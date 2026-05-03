import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import LoginPage from './routes/login';
import HomePage from './routes/index';
import NotFoundPage from './routes/not-found';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [{ index: true, element: <HomePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
]);
