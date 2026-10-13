import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth, RequireAdmin, RequireNotSuspended, RedirectIfAuthenticated } from './components/RequireAuth';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { TripsListPage } from './pages/TripsListPage';
import { NewTripPage } from './pages/NewTripPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { InvitePage } from './pages/InvitePage';
import { SuspendedPage } from './pages/SuspendedPage';
// Copied from the Next.js app (scripts/port-lib.mjs): the page file keeps its path.
import ProfilePage from './app/(app)/profile/page';

export const router = createBrowserRouter([
  { path: '/suspended', Component: SuspendedPage },
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: '/auth/login', Component: LoginPage },
      { path: '/auth/forgot-password', Component: ForgotPasswordPage },
    ],
  },
  // Outside RedirectIfAuthenticated: the link of the reset email signs the user
  // in (recovery session) before the page opens.
  { path: '/auth/reset-password', Component: ResetPasswordPage },
  {
    element: <RequireNotSuspended />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [{ path: '/', Component: LandingPage }],
      },
      { path: '/blog', /* Task 4.9 */ Component: undefined },
      { path: '/blog/:slug', Component: undefined },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/dashboard', Component: DashboardPage },
              { path: '/trips', Component: TripsListPage },
              { path: '/trips/new', Component: NewTripPage },
              { path: '/trips/:id', Component: TripDetailPage },
              { path: '/invite/:token', Component: InvitePage },
              { path: '/trips/:id/posts/:postId/edit', /* Task 4.10 */ Component: undefined },
              { path: '/profile', Component: ProfilePage },
              {
                path: '/admin',
                element: <RequireAdmin />,
                children: [
                  { index: true, /* Task 4.13 */ Component: undefined },
                  { path: 'users', Component: undefined },
                  { path: 'audit-log', Component: undefined },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
