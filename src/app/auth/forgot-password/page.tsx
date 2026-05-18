'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plane, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const supabase = createClient();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?redirect=/auth/reset-password`,
        });

        if (resetError) {
            setError(resetError.message);
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">
            {/* Top Navigation Strip */}
            <header className="h-20 bg-neutral-900 flex items-center justify-between px-8 z-50">
                <div className="flex items-center gap-2 text-white">
                    <Plane className="w-8 h-8" />
                    <span className="font-bold text-2xl tracking-tight">motonui</span>
                </div>
                <div className="w-24" />
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* ─── Left Side: Form ─── */}
                <div className="flex-1 flex flex-col justify-center px-8 lg:px-24 bg-white relative">
                    <div className="max-w-md w-full mx-auto">
                        <div className="mb-10">
                            <Link 
                                href="/auth/login" 
                                className="inline-flex items-center gap-2 text-gray-400 hover:text-neutral-900 font-bold text-xs uppercase tracking-widest mb-8 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Torna al login
                            </Link>
                            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-2 tracking-tight">Password dimenticata?</h1>
                            <p className="text-neutral-400 font-medium">Nessun problema, ti invieremo le istruzioni per il reset.</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        {success ? (
                            <div className="text-center p-8 bg-neutral-50 rounded-2xl border border-neutral-100">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-neutral-900 mb-2">Controlla la tua email</h3>
                                <p className="text-neutral-500 mb-6">
                                    Abbiamo inviato un link per il reset della password a <span className="font-bold text-neutral-900">{email}</span>.
                                </p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="text-neutral-900 font-bold text-sm underline underline-offset-4"
                                >
                                    Non hai ricevuto l'email? Riprova
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleReset} className="space-y-4">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Inserisci la tua email"
                                        required
                                        className="w-full bg-gray-50 border-none py-4 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-neutral-200"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all mt-4"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Invia Link di Reset'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* ─── Right Side: Image ─── */}
                <div className="hidden lg:block lg:w-1/2 relative bg-neutral-900">
                    <img
                        src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=2070"
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex flex-col justify-end p-20 text-white">
                        <h2 className="text-6xl font-bold mb-4 leading-tight tracking-tighter">Trova la tua pace</h2>
                        <p className="text-lg text-white/70">Reimposta la tua password e continua il tuo viaggio.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
