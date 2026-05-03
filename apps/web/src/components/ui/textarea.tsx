import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text)] shadow-sm transition-colors',
        'placeholder:text-[var(--text-3)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--acc)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
