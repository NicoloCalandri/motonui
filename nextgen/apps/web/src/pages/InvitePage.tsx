import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Loader2, Users } from 'lucide-react';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

/** Same shape the API checks (INVITE_TOKEN_PATTERN in src/lib/invites.ts): 32 random bytes, base64url. */
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const FALLBACK_ERROR = 'Ops! Qualcosa è andato storto 🏝️';

/**
 * /invite/:token — landing page of the partner invite email. Ported from
 * src/app/(app)/invite/[token]. It sits behind RequireAuth: an anonymous
 * visitor goes to login and comes back here.
 */
export function InvitePage() {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const { session } = useAuth();
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!INVITE_TOKEN_PATTERN.test(token)) {
        return (
            <div className="min-h-full flex items-center justify-center px-6 py-16">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-8 text-center space-y-4">
                    <h1 className="text-2xl font-bold text-neutral-900">Questo invito non è valido</h1>
                    <p className="text-sm text-neutral-500">Il link sembra incompleto. Chiedi al tuo partner di inviartene uno nuovo 🏝️</p>
                    <Link to="/dashboard" className="inline-block font-bold text-neutral-900 underline underline-offset-4">Vai alla dashboard</Link>
                </div>
            </div>
        );
    }

    const accept = async () => {
        setAccepting(true);
        setError(null);
        try {
            const body = await apiFetch<{ trip_id: string }>(
                '/api/invites/accept',
                { method: 'POST', body: JSON.stringify({ token }) },
                session?.access_token,
            );
            navigate(`/trips/${body.trip_id}`, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : FALLBACK_ERROR);
            setAccepting(false);
        }
    };

    return (
        <div className="min-h-full flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto bg-neutral-50 rounded-full flex items-center justify-center">
                    <Users className="w-10 h-10 text-neutral-900" aria-hidden="true" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 mb-2">Sei stato invitato a un viaggio</h1>
                    <p className="text-sm text-neutral-500">
                        Accetta per pianificare itinerario, spese e foto insieme al tuo partner.
                    </p>
                </div>

                {error && (
                    <p role="alert" className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
                        {error}
                    </p>
                )}

                <button
                    type="button"
                    onClick={accept}
                    disabled={accepting}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-neutral-900 hover:bg-black text-white rounded-2xl font-bold transition-all disabled:opacity-50"
                >
                    {accepting ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Check className="w-5 h-5" aria-hidden="true" />}
                    {accepting ? 'Un attimo...' : "Accetta l'invito"}
                </button>
            </div>
        </div>
    );
}
