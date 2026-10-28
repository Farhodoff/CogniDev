import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Check,
  Trash2,
  ArrowUpDown,
  Search,
  ListTodo,
  X,
} from 'lucide-react';
import { useSynapse } from '../lib/store';

export default function TaskStream() {
  const {
    tasks,
    selectedTaskId,
    selectTask,
    updateTaskStatus,
    deleteTask,
    quickCapture,
    activeWorkspaceId,
    sortOrder,
    setSortOrder,
  } = useSynapse();

  const [quickInput, setQuickInput] = useState('');
  const [tab, setTab] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

  // Faqat joriy ish maydoniga tegishli vazifalar
  const workspaceTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.workspace_id === activeWorkspaceId ||
        (!t.workspace_id && activeWorkspaceId === 'personal') ||
        (t.workspace_id === 'default' && activeWorkspaceId === 'personal'),
    );
  }, [tasks, activeWorkspaceId]);

  const activeCount = useMemo(
    () => workspaceTasks.filter((t) => t.status !== 'completed').length,
    [workspaceTasks],
  );
  const completedCount = useMemo(
    () => workspaceTasks.filter((t) => t.status === 'completed').length,
    [workspaceTasks],
  );

  // Saralash va qidiruv bo'yicha filtrlash
  const visibleTasks = useMemo(() => {
    let list = workspaceTasks;

    if (tab === 'active') {
      list = list.filter((t) => t.status !== 'completed');
    } else if (tab === 'completed') {
      list = list.filter((t) => t.status === 'completed');
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (sortOrder === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'oldest') {
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      }
      // default: newest
      return (
        Date.parse(b.created_at || b.updated_at) -
        Date.parse(a.created_at || a.updated_at)
      );
    });
  }, [workspaceTasks, tab, searchQuery, sortOrder]);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text) return;
    await quickCapture(text);
    setQuickInput('');
  }

  return (
    <section className="relative flex w-[380px] lg:w-[420px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0d12]/80 backdrop-blur-md select-none h-full overflow-hidden">
      {/* Sarlavha paneli */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/20">
            <ListTodo size={15} />
          </div>
          <div>
            <h2 className="text-[13.5px] font-bold text-zinc-100 leading-none">
              Vazifalar
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {activeCount > 0
                ? `${activeCount} ta bajarilmagan vazifa`
                : 'Barcha vazifalar bajarildi'}
            </p>
          </div>
        </div>

        {/* Saralash menyusi */}
        <div className="relative">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
              sortOpen
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="Saralash tartibi"
          >
            <ArrowUpDown size={12} />
            <span>
              {sortOrder === 'newest'
                ? 'Yangi'
                : sortOrder === 'oldest'
                ? 'Avvalgi'
                : 'A-Z'}
            </span>
          </button>

          {sortOpen && (
            <div className="absolute right-0 top-8 z-50 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#16171d] shadow-2xl py-1 text-[12px]">
              <button
                onClick={() => {
                  setSortOrder('newest');
                  setSortOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/5 ${
                  sortOrder === 'newest'
                    ? 'text-sky-300 font-semibold'
                    : 'text-zinc-300'
                }`}
              >
                Eng yangi {sortOrder === 'newest' && <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setSortOrder('oldest');
                  setSortOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/5 ${
                  sortOrder === 'oldest'
                    ? 'text-sky-300 font-semibold'
                    : 'text-zinc-300'
                }`}
              >
                Avvalgilari {sortOrder === 'oldest' && <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setSortOrder('title');
                  setSortOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/5 ${
                  sortOrder === 'title'
                    ? 'text-sky-300 font-semibold'
                    : 'text-zinc-300'
                }`}
              >
                Nomi bo'yicha (A-Z) {sortOrder === 'title' && <Check size={12} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Yuqoridagi tezkor vazifa yozish kiritish qatori (To-Do Input) */}
      <div className="p-3 border-b border-white/[0.05] bg-white/[0.015]">
        <form onSubmit={handleAddTask} className="relative flex items-center">
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Yangi vazifa yozing va Enter bosing..."
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-3.5 pr-20 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-sky-400 focus:bg-black/60 focus:outline-none transition shadow-inner"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="absolute right-1.5 flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-sky-400 disabled:opacity-20 disabled:hover:bg-sky-500 transition shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Qo'shish</span>
          </button>
        </form>
      </div>

      {/* Filtr tablari: Barchasi | Faol | Bajarilgan va qidiruv */}
      <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.04] space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab('all')}
            className={`flex-1 rounded-lg py-1 px-2 text-[11.5px] font-semibold transition text-center ${
              tab === 'all'
                ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            Barchasi ({workspaceTasks.length})
          </button>
          <button
            onClick={() => setTab('active')}
            className={`flex-1 rounded-lg py-1 px-2 text-[11.5px] font-semibold transition text-center ${
              tab === 'active'
                ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            Faol ({activeCount})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`flex-1 rounded-lg py-1 px-2 text-[11.5px] font-semibold transition text-center ${
              tab === 'completed'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            Bajarilgan ({completedCount})
          </button>
        </div>

        {/* Tezkor qidiruv */}
        <div className="relative flex items-center">
          <Search
            size={12}
            className="absolute left-2.5 text-zinc-500 pointer-events-none"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vazifalardan qidirish..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 pl-7 pr-6 text-[11.5px] text-zinc-300 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Vazifalar ro'yxati (To-Do List) */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
        {visibleTasks.map((t) => {
          const isDone = t.status === 'completed';
          const isSelected = t.id === selectedTaskId;

          return (
            <div
              key={t.id}
              onClick={() => selectTask(t.id)}
              className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                isSelected
                  ? 'border-sky-500/50 bg-sky-500/[0.09] shadow-[0_4px_16px_-4px_rgba(56,189,248,0.25)]'
                  : 'border-white/[0.06] bg-zinc-900/40 hover:border-white/[0.14] hover:bg-zinc-900/80'
              }`}
            >
              {/* Checkbox: bitta bosish bilan check/uncheck qilish */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTaskStatus(t.id, isDone ? 'active' : 'completed');
                }}
                title={isDone ? 'Bajarilmaganga qaytarish' : 'Bajarildi deb belgilash'}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                  isDone
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'border-zinc-600 bg-white/[0.03] text-transparent hover:border-sky-400 hover:bg-sky-500/10'
                }`}
              >
                <Check
                  size={12}
                  strokeWidth={3}
                  className={isDone ? 'opacity-100' : 'opacity-0 group-hover:opacity-30 text-sky-300'}
                />
              </button>

              {/* Vazifa matni va ID */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13px] leading-snug break-words transition ${
                    isDone
                      ? 'line-through text-zinc-500'
                      : 'text-zinc-100 font-medium'
                  }`}
                >
                  {t.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-zinc-500">
                    {t.id}
                  </span>
                  {t.updated_at && (
                    <span className="text-[10px] text-zinc-600">
                      {t.updated_at.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>

              {/* O'chirish tugmasi (faqat hover qilinganda) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTask(t.id);
                }}
                title="Vazifani o'chirish"
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:bg-rose-500/20 hover:text-rose-400 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}

        {/* Bo'sh holat: Hech qanday vazifa yo'q */}
        {workspaceTasks.length === 0 && (
          <div className="mx-2 my-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-3">
              <CheckSquare size={22} />
            </div>
            <h4 className="text-[14px] font-semibold text-zinc-200">
              Vazifalar ro'yxati bo'sh
            </h4>
            <p className="mt-1 text-[12px] text-zinc-500 max-w-[240px] leading-relaxed">
              Yuqoridagi maydonga yangi vazifangizni yozib Enter tugmasini bosing.
            </p>
          </div>
        )}

        {/* Qidiruv yoki filtr bo'yicha hech narsa topilmadi */}
        {workspaceTasks.length > 0 && visibleTasks.length === 0 && (
          <div className="my-8 text-center px-4">
            <p className="text-[12.5px] text-zinc-500">
              {tab === 'active'
                ? 'Barcha vazifalar bajarilgan! 🎉'
                : tab === 'completed'
                ? 'Bajarilgan vazifalar mavjud emas'
                : 'Hech qanday vazifa topilmadi'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[11.5px] text-sky-400 hover:underline"
              >
                Qidiruvni tozalash
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
