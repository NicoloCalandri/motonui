'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Users } from 'lucide-react';

interface AcceptInviteProps {
    token: string;
}

/** Accepts a partner invite (T-2.5) and opens the trip. */
export default function AcceptInvite({ token }: AcceptInviteProps) {
    const router = useRouter();
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const accept = async () => {
        setAccepting(true);
        setError(null);
        try {
            const res = await fetch('/api/invites/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const body: { trip_id?: string; error?: string } = await res.json();
            if (!res.ok || !body.trip_id) throw new Error(body.error ?? 'Ops! Qualcosa è andato storto 🏝️');
            router.replace(`/trips/${body.trip_id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ops! Qualcosa è andato storto 🏝️');
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
