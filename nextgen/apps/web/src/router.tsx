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
import AdminDashboardPage from './app/(admin)/admin/page';
import AdminUsersPage from './app/(admin)/admin/users/page';
import AdminAuditLogPage from './app/(admin)/admin/audit-log/page';
import { AdminLayout } from './components/admin/AdminLayout';
import PostEditPage from './app/(app)/trips/[id]/posts/[postId]/edit/page';
import { BlogLayout } from './pages/blog/BlogLayout';
import { BlogIndexPage } from './pages/blog/BlogIndexPage';
import { BlogPostPage } from './pages/blog/BlogPostPage';

export const router = createBrowserRouter([
  { path: '/suspended', Component: SuspendedPage },
  // The public blog: no session, no guard, its own frame.
  {
    element: <BlogLayout />,
    children: [
      { path: '/blog', Component: BlogIndexPage },
      { path: '/blog/:slug', Component: BlogPostPage },
    ],
  },
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
              { path: '/trips/:id/posts/:postId/edit', Component: PostEditPage },
              { path: '/profile', Component: ProfilePage },
            ],
          },
          // The admin area has its own frame, as in the Next.js app: it is not inside the app shell.
          {
            path: '/admin',
            element: <RequireAdmin />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  { index: true, Component: AdminDashboardPage },
                  { path: 'users', Component: AdminUsersPage },
                  { path: 'audit-log', Component: AdminAuditLogPage },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
