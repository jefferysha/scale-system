import { cn } from '@/lib/utils';

/**
 * 复刻原型 .cfg-h：左 8px 短线 + 大写小标题 + 右侧延伸长线，用于配置面板分栏。
 */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.05em] text-[var(--text-3)]',
        className,
      )}
    >
      <span className="h-px w-2 bg-[var(--line-2)]" />
      <span className="whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}
