import { filteredTasks, useSynapse } from '../lib/store';
import { Plus } from 'lucide-react';

export default function TaskStream() {
  const {
    tasks,
    selectedTaskId,
    selectTask,
    quickFilter,
    sortOrder,
    activeWorkspaceId,
    search,
    setTaskModal,
  } = useSynapse();

  const workspaceTasks = tasks.filter((t) => t.workspace_id === activeWorkspaceId);
  const visible = filteredTasks(tasks, quickFilter, search, activeWorkspaceId, sortOrder);

  return (
    <section className="flex w-[370px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0f1013]/60 relative">
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-zinc-100">Daily Engineering Stream</h2>
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300 font-mono text-[10.5px] font-semibold">
            {workspaceTasks.length}
          </span>
        </div>
        <button onClick={() => setTaskModal(true)} className="rounded-lg p-1.5 hover:bg-white/10 text-zinc-400">
          <Plus size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {visible.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTask(t.id)}
            className={`w-full rounded-2xl border p-3.5 text-left transition ${
              t.id === selectedTaskId
                ? 'border-sky-400/50 bg-gradient-to-b from-sky-500/[0.12] to-white/[0.02]'
                : 'border-white/[0.06] bg-zinc-900/60 hover:bg-zinc-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">{t.id}</span>
              <span className="rounded-md border border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0.5 text-[10.5px] text-zinc-300">{t.status}</span>
            </div>
            <p className="mt-2 text-[13.5px] font-semibold text-zinc-100">{t.title}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
