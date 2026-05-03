import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { RecordItem } from '@/types/api';

interface Props {
  record: RecordItem | null;
  onClose: () => void;
}

export function RecordDetailDrawer({ record, onClose }: Props): React.ReactElement | null {
  const [copied, setCopied] = useState(false);
  if (!record) return null;

  const copyUid = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(record.client_uid);
      setCopied(true);
      toast.success('已复制 client_uid');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败');
    }
  };

  const points = record.points as Array<Record<string, unknown>>;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-[560px] flex-col border-l border-[var(--line)] bg-[var(--bg-1)] shadow-xl"
      data-testid="record-detail-drawer"
    >
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">记录详情 — #{record.id}</h3>
          <p className="text-xs text-[var(--text-3)]">
            {record.sample_date} · 项目 P-{record.project_id} · 垂线 V-{record.vertical_id}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3 text-xs">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <dt className="text-[var(--text-3)]">client_uid</dt>
          <dd className="flex items-center gap-2 font-mono">
            <span className="truncate">{record.client_uid}</span>
            <button
              type="button"
              className="text-[var(--acc)]"
              onClick={() => void copyUid()}
              data-testid="record-copy-uid"
            >
              <Copy className="size-3" />
              {copied ? '已复制' : ''}
            </button>
          </dd>
          <dt className="text-[var(--text-3)]">潮型</dt>
          <dd>{record.tide_type ?? '—'}</dd>
          <dt className="text-[var(--text-3)]">水深 m</dt>
          <dd className="font-mono">{record.water_depth_m ?? '—'}</dd>
          <dt className="text-[var(--text-3)]">体积 mL</dt>
          <dd className="font-mono">{record.volume_ml ?? '—'}</dd>
          <dt className="text-[var(--text-3)]">起止时间</dt>
          <dd className="font-mono">
            {record.start_time ?? '—'} → {record.end_time ?? '—'}
          </dd>
          <dt className="text-[var(--text-3)]">操作员</dt>
          <dd>{record.operator_id ?? '—'}</dd>
          <dt className="text-[var(--text-3)]">来源</dt>
          <dd>{record.source}</dd>
          <dt className="text-[var(--text-3)]">平均含沙</dt>
          <dd className="font-mono">{record.computed_avg_concentration ?? '—'}</dd>
        </dl>

        <h4 className="mt-4 text-xs font-semibold text-[var(--text)]">点位明细</h4>
        <table className="mt-2 w-full text-xs">
          <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-2 py-1 text-left">pos</th>
              <th className="px-2 py-1 text-left">cup</th>
              <th className="px-2 py-1 text-right">tare g</th>
              <th className="px-2 py-1 text-right">湿重 g</th>
              <th className="px-2 py-1 text-right">含沙 mg/L</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-2 text-center text-[var(--text-3)]">
                  暂无点位
                </td>
              </tr>
            ) : (
              points.map((p, idx) => (
                <tr key={idx} className="border-t border-[var(--line)]">
                  <td className="px-2 py-1 font-mono">{String(p.pos ?? '')}</td>
                  <td className="px-2 py-1 font-mono">{String(p.cup_number ?? '—')}</td>
                  <td className="px-2 py-1 text-right font-mono">{String(p.cup_tare_g ?? '—')}</td>
                  <td className="px-2 py-1 text-right font-mono">
                    {String(p.wet_weight_g ?? '—')}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {String(p.concentration_mg_l ?? '—')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {record.notes ? (
          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--bg-2)]/40 p-2">
            <span className="text-[var(--text-3)]">备注：</span>
            <span className="text-[var(--text-2)]">{record.notes}</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
