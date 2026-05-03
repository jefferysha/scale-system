import { cn } from '@/lib/utils';

interface Props {
  digits: string;
  unit?: string;
  stable?: boolean;
  className?: string;
}

export function LCDDisplay({
  digits,
  unit = 'g',
  stable = false,
  className,
}: Props): React.ReactElement {
  return (
    <div
      className={cn(
        'absolute left-1/2 top-[42%] flex -translate-x-1/2 items-baseline gap-2 font-mono text-2xl tabular-nums',
        'rounded-md border border-[var(--line-2)] bg-black/60 px-3 py-1 text-[var(--acc)]',
        stable && 'shadow-[var(--led-glow)]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          'size-1.5 rounded-full bg-[var(--acc)]',
          stable ? '' : 'opacity-30',
        )}
      />
      <span>{digits}</span>
      <span className="text-xs">{unit}</span>
    </div>
  );
}
