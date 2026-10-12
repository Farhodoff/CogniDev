import { useEffect, useState } from 'react';
import { Folder, Sparkles, Plus, Trophy, BookOpen, Layers, Bot, TrendingUp, Users, X } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { isBlocker } from '../lib/ai';
import { fetchTagCounts } from '../lib/db';

/** 5 o'qli radar poligoni: qiymatlar 0..1, markaz (50,48), radius 36. */
function radarPoints(values: number[]): string {
  const cx = 50, cy = 48, R = 36;
  return values
    .map((v, i) => {
      const a = ((-90 + i * 72) * Math.PI) / 180;
      const r = R * Math.max(0.06, Math.min(1, v));
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');
}

export default function Sidebar() {
  const {
    tasks,
    prompts,
    notes,
    search,
    workspaces,
    activeWorkspaceId,
    setWorkspace,
    setFilter,
    quickFilter,
    activeTag,
    setActiveTag,
    setSearch,
    triggerStandup,
    triggerWeeklyCoach,
    createWorkspace,
    dbMode,
    groups,
    activeGroupId,
    setActiveGroup,
    createGroup,
    deleteGroup,
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
  const memPromptCount = prompts.length;
  const memBlockerCount = tasks.filter(isBlocker).length;
  const memArchCount = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes('arch') ||
      t.title.toLowerCase().includes('refactor') ||
      t.title.toLowerCase().includes('design'),
  ).length;

  const promptCount = dbTagCounts ? dbTagCounts.promptLibrary : memPromptCount;
  const blockerCount = dbTagCounts ? dbTagCounts.blocker : memBlockerCount;
  const archCount = dbTagCounts ? dbTagCounts.architecture : memArchCount;

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
  const totalTasks = tasks.length || 1;
  const progressPercent = Math.min(Math.round((completedCount / totalTasks) * 100), 100);

  // --- Jonli radar ma'lumotlari (5 o'q: Reja, Bajarildi, Yechim, Bilim, AI) ---
  const wsTasks = tasks.filter((t) => t.workspace_id === activeWorkspaceId);
  const wsTotal = wsTasks.length || 1;
  const radarValues = [
    wsTasks.filter((t) => t.status === 'active' || t.status === 'backlog' || t.status === 'in_review').length / wsTotal,
    wsTasks.filter((t) => t.status === 'completed').length / wsTotal,
    wsTasks.filter((t) => (notes[t.id] ?? '').trim().length > 0).length / wsTotal,
    wsTasks.filter((t) => /arch|refactor|design|bilim|o'rgan/i.test(t.title)).length / wsTotal,
    wsTasks.filter((t) => !!t.ai_source).length / wsTotal,
  ];

  // --- Blocker Radar odamlari: avval blokerlardagi assignee'lar, keyin qolganlar ---
  const radarPeople = (() => {
    const names: string[] = [];
    const push = (n?: string | null) => {
      if (n && n.trim() && !names.includes(n.trim()) && names.length < 4) names.push(n.trim());
    };
    wsTasks.filter((t) => t.status === 'blocker').forEach((t) => { push(t.assignee_name); push(t.assignee_name2); });
    wsTasks.forEach((t) => { push(t.assignee_name); push(t.assignee_name2); });
    push('Farhod');
    while (names.length < 4) names.push('—');
    return names;
  })();

  return (
    <aside className="flex w-[246px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] bg-[#0f1013]/80 px-3 py-4">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-2 pb-1">
        <img src="/logo.svg" alt="CogniDev Logo" className="h-7 w-7 rounded-xl shadow-md border border-white/10" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold tracking-tight text-white">CogniDev</span>
            <span className="rounded bg-sky-500/20 px-1 py-0.2 font-mono text-[9px] text-sky-300 border border-sky-400/30">v1.0</span>
          </div>
          <p className="truncate font-mono text-[10px] text-zinc-500">AI Markaz</p>
        </div>
      </div>

      {/* Smart Ko'rinishlar (Asosiy Bo'limlar) */}
      <nav className="space-y-0.5">
        <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Boshqaruv</p>
        
        <button
          onClick={() => { setFilter(null); setSearch(''); }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            quickFilter === null && search.trim() === '' ? 'bg-white/[0.08] text-white font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Layers size={15} className="text-sky-400" />
          <span>Kunlik Oqim</span>
          <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
            {tasks.filter((t) => t.workspace_id === activeWorkspaceId).length}
          </span>
        </button>

        <button
          onClick={() => setFilter('solved')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            quickFilter === 'solved' ? 'bg-emerald-500/15 text-emerald-300 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Trophy size={15} className="text-emerald-400" />
          <span>Hal Qilinganlar</span>
          <span className="ml-auto rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-400">
            {completedCount}
          </span>
        </button>

        <button
          onClick={() => setFilter('knowledge')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
            quickFilter === 'knowledge' ? 'bg-violet-500/15 text-violet-300 font-semibold' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <BookOpen size={15} className="text-violet-400" />
          <span>Bilimlar Ombori</span>
          <span className="ml-auto rounded-md bg-violet-500/10 px-1.5 py-0.5 font-mono text-[11px] text-violet-300">
            {archCount}
          </span>
        </button>

        <button
          onClick={() => setSearch('prompt')}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition"
        >
          <Bot size={15} className="text-cyan-400" />
          <span>AI Prompt Ombori</span>
          <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
            {promptCount}
          </span>
        </button>
      </nav>

      {/* Weekly Progress Radar Karta */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 shadow-sm hover:border-white/[0.12] transition">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={13} className="text-sky-400" /> Progress Radar
          </span>
          <button
            onClick={() => triggerWeeklyCoach()}
            className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition"
          >
            Tahlil
          </button>
        </div>
        
        {/* SVG Radar */}
        <div className="relative flex items-center justify-center py-1">
          <svg viewBox="0 0 100 90" className="w-full max-w-[130px] overflow-visible">
            {/* Pentagon grid */}
            <polygon points="50,6 94,36 78,84 22,84 6,36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <polygon points="50,22 75,39 65,68 35,68 25,39" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Jonli ma'lumot poligoni */}
            <polygon
              points={radarPoints(radarValues)}
              fill="rgba(56,189,248,0.18)"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            {/* Labels */}
            <text x="50" y="2" textAnchor="middle" fill="#71717a" fontSize="6.5">Reja</text>
            <text x="96" y="38" textAnchor="start" fill="#71717a" fontSize="6.5">Bajarildi</text>
            <text x="78" y="90" textAnchor="middle" fill="#71717a" fontSize="6.5">Yechim</text>
            <text x="22" y="90" textAnchor="middle" fill="#71717a" fontSize="6.5">Bilim</text>
            <text x="4" y="38" textAnchor="end" fill="#71717a" fontSize="6.5">AI</text>
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10.5px] text-zinc-400 font-mono pt-1.5 border-t border-white/[0.04]">
          <span>Tezlik: {progressPercent}%</span>
          <span className="text-emerald-400 font-semibold">Barqaror</span>
        </div>
      </div>

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
        <button
          onClick={() => triggerStandup()}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-violet-500/10 px-2.5 py-2 text-left text-[12.5px] font-medium text-violet-200 hover:bg-violet-500/20 transition"
        >
          <Sparkles size={14} className="text-violet-300" />
          AI Standup
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.7)]" />
        </button>
      </nav>

      {/* Team Blocker Radar (Live) */}
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.03] p-3 shadow-sm hover:border-rose-500/40 transition">
        <div className="flex items-center justify-between pb-1.5">
          <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={12} className="text-rose-400" /> To'siq Radari
          </span>
          <span className="rounded-full bg-rose-500/20 border border-rose-400/30 px-1.5 py-0.5 text-[9.5px] font-mono text-rose-300 animate-pulse">
            Jonli
          </span>
        </div>

        {/* Constellation SVG */}
        <div className="relative flex items-center justify-center py-1">
          <svg viewBox="0 0 100 80" className="w-full max-w-[125px] overflow-visible">
            <line x1="50" y1="12" x2="85" y2="45" stroke="rgba(244,63,94,0.3)" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="85" y1="45" x2="50" y2="70" stroke="rgba(56,189,248,0.3)" strokeWidth="1" />
            <line x1="50" y1="70" x2="15" y2="45" stroke="rgba(168,85,247,0.3)" strokeWidth="1" />
            <line x1="15" y1="45" x2="50" y2="12" stroke="rgba(52,211,153,0.3)" strokeWidth="1" />
            <line x1="50" y1="12" x2="50" y2="70" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5" />

            <circle cx="50" cy="12" r="5" fill="#f43f5e" />
            <text x="50" y="5" textAnchor="middle" fill="#e4e4e7" fontSize="6.5">{radarPeople[0]}</text>

            <circle cx="85" cy="45" r="4.5" fill="#38bdf8" />
            <text x="92" y="47" textAnchor="start" fill="#a1a1aa" fontSize="6">{radarPeople[1]}</text>

            <circle cx="50" cy="70" r="4.5" fill="#a855f7" />
            <text x="50" y="78" textAnchor="middle" fill="#a1a1aa" fontSize="6">{radarPeople[2]}</text>

            <circle cx="15" cy="45" r="4.5" fill="#34d399" />
            <text x="8" y="47" textAnchor="end" fill="#a1a1aa" fontSize="6">{radarPeople[3]}</text>
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1.5 border-t border-white/[0.04]">
          <span className="text-rose-400 font-medium">To'siqlar: {tasks.filter((t) => t.status === 'blocker').length} faol</span>
          <button onClick={() => setFilter('high')} className="text-zinc-300 hover:text-white underline">
            Ko'rish
          </button>
        </div>
      </div>

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
            <span>#blokirlar</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${blockerCount > 0 ? 'border-amber-400/40 bg-amber-500/15 text-amber-300' : 'border-transparent bg-white/5 text-zinc-500'}`}>
              {blockerCount > 0 ? `${blockerCount} faol` : '0'}
            </span>
          </button>
        </div>
      </div>

      {/* Foydalanuvchi profili yoki Jamoa a'zolari */}
      <div>
        <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {isPersonal ? 'Foydalanuvchi Profili' : 'Jamoa Aʼzolari'}
        </p>
        {isPersonal ? (
          <div className="flex items-center gap-2.5 px-2.5">
            <div className="relative">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-white ring-2 ring-[#0f1013]">
                F
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f1013] bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-zinc-200">Farhod (Siz)</p>
              <p className="text-[10px] font-mono text-zinc-500">Shaxsiy Ombor · Oflayn</p>
            </div>
          </div>
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

      {/* Tizim holati */}
      <div className="mt-auto space-y-2">
        <div className="flex w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]" />
          <span className="truncate font-mono text-[11.5px] text-zinc-300">
            {dbMode === 'sqlite' ? `synapse.db · ${tasks.length} ta yozuv` : 'xotira rejimi'}
          </span>
        </div>
        <p className="px-1 font-mono text-[10px] text-zinc-600">mahalliy SQLite · Ollama</p>
      </div>
    </aside>
  );
}
