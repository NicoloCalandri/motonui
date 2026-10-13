import { createContext, useContext, useEffect, useState, type ReactNode, useRef } from 'react';
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
  // The profile, with the user it was loaded for: `profileLoading` is derived
  // from it, so there is no render in which a session exists, nothing is
  // loading and the profile is not there yet (a route guard would decide on it).
  const [loaded, setLoaded] = useState<{ userId: string; profile: SessionProfile | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userId = session?.user.id ?? null;
  const tokenRef = useRef<string | undefined>(undefined);
  tokenRef.current = session?.access_token;

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

  // Keyed on the user, not on the session object: Supabase hands out a new
  // object for the same user whenever the token is refreshed or the browser
  // tab becomes visible again, and reloading the profile then would unmount
  // every guarded page (and whatever the user was typing).
  useEffect(() => {
    if (!userId) { setLoaded(null); return; }
    let current = true;
    // Name, avatar, role and suspension, for the shell and the route guards.
    apiFetch<SessionProfile>('/api/session', {}, tokenRef.current)
      .then((profile) => { if (current) setLoaded({ userId, profile }); })
      .catch(() => { if (current) setLoaded({ userId, profile: null }); });
    return () => { current = false; };
  }, [userId]);

  const profile = loaded && loaded.userId === userId ? loaded.profile : null;
  const profileLoading = userId !== null && loaded?.userId !== userId;

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
