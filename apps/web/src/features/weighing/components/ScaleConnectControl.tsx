import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useScales } from '@/features/scales/hooks';
import { getSerialAdapter } from '@/lib/platform';
import type { ScaleConfig, SerialPortInfo } from '@/lib/serial/adapter';
import type { Scale } from '@/types/api';
import { useScaleStreamStore } from '@/stores/scale-stream-store';

const toScaleConfig = (s: Scale): ScaleConfig => ({
  baudRate: s.baud_rate,
  dataBits: (s.data_bits === 7 ? 7 : 8) as 7 | 8,
  parity: s.parity,
  stopBits: (s.stop_bits === 2 ? 2 : 1) as 1 | 2,
  flowControl: s.flow_control === 'rtscts' ? 'hardware' : 'none',
  protocolType: s.protocol_type,
  readTimeoutMs: s.read_timeout_ms,
  decimalPlaces: s.decimal_places,
  unitDefault: s.unit_default,
});

interface Props {
  /** 当前已选定的天平（连接成功后由父组件保存）。 */
  scaleId: number | null;
  onScaleChange: (id: number | null) => void;
}

/**
 * 采集页"硬件连接"控件：
 * 1. 选天平（来自后端 /scales）→ 决定 ScaleConfig
 * 2. 添加设备（Web Serial 必须用户手势触发；mock/unsupported 无此按钮）
 * 3. 选端口 → 连接 / 断开
 *
 * 连接状态走 useScaleStreamStore.connection。
 */
export function ScaleConnectControl({ scaleId, onScaleChange }: Props): React.ReactElement {
  const { data: scales = [] } = useScales({ is_active: true });
  const connection = useScaleStreamStore((s) => s.connection);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [portId, setPortId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const adapter = getSerialAdapter();
  const supportsRequest = typeof adapter.requestPermission === 'function';
  const isConnected = connection === 'connected' || connection === 'reading';

  const refreshPorts = async (): Promise<SerialPortInfo[]> => {
    const ps = await adapter.listPorts();
    setPorts(ps);
    if (!portId && ps[0]) setPortId(ps[0].id);
    return ps;
  };

  useEffect(() => {
    void refreshPorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (): Promise<void> => {
    if (!adapter.requestPermission) return;
    const info = await adapter.requestPermission();
    if (info) {
      await refreshPorts();
      setPortId(info.id);
    }
  };

  const handleConnect = async (): Promise<void> => {
    const scale = scales.find((s) => s.id === scaleId);
    if (!scale) {
      toast.error('请先选择天平');
      return;
    }
    if (!portId) {
      toast.error('请先选择端口');
      return;
    }
    setBusy(true);
    try {
      await adapter.open(portId, toScaleConfig(scale));
      toast.success(`已连接 ${scale.name}`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error(`连接失败：${err.code ?? ''} ${err.message ?? ''}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    setBusy(true);
    try {
      await adapter.close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3"
      data-testid="scale-connect-control"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">硬件连接</h3>
        <span
          className={
            'rounded px-2 py-0.5 text-xs ' +
            (isConnected
              ? 'bg-[var(--ok)]/15 text-[var(--ok)]'
              : connection === 'opening'
                ? 'bg-[var(--warn)]/15 text-[var(--warn)]'
                : 'bg-[var(--bg-2)] text-[var(--text-3)]')
          }
        >
          {connection}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cn-scale">天平</Label>
        <Select
          id="cn-scale"
          value={scaleId !== null ? String(scaleId) : ''}
          onChange={(e) => onScaleChange(e.target.value ? Number(e.target.value) : null)}
          disabled={isConnected || busy}
        >
          <option value="">— 选择天平 —</option>
          {scales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.baud_rate} · {s.protocol_type})
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cn-port">端口</Label>
          <Select
            id="cn-port"
            value={portId}
            onChange={(e) => setPortId(e.target.value)}
            disabled={ports.length === 0 || isConnected || busy}
          >
            {ports.length === 0 ? (
              <option value="">无可用端口</option>
            ) : (
              ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))
            )}
          </Select>
        </div>
        {supportsRequest && !isConnected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleAdd()}
            disabled={busy}
            data-testid="scale-connect-add-device"
          >
            添加设备
          </Button>
        ) : null}
        {isConnected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleDisconnect()}
            disabled={busy}
            data-testid="scale-connect-disconnect"
          >
            断开
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleConnect()}
            disabled={busy || scaleId === null || !portId}
            data-testid="scale-connect-connect"
          >
            {busy ? '...' : '连接'}
          </Button>
        )}
      </div>
    </section>
  );
}
