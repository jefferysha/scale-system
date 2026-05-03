import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/error';
import type { Cup } from '@/types/api';
import { useCalibrateCup } from '../hooks';

const schema = z.object({
  tare_g: z.coerce.number().positive(),
  method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  cup: Cup | null;
  onClose: () => void;
}

export function CalibrationDialog({ cup, onClose }: Props): React.ReactElement {
  const calibrateM = useCalibrateCup();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tare_g: cup ? Number(cup.current_tare_g) : 0,
      method: '6 次称重平均',
      notes: '',
    },
  });

  const submit = handleSubmit(async (v) => {
    if (!cup) return;
    try {
      await calibrateM.mutateAsync({
        id: cup.id,
        body: {
          tare_g: v.tare_g,
          method: v.method || null,
          notes: v.notes || null,
        },
      });
      toast.success('率定已记录');
      reset();
      onClose();
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '率定失败');
    }
  });

  return (
    <Dialog open={cup !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>率定 — {cup?.cup_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cal-tare">皮重 g</Label>
            <Input id="cal-tare" type="number" step="0.0001" {...register('tare_g')} />
            {errors.tare_g && (
              <p className="text-xs text-[var(--danger)]">{errors.tare_g.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-method">率定方法</Label>
            <Input id="cal-method" {...register('method')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-notes">备注</Label>
            <Textarea id="cal-notes" rows={2} {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={calibrateM.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={calibrateM.isPending}>
              {calibrateM.isPending ? '保存中…' : '记录'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
