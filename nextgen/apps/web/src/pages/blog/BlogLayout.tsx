import { Link, Outlet } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

/**
 * Public blog shell: visitors and signed-in users see the same page.
 * Ported from src/app/(public)/blog/layout.tsx.
 */
export function BlogLayout() {
    return (
        <div className="min-h-screen flex flex-col bg-sand-50">
            <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
                <nav aria-label="Navigazione del blog" className="max-w-5xl mx-auto flex items-center justify-between px-4 h-16">
                    <Link to="/" className="font-display text-xl font-bold text-ink-900 tracking-tight">
                        motonui
                    </Link>
                    <div className="flex items-center gap-5 text-sm">
                        <Link to="/blog" className="flex items-center gap-1.5 text-ink-500 hover:text-ink-900 transition-colors">
                            <BookOpen className="w-4 h-4" aria-hidden="true" />
                            Blog
                        </Link>
                        <Link to="/dashboard" className="text-terracotta-500 hover:text-terracotta-600 font-medium transition-colors">
                            I miei viaggi
                        </Link>
                    </div>
                </nav>
            </header>

            <main className="flex-1 w-full px-4 pt-10">
                <Outlet />
            </main>

            <footer className="border-t border-sand-200 py-8 text-center text-xs text-ink-400">
                motonui — storie di viaggio di Nicolò e Giorgia
            </footer>
        </div>
    );
}
