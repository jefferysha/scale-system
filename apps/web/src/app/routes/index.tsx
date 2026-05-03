import { Link } from 'react-router-dom';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/domain/ThemeToggle';

export default function HomePage(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  return (
    <main className="min-h-screen p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">天平称重系统</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-[var(--text-2)]">{user?.username}</span>
          <Button variant="outline" onClick={() => logout.mutate()}>
            退出
          </Button>
        </div>
      </header>
      <nav className="grid gap-2 text-[var(--acc)]">
        <Link to="/weighing">采集页（Phase 4 实现）</Link>
        <Link to="/scales">天平管理（Phase 5）</Link>
        <Link to="/projects">项目管理（Phase 5）</Link>
        <Link to="/cups">杯库管理（Phase 5）</Link>
        <Link to="/records">数据浏览（Phase 5）</Link>
      </nav>
    </main>
  );
}
