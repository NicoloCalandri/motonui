'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plane, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/auth/login');
            }
        };
        checkSession();
    }, [supabase, router]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('Le password non coincidono');
            return;
        }

        setLoading(true);
        setError(null);

        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        if (updateError) {
            setError(updateError.message);
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
        
        // Redirect to login after a short delay
        setTimeout(() => {
            router.push('/auth/login');
        }, 3000);
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
                            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-2 tracking-tight">Nuova Password</h1>
                            <p className="text-neutral-400 font-medium">Inserisci la tua nuova password qui sotto.</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        {success ? (
                            <div className="text-center p-8 bg-neutral-50 rounded-2xl border border-neutral-100">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-neutral-900 mb-2">Password Aggiornata!</h3>
                                <p className="text-neutral-500">
                                    La tua password è stata reimpostata con successo. Ti stiamo reindirizzando al login...
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleReset} className="space-y-4">
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Nuova Password"
                                        required
                                        className="w-full bg-gray-50 border-none py-4 pl-12 pr-12 rounded-xl text-sm focus:ring-2 focus:ring-neutral-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>

                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Conferma Nuova Password"
                                        required
                                        className="w-full bg-gray-50 border-none py-4 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-neutral-200"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all mt-4"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Reimposta Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* ─── Right Side: Image ─── */}
                <div className="hidden lg:block lg:w-1/2 relative bg-neutral-900">
                    <img
                        src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2073"
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex flex-col justify-end p-20 text-white">
                        <h2 className="text-6xl font-bold mb-4 leading-tight tracking-tighter">La tua sicurezza prima di tutto</h2>
                        <p className="text-lg text-white/70">Proteggi il tuo account con una password robusta.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
