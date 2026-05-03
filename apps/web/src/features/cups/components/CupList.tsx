import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Scale, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/features/auth/hooks';
import { isApiError } from '@/lib/api/error';
import type { Cup, CupCreate, CupUpdate } from '@/types/api';
import {
  useCreateCup,
  useCups,
  useDeleteCup,
  useUpdateCup,
} from '../hooks';
import { CupForm } from './CupForm';
import { CalibrationDialog } from './CalibrationDialog';
import { CalibrationHistoryDrawer } from './CalibrationHistoryDrawer';

const PAGE_SIZE = 20;

export default function CupList(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<
    { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; cup: Cup }
  >({ kind: 'closed' });
  const [calibrate, setCalibrate] = useState<Cup | null>(null);
  const [history, setHistory] = useState<Cup | null>(null);

  const { data } = useCups({
    q: q || undefined,
    page,
    size: PAGE_SIZE,
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const createM = useCreateCup();
  const updateM = useUpdateCup();
  const deleteM = useDeleteCup();

  const handleSave = async (
    body: CupCreate | CupUpdate,
    edit: Cup | null,
  ): Promise<void> => {
    try {
      if (edit) {
        await updateM.mutateAsync({ id: edit.id, body: body as CupUpdate });
        toast.success('已更新');
      } else {
        await createM.mutateAsync(body as CupCreate);
        toast.success('已创建');
      }
      setDialog({ kind: 'closed' });
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '保存失败');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm('停用该杯？')) return;
    try {
      await deleteM.mutateAsync(id);
      toast.success('已停用');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '操作失败');
    }
  };

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">杯库管理</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索杯号…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-64"
            data-testid="cups-search"
          />
          {isAdmin ? (
            <Button onClick={() => setDialog({ kind: 'create' })} data-testid="cups-new">
              <Plus className="size-4" /> 新建
            </Button>
          ) : null}
        </div>
      </header>

      <div className="overflow-auto rounded-md border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-3 py-2 text-left">杯号</th>
              <th className="px-3 py-2 text-right">皮重 g</th>
              <th className="px-3 py-2 text-left">最近率定</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--text-3)]">
                  暂无杯
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[var(--line)] hover:bg-[var(--bg-2)]/40"
                  data-testid={`cup-row-${c.id}`}
                >
                  <td className="px-3 py-2 font-mono">{c.cup_number}</td>
                  <td className="px-3 py-2 text-right font-mono">{c.current_tare_g}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.latest_calibration_date ?? '—'}
                  </td>
                  <td className="px-3 py-2">{c.is_active ? '启用' : '停用'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCalibrate(c)}
                        data-testid={`cup-calibrate-${c.id}`}
                      >
                        <Scale className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistory(c)}
                        data-testid={`cup-history-${c.id}`}
                      >
                        <History className="size-4" />
                      </Button>
                      {isAdmin ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ kind: 'edit', cup: c })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(c.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between text-xs text-[var(--text-3)]">
        <span>
          共 {total} 条，第 {page} / {lastPage} 页
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            下一页
          </Button>
        </div>
      </footer>

      <Dialog
        open={dialog.kind !== 'closed'}
        onOpenChange={(o) => !o && setDialog({ kind: 'closed' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.kind === 'edit' ? '编辑杯' : '新建杯'}</DialogTitle>
          </DialogHeader>
          {dialog.kind === 'edit' ? (
            <CupForm
              initial={dialog.cup}
              pending={updateM.isPending}
              onCancel={() => setDialog({ kind: 'closed' })}
              onSubmit={(b) => void handleSave(b, dialog.cup)}
            />
          ) : dialog.kind === 'create' ? (
            <CupForm
              pending={createM.isPending}
              onCancel={() => setDialog({ kind: 'closed' })}
              onSubmit={(b) => void handleSave(b, null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <CalibrationDialog cup={calibrate} onClose={() => setCalibrate(null)} />
      <CalibrationHistoryDrawer cup={history} onClose={() => setHistory(null)} />
    </section>
  );
}
