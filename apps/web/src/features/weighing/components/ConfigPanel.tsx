import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MOCK_CUPS, MOCK_PROJECTS, MOCK_VERTICALS } from '../mock-data';
import type { PointPosition, WeighingConfig } from '../types';

interface Props {
  config: Partial<WeighingConfig>;
  onChange: (cfg: Partial<WeighingConfig>) => void;
  onStart: () => void;
  onCommit: () => void;
  canStart: boolean;
  canCommit: boolean;
}

const POSITIONS: PointPosition[] = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

export function ConfigPanel({
  config,
  onChange,
  onStart,
  onCommit,
  canStart,
  canCommit,
}: Props): React.ReactElement {
  const [bottle, setBottle] = useState<1000 | 500 | 250>(config.bottle ?? 1000);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">称重设置</h3>

      <div className="space-y-2">
        <Label>称重项目</Label>
        <select
          className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
          value={config.project?.id ?? ''}
          onChange={(e) => {
            const p = MOCK_PROJECTS.find((x) => x.id === Number(e.target.value)) ?? null;
            onChange({ ...config, project: p, vertical: null });
          }}
        >
          <option value="">选择项目</option>
          {MOCK_PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>垂线号</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={config.vertical?.id ?? ''}
            disabled={!config.project}
            onChange={(e) => {
              const v = MOCK_VERTICALS.find((x) => x.id === Number(e.target.value)) ?? null;
              onChange({ ...config, vertical: v });
            }}
          >
            <option value="">—</option>
            {MOCK_VERTICALS.filter((v) => v.project_id === config.project?.id).map((v) => (
              <option key={v.id} value={v.id}>
                {v.code}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>容积 mL</Label>
          <Input
            type="number"
            value={config.volume_ml ?? 500}
            onChange={(e) => onChange({ ...config, volume_ml: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>瓶型</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={bottle}
            onChange={(e) => {
              const b = Number(e.target.value) as 1000 | 500 | 250;
              setBottle(b);
              onChange({ ...config, bottle: b });
            }}
          >
            <option value="1000">1000</option>
            <option value="500">500</option>
            <option value="250">250</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>水深 m</Label>
          <Input
            type="number"
            step="0.1"
            value={config.water_depth_m ?? ''}
            onChange={(e) => onChange({ ...config, water_depth_m: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>点次</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={config.current_pos ?? '0.0'}
            onChange={(e) =>
              onChange({ ...config, current_pos: e.target.value as PointPosition })
            }
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>杯号</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={config.current_cup?.id ?? ''}
            onChange={(e) => {
              const c = MOCK_CUPS.find((x) => x.id === Number(e.target.value)) ?? null;
              onChange({ ...config, current_cup: c });
            }}
          >
            <option value="">—</option>
            {MOCK_CUPS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cup_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>杯重 g</Label>
          <Input value={config.current_cup?.current_tare_g ?? 0} readOnly />
        </div>
        <div className="space-y-2">
          <Label>目标湿重 g</Label>
          <Input
            type="number"
            value={config.target_wet_weight_g ?? ''}
            onChange={(e) =>
              onChange({ ...config, target_wet_weight_g: Number(e.target.value) })
            }
          />
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button className="flex-1" onClick={onStart} disabled={!canStart}>
          开始称重
        </Button>
        <Button className="flex-1" variant="outline" onClick={onCommit} disabled={!canCommit}>
          录入
        </Button>
      </div>
    </section>
  );
}
