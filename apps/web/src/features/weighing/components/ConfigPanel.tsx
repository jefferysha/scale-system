import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/ui/section-title';
import { SelectBox, type SelectOption } from '@/components/ui/select-box';
import { ProjectCombobox } from '@/features/projects/components/ProjectCombobox';
import { useVerticalsByProject } from '@/features/projects/hooks';
import { CupCombobox } from '@/features/cups/components/CupCombobox';
import type { CupLite, PointPosition, ProjectLite, VerticalLite, WeighingConfig } from '../types';

interface Props {
  config: Partial<WeighingConfig>;
  onChange: (cfg: Partial<WeighingConfig>) => void;
  onStart: () => void;
  onCommit: () => void;
  canStart: boolean;
  canCommit: boolean;
}

const POSITIONS: PointPosition[] = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];
const POSITION_OPTIONS: SelectOption[] = POSITIONS.map((p) => ({ value: p, label: p }));
const BOTTLE_OPTIONS: SelectOption[] = [
  { value: '1000', label: '1000' },
  { value: '500', label: '500' },
  { value: '250', label: '250' },
];

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

  const { data: verticals = [] } = useVerticalsByProject(config.project?.id ?? null);

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

  const verticalOptions: SelectOption[] = verticals.map((v) => ({
    value: String(v.id),
    label: `${v.code}${v.label ? ' · ' + v.label : ''}`,
  }));

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">称重设置</h3>

      {/* ── 项目信息 ── */}
      <div className="flex flex-col gap-2">
        <SectionTitle>项目信息</SectionTitle>
        <div className="space-y-1.5">
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
            onChange={(p) => onChange({ ...config, project: p ? toLite(p) : null, vertical: null })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-vertical">垂线号</Label>
            <SelectBox
              id="cfg-vertical"
              value={config.vertical?.id !== undefined ? String(config.vertical.id) : ''}
              disabled={!config.project}
              placeholder="—"
              options={verticalOptions}
              onChange={(val) => {
                const v = verticals.find((x) => x.id === Number(val));
                const lite: VerticalLite | null = v
                  ? { id: v.id, project_id: v.project_id, code: v.code, label: v.label ?? null }
                  : null;
                onChange({ ...config, vertical: lite });
              }}
              testId="cfg-vertical"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-volume">容积 mL</Label>
            <Input
              id="cfg-volume"
              type="number"
              step="50"
              value={config.volume_ml ?? 500}
              onChange={(e) => onChange({ ...config, volume_ml: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-bottle">瓶型</Label>
            <SelectBox
              id="cfg-bottle"
              value={String(bottle)}
              options={BOTTLE_OPTIONS}
              onChange={(val) => {
                const b = Number(val) as 1000 | 500 | 250;
                setBottle(b);
                onChange({ ...config, bottle: b });
              }}
              testId="cfg-bottle"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-depth">水深 m</Label>
            <Input
              id="cfg-depth"
              type="number"
              step="0.1"
              placeholder="例 2.5"
              value={config.water_depth_m ?? ''}
              onChange={(e) => onChange({ ...config, water_depth_m: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* ── 采样参数 ── */}
      <div className="flex flex-col gap-2">
        <SectionTitle>采样参数</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-start">开始时间</Label>
            <Input id="cfg-start" value={config.start_time ?? ''} placeholder="未开始" readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-end">结束时间</Label>
            <Input id="cfg-end" value="" placeholder="自动" readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-pos">点次</Label>
            <SelectBox
              id="cfg-pos"
              value={config.current_pos ?? '0.0'}
              options={POSITION_OPTIONS}
              onChange={(val) => onChange({ ...config, current_pos: val as PointPosition })}
              testId="cfg-pos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-cup">杯号</Label>
            <CupCombobox
              value={config.current_cup ?? null}
              onChange={(c) => onChange({ ...config, current_cup: c as CupLite | null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-tare">杯重 g</Label>
            <Input
              id="cfg-tare"
              className="no-spinner"
              value={config.current_cup?.current_tare_g ?? 0}
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-target">目标湿重 g</Label>
            <Input
              id="cfg-target"
              type="number"
              step="0.5"
              placeholder="—"
              value={config.target_wet_weight_g ?? ''}
              onChange={(e) => onChange({ ...config, target_wet_weight_g: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* ── 操作按钮 ── */}
      <div className="mt-1 flex gap-2 border-t border-[var(--line)] pt-3">
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
