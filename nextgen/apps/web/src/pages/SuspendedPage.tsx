import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

/**
 * /suspended — where a suspended user lands. Ported from
 * src/app/(public)/suspended (page.tsx and SignOutButton.tsx): there the page
 * is a server component that reads the reason from `profiles`; here the
 * reason comes with the session (`GET /api/session`).
 */
export function SuspendedPage() {
    const { user, profile, isLoading, signOut } = useAuth();
    const navigate = useNavigate();

    if (isLoading) return null;
    if (!user) return <Navigate to="/auth/login" replace />;

    const reason = profile?.suspended_reason ?? null;

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="text-6xl mb-6" aria-hidden="true">🏝️</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    Il tuo account è in pausa
                </h1>
                <p className="text-gray-500 mb-4">
                    Il tuo account è stato sospeso: per ora non puoi entrare in motonui.
                </p>

                {reason && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Motivo</p>
                        <p className="text-sm text-amber-800">{reason}</p>
                    </div>
                )}

                <p className="text-sm text-gray-500 mb-6">
                    Se pensi che sia un errore, scrivici a{' '}
                    <a href="mailto:support@motonui.com" className="text-blue-600 hover:underline font-medium">
                        support@motonui.com
                    </a>
                    .
                </p>

                <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Esci dall&apos;account
                </button>

                <Link to="/auth/login" className="block mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Torna al login
                </Link>
            </div>
        </div>
    );
}
