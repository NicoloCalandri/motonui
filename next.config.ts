import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// In dev, also allow local Supabase (http://127.0.0.1:54321)
const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'https://api.mapbox.com',
    'https://events.mapbox.com',
    'https://*.mapbox.com',
    'https://api.anthropic.com',
    ...(isDev ? ['http://127.0.0.1:54321', 'ws://127.0.0.1:54321'] : []),
].join(' ');

const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self';` },
];

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/sign/**',
            },
        ],
    },
    serverExternalPackages: ['sharp', 'exifr'],
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
