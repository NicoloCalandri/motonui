import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    href: string;
    children?: ReactNode;
    /** Accepted and ignored: the SPA has nothing to prefetch. */
    prefetch?: boolean;
}

const INTERNAL = /^\/(?!\/)/;

/**
 * Stands in for `next/link` in components copied from the Next.js app
 * (scripts/port-lib.mjs rewrites the import). A path of this app is a router
 * link; anything else (another site, mailto:, an anchor) is a plain `<a>`.
 */
export default function Link({ href, prefetch: _prefetch, children, ...rest }: LinkProps) {
    if (!INTERNAL.test(href)) {
        return <a href={href} {...rest}>{children}</a>;
    }
    return <RouterLink to={href} {...rest}>{children}</RouterLink>;
}
