import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCups } from '../hooks';

export interface CupLite {
  id: number;
  cup_number: string;
  current_tare_g: number;
}

interface Props {
  value: CupLite | null;
  onChange: (cup: CupLite | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 杯号选择器：单 trigger 触发的可搜索 Combobox。
 * 替代原"搜索 input + 空 select"两段式 UI 减少视觉冗余，
 * 也让用户在一个交互里完成"搜索 + 选中"。
 */
export function CupCombobox({
  value,
  onChange,
  placeholder = '选择杯号',
  disabled,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 200);
    return () => window.clearTimeout(id);
  }, [q]);

  const { data: cupsPage, isFetching } = useCups({
    q: debouncedQ || undefined,
    page: 1,
    size: 30,
  });
  const items = cupsPage?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-mono', !value && 'text-[var(--text-3)]')}
          disabled={disabled}
          data-testid="cup-combobox-trigger"
        >
          <span className="truncate">{value ? value.cup_number : placeholder}</span>
          <ChevronDown
            className={cn('size-4 opacity-60 transition-transform', open && 'rotate-180')}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
        className="w-[var(--radix-popover-trigger-width)] min-w-[180px] p-0"
      >
        <Command shouldFilter={false} className="flex flex-col">
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="搜索杯号…"
            className="h-9 w-full border-b border-[var(--line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
            data-testid="cup-combobox-input"
          />
          <CommandList ref={listRef} className="max-h-72 overflow-auto">
            <CommandEmpty className="px-3 py-2 text-xs text-[var(--text-3)]">
              {isFetching ? '加载中…' : '无匹配杯号'}
            </CommandEmpty>
            {items.map((c) => {
              const lite: CupLite = {
                id: c.id,
                cup_number: c.cup_number,
                current_tare_g: Number(c.current_tare_g),
              };
              const selected = value?.id === c.id;
              return (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => {
                    onChange(lite);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-sm',
                    'aria-selected:bg-[var(--acc-shade)] aria-selected:text-[var(--acc)]',
                    selected && 'bg-[var(--acc-shade)] font-semibold text-[var(--acc)]',
                  )}
                  data-testid={`cup-combobox-item-${c.id}`}
                >
                  <Check
                    className={cn('size-3.5 flex-none', selected ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="flex-1 truncate">{c.cup_number}</span>
                  <span className="text-[10px] text-[var(--text-3)]">{c.current_tare_g}g</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
