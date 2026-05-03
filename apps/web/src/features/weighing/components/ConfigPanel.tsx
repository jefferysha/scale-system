import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ProjectCombobox } from '@/features/projects/components/ProjectCombobox';
import { useVerticalsByProject } from '@/features/projects/hooks';
import { useCups } from '@/features/cups/hooks';
import type {
  CupLite,
  PointPosition,
  ProjectLite,
  VerticalLite,
  WeighingConfig,
} from '../types';

interface Props {
  config: Partial<WeighingConfig>;
  onChange: (cfg: Partial<WeighingConfig>) => void;
  onStart: () => void;
  onCommit: () => void;
  canStart: boolean;
  canCommit: boolean;
}

const POSITIONS: PointPosition[] = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

const toLite = (p: {
  id: number;
  name: string;
  established_date?: string | null;
}): ProjectLite => ({
  id: p.id,
  name: p.name,
  established_date: p.established_date ?? null,
});

export function ConfigPanel({
  config,
  onChange,
  onStart,
  onCommit,
  canStart,
  canCommit,
}: Props): React.ReactElement {
  const [bottle, setBottle] = useState<1000 | 500 | 250>(config.bottle ?? 1000);
  const [cupSearch, setCupSearch] = useState('');

  const { data: verticals = [] } = useVerticalsByProject(config.project?.id ?? null);
  const { data: cupsPage } = useCups({ q: cupSearch || undefined, page: 1, size: 20 });
  const cups = cupsPage?.items ?? [];

  // 当当前项目变更后，垂线选择被清空。
  useEffect(() => {
    if (
      config.vertical &&
      verticals.length > 0 &&
      !verticals.find((v) => v.id === config.vertical?.id)
    ) {
      onChange({ ...config, vertical: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticals.length, config.project?.id]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">称重设置</h3>

      <div className="space-y-2">
        <Label>称重项目</Label>
        <ProjectCombobox
          value={
            config.project
              ? {
                  id: config.project.id,
                  name: config.project.name,
                  established_date: config.project.established_date,
                  notes: null,
                  is_active: true,
                  created_at: '',
                  updated_at: '',
                }
              : null
          }
          onChange={(p) =>
            onChange({ ...config, project: p ? toLite(p) : null, vertical: null })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cfg-vertical">垂线号</Label>
          <Select
            id="cfg-vertical"
            value={config.vertical?.id ?? ''}
            disabled={!config.project}
            onChange={(e) => {
              const v = verticals.find((x) => x.id === Number(e.target.value));
              const lite: VerticalLite | null = v
                ? { id: v.id, project_id: v.project_id, code: v.code, label: v.label ?? null }
                : null;
              onChange({ ...config, vertical: lite });
            }}
          >
            <option value="">—</option>
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code}
                {v.label ? ` · ${v.label}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-volume">容积 mL</Label>
          <Input
            id="cfg-volume"
            type="number"
            value={config.volume_ml ?? 500}
            onChange={(e) => onChange({ ...config, volume_ml: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cfg-bottle">瓶型</Label>
          <Select
            id="cfg-bottle"
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
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-depth">水深 m</Label>
          <Input
            id="cfg-depth"
            type="number"
            step="0.1"
            value={config.water_depth_m ?? ''}
            onChange={(e) => onChange({ ...config, water_depth_m: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cfg-pos">点次</Label>
          <Select
            id="cfg-pos"
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
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-cup">杯号</Label>
          <Input
            id="cfg-cup-search"
            placeholder="搜索杯号…"
            value={cupSearch}
            onChange={(e) => setCupSearch(e.target.value)}
          />
          <Select
            id="cfg-cup"
            value={config.current_cup?.id ?? ''}
            onChange={(e) => {
              const c = cups.find((x) => x.id === Number(e.target.value));
              const lite: CupLite | null = c
                ? {
                    id: c.id,
                    cup_number: c.cup_number,
                    current_tare_g: Number(c.current_tare_g),
                  }
                : null;
              onChange({ ...config, current_cup: lite });
            }}
          >
            <option value="">—</option>
            {cups.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cup_number}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cfg-tare">杯重 g</Label>
          <Input id="cfg-tare" value={config.current_cup?.current_tare_g ?? 0} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-target">目标湿重 g</Label>
          <Input
            id="cfg-target"
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
