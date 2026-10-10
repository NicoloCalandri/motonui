import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Figtree, Playfair_Display } from 'next/font/google';
import './globals.css';
import { getAppBaseUrl } from '@/lib/url';

const figtree = Figtree({
    subsets: ['latin'],
    variable: '--font-figtree',
});

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
});

export const metadata: Metadata = {
    title: { default: 'motonui', template: '%s — motonui' },
    description: 'Il tuo compagno di viaggio di coppia. Pianifica, ricorda, condividi.',
    metadataBase: getAppBaseUrl(),
};

/**
 * Reading the request headers makes every page render per request, so
 * Next.js can stamp the CSP nonce set by middleware.ts on its scripts
 * (T-4.4): a prerendered page would carry no nonce and be blocked.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
    await headers();
    return (
        <html lang="it" className={`${figtree.variable} ${playfair.variable}`}>
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}
