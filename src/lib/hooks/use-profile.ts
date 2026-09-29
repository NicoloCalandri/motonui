import useSWR from 'swr';
import { jsonFetcher } from '@/lib/fetcher';

export type ProfileResponse = { id: string; email: string | null; fullName: string; avatarUrl: string | null };
export type ProfileStats = { trips: number; posts: number };

/** Current user's profile. Shared key: the app shell and the profile page see the same data. */
export function useProfile() {
    return useSWR<ProfileResponse>('/api/profile', jsonFetcher);
}

export function useProfileStats() {
    return useSWR<ProfileStats>('/api/profile/stats', jsonFetcher);
}
