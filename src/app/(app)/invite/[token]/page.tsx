import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { INVITE_TOKEN_PATTERN } from '@/lib/invites';
import AcceptInvite from './accept-invite';

// The token is a credential: keep the page out of indexes and caches.
export const metadata: Metadata = { title: 'Invito · motonui', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

interface InvitePageProps {
    params: Promise<{ token: string }>;
}

/**
 * /invite/[token] — landing page of the partner invite email (T-2.5).
 * The middleware sends anonymous visitors to login and back here.
 */
export default async function InvitePage({ params }: InvitePageProps) {
    const { token } = await params;
    if (!INVITE_TOKEN_PATTERN.test(token)) notFound();
    return <AcceptInvite token={token} />;
}
