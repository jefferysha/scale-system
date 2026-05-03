import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { StatusChip } from '@/components/domain/StatusChip';
import { NavMenu } from './NavMenu';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { Button } from '@/components/ui/button';

export function Header(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="size-7 rounded-lg bg-gradient-conic from-[var(--acc)] via-[var(--acc-2)] to-[var(--acc)]" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">天平称重系统</span>
          <span className="font-mono text-[10px] tracking-widest text-[var(--text-3)]">SCALE-SYSTEM</span>
        </div>
        <NavMenu />
      </div>
      <div />
      <div className="flex items-center gap-3">
        <StatusChip label="实时同步" variant="success" />
        <ThemeToggle />
        <span className="text-xs text-[var(--text-2)]">{user?.username}</span>
        <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
          退出
        </Button>
      </div>
    </header>
  );
}
