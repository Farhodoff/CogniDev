import { useEffect, useState } from 'react';
import { Folder, Sparkles, Plus, Layers, Users } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { fetchTagCounts } from '../lib/db';

export default function Sidebar() {
  const {
    tasks,
    prompts,
    workspaces,
    activeWorkspaceId,
    setWorkspace,
    setFilter,
    quickFilter,
    setSearch,
    triggerStandup,
    createWorkspace,
    dbMode,
  } = useSynapse();

  const [creatingWs, setCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  useEffect(() => {
    if (dbMode === 'sqlite') {
      fetchTagCounts().catch(() => {});
    }
  }, [dbMode, tasks.length, prompts.length]);

  return (
    <aside className="flex w-[246px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] bg-[#0f1013]/80 px-3 py-4">
      <nav className="space-y-0.5">
        <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Boshqaruv</p>
        <button
          onClick={() => { setFilter(null); setSearch(''); }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            quickFilter === null ? 'bg-white/[0.08] text-white font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Layers size={15} className="text-sky-400" />
          <span>Daily Stream</span>
          <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
            {tasks.filter((t) => t.workspace_id === activeWorkspaceId).length}
          </span>
        </button>
      </nav>

      <nav className="space-y-1">
        <div className="flex items-center justify-between px-2.5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Omborlar</p>
          <button
            onClick={() => setCreatingWs((v) => !v)}
            className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition"
          >
            <Plus size={13} />
          </button>
        </div>

        {creatingWs && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (newWsName.trim()) {
                await createWorkspace(newWsName.trim(), 'personal');
                setNewWsName('');
                setCreatingWs(false);
              }
            }}
            className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-2"
          >
            <input
              autoFocus
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Ombor nomi…"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => { setCreatingWs(false); setNewWsName(''); }}
                className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Bekor
              </button>
              <button
                type="submit"
                disabled={!newWsName.trim()}
                className="rounded bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-400 disabled:opacity-40"
              >
                Saqlash
              </button>
            </div>
          </form>
        )}

        {workspaces.map((w) => {
          const taskCount = tasks.filter((t) => t.workspace_id === w.id).length;
          const isSelected = w.id === activeWorkspaceId;
          return (
            <button
              key={w.id}
              onClick={() => setWorkspace(w.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition ${
                isSelected ? 'bg-white/[0.08] text-white font-semibold' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <span className={isSelected ? 'text-sky-300' : 'text-zinc-500'}>
                {w.type === 'team' ? <Users size={14} className="text-violet-400" /> : <Folder size={14} />}
              </span>
              <span className="truncate">{w.id === 'ws-personal' ? 'Personal Sandbox' : w.name}</span>
              {taskCount > 0 && (
                <span className="ml-auto rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300">
                  {taskCount}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => triggerStandup()}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-violet-500/10 px-2.5 py-2 text-left text-[12.5px] font-medium text-violet-200 hover:bg-violet-500/20 transition"
        >
          <Sparkles size={14} className="text-violet-300" />
          AI Kunlik Standup
        </button>
      </nav>
    </aside>
  );
}
