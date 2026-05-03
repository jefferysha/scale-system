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
 * 不阻塞首屏：直接渲染 children，refresh 异步完成后触发重渲染。
 */
export function AuthBootstrap({ children }: Props): React.ReactElement {
  const apply = useAuthStore((s) => s.applyToken);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await refresh();
        if (!cancelled) apply(r.access_token, r.user);
      } catch {
        // 没有有效 refresh cookie，不做处理。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  return <>{children}</>;
}
