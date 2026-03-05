'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plane, Mail, Loader2 } from 'lucide-react';

/**
 * Auth login page — magic link + Google OAuth sign-in.
 * Redirects to the /dashboard or the original requested page after auth.
 */
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') ?? '/dashboard';

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
            },
        });

        setLoading(false);

        if (authError) {
            setError('Non riusciamo a inviare il link. Controlla la tua email e riprova.');
            return;
        }

        setSent(true);
    };

    const handleGoogle = async () => {
        setGoogleLoading(true);
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
            },
        });
        if (authError) {
            setError('Errore con Google. Riprova.');
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen paper-bg flex flex-col items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-terracotta-100/50 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sage-100/50 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-terracotta-400 rounded-2xl mb-4 shadow-card">
                        <Plane className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-display text-4xl font-bold text-ink-900">motonui</h1>
                    <p className="text-ink-400 mt-2 text-sm">
                        Il tuo diari di viaggio di coppia
                    </p>
                </div>

                {/* Card */}
                <div className="card p-8">
                    {sent ? (
                        /* Sent state */
                        <div className="text-center py-4">
                            <div className="w-14 h-14 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail className="w-7 h-7 text-sage-400" />
                            </div>
                            <h2 className="font-display text-2xl font-semibold text-ink-900 mb-2">
                                Controlla la tua email!
                            </h2>
                            <p className="text-ink-400 text-sm leading-relaxed">
                                Abbiamo inviato un link magico a <strong className="text-ink-600">{email}</strong>.
                                Clicca il link per accedere.
                            </p>
                            <button
                                onClick={() => { setSent(false); setEmail(''); }}
                                className="mt-6 text-terracotta-400 text-sm hover:underline"
                            >
                                Usa un altra email
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1">
                                Bentornati 👋
                            </h2>
                            <p className="text-ink-400 text-sm mb-6">
                                Accedi per continuare il vostro viaggio
                            </p>

                            {error && (
                                <div className="mb-4 p-3 bg-terracotta-50 border border-terracotta-200 rounded-xl text-terracotta-600 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Magic link form */}
                            <form onSubmit={handleMagicLink} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1.5">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nicolò@example.com"
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60 focus:border-terracotta-400 transition-colors"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-900 hover:bg-ink-500 text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    Invia link magico
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="my-6 flex items-center gap-3">
                                <div className="flex-1 h-px bg-sand-200" />
                                <span className="text-ink-300 text-xs">oppure</span>
                                <div className="flex-1 h-px bg-sand-200" />
                            </div>

                            {/* Google OAuth */}
                            <button
                                onClick={handleGoogle}
                                disabled={googleLoading}
                                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-sand-300 hover:bg-sand-50 text-ink-700 rounded-xl font-medium transition-colors duration-150 disabled:opacity-50"
                            >
                                {googleLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                )}
                                Continua con Google
                            </button>
                        </>
                    )}
                </div>

                <p className="text-center text-ink-300 text-xs mt-6">
                    Point Nemo è il luogo più solitario della Terra — <br />
                    ma <em>motonui</em> rende ogni viaggio come a casa.
                </p>
            </div>
        </div>
    );
}
