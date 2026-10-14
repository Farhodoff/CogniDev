import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Plus,
  ArrowRight,
  FolderKanban,
  Lightbulb,
  FileText,
  Check,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { TaskPriority, ScheduleBlock } from '../lib/types';

export default function DashboardWorkspace() {
  const {
    tasks,
    userProfile,
    projectIdeas,
    notesDocs,
    setTaskModal,
    setMainView,
    selectIdea,
    toggleAiDrawer,
    scheduleBlocks,
    toggleScheduleBlockDone,
    addScheduleBlock,
    todayAiSummary,
    isGeneratingTodayAiSummary,
    generateTodayAiSummary,
    updateTaskStatus,
  } = useSynapse();

  const [activeTaskTab, setActiveTaskTab] = useState<'all' | 'work' | 'study' | 'personal'>('all');
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [newBlockTime, setNewBlockTime] = useState('14:00 - 15:30');
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockCategory, setNewBlockCategory] = useState<'work' | 'study' | 'personal' | 'health'>('work');
  const [newBlockTag, setNewBlockTag] = useState('Backend');

  const [todayDateFormatted] = useState(() => {
    try {
      const d = new Date();
      return d.toLocaleDateString('uz-UZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Bugun';
    }
  });

  // Calculate metrics
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'backlog');
  const blockers = tasks.filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker');
  const totalTasksCount = Math.max(tasks.length, 1);
  const taskProgressPct = Math.round((completedTasks.length / totalTasksCount) * 100);

  // Filter tasks for Today's list
  const filteredTodayTasks = tasks.filter((t) => {
    if (activeTaskTab === 'all') return true;
    const lowerTags = (t.tags ?? []).map((x) => x.toLowerCase());
    const lowerTitle = t.title.toLowerCase();
    if (activeTaskTab === 'work') {
      return lowerTags.some((x) => x.includes('zoovita') || x.includes('admin') || x.includes('api') || x.includes('work') || x.includes('mobile')) || lowerTitle.includes('deploy') || lowerTitle.includes('api');
    }
    if (activeTaskTab === 'study') {
      return lowerTags.some((x) => x.includes('study') || x.includes('postgres') || x.includes('golang') || x.includes('rust') || x.includes('learn')) || lowerTitle.includes('o‘rgan') || lowerTitle.includes('tahlil');
    }
    if (activeTaskTab === 'personal') {
      return lowerTags.some((x) => x.includes('personal') || x.includes('portfolio') || x.includes('gym') || x.includes('sport'));
    }
    return true;
  });

  const handleCreateScheduleBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockTitle.trim()) return;
    const colors: Record<ScheduleBlock['category'], string> = {
      work: '#0ea5e9',
      study: '#a855f7',
      personal: '#3b82f6',
      health: '#22c55e',
    };
    addScheduleBlock({
      time_range: newBlockTime.trim(),
      title: newBlockTitle.trim(),
      category: newBlockCategory,
      tag: newBlockTag.trim() || 'Dev',
      color: colors[newBlockCategory],
      done: false,
    });
    setNewBlockTitle('');
    setShowAddBlockModal(false);
  };

  const getPriorityBadge = (p: TaskPriority) => {
    if (p === 'P0 Blocker' || p === 'Critical') {
      return <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">P0 Blocker</span>;
    }
    if (p === 'High Priority') {
      return <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">Yuqori</span>;
    }
    return <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">Oddiy</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-obsidian-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* 1. Hero Greeting Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-purple-950/40 p-6 backdrop-blur-xl shadow-2xl">
          {/* Ambient glow accent */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                <Flame size={14} className="text-amber-400" />
                <span>CogniDev Muhandislik Kokpiti</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 capitalize">{todayDateFormatted}</span>
              </div>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Salom, {userProfile.full_name || 'Farhod'}! 👏
              </h1>
              <p className="mt-1 text-sm text-zinc-300">
                <span className="font-medium text-amber-300">継続は力なり</span> (Consistency is power) — Bugun ham katta natijalarga yana bir qadam!
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setTaskModal(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-blue-500 active:scale-95 transition"
              >
                <Plus size={15} />
                <span>Tezkor Vazifa (⌘N)</span>
              </button>
              <button
                onClick={toggleAiDrawer}
                className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 active:scale-95 transition"
              >
                <Sparkles size={15} className="text-purple-400" />
                <span>AI Assistant (⌘J)</span>
              </button>
            </div>
          </div>

          {/* Top 4 Stat Metric Cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Card 1: Bugungi Vazifalar */}
            <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Vazifalar Progressi</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">
                  {completedTasks.length} <span className="text-xs font-normal text-zinc-400">/ {tasks.length}</span>
                </span>
                <span className="text-xs font-semibold text-emerald-400">({taskProgressPct}%)</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(taskProgressPct, 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                <span>{activeTasks.length} ta faol</span>
                <span>{completedTasks.length} ta tayyor</span>
              </div>
            </div>

            {/* Card 2: Faol Loyihalar */}
            <div
              onClick={() => setMainView('ideas')}
              className="cursor-pointer rounded-xl border border-white/5 bg-black/40 p-3.5 backdrop-blur-md hover:border-sky-500/30 transition"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Faol Loyihalar</span>
                <FolderKanban size={15} className="text-sky-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{projectIdeas.length}</span>
                <span className="text-xs text-zinc-400">ta tizim</span>
              </div>
              <p className="mt-2 text-[11px] text-sky-400 hover:underline flex items-center gap-1">
                G‘oyalar vitrinasi <ArrowRight size={10} />
              </p>
            </div>

            {/* Card 3: G'oyalar Inkubatori */}
            <div
              onClick={() => setMainView('ideas')}
              className="cursor-pointer rounded-xl border border-white/5 bg-black/40 p-3.5 backdrop-blur-md hover:border-amber-500/30 transition"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>G‘oyalar</span>
                <Lightbulb size={15} className="text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{projectIdeas.length}</span>
                <span className="text-xs text-zinc-400">inkubator</span>
              </div>
              <p className="mt-2 text-[11px] text-amber-400 hover:underline flex items-center gap-1">
                AI Dekompozitsiya <ArrowRight size={10} />
              </p>
            </div>

            {/* Card 4: Notion Qaydlar */}
            <div
              onClick={() => setMainView('notes')}
              className="cursor-pointer rounded-xl border border-white/5 bg-black/40 p-3.5 backdrop-blur-md hover:border-purple-500/30 transition"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Notion Qaydlar</span>
                <FileText size={15} className="text-purple-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{notesDocs.length}</span>
                <span className="text-xs text-zinc-400">hujjat</span>
              </div>
              <p className="mt-2 text-[11px] text-purple-400 hover:underline flex items-center gap-1">
                Qaydlarni ochish <ArrowRight size={10} />
              </p>
            </div>
          </div>
        </div>

        {/* 2. AI — Bugungi Qisqa Xulosa Kartochkasi */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/25 via-indigo-950/20 to-sky-950/20 p-5 backdrop-blur-xl shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI — Bugungi qisqa xulosa</h3>
                <p className="text-[11px] text-zinc-400">
                  {blockers.length > 0 ? (
                    <span className="text-rose-400 font-medium">⚠️ {blockers.length} ta P0 to‘siq mavjud!</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">✓ To‘siqlar yo‘q, rivojlanish barqaror</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={generateTodayAiSummary}
                disabled={isGeneratingTodayAiSummary}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
              >
                <RefreshCw size={12} className={isGeneratingTodayAiSummary ? 'animate-spin text-purple-400' : ''} />
                <span>{isGeneratingTodayAiSummary ? 'Tahlil qilinmoqda...' : 'Xulosani yangilash'}</span>
              </button>
              <button
                onClick={toggleAiDrawer}
                className="flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300 transition"
              >
                <span>Batafsil AI suhbat</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div className="mt-3.5 rounded-xl border border-white/5 bg-black/40 p-4 text-xs leading-relaxed text-zinc-300">
            {todayAiSummary}
          </div>
        </div>

        {/* 3. Main 2-Column Grid: Today's Tasks & Daily Timeline Schedule */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* Left Column: Bugungi Vazifalar (7 Cols) */}
          <div className="rounded-2xl border border-white/10 bg-obsidian-900/80 p-5 backdrop-blur-xl shadow-xl lg:col-span-7 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-sky-400" />
                <h2 className="text-sm font-bold text-white">Bugungi vazifalar</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                  {completedTasks.length}/{tasks.length}
                </span>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 border border-white/5 text-[11px]">
                <button
                  onClick={() => setActiveTaskTab('all')}
                  className={`rounded px-2 py-1 font-medium transition ${activeTaskTab === 'all' ? 'bg-sky-500/20 text-sky-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Barchasi
                </button>
                <button
                  onClick={() => setActiveTaskTab('work')}
                  className={`rounded px-2 py-1 font-medium transition ${activeTaskTab === 'work' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Ish / Loyiha
                </button>
                <button
                  onClick={() => setActiveTaskTab('study')}
                  className={`rounded px-2 py-1 font-medium transition ${activeTaskTab === 'study' ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  O‘qish
                </button>
                <button
                  onClick={() => setActiveTaskTab('personal')}
                  className={`rounded px-2 py-1 font-medium transition ${activeTaskTab === 'personal' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Shaxsiy
                </button>
              </div>
            </div>

            {/* Task List */}
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {filteredTodayTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  Bu bo‘limda hozircha vazifalar yo‘q.
                </div>
              ) : (
                filteredTodayTasks.map((t) => {
                  const isDone = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      className={`group flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                        isDone
                          ? 'border-white/5 bg-white/[0.02] opacity-60'
                          : 'border-white/10 bg-white/[0.04] hover:border-sky-500/30 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => updateTaskStatus(t.id, isDone ? 'active' : 'completed')}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                            isDone
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-zinc-600 bg-black/40 hover:border-sky-400'
                          }`}
                        >
                          {isDone ? <Check size={12} strokeWidth={3} /> : null}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium truncate ${isDone ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                            {t.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {t.tags?.slice(0, 2).map((tg) => (
                              <span key={tg} className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[10px] text-sky-400">
                                #{tg}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {getPriorityBadge(t.priority)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => setTaskModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition"
              >
                <Plus size={14} />
                <span>Yangi vazifa qo‘shish</span>
              </button>
              <button
                onClick={() => setMainView('stream')}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                <span>Barcha vazifalar oqimi (⌘1)</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Right Column: Bugungi Jadval (Timeline 09:00 - 23:00) (5 Cols) */}
          <div className="rounded-2xl border border-white/10 bg-obsidian-900/80 p-5 backdrop-blur-xl shadow-xl lg:col-span-5 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-purple-400" />
                <h2 className="text-sm font-bold text-white">Bugungi jadval</h2>
                <span className="text-[11px] text-zinc-400">Timeline</span>
              </div>
              <button
                onClick={() => setShowAddBlockModal(true)}
                className="rounded-lg bg-white/5 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/10 transition flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Blok qo‘shish</span>
              </button>
            </div>

            {/* Timeline Blocks */}
            <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
              {scheduleBlocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => toggleScheduleBlockDone(block.id)}
                  style={{ borderLeftColor: block.color }}
                  className={`group cursor-pointer rounded-xl border border-l-4 border-white/5 bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06] ${
                    block.done ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-400">
                      <Clock size={11} style={{ color: block.color }} />
                      <span>{block.time_range}</span>
                    </div>
                    <span
                      style={{ color: block.color, backgroundColor: `${block.color}15` }}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    >
                      {block.tag}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className={`text-xs font-medium text-zinc-200 ${block.done ? 'line-through text-zinc-500' : ''}`}>
                      {block.title}
                    </p>
                    <div className="text-zinc-600 group-hover:text-zinc-400">
                      {block.done ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Circle size={13} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 text-center">
              <span className="text-[11px] text-zinc-500">
                Blok ustiga bosib uni bajarilgan deb belgilashingiz mumkin
              </span>
            </div>
          </div>
        </div>

        {/* 4. Bottom Row: Faol Loyihalar Vitrinasi (Active Projects Showcase) */}
        <div className="rounded-2xl border border-white/10 bg-obsidian-900/80 p-5 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Faol Loyihalar Vitrinasi</h2>
              <span className="text-[11px] text-zinc-400">Inkubator va faol ishlanmalar</span>
            </div>
            <button
              onClick={() => setMainView('ideas')}
              className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition"
            >
              <span>Barchasini ko‘rish</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projectIdeas.slice(0, 4).map((idea, idx) => {
              const totalTasks = idea.tasks.length || 4;
              const doneTasks = idea.tasks.filter((t) => t.done).length || (idx === 0 ? 2 : 1);
              const pct = Math.round((doneTasks / totalTasks) * 100);
              return (
                <div
                  key={idea.id}
                  onClick={() => {
                    selectIdea(idea.id);
                    setMainView('ideas');
                  }}
                  className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-500/40 hover:bg-white/[0.06] active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                      {idea.stack.split('+')[0]?.trim() || 'Backend'}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400">{pct}%</span>
                  </div>

                  <h3 className="mt-2 text-xs font-bold text-white line-clamp-1">{idea.title}</h3>
                  <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">{idea.description}</p>

                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{doneTasks}/{totalTasks} vazifa bajarildi</span>
                      <span className="text-emerald-400 capitalize">{idea.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal: Yangi Schedule Blok qo'shish */}
      {showAddBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-obsidian-900 p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-purple-400" />
              <span>Jadvalga Yangi Blok Qo‘shish</span>
            </h3>

            <form onSubmit={handleCreateScheduleBlock} className="mt-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-medium text-zinc-400">Vaqt oralig‘i</label>
                <input
                  type="text"
                  value={newBlockTime}
                  onChange={(e) => setNewBlockTime(e.target.value)}
                  placeholder="masalan: 14:00 - 16:00"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400">Blok nomi / Reja</label>
                <input
                  type="text"
                  autoFocus
                  value={newBlockTitle}
                  onChange={(e) => setNewBlockTitle(e.target.value)}
                  placeholder="masalan: Go Concurrency amaliyot..."
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Kategoriya</label>
                  <select
                    value={newBlockCategory}
                    onChange={(e) => setNewBlockCategory(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                  >
                    <option value="work">Ish / Loyiha</option>
                    <option value="study">O‘qish / Kod</option>
                    <option value="personal">Shaxsiy</option>
                    <option value="health">Sport / Dam olish</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Teg</label>
                  <input
                    type="text"
                    value={newBlockTag}
                    onChange={(e) => setNewBlockTag(e.target.value)}
                    placeholder="FastAPI, Go..."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddBlockModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!newBlockTitle.trim()}
                  className="rounded-lg bg-purple-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-400 transition disabled:opacity-40"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
