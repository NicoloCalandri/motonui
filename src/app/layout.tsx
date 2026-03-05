import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: { default: 'motonui', template: '%s — motonui' },
    description: 'Il tuo compagno di viaggio di coppia. Pianifica, ricorda, condividi.',
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="it">
            <body className="font-sans">{children}</body>
        </html>
    );
}
