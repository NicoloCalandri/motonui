/**
 * Open Graph card for a blog post (T-5.4), rendered to PNG by `next/og`.
 * Satori supports a subset of CSS: inline styles only, and every element
 * with more than one child needs `display: flex`.
 */
export interface PostOgCardProps {
    title: string;
    description?: string | null;
    publishedAt?: string | null;
    readingTime?: number | null;
}

export const OG_SIZE = { width: 1200, height: 630 } as const;

const SAND = '#FDFAF4';
const INK = '#2B211C';
const TERRACOTTA = '#A34F23';

/** Clips text to `max` characters on a word boundary. */
export function clip(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function PostOgCard({ title, description, publishedAt, readingTime }: PostOgCardProps) {
    const meta = [publishedAt ? formatDate(publishedAt) : null, readingTime ? `${readingTime} min di lettura` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '64px 72px',
                background: `linear-gradient(135deg, ${SAND} 0%, #F5D8CC 100%)`,
                color: INK,
                fontFamily: 'sans-serif',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: TERRACOTTA, letterSpacing: 2 }}>
                motonui · blog di viaggio
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: title.length > 60 ? 60 : 72, fontWeight: 700, lineHeight: 1.1 }}>
                    {clip(title, 110)}
                </div>
                {description ? (
                    <div style={{ display: 'flex', marginTop: 28, fontSize: 30, lineHeight: 1.35, color: '#3D322D' }}>
                        {clip(description, 160)}
                    </div>
                ) : null}
            </div>

            <div style={{ display: 'flex', fontSize: 26, color: '#6B5E56' }}>{meta || 'Storie di viaggio di Nicolò e Giorgia'}</div>
        </div>
    );
}
