/**
 * T-0.9 — Move boarding passes from the public `trip-media` bucket to the
 * private `trip-documents` bucket, then delete every remaining public copy
 * (including orphans left by the old DELETE route, which never removed files).
 *
 * Requires migration 0017 applied. Dry run by default:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run storage:migrate-boarding-passes
 *   ... npm run storage:migrate-boarding-passes -- --apply
 *
 * Idempotent: migrated legs have boarding_pass_url = null and are skipped.
 */
import { createClient } from '@supabase/supabase-js';
import {
    LEGACY_PUBLIC_BUCKET,
    TRIP_DOCUMENTS_BUCKET,
    boardingPassExtension,
    boardingPassPrefix,
    buildBoardingPassPath,
    isBoardingPassPathForTrip,
    legacyBoardingPassPath,
} from '../src/lib/boarding-pass';

interface LegRow {
    id: string;
    trip_id: string;
    boarding_pass_url: string | null;
    boarding_pass_path: string | null;
}

const apply = process.argv.includes('--apply');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

function log(message: string): void {
    console.log(`${apply ? '[apply]' : '[dry-run]'} ${message}`);
}

async function migrateLeg(leg: LegRow): Promise<'moved' | 'skipped'> {
    const legacyPath = legacyBoardingPassPath(leg.boarding_pass_url, supabaseUrl!);
    if (!isBoardingPassPathForTrip(legacyPath, leg.trip_id)) {
        log(`leg ${leg.id}: boarding_pass_url is not a trip-media boarding pass of trip ${leg.trip_id}, skipped`);
        return 'skipped';
    }

    const { data: file, error: downloadError } = await supabase.storage.from(LEGACY_PUBLIC_BUCKET).download(legacyPath);
    if (downloadError || !file) {
        log(`leg ${leg.id}: download of ${legacyPath} failed (${downloadError?.message ?? 'empty'}), skipped`);
        return 'skipped';
    }

    const extension = boardingPassExtension(file.type) ?? legacyPath.split('.').pop()?.toLowerCase() ?? 'bin';
    const newPath = buildBoardingPassPath(leg.trip_id, leg.id, extension);
    log(`leg ${leg.id}: ${LEGACY_PUBLIC_BUCKET}/${legacyPath} -> ${TRIP_DOCUMENTS_BUCKET}/${newPath}`);
    if (!apply) return 'moved';

    const { error: uploadError } = await supabase.storage
        .from(TRIP_DOCUMENTS_BUCKET)
        .upload(newPath, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw new Error(`upload ${newPath}: ${uploadError.message}`);

    const { error: updateError } = await supabase
        .from('legs')
        .update({ boarding_pass_path: newPath, boarding_pass_url: null })
        .eq('id', leg.id);
    if (updateError) {
        await supabase.storage.from(TRIP_DOCUMENTS_BUCKET).remove([newPath]);
        throw new Error(`update leg ${leg.id}: ${updateError.message}`);
    }

    const { error: removeError } = await supabase.storage.from(LEGACY_PUBLIC_BUCKET).remove([legacyPath]);
    if (removeError) log(`leg ${leg.id}: could not remove ${legacyPath}: ${removeError.message} (the cleanup pass retries)`);
    return 'moved';
}

async function listTripIdsWithFolders(): Promise<string[]> {
    const ids: string[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.storage.from(LEGACY_PUBLIC_BUCKET).list('trips', { limit: 1000, offset });
        if (error) throw new Error(`list trips/: ${error.message}`);
        ids.push(...(data ?? []).map((entry) => entry.name));
        if (!data || data.length < 1000) return ids;
    }
}

/** Deletes every file still under trip-media/trips/{id}/boarding-passes/. */
async function removePublicLeftovers(): Promise<number> {
    let removed = 0;
    for (const tripId of await listTripIdsWithFolders()) {
        const prefix = boardingPassPrefix(tripId);
        const { data, error } = await supabase.storage.from(LEGACY_PUBLIC_BUCKET).list(prefix.slice(0, -1), { limit: 1000 });
        if (error) throw new Error(`list ${prefix}: ${error.message}`);
        const paths = (data ?? []).map((entry) => `${prefix}${entry.name}`).filter((path) => isBoardingPassPathForTrip(path, tripId));
        if (paths.length === 0) continue;

        paths.forEach((path) => log(`remove public leftover ${LEGACY_PUBLIC_BUCKET}/${path}`));
        if (apply) {
            const { error: removeError } = await supabase.storage.from(LEGACY_PUBLIC_BUCKET).remove(paths);
            if (removeError) throw new Error(`remove under ${prefix}: ${removeError.message}`);
        }
        removed += paths.length;
    }
    return removed;
}

async function main(): Promise<void> {
    const { data: legs, error } = await supabase
        .from('legs')
        .select('id, trip_id, boarding_pass_url, boarding_pass_path')
        .not('boarding_pass_url', 'is', null);
    if (error) throw new Error(`select legs: ${error.message}`);

    let moved = 0;
    let skipped = 0;
    for (const leg of (legs ?? []) as LegRow[]) {
        if ((await migrateLeg(leg)) === 'moved') moved += 1;
        else skipped += 1;
    }

    // A skipped leg may still reference its public file (e.g. a transient
    // download error): never delete leftovers until every leg has moved.
    if (skipped > 0) {
        log(`legs moved: ${moved}, skipped: ${skipped}; public cleanup not run, fix the skipped legs and re-run`);
        process.exitCode = 2;
        return;
    }

    const leftovers = await removePublicLeftovers();

    log(`legs moved: ${moved}, public files removed: ${leftovers}`);
    if (!apply) log('nothing changed; re-run with --apply');
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
