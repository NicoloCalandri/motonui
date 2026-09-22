import { useState } from 'react';
import { Loader2, Ticket, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface BoardingPassFieldProps {
    tripId: string;
    dayId: string;
    legId: string;
    boardingPassUrl: string | null;
    onBoardingPassChange: (url: string | null) => void;
}

/**
 * Boarding-pass upload/remove control shown inside LegDrawer when editing a
 * flight leg. Extracted out of LegDrawer.tsx's `handleBoardingPassUpload`/
 * `handleBoardingPassRemove` + their JSX block (src/components/trip/LegDrawer.tsx,
 * ~90 lines combined) into its own file to keep LegDrawer.tsx under
 * docs/CLAUDE.md's 300-line-per-file rule — the old 648-line LegDrawer.tsx
 * was not split at all.
 *
 * Touchpoint changes from the old inline code:
 * - The upload/delete calls a `multipart/form-data` endpoint, which
 *   `apiFetch` can't be used for (it always forces a JSON `Content-Type`
 *   header when a body is present — see `lib/api-client.ts` — which would
 *   corrupt the multipart boundary). Kept as raw `fetch`, matching the old
 *   app's behavior, but with the bearer token from `useAuth()` attached
 *   manually as an `Authorization` header (the old Next.js app relied on a
 *   same-origin session cookie for this call instead; this app's API has no
 *   cookie auth — see `requireUser` in `nextgen/apps/api`, which only reads
 *   the `Authorization` header — so this header is required, not optional).
 * - Added a `catch` around both calls (old code only had `try`/`finally`)
 *   so a network failure is logged instead of becoming an unhandled promise
 *   rejection; behavior is otherwise identical — `finally` already reset
 *   the loading flag in the old code, so there was no stuck-button bug here.
 */
export default function BoardingPassField({ tripId, dayId, legId, boardingPassUrl, onBoardingPassChange }: BoardingPassFieldProps) {
    const { session } = useAuth();
    const token = session?.access_token;
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch(
                `/api/trips/${tripId}/days/${dayId}/legs/${legId}/boarding-pass`,
                {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body: form,
                }
            );
            if (res.ok) {
                const data = await res.json();
                onBoardingPassChange(data.boarding_pass_url ?? null);
            }
        } catch (err) {
            console.error('[motonui][BoardingPassField] failed to upload boarding pass', err);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemove = async () => {
        try {
            const res = await fetch(
                `/api/trips/${tripId}/days/${dayId}/legs/${legId}/boarding-pass`,
                {
                    method: 'DELETE',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }
            );
            if (res.ok) onBoardingPassChange(null);
        } catch (err) {
            console.error('[motonui][BoardingPassField] failed to remove boarding pass', err);
        }
    };

    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Carta d&apos;imbarco</label>
            {boardingPassUrl ? (
                <div className="flex items-center gap-3 p-4 bg-sage-50 rounded-2xl">
                    <Ticket className="w-5 h-5 text-sage-500 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-ink-700 truncate">Documento caricato</span>
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="text-xs font-bold text-red-500 hover:text-red-700"
                    >
                        Rimuovi
                    </button>
                </div>
            ) : (
                <label className="flex items-center justify-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer transition-colors">
                    {uploading
                        ? <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                        : <Upload className="w-5 h-5 text-neutral-400" />}
                    <span className="text-sm font-bold text-neutral-500">
                        {uploading ? 'Caricamento...' : 'Carica foto o PDF'}
                    </span>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                        className="sr-only"
                        onChange={handleUpload}
                        disabled={uploading}
                    />
                </label>
            )}
        </div>
    );
}
