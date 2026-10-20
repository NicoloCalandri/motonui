import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to={`/auth/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}

export function RedirectIfAuthenticated() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { profile, isLoading, profileLoading } = useAuth();
  if (isLoading || profileLoading) return null;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RequireNotSuspended() {
  const { profile, isLoading, profileLoading } = useAuth();
  if (isLoading || profileLoading) return null;
  if (profile?.suspended_at) return <Navigate to="/suspended" replace />;
  return <Outlet />;
}
