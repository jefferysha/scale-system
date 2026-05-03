import { cn } from '@/lib/utils';

interface LedDotProps {
  status?: 'on' | 'off' | 'pulse';
  color?: 'acc' | 'warn' | 'danger';
  className?: string;
}

export function LedDot({
  status = 'pulse',
  color = 'acc',
  className,
}: LedDotProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-block size-1.5 rounded-full',
        color === 'acc' && 'bg-[var(--acc)]',
        color === 'warn' && 'bg-[var(--warn)]',
        color === 'danger' && 'bg-[var(--danger)]',
        status === 'pulse' && 'animate-pulse',
        status === 'off' && 'opacity-30',
        className,
      )}
      style={{ boxShadow: status !== 'off' ? 'var(--led-glow)' : undefined }}
    />
  );
}
