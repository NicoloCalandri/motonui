import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignOutButton from './SignOutButton';

export const metadata = {
    title: 'Account sospeso – Motonui',
};

export default async function SuspendedPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Fetch suspension reason from profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('suspended_reason')
        .eq('id', user.id)
        .single();

    const reason = profile?.suspended_reason ?? null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="text-6xl mb-6">🏝️</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    Account temporaneamente sospeso
                </h1>
                <p className="text-gray-500 mb-4">
                    Il tuo account è stato temporaneamente sospeso e non puoi accedere all&apos;applicazione in questo momento.
                </p>

                {reason && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Motivo</p>
                        <p className="text-sm text-amber-800">{reason}</p>
                    </div>
                )}

                <p className="text-sm text-gray-500 mb-6">
                    Se ritieni che si tratti di un errore, contatta il supporto all&apos;indirizzo{' '}
                    <a
                        href="mailto:support@motonui.com"
                        className="text-blue-600 hover:underline font-medium"
                    >
                        support@motonui.com
                    </a>
                    .
                </p>

                <SignOutButton />

                <Link
                    href="/auth/login"
                    className="block mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                    Torna al login
                </Link>
            </div>
        </div>
    );
}
