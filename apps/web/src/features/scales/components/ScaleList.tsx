import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentUser } from '@/features/auth/hooks';
import { isApiError } from '@/lib/api/error';
import type { Scale, ScaleCreate, ScaleUpdate } from '@/types/api';
import { useCreateScale, useDeleteScale, useScales, useUpdateScale } from '../hooks';
import { ScaleForm } from './ScaleForm';
import { ScaleProbeDialog } from './ScaleProbeDialog';

export default function ScaleList(): React.ReactElement {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';
  const [dialog, setDialog] = useState<
    { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; scale: Scale }
  >({ kind: 'closed' });
  const [probe, setProbe] = useState<Scale | null>(null);

  const { data: rows = [] } = useScales();
  const createM = useCreateScale();
  const updateM = useUpdateScale();
  const deleteM = useDeleteScale();

  const handleSave = async (
    payload: ScaleCreate | ScaleUpdate,
    edit: Scale | null,
  ): Promise<void> => {
    try {
      if (edit) {
        await updateM.mutateAsync({ id: edit.id, body: payload as ScaleUpdate });
        toast.success('已更新');
      } else {
        await createM.mutateAsync(payload as ScaleCreate);
        toast.success('已创建');
      }
      setDialog({ kind: 'closed' });
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '保存失败');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm('删除该天平配置？')) return;
    try {
      await deleteM.mutateAsync(id);
      toast.success('已删除');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '删除失败');
    }
  };

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">天平管理</h2>
        {isAdmin ? (
          <Button onClick={() => setDialog({ kind: 'create' })} data-testid="scales-new">
            <Plus className="size-4" /> 新建
          </Button>
        ) : null}
      </header>

      <div className="overflow-auto rounded-md border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">型号</th>
              <th className="px-3 py-2 text-left">协议</th>
              <th className="px-3 py-2 text-left">串口参数</th>
              <th className="px-3 py-2 text-left">小数位</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--text-3)]">
                  暂无天平
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-[var(--line)] hover:bg-[var(--bg-2)]/40"
                  data-testid={`scale-row-${s.id}`}
                >
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.model ?? '—'}</td>
                  <td className="px-3 py-2">{s.protocol_type}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.baud_rate}/{s.data_bits}
                    {s.parity[0]?.toUpperCase()}/{s.stop_bits}
                  </td>
                  <td className="px-3 py-2">{s.decimal_places}</td>
                  <td className="px-3 py-2">{s.is_active ? '启用' : '停用'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProbe(s)}
                        aria-label={`探测 ${s.name} 连接`}
                        title="探测连接"
                        data-testid={`scale-probe-${s.id}`}
                      >
                        <Cable className="size-4" aria-hidden="true" />
                      </Button>
                      {isAdmin ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ kind: 'edit', scale: s })}
                            aria-label={`编辑 ${s.name}`}
                            title="编辑"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(s.id)}
                            aria-label={`删除 ${s.name}`}
                            title="删除"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
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

      <Dialog
        open={dialog.kind !== 'closed'}
        onOpenChange={(o) => !o && setDialog({ kind: 'closed' })}
      >
        <DialogContent className="w-[min(96vw,860px)] max-w-none p-5">
          <DialogHeader>
            <DialogTitle>{dialog.kind === 'edit' ? '编辑天平' : '新建天平'}</DialogTitle>
          </DialogHeader>
          {dialog.kind === 'edit' ? (
            <ScaleForm
              initial={dialog.scale}
              pending={updateM.isPending}
              onCancel={() => setDialog({ kind: 'closed' })}
              onSubmit={(v) => void handleSave(v, dialog.scale)}
            />
          ) : dialog.kind === 'create' ? (
            <ScaleForm
              pending={createM.isPending}
              onCancel={() => setDialog({ kind: 'closed' })}
              onSubmit={(v) => void handleSave(v, null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ScaleProbeDialog scale={probe} onClose={() => setProbe(null)} />
    </section>
  );
}
