import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getSerialAdapter } from '@/lib/platform';
import type { ProbeResult, ScaleConfig, SerialPortInfo } from '@/lib/serial/adapter';
import { isApiError } from '@/lib/api/error';

interface Props {
  /** 当前表单的串口/协议参数。当任一关键字段变更时应当重置 result。 */
  config: ScaleConfig;
  /** 已存在的天平 id：传入则探测后回写后端 audit。create 模式下传 undefined。 */
  scaleId?: number;
  /** 探测结果 callback，外部用于决定是否允许保存。 */
  onResult?: (ok: boolean) => void;
  reportProbe?: (id: number, ok: boolean, samples: ProbeResult['samples']) => Promise<void>;
}

/**
 * 天平表单内嵌的探测面板：列出串口、运行 probe、显示样本结果。
 * 不再用单独 Dialog，create / edit 时都内嵌在表单 modal 中。
 */
export function ScaleProbePanel({
  config,
  scaleId,
  onResult,
  reportProbe,
}: Props): React.ReactElement {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  const adapter = getSerialAdapter();
  const canRequestPermission = typeof adapter.requestPermission === 'function';

  const refreshPorts = useCallback(async (): Promise<SerialPortInfo[]> => {
    const ps = await adapter.listPorts();
    setPorts(ps);
    const first = ps[0];
    if (first) setSelected((cur) => cur || first.id);
    return ps;
  }, [adapter]);

  useEffect(() => {
    void refreshPorts();
    // scaleId 变化时刷新一次端口列表（虽然 Web Serial 不感知 scaleId，但保持兼容）
  }, [scaleId, refreshPorts]);

  const handleRequestPermission = async (): Promise<void> => {
    if (!adapter.requestPermission) return;
    const info = await adapter.requestPermission();
    if (info) {
      await refreshPorts();
      setSelected(info.id);
    }
  };

  // 配置改了就清结果
  useEffect(() => {
    setResult(null);
    onResult?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.baudRate,
    config.dataBits,
    config.parity,
    config.stopBits,
    config.flowControl,
    config.protocolType,
  ]);

  const handleProbe = async (): Promise<void> => {
    if (!selected) return;
    setRunning(true);
    try {
      const r = await adapter.probe(selected, config, 3000);
      setResult(r);
      onResult?.(r.ok);
      if (scaleId !== undefined && reportProbe) {
        await reportProbe(scaleId, r.ok, r.samples);
      }
      if (r.ok) toast.success(`探测成功，采集 ${r.samples.length} 个样本`);
      else toast.error(`探测失败：${r.error?.message ?? r.error?.code ?? '未知错误'}`);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '探测异常');
      onResult?.(false);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="space-y-2 rounded-md border border-[var(--line)] bg-[var(--bg-2)]/30 p-3"
      data-testid="scale-probe-panel"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="probe-port-inline">测试连接</Label>
          <Select
            id="probe-port-inline"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={ports.length === 0 || running}
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
        {canRequestPermission ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRequestPermission()}
            disabled={running}
            data-testid="probe-request-permission"
            title="Web Serial 首次连接需要在浏览器弹窗里选中天平串口"
          >
            添加设备
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleProbe()}
          disabled={running || !selected}
          data-testid="probe-start"
        >
          {running ? '探测中…' : '开始探测'}
        </Button>
      </div>

      {result ? (
        <div className="rounded-md bg-[var(--bg-1)] p-2 text-xs" data-testid="probe-result">
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
    </div>
  );
}
