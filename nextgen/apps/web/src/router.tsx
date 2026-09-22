import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth, RequireAdmin, RequireNotSuspended, RedirectIfAuthenticated } from './components/RequireAuth';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { LandingPage } from './pages/LandingPage';

export const router = createBrowserRouter([
  { path: '/suspended', /* Task 4.11 */ Component: undefined },
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: '/auth/login', Component: LoginPage },
      { path: '/auth/forgot-password', Component: ForgotPasswordPage },
      { path: '/auth/reset-password', Component: ResetPasswordPage },
    ],
  },
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
              { path: '/dashboard', /* Task 4.7 */ Component: undefined },
              { path: '/trips', /* Task 4.8 */ Component: undefined },
              { path: '/trips/new', Component: undefined },
              { path: '/trips/:id', Component: undefined },
              { path: '/trips/:id/posts/:postId/edit', /* Task 4.10 */ Component: undefined },
              { path: '/profile', /* Task 4.12 */ Component: undefined },
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
