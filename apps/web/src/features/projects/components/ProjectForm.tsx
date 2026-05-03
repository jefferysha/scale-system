import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Project, ProjectCreate, ProjectUpdate } from '@/types/api';

const schema = z.object({
  name: z.string().min(1, '项目名必填').max(128),
  established_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean(),
});

export type ProjectFormValues = z.infer<typeof schema>;

interface Props {
  initial?: Project | null;
  pending?: boolean;
  onSubmit: (values: ProjectCreate | ProjectUpdate) => void;
  onCancel?: () => void;
}

export function ProjectForm({ initial, pending, onSubmit, onCancel }: Props): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      established_date: initial?.established_date ?? '',
      notes: initial?.notes ?? '',
      is_active: initial?.is_active ?? true,
    },
  });

  const submit = handleSubmit((values) => {
    onSubmit({
      name: values.name,
      established_date: values.established_date || null,
      notes: values.notes || null,
      is_active: values.is_active,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="proj-name">项目名</Label>
        <Input id="proj-name" {...register('name')} />
        {errors.name && <p className="text-xs text-[var(--danger)]">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="proj-date">立项日期</Label>
        <Input id="proj-date" type="date" {...register('established_date')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="proj-notes">备注</Label>
        <Textarea id="proj-notes" rows={3} {...register('notes')} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="proj-active"
          type="checkbox"
          className="size-4 accent-[var(--acc)]"
          {...register('is_active')}
        />
        <Label htmlFor="proj-active">启用</Label>
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
