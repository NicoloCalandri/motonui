import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutDashboard, LogOut, Map, PlusCircle, User } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ImpersonationBanner } from './ImpersonationBanner';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Map;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/trips', label: 'Viaggi', icon: Map },
  { to: '/blog', label: 'Blog', icon: BookOpen },
  { to: '/profile', label: 'Impostazioni', icon: User },
];

function isActive(pathname: string, to: string) {
  return to === '/dashboard' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Authenticated app shell: slim sidebar (desktop) + bottom nav (mobile) +
 * cockpit header with user menu. Ported from src/app/(app)/layout.tsx.
 *
 * This is a layout route rendered only inside <RequireAuth /> (see
 * router.tsx), so `user`/`profile` from useAuth() are guaranteed to be
 * populated once loading settles — the old component's own
 * fetch('/api/profile') + redirect-if-unauthenticated effect is dropped
 * since that responsibility now belongs entirely to the route guard.
 */
export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = profile?.display_name || user?.email?.split('@')[0] || 'Viaggiatore';
  const userEmail = user?.email ?? null;
  const avatarUrl = profile?.avatar_url ?? null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const mobileNavItems: NavItem[] = [...NAV_ITEMS, { to: '/trips/new', label: 'Nuovo', icon: PlusCircle }];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)]">
      <ImpersonationBanner />
      <div className="flex flex-1">
        {/* Slim Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col items-center w-20 min-h-screen bg-[var(--color-sidebar)] py-8 sticky top-0 h-screen">
          <div className="mb-10">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              M
            </div>
          </div>

          <nav className="flex-1 w-full px-3 space-y-6 flex flex-col items-center">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = isActive(location.pathname, to);
              return (
                <Link
                  key={to}
                  to={to}
                  title={label}
                  className={`relative group p-3 rounded-2xl transition-all duration-300 hover:bg-white/10 ${
                    active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <div
                    className={`absolute left-[-12px] top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </Link>
              );
            })}

            <Link
              to="/trips/new"
              className="p-3 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <PlusCircle className="w-6 h-6" />
            </Link>
          </nav>

          <button
            onClick={handleSignOut}
            title="Esci"
            aria-label="Esci"
            className="p-3 rounded-2xl text-gray-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8">
          {/* Top Cockpit Header */}
          <header className="flex items-center justify-between mb-8">
            {/* Search Mockup */}
            <div className="flex-1 max-w-md relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <PlusCircle className="w-5 h-5 text-gray-400 group-focus-within:text-ink-900 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Cerca il tuo viaggio..."
                className="w-full bg-white border-none py-3 pl-12 pr-4 rounded-2xl shadow-soft focus:ring-2 focus:ring-gray-200 transition-all text-sm font-medium"
              />
            </div>

            {/* Actions & Profile */}
            <div className="flex items-center gap-6">
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-3 focus:outline-none"
                  aria-label="Menu utente"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-ink-900 leading-none">{userName}</p>
                    <p className="text-[10px] font-medium text-ink-400 mt-1 uppercase">Trip Explorer</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white shadow-soft p-1 overflow-hidden border border-gray-100 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-white text-[10px] font-bold">
                        {userName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-ink-900 truncate">{userName}</p>
                      <p className="text-[11px] text-ink-400 truncate">{userEmail}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-ink-900 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Profilo
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Esci
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <Outlet />
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden fixed bottom-6 inset-x-4 z-40 bg-[var(--color-sidebar)]/90 backdrop-blur-xl rounded-3xl shadow-2xl p-2 border border-white/10">
            <div className="flex items-center justify-around">
              {mobileNavItems.map(({ to, label, icon: Icon }) => {
                const active = isActive(location.pathname, to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex flex-col items-center gap-1 py-2 px-3 transition-all ${
                      active ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[8px] font-bold uppercase">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </main>
      </div>
    </div>
  );
}
