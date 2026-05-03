import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getSerialAdapter } from '@/lib/platform';
import type { ProbeResult, SerialPortInfo } from '@/lib/serial/adapter';
import { isApiError } from '@/lib/api/error';
import type { Scale } from '@/types/api';
import { useReportProbe } from '../hooks';

interface Props {
  scale: Scale | null;
  onClose: () => void;
}

export function ScaleProbeDialog({ scale, onClose }: Props): React.ReactElement {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const reportM = useReportProbe();

  useEffect(() => {
    if (!scale) return;
    const adapter = getSerialAdapter();
    void adapter.listPorts().then((ps) => {
      setPorts(ps);
      if (ps[0]) setSelected(ps[0].id);
    });
  }, [scale]);

  const handleProbe = async (): Promise<void> => {
    if (!scale || !selected) return;
    setRunning(true);
    try {
      const adapter = getSerialAdapter();
      const r = await adapter.probe(
        selected,
        {
          baudRate: scale.baud_rate,
          dataBits: scale.data_bits as 7 | 8,
          parity: scale.parity,
          stopBits: scale.stop_bits as 1 | 2,
          flowControl: scale.flow_control === 'none' ? 'none' : 'hardware',
          protocolType: scale.protocol_type,
          readTimeoutMs: scale.read_timeout_ms,
          decimalPlaces: scale.decimal_places,
          unitDefault: scale.unit_default,
        },
        3000,
      );
      setResult(r);
      await reportM.mutateAsync({
        id: scale.id,
        body: {
          ok: r.ok,
          samples_count: r.samples.length,
          samples: r.samples.map((s) => ({
            value: s.value,
            unit: s.unit,
            stable: s.stable,
            ts: s.ts,
          })),
          error: r.error?.code ?? null,
        },
      });
      if (r.ok) toast.success(`探测成功，采集 ${r.samples.length} 个样本`);
      else toast.error(`探测失败：${r.error?.message ?? r.error?.code ?? '未知错误'}`);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '探测异常');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={scale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>探测连接 — {scale?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="probe-port">串口</Label>
            <Select
              id="probe-port"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={ports.length === 0}
              data-testid="probe-port-select"
            >
              {ports.length === 0 ? (
                <option value="">无可用串口</option>
              ) : (
                ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))
              )}
            </Select>
          </div>

          {result ? (
            <div
              className="rounded-md border border-[var(--line)] bg-[var(--bg-2)]/40 p-3 text-xs"
              data-testid="probe-result"
            >
              {result.ok ? (
                <p className="text-[var(--ok)]">
                  ✓ 成功，采集 {result.samples.length} 个样本（最后值 ≈
                  {result.samples.at(-1)?.value ?? '—'} {result.samples.at(-1)?.unit ?? ''}）
                </p>
              ) : (
                <p className="text-[var(--danger)]">
                  ✗ 失败：{result.error?.code} — {result.error?.message}
                </p>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={running}>
              关闭
            </Button>
            <Button
              onClick={() => void handleProbe()}
              disabled={running || !selected}
              data-testid="probe-start"
            >
              {running ? '探测中…' : '开始探测'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
