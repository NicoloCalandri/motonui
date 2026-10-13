import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { apiFetch } from './api-client';
import type { Profile } from '@motonui/shared-types';

/** What GET /api/session returns: the part of the profile the web app reads. */
export type SessionProfile = Pick<Profile, 'display_name' | 'avatar_url' | 'role' | 'suspended_at' | 'suspended_reason'> & {
  id: string;
  email: string | null;
};

interface AuthValue {
  user: User | null;
  session: Session | null;
  profile: SessionProfile | null;
  isLoading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    }).catch(() => {
      setSession(null);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    // Name, avatar, role and suspension, for the shell and the route guards.
    apiFetch<SessionProfile>('/api/session', {}, session.access_token)
      .then((p) => { setProfile(p); setProfileLoading(false); })
      .catch(() => { setProfile(null); setProfileLoading(false); });
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, profile, isLoading, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
