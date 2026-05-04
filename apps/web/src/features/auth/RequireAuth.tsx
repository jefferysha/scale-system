import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store';

export function RequireAuth(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const location = useLocation();

  // AuthBootstrap 仍在尝试 refresh 还原 session：先显示骨架，避免误跳 /login
  if (isBootstrapping) {
    return (
      <div
        role="status"
        aria-label="正在还原会话"
        className="grid min-h-screen place-items-center bg-[var(--bg-0)] text-[var(--text-3)]"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--acc)]" />
          <span>正在还原会话…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
