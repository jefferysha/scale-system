import type { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import type { ScaleFormValues } from './scale-form-schema';

interface Props {
  form: UseFormReturn<ScaleFormValues>;
}

const PROTOCOL_HINT: Record<string, string> = {
  generic: '通用协议：按读超时切换出值。',
  mettler: 'Mettler Toledo XS / XP 系列。建议 9600/8/N/1，stop_bits=2 不兼容。',
  sartorius: 'Sartorius BSA / Practum 系列。建议 9600/8/O/1。',
};

const STOP_BITS_BY_PROTOCOL: Record<string, number[]> = {
  mettler: [1],
  sartorius: [1, 2],
  generic: [1, 2],
};

export function ScaleProtocolFields({ form }: Props): React.ReactElement {
  const protocol = form.watch('protocol_type');
  const stop = form.watch('stop_bits');
  const allowedStop = STOP_BITS_BY_PROTOCOL[protocol] ?? [1, 2];
  const stopWarning = !allowedStop.includes(Number(stop));

  return (
    <div
      className="rounded-md border border-[var(--line)] bg-[var(--bg-2)]/30 p-3"
      data-testid="scale-protocol-hint"
    >
      <Label className="text-xs">协议提示</Label>
      <p className="mt-1 text-xs text-[var(--text-2)]">{PROTOCOL_HINT[protocol] ?? ''}</p>
      {stopWarning ? (
        <p className="mt-2 text-xs text-[var(--warn)]" data-testid="scale-stop-warn">
          ⚠ 当前协议建议 stop_bits ∈ [{allowedStop.join(', ')}]，请确认设备说明。
        </p>
      ) : null}
    </div>
  );
}
