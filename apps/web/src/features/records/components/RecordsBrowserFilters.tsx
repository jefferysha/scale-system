import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ProjectCombobox } from '@/features/projects/components/ProjectCombobox';
import { useVerticalsByProject } from '@/features/projects/hooks';
import type { Project } from '@/types/api';

export interface RecordsFilterState {
  project: Project | null;
  vertical_id: number | null;
  date_from: string;
  date_to: string;
  cup_number: string;
}

interface Props {
  filter: RecordsFilterState;
  onChange: (next: RecordsFilterState) => void;
  onExport: () => void;
  exporting?: boolean;
}

export function RecordsBrowserFilters({
  filter,
  onChange,
  onExport,
  exporting,
}: Props): React.ReactElement {
  const { data: verticals = [] } = useVerticalsByProject(filter.project?.id ?? null);

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-end gap-3">
      <div className="space-y-2">
        <Label>项目</Label>
        <ProjectCombobox
          value={filter.project}
          onChange={(p) => onChange({ ...filter, project: p, vertical_id: null })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rec-vertical">垂线</Label>
        <Select
          id="rec-vertical"
          value={filter.vertical_id ?? ''}
          onChange={(e) =>
            onChange({
              ...filter,
              vertical_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          disabled={!filter.project}
        >
          <option value="">全部</option>
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rec-from">起始日期</Label>
        <Input
          id="rec-from"
          type="date"
          value={filter.date_from}
          onChange={(e) => onChange({ ...filter, date_from: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rec-to">结束日期</Label>
        <Input
          id="rec-to"
          type="date"
          value={filter.date_to}
          onChange={(e) => onChange({ ...filter, date_to: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rec-cup">杯号</Label>
        <Input
          id="rec-cup"
          placeholder="C-…"
          value={filter.cup_number}
          onChange={(e) => onChange({ ...filter, cup_number: e.target.value })}
        />
      </div>
      <Button
        variant="outline"
        onClick={onExport}
        disabled={exporting}
        data-testid="records-export"
      >
        <Download className="size-4" /> {exporting ? '导出中…' : '导出 CSV'}
      </Button>
    </div>
  );
}
