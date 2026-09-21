import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth, RequireAdmin, RequireNotSuspended, RedirectIfAuthenticated } from './components/RequireAuth';

export const router = createBrowserRouter([
  { path: '/suspended', /* Task 4.11 */ Component: undefined },
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: '/auth/login', /* Task 4.6 */ Component: undefined },
      { path: '/auth/forgot-password', Component: undefined },
      { path: '/auth/reset-password', Component: undefined },
    ],
  },
  {
    element: <RequireNotSuspended />,
    children: [
      { path: '/', /* Task 4.5 */ Component: undefined },
      { path: '/blog', /* Task 4.9 */ Component: undefined },
      { path: '/blog/:slug', Component: undefined },
      {
        element: <RequireAuth />,
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
]);
