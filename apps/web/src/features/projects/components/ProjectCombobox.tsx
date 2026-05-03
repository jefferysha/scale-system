import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from 'cmdk';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { Project } from '@/types/api';
import { useProjectsInfinite } from '../hooks';

interface Props {
  value: Project | null;
  onChange: (p: Project | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProjectCombobox({
  value,
  onChange,
  placeholder = '选择项目',
  disabled,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const { data, fetchNextPage, hasNextPage, isFetching } = useProjectsInfinite({
    q: debouncedQ || undefined,
    limit: 20,
  });
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const onScroll = (): void => {
    const el = listRef.current;
    if (!el || !hasNextPage || isFetching) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) void fetchNextPage();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
          data-testid="project-combobox-trigger"
        >
          <span className="truncate">{value ? value.name : placeholder}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false} className="flex flex-col">
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="搜索项目…"
            className="h-9 w-full border-b border-[var(--line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
            data-testid="project-combobox-input"
          />
          <CommandList
            ref={listRef}
            onScroll={onScroll}
            className="max-h-72 overflow-auto"
          >
            <CommandEmpty className="px-3 py-2 text-xs text-[var(--text-3)]">
              无匹配项目
            </CommandEmpty>
            {items.map((p) => (
              <CommandItem
                key={p.id}
                value={String(p.id)}
                onSelect={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm aria-selected:bg-[var(--bg-2)]"
                data-testid={`project-combobox-item-${p.id}`}
              >
                <Check
                  className={`size-4 ${value?.id === p.id ? 'opacity-100' : 'opacity-0'}`}
                />
                <span className="truncate">{p.name}</span>
              </CommandItem>
            ))}
            {isFetching ? (
              <div className="px-3 py-2 text-xs text-[var(--text-3)]">加载中…</div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
