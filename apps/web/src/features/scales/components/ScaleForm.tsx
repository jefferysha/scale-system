import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import type { Scale, ScaleCreate, ScaleUpdate } from '@/types/api';
import { ScaleFormFields } from './ScaleFormFields';
import { scaleSchema, type ScaleFormValues } from './scale-form-schema';
import { ScaleProtocolFields } from './ScaleProtocolFields';

interface Props {
  initial?: Scale | null;
  pending?: boolean;
  onSubmit: (values: ScaleCreate | ScaleUpdate) => void;
  onCancel?: () => void;
}

const defaultsFromScale = (s?: Scale | null): ScaleFormValues => ({
  name: s?.name ?? '',
  model: s?.model ?? '',
  protocol_type: (s?.protocol_type as ScaleFormValues['protocol_type']) ?? 'generic',
  baud_rate: s?.baud_rate ?? 9600,
  data_bits: (s?.data_bits as 7 | 8) ?? 8,
  parity: (s?.parity as ScaleFormValues['parity']) ?? 'none',
  stop_bits: (s?.stop_bits as 1 | 2) ?? 1,
  flow_control: (s?.flow_control as ScaleFormValues['flow_control']) ?? 'none',
  read_timeout_ms: s?.read_timeout_ms ?? 1000,
  decimal_places: s?.decimal_places ?? 4,
  unit_default: (s?.unit_default as ScaleFormValues['unit_default']) ?? 'g',
  notes: s?.notes ?? '',
  is_active: s?.is_active ?? true,
});

export function ScaleForm({ initial, pending, onSubmit, onCancel }: Props): React.ReactElement {
  const form = useForm<ScaleFormValues>({
    resolver: zodResolver(scaleSchema),
    defaultValues: defaultsFromScale(initial),
  });

  const submit = form.handleSubmit((values) => {
    onSubmit({
      ...values,
      model: values.model || null,
      notes: values.notes || null,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <ScaleFormFields form={form} />
      <ScaleProtocolFields form={form} />
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
