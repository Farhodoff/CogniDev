import { useState } from 'react';
import { ArrowUpDown, SlidersHorizontal, Terminal, Inbox, Check, Send, Bot, Calendar, CheckCircle2 } from 'lucide-react';
import { filteredTasks, useSynapse } from '../lib/store';
import type { QuickFilter, Task } from '../lib/types';

const FILTERS: Array<{ id: Exclude<QuickFilter, null>; label: string }> = [
  { id: 'high', label: "P0 To'siqlar" },
  { id: 'solved', label: 'Hal qilingan' },
  { id: 'knowledge', label: 'Bilimlar bazasi' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
];

export default function TaskStream() {
  const {
    tasks,
    selectedTaskId,
    selectTask,
    quickFilter,
    setFilter,
    sortOrder,
    setSortOrder,
    activeWorkspaceId,
    search,
    quickCapture,
    notes,
    prompts,
    activeGroupId,
    groups,
    setActiveGroup,
    activeTag,
    setActiveTag,
  } = useSynapse();

  const [sortOpen, setSortOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');

  const workspaceTasks = tasks.filter((t) => t.workspace_id === activeWorkspaceId);
  const visible = filteredTasks(tasks, quickFilter, search, activeWorkspaceId, sortOrder, activeGroupId, activeTag);
  const activeCount = workspaceTasks.filter(
    (t) => t.status === 'active' || t.status === 'blocker' || t.status === 'in_review',
  ).length;

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  const [todayLabel] = useState(
    () => new Date().toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
  );

  async function handleQuickCapture(e: React.FormEvent) {
    e.preventDefault();
    if (!quickInput.trim()) return;
    await quickCapture(quickInput.trim());
    setQuickInput('');
  }

  return (
    <section className="flex w-[370px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0f1013]/60 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-zinc-100 flex items-center gap-2">
            Vazifalar Oqimi
          </h2>
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300 font-mono text-[10.5px] font-semibold">
            {activeCount} Faol
          </span>
        </div>

        <div className="relative flex items-center gap-1 text-zinc-500">
          {/* Saralash tugmasi */}
          <button
            onClick={() => setSortOpen((v) => !v)}
            className={`rounded-lg p-1.5 hover:bg-white/5 transition ${sortOpen ? 'bg-white/10 text-zinc-200' : 'hover:text-zinc-200'}`}
            title="Saralash"
          >
            <ArrowUpDown size={14} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-8 z-50 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#17181d] shadow-2xl py-1">
              <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/[0.06]">
                Saralash tartibi
              </p>
              <SortItem label="Eng yangi" active={sortOrder === 'newest'} onClick={() => { setSortOrder('newest'); setSortOpen(false); }} />
              <SortItem label="Avvalgi" active={sortOrder === 'oldest'} onClick={() => { setSortOrder('oldest'); setSortOpen(false); }} />
              <SortItem label="Muhimlik darajasi" active={sortOrder === 'priority'} onClick={() => { setSortOrder('priority'); setSortOpen(false); }} />
              <SortItem label="Nomi (A-Z)" active={sortOrder === 'title'} onClick={() => { setSortOrder('title'); setSortOpen(false); }} />
            </div>
          )}

          {/* Filtrni tozalash / boshqarish */}
          <button
            onClick={() => setFilter(quickFilter ? null : 'high')}
            className={`rounded-lg p-1.5 hover:bg-white/5 transition ${quickFilter ? 'bg-sky-500/20 text-sky-300' : 'hover:text-zinc-200'}`}
            title={quickFilter ? "Filtrni bekor qilish" : "Muhimlarini filtrlash"}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Kun dropdown va filtr teglari */}
      <div className="px-3.5 pt-2.5 pb-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5 pb-2 text-[11.5px] font-medium text-zinc-400">
          <Calendar size={13} className="text-zinc-500" />
          <span>Bugun</span>
          <span className="text-zinc-600">· {todayLabel}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = quickFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(on ? null : f.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                  on
                    ? 'border-sky-400/60 bg-sky-500/20 text-sky-200 shadow-[0_0_12px_-2px_rgba(56,189,248,0.6)]'
                    : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Squad / Group Filter Banner */}
      {activeGroup && (
        <div className="mx-3.5 mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: activeGroup.color }} />
            <span className="font-semibold text-white">{activeGroup.name}</span>
            <span className="text-zinc-500 font-mono text-[10px]">Squad</span>
          </div>
          <button
            onClick={() => setActiveGroup(null)}
            className="text-[11px] text-zinc-400 hover:text-white transition"
          >
            Barchasi
          </button>
        </div>
      )}

      {/* Active Tag Filter Banner */}
      {activeTag && (
        <div className="mx-3.5 mt-2 flex items-center justify-between rounded-xl border border-violet-400/25 bg-violet-500/[0.08] px-3 py-1.5 text-[11.5px]">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-violet-200">#{activeTag}</span>
            <span className="text-zinc-500 font-mono text-[10px]">Teg</span>
          </div>
          <button
            onClick={() => setActiveTag(null)}
            className="text-[11px] text-zinc-400 hover:text-white transition"
          >
            Barchasi
          </button>
        </div>
      )}

      {/* Vazifalar ro'yxati */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3 pb-20">
        {visible.map((t) => {
          const grp = groups.find((g) => g.id === t.group_id);
          return (
            <TaskCard
              key={t.id}
              task={t}
              selected={t.id === selectedTaskId}
              groupName={grp?.name}
              groupColor={grp?.color}
              noteSnippet={notes[t.id]}
              promptSnippet={prompts.find((p) => p.task_id === t.id)?.raw_prompt}
              onSelect={() => selectTask(t.id)}
              onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
            />
          );
        })}

        {/* 0 ta vazifa bo'lgandagi bo'sh holat */}
        {workspaceTasks.length === 0 && (
          <div className="mx-1 my-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 shadow-inner">
              <Inbox size={18} />
            </div>
            <p className="mt-3 text-[13px] font-medium text-zinc-300">
              Ushbu ish maydonida faol vazifalar yo'q.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Quyidagi qatordan yangi ish, yechilgan xato yoki bilimni tezda yozib qoldiring.
            </p>
          </div>
        )}

        {/* Qidiruv/filtr bo'yicha topilmaganda */}
        {workspaceTasks.length > 0 && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
            <p className="text-[13px] text-zinc-500">
              Ushbu filtr bo'yicha hech qanday vazifa topilmadi.
            </p>
            <button
              onClick={() => { setFilter(null); setActiveTag(null); }}
              className="mt-2 text-[12px] text-sky-400 hover:underline"
            >
              Filtrni tozalash
            </button>
          </div>
        )}
      </div>

      {/* Tezkor kiritish (Quick Capture) - Pastki panel */}
      <div className="p-2.5 border-t border-white/[0.08] bg-[#0f1013]/95 backdrop-blur-md absolute bottom-0 inset-x-0">
        <form onSubmit={handleQuickCapture} className="relative flex items-center">
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Bugun nima qildingiz? (Enter)"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-3 pr-9 text-[12px] text-zinc-200 placeholder:text-zinc-500 focus:border-sky-400 focus:outline-none transition shadow-inner"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="absolute right-1.5 p-1.5 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-white disabled:opacity-20 transition"
            title="Qayd qilish"
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </section>
  );
}

function SortItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] hover:bg-white/5 transition ${active ? 'text-sky-300 font-semibold' : 'text-zinc-300'}`}
    >
      <span>{label}</span>
      {active && <Check size={13} className="text-sky-400" />}
    </button>
  );
}

function keyStyle(t: Task): string {
  if (t.status === 'completed') return 'bg-emerald-500/15 text-emerald-300';
  if (t.priority === 'Critical') return 'bg-red-500/15 text-red-300';
  return 'bg-sky-500/15 text-sky-300';
}

function statusBadge(t: Task): { label: string; cls: string } {
  if (t.status === 'blocker') return { label: "P0 To'siq", cls: 'bg-amber-500/15 text-amber-300 border-amber-400/40' };
  if (t.status === 'in_review') return { label: "Tekshiruvda", cls: 'bg-sky-500/12 text-sky-300 border-sky-400/30' };
  if (t.status === 'completed') return { label: 'Bajarildi', cls: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/30' };
  if (t.priority === 'Critical') return { label: "Kritik", cls: 'bg-pink-500/15 text-pink-300 border-pink-400/30' };
  if (t.priority === 'High Priority') return { label: 'Yuqori', cls: 'bg-violet-500/12 text-violet-300 border-violet-400/30' };
  return { label: 'Oddiy', cls: 'bg-zinc-500/12 text-zinc-300 border-zinc-500/30' };
}

function aiPill(ai: string): { label: React.ReactNode; cls: string } {
  const low = ai.toLowerCase();
  if (low.includes('claude')) return { label: ai, cls: 'border-violet-400/25 bg-violet-500/10 text-violet-200' };
  if (low.includes('gemini')) return { label: ai, cls: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200' };
  if (low.includes('ollama')) return { label: <span className="flex items-center gap-1"><Terminal size={10} /> {ai}</span>, cls: 'border-white/10 bg-white/[0.05] text-zinc-300' };
  return { label: ai, cls: 'border-white/10 bg-white/[0.05] text-zinc-400' };
}

function TaskCard({
  task,
  selected,
  onSelect,
  noteSnippet,
  promptSnippet,
  groupName,
  groupColor,
  onTagClick,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  noteSnippet?: string;
  promptSnippet?: string;
  groupName?: string;
  groupColor?: string;
  onTagClick?: (tag: string) => void;
}) {
  const st = statusBadge(task);
  const ai = task.ai_source ? aiPill(task.ai_source) : null;
  const done = task.status === 'completed';

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3.5 text-left transition ${
        selected
          ? 'border-sky-400/50 bg-gradient-to-b from-sky-500/[0.12] to-white/[0.02] shadow-[0_8px_30px_-12px_rgba(56,189,248,0.5)]'
          : 'border-white/[0.06] bg-zinc-900/60 hover:border-white/[0.14] hover:bg-zinc-900'
      }`}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.priority === 'Critical' && <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_6px_1px_rgba(248,113,113,0.8)]" />}
        <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ${keyStyle(task)}`}>{task.id}</span>
        <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${st.cls}`}>{st.label}</span>
        {groupName && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold border"
            style={{
              backgroundColor: `${groupColor || '#38bdf8'}18`,
              borderColor: `${groupColor || '#38bdf8'}35`,
              color: groupColor || '#38bdf8',
            }}
          >
            {groupName}
          </span>
        )}
        {done && (
          <span className="ml-auto rounded-md border border-emerald-400/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
            <CheckCircle2 size={11} /> Yechildi
          </span>
        )}
      </div>

      <p className={`mt-2 text-[13.5px] font-semibold leading-snug ${done ? 'text-zinc-400' : 'text-zinc-100'}`}>{task.title}</p>

      {/* Attached AI Prompt Snippet Karta (Prototip dizayndagidek) */}
      {(promptSnippet || task.ai_source) && (
        <div className="mt-2.5 rounded-xl border border-white/[0.07] bg-black/40 p-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-violet-300 mb-1">
            <Bot size={11} />
            <span>Biriktirilgan prompt ({task.ai_source ?? 'AI'})</span>
          </div>
          <p className="line-clamp-2 text-zinc-400 font-mono text-[11px] leading-relaxed">
            {promptSnippet || (noteSnippet ? noteSnippet.replace(/^[#\s]+/, '').slice(0, 120) : "AI suhbati va kontekst ushbu vazifaga biriktirilgan...")}
          </p>
        </div>
      )}

      {/* Teglar va bog'liqliklar */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {ai && <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${ai.cls}`}>{ai.label}</span>}
        {(task.tags ?? []).map((tag) => (
          <span
            key={tag}
            onClick={(e) => { e.stopPropagation(); onTagClick?.(tag); }}
            title={`#${tag} bo'yicha filtrlash`}
            className="cursor-pointer rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-200 hover:bg-violet-500/25 transition"
          >
            #{tag}
          </span>
        ))}
        {done && <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">#solved</span>}
        {(task.assignee_avatar || task.assignee_avatar2) && (
          <span className="ml-auto flex items-center">
            {task.assignee_avatar && (
              <Avatar letter={task.assignee_avatar} name={task.assignee_name} gradient="from-cyan-400 to-blue-600" />
            )}
            {task.assignee_avatar2 && (
              <span className="-ml-2"><Avatar letter={task.assignee_avatar2} name={task.assignee_name2} gradient="from-rose-400 to-orange-500" /></span>
            )}
          </span>
        )}
      </div>
    </button>
  );
}

function Avatar({ letter, name, gradient }: { letter: string; name: string | null; gradient: string }) {
  return (
    <span title={name ?? ''} className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br text-[9.5px] font-bold text-white ring-2 ring-[#141519] ${gradient}`}>
      {letter}
    </span>
  );
}
