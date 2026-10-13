import { useEffect, useState } from 'react';
import {
  Folder,
  Plus,
  Trophy,
  Layers,
  Users,
  X,
  HelpCircle,
  FileText,
  Lightbulb,
  Compass,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { isBlocker } from '../lib/ai';
import { fetchTagCounts } from '../lib/db';

export default function Sidebar() {
  const {
    tasks,
    prompts,
    search,
    workspaces,
    activeWorkspaceId,
    setWorkspace,
    setFilter,
    quickFilter,
    activeTag,
    setActiveTag,
    setSearch,
    createWorkspace,
    dbMode,
    groups,
    activeGroupId,
    setActiveGroup,
    createGroup,
    deleteGroup,
    userProfile,
    setProfileModal,
    setGuideModal,
    mainView,
    setMainView,
    notesDocs,
    roadmaps,
    projectIdeas,
  } = useSynapse();

  const [dbTagCounts, setDbTagCounts] = useState<{
    promptLibrary: number;
    bugFix: number;
    blocker: number;
    architecture: number;
  } | null>(null);

  const [creatingWs, setCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'personal' | 'team'>('personal');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#38bdf8');

  // Poll or fetch tag counts when SQLite is ready or tasks change
  useEffect(() => {
    let mounted = true;
    if (dbMode === 'sqlite') {
      fetchTagCounts()
        .then((counts) => {
          if (mounted) setDbTagCounts(counts);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [dbMode, tasks.length, prompts.length]);

  // Compute fallback / in-memory counts
  const memBlockerCount = tasks.filter(isBlocker).length;
  const blockerCount = dbTagCounts ? dbTagCounts.blocker : memBlockerCount;

  // --- Haqiqiy teglar statistikasi (joriy workspace) ---
  const wsTagTasks = tasks.filter((t) => t.workspace_id === activeWorkspaceId);
  const tagStats: Array<{ tag: string; count: number }> = (() => {
    const map = new Map<string, number>();
    for (const t of wsTagTasks) {
      for (const tag of t.tags ?? []) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 8);
  })();

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const isPersonal = !activeWs || activeWs.type === 'personal';

  // Extract unique assignees from real tasks in current workspace
  const workspaceAssignees = Array.from(
    new Set(
      tasks
        .filter((t) => t.workspace_id === activeWorkspaceId && t.assignee_name)
        .map((t) => t.assignee_name as string),
    ),
  );

  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <aside className="flex w-[246px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] bg-[#0f1013]/80 px-3 py-4">
      {/* Asosiy Ish Maydonlari (Workspaces & Views) */}
      <nav className="space-y-1">
        <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Boshqaruv</p>
        
        {/* 1. Vazifalar Oqimi */}
        <button
          onClick={() => { setMainView('stream'); setFilter(null); setSearch(''); }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            mainView === 'stream' && quickFilter === null && search.trim() === ''
              ? 'bg-white/[0.08] text-white font-semibold'
              : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Layers size={15} className="text-sky-400" />
          <span>Vazifalar Oqimi</span>
          <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
            {tasks.filter((t) => t.workspace_id === activeWorkspaceId).length}
          </span>
        </button>

        {/* 2. Notion Qaydlar */}
        <button
          onClick={() => setMainView('notes')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            mainView === 'notes' ? 'bg-purple-500/15 text-purple-300 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <FileText size={15} className="text-purple-400" />
          <span>Notion Qaydlar</span>
          <span className="ml-auto rounded-md bg-purple-500/10 px-1.5 py-0.5 font-mono text-[11px] text-purple-300">
            {notesDocs.length}
          </span>
        </button>

        {/* 3. Roadmap & O'rganish */}
        <button
          onClick={() => setMainView('roadmap')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            mainView === 'roadmap' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Compass size={15} className="text-amber-400" />
          <span>Roadmap & O'rganish</span>
          <span className="ml-auto rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-400">
            {roadmaps.length}
          </span>
        </button>

        {/* 4. G'oyalar & Loyihalar */}
        <button
          onClick={() => setMainView('ideas')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            mainView === 'ideas' ? 'bg-orange-500/15 text-orange-300 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Lightbulb size={15} className="text-orange-400" />
          <span>G'oyalar Inkubatori</span>
          <span className="ml-auto rounded-md bg-orange-500/10 px-1.5 py-0.5 font-mono text-[11px] text-orange-400">
            {projectIdeas.length}
          </span>
        </button>

        {/* 5. Haftalik Tahlil */}
        <button
          onClick={() => setMainView('retro')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            mainView === 'retro' ? 'bg-emerald-500/15 text-emerald-300 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Trophy size={15} className="text-emerald-400" />
          <span>Haftalik Tahlil</span>
          <span className="ml-auto rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-400">
            {completedCount}
          </span>
        </button>
      </nav>

      {/* Workspaces (Omborlar) */}
      <nav className="space-y-1">
        <div className="flex items-center justify-between px-2.5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Omborlar</p>
          <button
            onClick={() => setCreatingWs((v) => !v)}
            title="Yangi ombor qo'shish"
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
                await createWorkspace(newWsName.trim(), newWsType);
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
              placeholder="Ombor nomi (masalan: Core Product)…"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setNewWsType('personal')}
                className={`flex-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition ${newWsType === 'personal' ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Shaxsiy
              </button>
              <button
                type="button"
                onClick={() => setNewWsType('team')}
                className={`flex-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition ${newWsType === 'team' ? 'bg-violet-500/20 text-violet-300 border border-violet-400/40' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Jamoa
              </button>
            </div>
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

        {/* Omborlar ro'yxati */}
        {workspaces.map((w) => {
          const taskCount = tasks.filter((t) => t.workspace_id === w.id).length;
          const isSelected = w.id === activeWorkspaceId;
          const label = w.id === 'ws-personal' ? 'Personal Sandbox' : w.name;
          return (
            <button
              key={w.id}
              onClick={() => setWorkspace(w.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition ${
                isSelected
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <span className={isSelected ? 'text-sky-300' : 'text-zinc-500'}>
                {w.type === 'team' ? <Users size={14} className="text-violet-400" /> : <Folder size={14} />}
              </span>
              <span className="truncate">{label}</span>
              {taskCount > 0 && (
                <span className="ml-auto rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300">
                  {taskCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Team Groups (Squadlar & Jamoaviy Guruhlar) */}
      <nav className="space-y-1">
        <div className="flex items-center justify-between px-2.5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Guruhlar ({groups.length})
          </p>
          <button
            onClick={() => setCreatingGroup((v) => !v)}
            title="Yangi guruh qo'shish"
            className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition"
          >
            <Plus size={13} />
          </button>
        </div>

        {creatingGroup && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (newGroupName.trim()) {
                await createGroup(newGroupName.trim(), selectedColor);
                setNewGroupName('');
                setCreatingGroup(false);
              }
            }}
            className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-2"
          >
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Guruh nomi (masalan: ⚡️ Backend Core)…"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
            />
            {/* Color picker presets */}
            <div className="flex items-center gap-1.5 px-0.5">
              {['#38bdf8', '#a855f7', '#34d399', '#f59e0b', '#f43f5e'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`h-4 w-4 rounded-full transition ${selectedColor === c ? 'scale-125 ring-2 ring-white/50' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => { setCreatingGroup(false); setNewGroupName(''); }}
                className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Bekor
              </button>
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="rounded bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-400 disabled:opacity-40"
              >
                Qo'shish
              </button>
            </div>
          </form>
        )}

        {/* Barcha vazifalar filtri */}
        <button
          onClick={() => setActiveGroup(null)}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition ${
            activeGroupId === null
              ? 'bg-white/[0.08] text-white font-semibold'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-zinc-400" />
          <span className="truncate">Barchasi</span>
          <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-400">
            {tasks.filter((t) => t.workspace_id === activeWorkspaceId).length}
          </span>
        </button>

        {/* Guruhlar ro'yxati */}
        {groups.map((g) => {
          const groupTasks = tasks.filter((t) => t.workspace_id === activeWorkspaceId && t.group_id === g.id);
          const isSelected = g.id === activeGroupId;
          return (
            <div key={g.id} className="group flex items-center">
              <button
                onClick={() => setActiveGroup(g.id)}
                className={`flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition ${
                  isSelected
                    ? 'bg-white/[0.08] text-white font-semibold'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color || '#38bdf8' }} />
                <span className="truncate">{g.name}</span>
                {groupTasks.length > 0 && (
                  <span className="ml-auto rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300">
                    {groupTasks.length}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteGroup(g.id);
                }}
                title="Guruhni o'chirish"
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}

        {/* AI Kunlik Standup tugmasi */}
      </nav>

      {/* Teglar — real taglar bo'yicha aniq filtr */}
      <div>
        <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Teglar</p>
        <div className="space-y-0.5">
          {tagStats.map(({ tag, count }) => {
            const on = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(on ? null : tag)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 font-mono text-[11.5px] hover:bg-white/5 ${on ? 'bg-violet-500/[0.12] text-violet-200' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <span>#{tag}</span>
                <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${on ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-transparent bg-white/5 text-zinc-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {tagStats.length === 0 && (
            <p className="px-2.5 py-1 font-mono text-[11px] text-zinc-600">
              Hali teglar yo'q — vazifaga teg qo'shing
            </p>
          )}
          <button
            onClick={() => setFilter('high')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 font-mono text-[11.5px] hover:bg-white/5 ${blockerCount > 0 ? 'bg-amber-500/[0.07] text-amber-200' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <span>#to'siqlar</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${blockerCount > 0 ? 'border-amber-400/40 bg-amber-500/15 text-amber-300' : 'border-transparent bg-white/5 text-zinc-500'}`}>
              {blockerCount > 0 ? `${blockerCount} faol` : '0'}
            </span>
          </button>
        </div>
      </div>

      {/* Foydalanuvchi profili yoki Jamoa a'zolari */}
      <div>
        <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {isPersonal ? 'Mening Profilim' : 'Jamoa Aʼzolari'}
        </p>
        {isPersonal ? (
          <button
            onClick={() => setProfileModal(true)}
            className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/[0.05] transition text-left group"
            title="Profilni ko'rish va tahrirlash"
          >
            <div className="relative shrink-0">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white/10 transition-transform group-hover:scale-105"
                style={{ backgroundColor: userProfile.avatar_color }}
              >
                {userProfile.avatar_initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f1013] bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-zinc-200 group-hover:text-white transition">
                {userProfile.full_name} <span className="text-zinc-500 text-[10.5px] font-normal">(Siz)</span>
              </p>
              <p className="truncate text-[10.5px] font-mono text-zinc-500">
                {userProfile.title || 'Muhandis'} · Tahrirlash ✎
              </p>
            </div>
          </button>
        ) : (
          <div className="px-2.5">
            {workspaceAssignees.length > 0 ? (
              <div className="flex items-center">
                {workspaceAssignees.slice(0, 4).map((name) => (
                  <div key={name} title={name} className="relative shrink-0 [&:not(:first-child)]:-ml-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white ring-2 ring-[#0f1013]">
                      {name[0]?.toUpperCase() ?? '?'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-zinc-600">Aʼzolar biriktirilmagan</p>
            )}
          </div>
        )}
      </div>

      {/* Qo'llanma & Yordam tugmasi */}
      <div className="mt-auto space-y-2">
        <button
          onClick={() => setGuideModal(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2 text-[12px] font-medium text-sky-300 hover:bg-sky-500/10 hover:text-sky-200 transition"
        >
          <HelpCircle size={14} className="text-sky-400 shrink-0" />
          <span>Qo'llanma & Imkoniyatlar</span>
        </button>

        {/* Tizim holati */}
        <div className="flex w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]" />
          <span className="truncate font-mono text-[11px] text-zinc-300">
            {dbMode === 'sqlite' ? `synapse.db · ${tasks.length} ta yozuv` : 'RAM xotira rejimi'}
          </span>
        </div>
        <p className="px-1 font-mono text-[9.5px] text-zinc-600">Mahalliy SQLite · Ollama · RubaiSTT</p>
      </div>
    </aside>
  );
}
