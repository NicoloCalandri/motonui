import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';

/**
 * Fixed banner shown at the top of all authenticated pages when an admin is
 * impersonating another user. Detects the active session from the
 * non-sensitive display-name cookie (the token cookie is httpOnly and never
 * touched by client-side JS). Ported from
 * src/components/admin/impersonation-banner.tsx — same cookie contract, same
 * `/api/admin/impersonate/exit` route (already implemented server-side at
 * nextgen/apps/api/src/routes/admin/impersonate.ts).
 */
export function ImpersonationBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const displayNameCookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('impersonation_display_name='));

    if (displayNameCookie) {
      setVisible(true);
      setTargetName(decodeURIComponent(displayNameCookie.split('=')[1]));
    }
  }, []);

  const handleExit = async () => {
    setExiting(true);
    try {
      await apiFetch('/api/admin/impersonate/exit', { method: 'POST' });
      setVisible(false);
      navigate('/admin/users');
    } catch {
      setExiting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow">
      <span>
        ⚠️ Stai visualizzando l'app come <strong>{targetName ?? 'questo utente'}</strong> — modalità sola lettura
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="ml-4 px-3 py-1 rounded-lg bg-amber-950/20 hover:bg-amber-950/30 transition-colors disabled:opacity-60 text-xs font-semibold"
      >
        {exiting ? 'Uscita…' : "Esci dall'anteprima"}
      </button>
    </div>
  );
}
