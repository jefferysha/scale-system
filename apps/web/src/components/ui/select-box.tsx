import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** ARIA / data-testid 透传 */
  testId?: string;
}

/**
 * 替换 native <select>：基于 Radix Popover 的自定义下拉。
 * - dropdown 一律 side="bottom"，不向上翻转，避免遮挡上方内容
 * - 宽度等同 trigger，至少 160px
 * - 配色用主题 token，跟 input/select 在视觉上无缝
 */
export function SelectBox({
  value,
  onChange,
  options,
  placeholder = '—',
  disabled,
  className,
  id,
  testId,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          data-testid={testId}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--line-2)]',
            'bg-[var(--bg-1)] px-3 py-1 text-sm font-mono text-[var(--text)] shadow-sm transition-colors',
            'hover:border-[var(--acc)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--acc)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open && 'border-[var(--acc)] ring-1 ring-[var(--acc)]',
            className,
          )}
        >
          <span className={cn('truncate', !current && 'text-[var(--text-3)]')}>
            {current ? current.label : placeholder}
          </span>
          <ChevronDown
            className={cn('size-4 opacity-60 transition-transform', open && 'rotate-180')}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
        className="w-[var(--radix-popover-trigger-width)] min-w-[160px] p-1"
      >
        <div className="flex max-h-72 flex-col overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-3)]">无选项</div>
          ) : (
            options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-mono text-xs',
                  'hover:bg-[var(--acc-shade)] hover:text-[var(--acc)]',
                  o.value === value && 'bg-[var(--acc-shade)] font-semibold text-[var(--acc)]',
                )}
                data-testid={testId ? `${testId}-opt-${o.value}` : undefined}
              >
                <Check
                  className={cn(
                    'size-3.5 flex-none',
                    o.value === value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
