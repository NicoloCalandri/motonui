import { ImageResponse } from 'next/og';
import { OG_SIZE, PostOgCard } from '@/components/blog/post-og-card';

/** Open Graph image for the blog index (T-5.4). */
export const alt = 'Il blog di viaggio di motonui';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
    return new ImageResponse(
        <PostOgCard title="Il nostro diario di viaggio" description="Storie, fotografie e riflessioni dai nostri viaggi in giro per il mondo." />,
        { ...size },
    );
}
