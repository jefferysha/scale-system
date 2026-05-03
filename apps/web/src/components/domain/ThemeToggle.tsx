import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export function ThemeToggle(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex rounded-full border border-[var(--line-2)] bg-[var(--bg-1)] p-0.5">
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 text-xs text-[var(--text-2)] transition-colors',
          theme === 'dark' && 'bg-[var(--acc-shade)] text-[var(--acc)]',
        )}
      >
        <Moon className="size-3" /> 深色
      </button>
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 text-xs text-[var(--text-2)] transition-colors',
          theme === 'light' && 'bg-[var(--acc-shade)] text-[var(--acc)]',
        )}
      >
        <Sun className="size-3" /> 浅色
      </button>
    </div>
  );
}
