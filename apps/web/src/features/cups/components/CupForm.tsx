import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Cup, CupCreate, CupUpdate } from '@/types/api';

const schema = z.object({
  cup_number: z.string().min(1).max(32),
  current_tare_g: z.coerce.number().nonnegative(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean(),
});

export type CupFormValues = z.infer<typeof schema>;

interface Props {
  initial?: Cup | null;
  pending?: boolean;
  onSubmit: (values: CupCreate | CupUpdate) => void;
  onCancel?: () => void;
}

export function CupForm({ initial, pending, onSubmit, onCancel }: Props): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cup_number: initial?.cup_number ?? '',
      current_tare_g: Number(initial?.current_tare_g ?? 0),
      notes: initial?.notes ?? '',
      is_active: initial?.is_active ?? true,
    },
  });

  const submit = handleSubmit((values) => {
    onSubmit({
      cup_number: values.cup_number,
      current_tare_g: values.current_tare_g,
      notes: values.notes || null,
      is_active: values.is_active,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cup-number">杯号</Label>
        <Input id="cup-number" {...register('cup_number')} />
        {errors.cup_number && (
          <p className="text-xs text-[var(--danger)]">{errors.cup_number.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cup-tare">当前杯重 g</Label>
        <Input id="cup-tare" type="number" step="0.0001" {...register('current_tare_g')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cup-notes">备注</Label>
        <Textarea id="cup-notes" rows={2} {...register('notes')} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="cup-active"
          type="checkbox"
          className="size-4 accent-[var(--acc)]"
          {...register('is_active')}
        />
        <Label htmlFor="cup-active">启用</Label>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            取消
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? '保存中…' : '保存'}
        </Button>
      </div>
    </form>
  );
}
