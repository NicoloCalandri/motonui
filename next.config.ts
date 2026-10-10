import type { NextConfig } from 'next';
import { assertNoAdminBypassInProduction } from './src/lib/auth/admin-bypass';

// Refuse to build or start with the admin auth bypass in production (T-1.10).
assertNoAdminBypassInProduction();

const isDev = process.env.NODE_ENV === 'development';

/**
 * Static security headers: the only place they are set (T-4.4). The
 * Content-Security-Policy needs a per-request nonce and is set in
 * middleware.ts (src/lib/csp.ts).
 */
const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
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
            ...(isDev ? [{
                protocol: 'http',
                hostname: '127.0.0.1',
                port: '54321',
                pathname: '/storage/v1/object/public/**',
            } as const] : []),
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
