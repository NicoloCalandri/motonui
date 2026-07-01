import type { Metadata } from 'next';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="it" className={`${figtree.variable} ${playfair.variable}`}>
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}
