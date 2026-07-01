import Link from 'next/link';
import { Home, Compass } from 'lucide-react';

/**
 * Custom 404 page for Motonui.
 * Shows a premium "Lost at sea" message with a link back to safety.
 */
export default function NotFound() {
    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 text-center">
            {/* 404 Visual */}
            <div className="relative mb-8">
                <span className="text-[12rem] font-black text-gray-100 select-none">404</span>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Compass className="w-24 h-24 text-terracotta-400 animate-float" />
                </div>
            </div>

            <h1 className="font-display text-4xl font-bold text-ink-900 mb-4 tracking-tight">
                Persi nell&apos;oceano? 🌊
            </h1>
            <p className="text-ink-muted max-w-md mb-10 leading-relaxed font-medium">
                Sembra che la rotta che stai seguendo non porti a nessuna terra emersa. Torna alla dashboard per riprendere il viaggio.
            </p>

            <Link 
                href="/dashboard"
                className="flex items-center gap-2 px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold shadow-panel hover:bg-black transition-all active:scale-95"
            >
                <Home className="w-5 h-5" />
                Torna alla Dashboard
            </Link>
        </div>
    );
}
