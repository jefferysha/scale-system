import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/hooks';
import { isApiError } from '@/lib/api/error';
import type { RecordItem } from '@/types/api';
import { useDeleteRecord, useExportRecords, useRecordsInfinite } from '../hooks';
import { RecordsBrowserColumns } from './RecordsBrowserColumns';
import { RecordsBrowserFilters, type RecordsFilterState } from './RecordsBrowserFilters';
import { RecordsBrowserRowActions } from './RecordsBrowserRowActions';
import { RecordDetailDrawer } from './RecordDetailDrawer';

const initialFilter: RecordsFilterState = {
  project: null,
  vertical_id: null,
  date_from: '',
  date_to: '',
  cup_number: '',
};

const triggerCsvDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function RecordsBrowser(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';
  const [filter, setFilter] = useState<RecordsFilterState>(initialFilter);
  const [detail, setDetail] = useState<RecordItem | null>(null);

  const queryParams = useMemo(
    () => ({
      project_id: filter.project?.id,
      vertical_id: filter.vertical_id ?? undefined,
      date_from: filter.date_from || undefined,
      date_to: filter.date_to || undefined,
      cup_number: filter.cup_number || undefined,
      limit: 50,
    }),
    [filter],
  );

  const { data, fetchNextPage, hasNextPage, isFetching } = useRecordsInfinite(queryParams);
  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  const exportM = useExportRecords();
  const deleteM = useDeleteRecord();

  const onExport = async (): Promise<void> => {
    try {
      const blob = await exportM.mutateAsync({
        project_id: filter.project?.id,
        vertical_id: filter.vertical_id ?? undefined,
        date_from: filter.date_from || undefined,
        date_to: filter.date_to || undefined,
      });
      triggerCsvDownload(blob, `records-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CSV 已导出');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '导出失败');
    }
  };

  const onDelete = async (record: RecordItem): Promise<void> => {
    if (!confirm(`确认删除记录 #${record.id}？`)) return;
    try {
      await deleteM.mutateAsync(record.id);
      toast.success('已删除');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '删除失败');
    }
  };

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">数据浏览</h2>
      </header>
      <RecordsBrowserFilters
        filter={filter}
        onChange={setFilter}
        onExport={() => void onExport()}
        exporting={exportM.isPending}
      />
      <RecordsBrowserColumns
        rows={rows}
        onSelect={setDetail}
        onDelete={isAdmin ? (r) => void onDelete(r) : undefined}
        isAdmin={!!isAdmin}
      />
      <RecordsBrowserRowActions
        hasNext={!!hasNextPage}
        isFetching={isFetching}
        totalLoaded={rows.length}
        onLoadMore={() => void fetchNextPage()}
      />
      <RecordDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
