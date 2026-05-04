import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import type { Scale, ScaleCreate, ScaleUpdate } from '@/types/api';
import type { ScaleConfig } from '@/lib/serial/adapter';
import { useReportProbe } from '../hooks';
import { ScaleFormFields } from './ScaleFormFields';
import { scaleSchema, type ScaleFormValues } from './scale-form-schema';
import { ScaleProtocolFields } from './ScaleProtocolFields';
import { ScaleProbePanel } from './ScaleProbePanel';

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

const toScaleConfig = (v: ScaleFormValues): ScaleConfig => ({
  baudRate: Number(v.baud_rate),
  dataBits: Number(v.data_bits) as 7 | 8,
  parity: v.parity,
  stopBits: Number(v.stop_bits) as 1 | 2,
  flowControl: v.flow_control === 'none' ? 'none' : 'hardware',
  protocolType: v.protocol_type,
  readTimeoutMs: Number(v.read_timeout_ms),
  decimalPlaces: Number(v.decimal_places),
  unitDefault: v.unit_default,
});

export function ScaleForm({ initial, pending, onSubmit, onCancel }: Props): React.ReactElement {
  const form = useForm<ScaleFormValues>({
    resolver: zodResolver(scaleSchema),
    defaultValues: defaultsFromScale(initial),
  });
  const reportM = useReportProbe();
  const isCreate = !initial;
  /** create 模式必须先探测成功才能保存；edit 模式下探测仅供参考。 */
  const [probeOk, setProbeOk] = useState(false);
  const watched = form.watch();
  const probeConfig = toScaleConfig(watched);

  const submit = form.handleSubmit((values) => {
    onSubmit({
      ...values,
      model: values.model || null,
      notes: values.notes || null,
    });
  });

  const handleProbeReport = async (
    id: number,
    ok: boolean,
    samples: { value: number; unit: string; stable: boolean; ts: number }[],
  ): Promise<void> => {
    await reportM.mutateAsync({
      id,
      body: {
        ok,
        samples_count: samples.length,
        samples: samples.map((s) => ({
          value: s.value,
          unit: s.unit,
          stable: s.stable,
          ts: s.ts,
        })),
        error: null,
      },
    });
  };

  const saveDisabled = pending || (isCreate && !probeOk);

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 左栏：基础信息 */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
            基础信息
          </h4>
          <ScaleFormFields form={form} group="basic" />
        </div>

        {/* 右栏：串口 + 协议提示 + 探测面板 */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
            串口与协议
          </h4>
          <ScaleFormFields form={form} group="serial" />
          <ScaleProtocolFields form={form} />
          <ScaleProbePanel
            config={probeConfig}
            scaleId={initial?.id}
            onResult={setProbeOk}
            reportProbe={handleProbeReport}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <span className="text-xs text-[var(--text-3)]" data-testid="scale-save-hint">
          {isCreate
            ? probeOk
              ? '探测通过，可以保存'
              : '请先点"开始探测"，连接成功后才能保存'
            : ''}
        </span>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              取消
            </Button>
          ) : null}
          <Button type="submit" disabled={saveDisabled} data-testid="scale-form-save">
            {pending ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </form>
  );
}
