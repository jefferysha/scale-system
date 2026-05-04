import { useEffect } from 'react';
import { refresh } from './api';
import { useAuthStore } from './store';

interface Props {
  children: React.ReactNode;
}

/**
 * 应用启动时尝试用 refresh cookie 恢复 session：
 * - 成功 → applyToken 把 user 注入 store，受保护路由立刻可达。
 * - 失败 → 用户保持未登录，RequireAuth 跳到 /login。
 *
 * 期间 isBootstrapping=true，RequireAuth 应显示 loading 而非立即重定向，
 * 避免 refresh 还没完成就误判 user=null 而跳 /login。
 */
export function AuthBootstrap({ children }: Props): React.ReactElement {
  const apply = useAuthStore((s) => s.applyToken);
  const setBootstrapping = useAuthStore((s) => s.setBootstrapping);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await refresh();
        if (!cancelled) apply(r.access_token, r.user);
      } catch {
        // 没有有效 refresh cookie，保持未登录。
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, setBootstrapping]);

  return <>{children}</>;
}
