'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plane, Mail, Lock, User, Eye, EyeOff, Loader2, Github, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
//import { getAuthUser } from '@/lib/auth/get-user';

/**
 * Auth login page — magic link + Google OAuth sign-in.
 * Redirects to the /dashboard or the original requested page after auth.
 */
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDev, setIsDev] = useState(false);

    const supabase = createClient();
    const router = useRouter();
    
    useEffect(() => {
        setIsDev(process.env.NODE_ENV === 'development');
    }, []);
    

    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') ?? '/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        router.push(redirectTo);
        router.refresh();
    };

    const handleGoogle = async () => {
        setLoading(true);
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
            },
        });
        if (!isDev && authError) {
            setError('Errore con Google. Riprova.');
            setLoading(false);
        }
    };

    const handleDevLogin = async () => {
        setLoading(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email: 'test@example.com',
            password: 'password123',
        });

        if (authError) {
            setError('Errore Dev Login: ' + authError.message);
            setLoading(false);
            return;
        }

        router.push(redirectTo);
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">
            {/* Top Navigation Strip (TraWell style) */}
            <header className="h-20 bg-neutral-900 flex items-center justify-between px-8 z-50">
                <div className="flex items-center gap-2 text-white">
                    <Plane className="w-8 h-8" />
                    <span className="font-bold text-2xl tracking-tight">motonui</span>
                </div>
                <nav className="hidden lg:flex items-center gap-8">
                    {['Discover', 'Plan a trip', 'All tours', 'Check flights', 'Blog'].map(item => (
                        <button key={item} className="text-neutral-400 hover:text-white text-sm font-medium transition-colors">
                            {item}
                        </button>
                    ))}
                </nav>
                <div className="w-24" />
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* ─── Left Side: Form ─── */}
                <div className="flex-1 flex flex-col justify-center px-8 lg:px-24 bg-white relative">
                    <div className="max-w-md w-full mx-auto">
                        <div className="mb-10">
                            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-2 tracking-tight">Welcome Back!</h1>
                            <p className="text-neutral-400 font-medium">Log in to your account</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
                                    required
                                    className="w-full bg-gray-50 border-none py-4 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-neutral-200"
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
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

                            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300" />
                                    <span>Remember me</span>
                                </label>
                                <Link href="/auth/forgot-password">Password dimenticata?</Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-48 py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all mt-4"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Log in'}
                            </button>
                        </form>

                        {/* Development Bypass footer */}
                        {isDev && (
                            <div className="mt-12 pt-8 border-t border-dashed border-neutral-200">
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-4 text-center">
                                    Development Mode
                                </p>
                                <button
                                    onClick={handleDevLogin}
                                    disabled={loading}
                                    className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all border border-neutral-200 shadow-sm"
                                >
                                    Log in as test@example.com (Skip Auth)
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Right Side: Image ─── */}
                <div className="hidden lg:block lg:w-1/2 relative bg-neutral-900">
                    <img
                        src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2070"
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex flex-col justify-end p-20 text-white">
                        <h2 className="text-6xl font-bold mb-4 leading-tight tracking-tighter">Go around the world</h2>
                        <p className="text-lg text-white/70">Get a new experience with our exciting tours!</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
