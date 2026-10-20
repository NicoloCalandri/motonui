'use client';

import { Share2 } from 'lucide-react';

export default function ShareButton({ title }: { title: string }) {
    return (
        <button
            type="button"
            aria-label="Condividi il post"
            onClick={() => navigator.share?.({ title, url: window.location.href })}
            className="flex items-center gap-1.5 text-ink-400 hover:text-ink-700 text-sm transition-colors"
        >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Condividi</span>
        </button>
    );
}
