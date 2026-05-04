import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentUser } from '@/features/auth/hooks';
import { isApiError } from '@/lib/api/error';
import type { Project, ProjectCreate, ProjectUpdate } from '@/types/api';
import {
  useCreateProject,
  useDeleteProject,
  useProjectsInfinite,
  useUpdateProject,
} from '../hooks';
import { ProjectForm } from './ProjectForm';

export default function ProjectList(): React.ReactElement {
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<
    { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; project: Project }
  >({ kind: 'closed' });
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';

  const { data, fetchNextPage, hasNextPage, isFetching } = useProjectsInfinite({
    q: q || undefined,
    limit: 20,
  });
  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  const createM = useCreateProject();
  const updateM = useUpdateProject();
  const deleteM = useDeleteProject();

  const handleCreate = async (body: ProjectCreate | ProjectUpdate): Promise<void> => {
    try {
      await createM.mutateAsync(body as ProjectCreate);
      setDialog({ kind: 'closed' });
      toast.success('项目已创建');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '创建失败');
    }
  };

  const handleUpdate = async (id: number, body: ProjectCreate | ProjectUpdate): Promise<void> => {
    try {
      await updateM.mutateAsync({ id, body });
      setDialog({ kind: 'closed' });
      toast.success('项目已更新');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '更新失败');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm('确认删除该项目？')) return;
    try {
      await deleteM.mutateAsync(id);
      toast.success('项目已删除');
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '删除失败');
    }
  };

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">项目管理</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索项目名…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72"
            data-testid="projects-search"
          />
          {isAdmin ? (
            <Button onClick={() => setDialog({ kind: 'create' })} data-testid="projects-new">
              <Plus className="size-4" /> 新建
            </Button>
          ) : null}
        </div>
      </header>

      <div className="overflow-auto rounded-md border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">立项日期</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">备注</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--text-3)]">
                  暂无项目
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-[var(--line)] hover:bg-[var(--bg-2)]/40"
                  data-testid={`project-row-${p.id}`}
                >
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.established_date ?? '—'}</td>
                  <td className="px-3 py-2">{p.is_active ? '启用' : '停用'}</td>
                  <td className="px-3 py-2 text-[var(--text-2)]">{p.notes ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: 'edit', project: p })}
                          aria-label={`编辑项目 ${p.name}`}
                          title="编辑"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(p.id)}
                          aria-label={`删除项目 ${p.name}`}
                          title="删除"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetching}
          >
            {isFetching ? '加载中…' : '加载更多'}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={dialog.kind !== 'closed'}
        onOpenChange={(open) => !open && setDialog({ kind: 'closed' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.kind === 'edit' ? '编辑项目' : '新建项目'}</DialogTitle>
          </DialogHeader>
          {dialog.kind === 'edit' ? (
            <ProjectForm
              initial={dialog.project}
              pending={updateM.isPending}
              onCancel={() => setDialog({ kind: 'closed' })}
              onSubmit={(body) => void handleUpdate(dialog.project.id, body)}
            />
          ) : dialog.kind === 'create' ? (
            <ProjectForm
              pending={createM.isPending}
              onCancel={() => setDialog({ kind: 'closed' })}
              onSubmit={(body) => void handleCreate(body)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
