import type { NextConfig } from 'next';

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
    experimental: {
        serverComponentsExternalPackages: ['sharp', 'exifr'],
    },
};

export default nextConfig;
