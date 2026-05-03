import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 极简 native select 包装：保留 shadcn 风格但不使用 radix-select。
 * 4 个 CRUD 表单的下拉量很小，原生即可。
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] px-3 py-1 text-sm text-[var(--text)] shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--acc)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export { Select };
