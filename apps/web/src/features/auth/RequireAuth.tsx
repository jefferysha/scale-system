import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store';

export function RequireAuth(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
