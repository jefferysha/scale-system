import { cn } from '@/lib/utils';

export function SamplesHealthIndicator({ sps }: { sps: number }): React.ReactElement {
  const tone =
    sps >= 3
      ? 'text-[var(--acc)]'
      : sps >= 1
        ? 'text-[var(--warn)]'
        : 'text-[var(--danger)]';
  return (
    <span className={cn('font-mono text-[10px] tracking-wider', tone)} title="样本/秒">
      {sps} sps
    </span>
  );
}
