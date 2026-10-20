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

async function syncSessionCookie(method: 'POST' | 'DELETE', token: string | undefined): Promise<void> {
  try {
    await apiFetch('/api/session/cookie', { method }, token);
  } catch {
    // Private files will not show until the next token; nothing else depends on it.
  }
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // The profile, with the user it was loaded for: `profileLoading` is derived
  // from it, so there is no render in which a session exists, nothing is
  // loading and the profile is not there yet (a route guard would decide on it).
  const [loaded, setLoaded] = useState<{ userId: string; profile: SessionProfile | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // False until the first session cookie request has settled. Private files
  // (documents, boarding passes) are `<img>`/links that rely on the cookie, so
  // nothing that shows them may render before the cookie is there. Only the
  // first sync holds the app back: later token refreshes keep the old cookie
  // valid until the new one lands, and must not unmount the guarded pages.
  const [cookieReady, setCookieReady] = useState(false);
  const userId = session?.user.id ?? null;
  const tokenRef = useRef<string | undefined>(undefined);
  tokenRef.current = session?.access_token;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setCookieReady(true);
      setIsLoading(false);
    }).catch(() => {
      setSession(null);
      setCookieReady(true);
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
      .catch((error: unknown) => {
        // The API refuses the token (account deleted, session revoked): the
        // session kept in this browser is dead, and keeping it would send the
        // visitor from the login page straight back into an app that answers 401.
        if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
          void supabase.auth.signOut({ scope: 'local' });
        }
        if (current) setLoaded({ userId, profile: null });
      });
    return () => { current = false; };
  }, [userId]);

  // The API also accepts the token from an httpOnly cookie, on reads only: an
  // `<img>` or a link to a private file cannot send a header. The cookie is a
  // copy of the current token, renewed when the token changes and cleared when
  // the session ends. A failure only means private files will not show.
  const accessToken = session?.access_token;
  const hadSession = useRef(false);
  useEffect(() => {
    if (accessToken) {
      hadSession.current = true;
      void syncSessionCookie('POST', accessToken).then(() => setCookieReady(true));
    } else if (hadSession.current) {
      hadSession.current = false;
      void syncSessionCookie('DELETE', undefined);
    }
  }, [accessToken]);

  const profile = loaded && loaded.userId === userId ? loaded.profile : null;
  const profileLoading = userId !== null && loaded?.userId !== userId;

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, profile, isLoading: isLoading || !cookieReady, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
