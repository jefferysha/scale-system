import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from './routes/login';
import HomePage from './routes/index';
import WeighingPage from './routes/weighing';
import ProjectsPage from './routes/_auth/projects';
import ScalesPage from './routes/_auth/scales';
import CupsPage from './routes/_auth/cups';
import RecordsPage from './routes/_auth/records';
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
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/scales', element: <ScalesPage /> },
          { path: '/cups', element: <CupsPage /> },
          { path: '/records', element: <RecordsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
