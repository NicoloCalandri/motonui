import { useState } from 'react';
import { Loader2, Ticket, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { hasBoardingPass } from '../../lib/boarding-pass';

interface BoardingPassFieldProps {
    tripId: string;
    dayId: string;
    legId: string;
    /** Whether the leg has a boarding pass: the file itself is never needed here. */
    uploaded: boolean;
    onUploadedChange: (uploaded: boolean) => void;
}

const FALLBACK_ERROR = 'Ops! Non riusciamo a caricare la carta d’imbarco. Riprova tra poco 🏝️';

/**
 * Upload and removal of a leg's boarding pass, inside LegDrawer.
 *
 * `apiFetch` forces a JSON Content-Type when there is a body, which would
 * break the multipart boundary: the two calls use `fetch` with the bearer
 * token attached by hand. The API stores the file in a private bucket and
 * answers with the leg (`boarding_pass_path` set, `boarding_pass_url` null).
 */
export default function BoardingPassField({ tripId, dayId, legId, uploaded, onUploadedChange }: BoardingPassFieldProps) {
    const { session } = useAuth();
    const token = session?.access_token;
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const route = `/api/trips/${tripId}/days/${dayId}/legs/${legId}/boarding-pass`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const messageOf = async (res: Response) => {
        const body: unknown = await res.json().catch(() => null);
        const message = body && typeof body === 'object' && 'error' in body ? body.error : null;
        return typeof message === 'string' ? message : FALLBACK_ERROR;
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch(route, { method: 'POST', headers, body: form });
            if (res.ok) onUploadedChange(hasBoardingPass(await res.json()));
            else setError(await messageOf(res));
        } catch {
            setError(FALLBACK_ERROR);
        } finally {
            setUploading(false);
            input.value = '';
        }
    };

    const handleRemove = async () => {
        setError(null);
        try {
            const res = await fetch(route, { method: 'DELETE', headers });
            if (res.ok) onUploadedChange(false);
            else setError(await messageOf(res));
        } catch {
            setError(FALLBACK_ERROR);
        }
    };

    return (
        <div>
            <p className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Carta d&apos;imbarco</p>
            {uploaded ? (
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
            {error && <p role="alert" className="mt-2 text-xs font-medium text-red-500">{error}</p>}
        </div>
    );
}
