import type { MetadataRoute } from 'next';
import { getAppBaseUrl } from '@/lib/url';

/** /robots.txt (T-5.2): only the landing page and the public blog are indexable. */
export default function robots(): MetadataRoute.Robots {
    const base = getAppBaseUrl();
    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/blog'],
            disallow: ['/api/', '/auth/', '/admin', '/dashboard', '/trips', '/profile', '/invite', '/suspended'],
        },
        sitemap: new URL('/sitemap.xml', base).toString(),
    };
}
