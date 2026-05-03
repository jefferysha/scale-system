import { cn } from '@/lib/utils';
import { LedDot } from './LedDot';

interface StatusChipProps {
  label: string;
  variant?: 'default' | 'success' | 'warn' | 'danger';
  pulse?: boolean;
  className?: string;
}

export function StatusChip({
  label,
  variant = 'default',
  pulse = true,
  className,
}: StatusChipProps): React.ReactElement {
  const colorMap = { default: 'acc', success: 'acc', warn: 'warn', danger: 'danger' } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--bg-1)]/60 px-3 py-1 font-mono text-xs tracking-wider text-[var(--text-2)]',
        className,
      )}
    >
      <LedDot status={pulse ? 'pulse' : 'on'} color={colorMap[variant]} />
      <span>{label}</span>
    </span>
  );
}
