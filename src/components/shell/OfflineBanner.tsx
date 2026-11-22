'use client';

import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(onChange: () => void): () => void {
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
    };
}

const isOffline = () => !navigator.onLine;
// The server never renders the banner: no flash of "offline" on hydration.
const onServer = () => false;

/**
 * The app is used while travelling, often with poor or no signal (audit
 * B5.59). When the browser goes offline a banner says so, so a failed save is
 * not a mystery; it disappears by itself when the connection is back.
 */
export default function OfflineBanner() {
    const offline = useSyncExternalStore(subscribe, isOffline, onServer);
    if (!offline) return null;
    return (
        <div role="status" aria-live="polite" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ink-800 px-4 py-2 text-sm text-white">
            <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>Sei senza rete 🏝️ Vedi l&apos;ultima versione caricata: le modifiche si salvano quando torna la connessione, riprova tra poco.</span>
        </div>
    );
}
