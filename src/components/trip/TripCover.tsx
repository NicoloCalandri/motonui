/**
 * Trip cover: the uploaded `cover_image`, or a local "nautical chart" drawn
 * from the trip id (same id, same chart). No external image request.
 */
interface TripCoverProps {
    tripId: string;
    coverImage: string | null;
    /** Empty when decorative: the title is already next to the image. */
    alt?: string;
    className?: string;
}

const W = 400;
const H = 300;

/** FNV-1a: a small, stable hash so the chart depends only on the id. */
function hash(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Deterministic pseudo-random numbers in [0, 1) seeded by the hash (mulberry32). */
function seeded(seed: number): () => number {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A closed, wobbly ring around (cx, cy): one isobath. */
function isobath(cx: number, cy: number, r: number, wobble: number[], phase: number): string {
    const steps = 48;
    const points = Array.from({ length: steps }, (_, i) => {
        const a = (i / steps) * Math.PI * 2;
        const k = wobble.reduce((acc, amp, j) => acc + amp * Math.sin((j + 2) * a + phase * (j + 1)), 0);
        const rr = r * (1 + k);
        return [cx + rr * Math.cos(a) * 1.25, cy + rr * Math.sin(a)];
    });
    return `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}

export function NauticalChart({ tripId, label, className }: { tripId: string; label?: string; className?: string }) {
    const rand = seeded(hash(tripId));
    const cx = 120 + rand() * 160;
    const cy = 90 + rand() * 120;
    const wobble = [0.05 + rand() * 0.06, 0.03 + rand() * 0.04, 0.01 + rand() * 0.03];
    const phase = rand() * Math.PI * 2;
    const rings = [30, 58, 88, 122, 160, 204];
    const ticks = Array.from({ length: 19 }, (_, i) => i);

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid slice"
            className={className}
            {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
            focusable="false"
        >
            <rect width={W} height={H} fill="#0E2A33" />
            {rings.map((r, i) => (
                <path
                    key={r}
                    d={isobath(cx, cy, r, wobble, phase + i * 0.35)}
                    fill="none"
                    stroke="#3E8A8F"
                    strokeWidth={i % 3 === 2 ? 1.4 : 0.9}
                    strokeOpacity={0.6 - i * 0.05}
                />
            ))}
            <circle cx={cx} cy={cy} r={16} fill="#F2A93B" fillOpacity={0.18} />
            <circle cx={cx} cy={cy} r={8} fill="#F2A93B" fillOpacity={0.3} />
            <circle cx={cx} cy={cy} r={3.5} fill="#F2A93B" />
            <rect x={10} y={10} width={W - 20} height={H - 20} fill="none" stroke="#3E8A8F" strokeOpacity={0.5} />
            {ticks.map((i) => {
                const x = 10 + ((W - 20) / 18) * i;
                const len = i % 3 === 0 ? 7 : 4;
                return (
                    <g key={i} stroke="#3E8A8F" strokeOpacity={0.5}>
                        <line x1={x} y1={10} x2={x} y2={10 + len} />
                        <line x1={x} y1={H - 10} x2={x} y2={H - 10 - len} />
                    </g>
                );
            })}
            {ticks.slice(0, 14).map((i) => {
                const y = 10 + ((H - 20) / 13) * i;
                const len = i % 3 === 0 ? 7 : 4;
                return (
                    <g key={i} stroke="#3E8A8F" strokeOpacity={0.5}>
                        <line x1={10} y1={y} x2={10 + len} y2={y} />
                        <line x1={W - 10} y1={y} x2={W - 10 - len} y2={y} />
                    </g>
                );
            })}
        </svg>
    );
}

export default function TripCover({ tripId, coverImage, alt = '', className = '' }: TripCoverProps) {
    if (coverImage) {
        return <img src={coverImage} alt={alt} className={`object-cover ${className}`} />;
    }
    return <NauticalChart tripId={tripId} label={alt || undefined} className={className} />;
}
