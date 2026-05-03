import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from './routes/login';
import HomePage from './routes/index';
import WeighingPage from './routes/weighing';
import NotFoundPage from './routes/not-found';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/weighing" replace /> },
          { path: '/nav', element: <HomePage /> },
          { path: '/weighing', element: <WeighingPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
