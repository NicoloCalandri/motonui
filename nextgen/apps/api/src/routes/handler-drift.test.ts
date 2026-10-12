import { describe, expect, it } from 'vitest';
import { RESOURCES, compare, fingerprint, nextFilesFor } from '../../../../scripts/handler-drift.mjs';

/**
 * Route handlers are written by hand for Hono, so they cannot be compared
 * with the Next.js ones line by line. This test compares what they mention:
 * tables, RPCs, schema fields with their rules, library functions and
 * user-facing messages. A change in a Next.js handler that touches any of
 * those fails here until the Hono handler follows, or until the difference is
 * listed in ACCEPTED with its reason. To see the report, run in nextgen/:
 *
 *     node scripts/handler-drift.mjs
 *
 * It is evidence, not proof: two handlers can mention the same things and
 * still use them differently.
 */

type Side = { onlyNext?: string[]; onlyHono?: string[] };

/** Differences that are intended, by Hono route file. */
const ACCEPTED: Record<string, Record<string, Side & { why: string }>> = {
    'trips-boarding-pass.ts': {
        functions: {
            onlyNext: ['legacyBoardingPassPath'],
            onlyHono: ['removeLegFiles'],
            why: 'Hono removes the previous files with removeLegFiles (lib/trip-storage), which does what the local helper of the Next.js route does',
        },
        messages: {
            onlyNext: ['Carica un\\'],
            onlyHono: ["Carica un'immagine (JPEG, PNG, WebP, HEIC) o un PDF."],
            why: 'same message: the Next.js source escapes the apostrophe, which cuts the match',
        },
    },
    'trips-documents.ts': {
        fields: {
            onlyNext: ["query: z.object({ download: z.literal('1').optional() })"],
            why: 'withRoute option, not a schema field: Hono reads ?download=1 with c.req.query',
        },
    },
    'expenses.ts': {
        functions: {
            onlyHono: ['convertCurrency'],
            why: 'the Next.js route imports it dynamically, so it is not in its import list',
        },
    },
    'admin/features.ts': {
        messages: {
            onlyHono: ['payload non valido'],
            why: 'Hono answers a non-object body with the standard validation error (A2)',
        },
    },
};

describe('handler drift', () => {
    it('maps every Next.js route file to a Hono route file, once', () => {
        const all = nextFilesFor(['']).filter((file) => file.endsWith('/route.ts'));
        const mapped = Object.values(RESOURCES).flatMap((patterns) => nextFilesFor(patterns).filter((file) => file.endsWith('/route.ts')));

        expect(all.filter((file) => !mapped.includes(file))).toEqual([]);
        expect(mapped.filter((file, index) => mapped.indexOf(file) !== index)).toEqual([]);
    });

    it.each(Object.keys(RESOURCES))('%s does what its Next.js routes do', (resource) => {
        const { diff } = compare(resource);
        const accepted = ACCEPTED[resource] ?? {};
        const expected = Object.fromEntries(
            Object.entries(accepted).map(([key, { onlyNext = [], onlyHono = [] }]) => [key, { onlyNext, onlyHono }]),
        );

        expect(diff).toEqual(expected);
    });

    it('explains every accepted difference', () => {
        for (const [resource, kinds] of Object.entries(ACCEPTED)) {
            expect(Object.keys(RESOURCES)).toContain(resource);
            for (const { why } of Object.values(kinds)) expect(why.length).toBeGreaterThan(20);
        }
    });
});

describe('fingerprint', () => {
    const source = `
        import { convertCurrency } from '@/lib/expenses';
        import { withRoute } from '@/lib/api/with-route';
        const Schema = z.object({
            title: z.string().min(1).max(200),
            link: httpsUrl,
        });
        await supabase.from('trips').select('*');
        await supabase.rpc('create_trip', {});
        throw Errors.validation('non puoi invitare te stesso.');
    `;

    it('reads tables, RPCs, schema rules, library functions and messages', () => {
        const print = fingerprint(source);

        expect([...print.tables]).toEqual(['trips']);
        expect([...print.rpcs]).toEqual(['create_trip']);
        expect([...print.fields]).toEqual(['title: z.string().min(1).max(200)', 'link: httpsUrl']);
        expect([...print.functions]).toEqual(['convertCurrency']);
        expect([...print.messages]).toEqual(['non puoi invitare te stesso.']);
    });

    it('sees a changed rule as a different field', () => {
        const changed = fingerprint(source.replace('max(200)', 'max(500)'));

        expect([...changed.fields]).not.toEqual([...fingerprint(source).fields]);
    });
});
