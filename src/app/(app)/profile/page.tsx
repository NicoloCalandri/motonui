'use client';

import { Loader2 } from 'lucide-react';
import ProfileContent from '@/components/profile/ProfileContent';
import { useProfile, useProfileStats, type ProfileResponse } from '@/lib/hooks/use-profile';

export default function ProfilePage() {
    const { data: profile, isLoading, mutate } = useProfile();
    const { data: stats } = useProfileStats();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
            </div>
        );
    }

    // Saved changes go into the shared cache, so the app shell updates too.
    const updateProfile = (updates: Partial<ProfileResponse>) => {
        void mutate((prev) => (prev ? { ...prev, ...updates } : prev), { revalidate: false });
    };

    return (
        <ProfileContent
            key={profile?.id ?? 'none'}
            profile={profile ?? null}
            stats={stats ?? { trips: 0, posts: 0 }}
            onProfileChange={updateProfile}
        />
    );
}
