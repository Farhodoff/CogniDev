import React, { useState, useEffect } from 'react';
import {
  Check,
  CheckSquare,
  FileText,
  Plus,
  Trash2,
  ListTodo,
  Circle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { useFocusStore } from '../lib/focusStore';

/** Minimal markdown renderer: headings, code fences, inline code, bold, quote. */
export function MiniMarkdown({ source }: { source: string }) {
  const blocks = React.useMemo(() => renderMarkdown(source), [source]);
  return <div className="space-y-3 text-[13.5px] leading-relaxed text-zinc-300">{blocks}</div>;
}

function renderMarkdown(src: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = src.split('\n');
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'kod';
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      out.push(
        <div key={key++} className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/50">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
            <span className="font-mono text-[11px] text-zinc-500">{lang}</span>
            <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
          </div>
          <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed"><code dangerouslySetInnerHTML={{ __html: highlight(buf.join('\n'), lang) }} /></pre>
        </div>,
      );
      continue;
    }
    if (line.startsWith('# ')) { out.push(<h1 key={key++} className="text-[17px] font-bold text-white">{inline(line.slice(2))}</h1>); i++; continue; }
    if (line.startsWith('## ')) { out.push(<h2 key={key++} className="text-[14.5px] font-bold text-zinc-100">{inline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('> ')) { out.push(<blockquote key={key++} className="rounded-r-lg border-l-2 border-violet-400/60 bg-violet-500/[0.06] px-3 py-2 text-zinc-300">{inline(line.slice(2))}</blockquote>); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    out.push(<p key={key++}>{inline(line)}</p>);
    i++;
  }
  return out;
}

function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-white/[0.08] px-1 py-px font-mono text-[12px] text-amber-200">{p.slice(1, -1)}</code>;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    return <span key={i}>{p}</span>;
  });
}

function highlight(code: string, _lang: string): string {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kw = /\b(fn|let|const|var|func|return|if|else|for|while|struct|impl|type|interface|import|from|mut|pub|package|atomic|epoch|guard|slot)\b/g;
  const str = /(&quot;.*?&quot;|".*?"|`.*?`|\/\/.*$)/gm;
  return esc
    .replace(str, '<span style="color:#a5d6a7">$1</span>')
    .replace(kw, '<span style="color:#c4b5fd">$1</span>')
    .replace(/\b(\d[\d_]*)\b/g, '<span style="color:#fbbf24">$1</span>');
}

export default function WorkspaceEditor() {
  const {
    tasks,
    selectedTaskId,
    notes,
    checklists,
    toggleCheck,
    addChecklistItem,
    removeChecklistItem,
    deleteTask,
    updateTaskStatus,
    updateTaskTitle,
    updateNote,
  } = useSynapse();

  const task = tasks.find((t) => t.id === selectedTaskId);
  const note = selectedTaskId ? (notes[selectedTaskId] ?? '') : '';
  const list = selectedTaskId ? (checklists[selectedTaskId] ?? []) : [];

  const [titleDraft, setTitleDraft] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  // Tanlangan vazifa o'zgarganda sarlavha draftini yangilash
  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
    }
  }, [task?.id, task?.title]);

  function handleTitleBlur() {
    if (task && titleDraft.trim() && titleDraft.trim() !== task.title) {
      updateTaskTitle(task.id, titleDraft.trim());
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  // Tanlangan vazifa bo'lmaganda ko'rinadigan bo'sh holat
  if (!task) {
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#0d0e13]/60 p-8 text-center relative select-none">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-500 shadow-inner">
          <CheckSquare size={26} className="text-sky-400" />
        </div>
        <h3 className="mt-4 text-[16px] font-semibold text-zinc-200">
          Vazifa tanlanmagan
        </h3>
        <p className="mt-1.5 max-w-sm text-[13px] text-zinc-500 leading-relaxed">
          Chap tomondagi ro'yxatdan biror vazifani tanlang yoki yuqoridagi maydondan yangi vazifa yozing.
        </p>
      </main>
    );
  }

  const isDone = task.status === 'completed';
  const completedSubtasks = list.filter((c) => c.done).length;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#0d0e13]/60 relative overflow-hidden h-full">
      {/* Yuqori boshqaruv paneli */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-sky-500/15 border border-sky-400/30 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">
            {task.id}
          </span>

          {/* Statusni o'zgartirish tugmasi */}
          <button
            onClick={() =>
              updateTaskStatus(task.id, isDone ? 'active' : 'completed')
            }
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[12px] font-semibold transition ${
              isDone
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300'
            }`}
          >
            {isDone ? (
              <>
                <Check size={13} strokeWidth={2.5} />
                <span>Bajarildi</span>
              </>
            ) : (
              <>
                <Circle size={13} />
                <span>Faol (Bajarish)</span>
              </>
            )}
          </button>

          {/* Fokus (Pomodoro) */}
          <button
            onClick={() => {
              useFocusStore.getState().startFocus(25, task.id, task.title);
              useFocusStore.getState().setShowModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11.5px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
            title="25 minutlik Pomodoro fokus taymerini boshlash"
          >
            <span className="text-xs">🍅</span>
            <span>Fokus</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* O'chirish */}
          <button
            onClick={() => {
              if (window.confirm(`"${task.title}" vazifasini o'chirishni xohlaysizmi?`)) {
                deleteTask(task.id);
              }
            }}
            title="Vazifani o'chirish"
            className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11.5px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
          >
            <Trash2 size={12} />
            <span>O'chirish</span>
          </button>
        </div>
      </div>

      {/* Asosiy tahrirlash maydoni */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-[700px] space-y-6 pb-20">
          {/* Vazifa sarlavhasi (inline tahrirlash) */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() =>
                updateTaskStatus(task.id, isDone ? 'active' : 'completed')
              }
              title={isDone ? 'Bajarilmaganga qaytarish' : 'Bajarildi deb belgilash'}
              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                isDone
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'border-zinc-600 bg-white/[0.03] text-transparent hover:border-sky-400 hover:bg-sky-500/10'
              }`}
            >
              <Check
                size={14}
                strokeWidth={3}
                className={isDone ? 'opacity-100' : 'opacity-0 hover:opacity-40 text-sky-300'}
              />
            </button>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Vazifa nomi..."
              className={`w-full bg-transparent text-[20px] font-bold tracking-tight text-white focus:outline-none transition ${
                isDone ? 'line-through text-zinc-500' : ''
              }`}
            />
          </div>

          {/* Kichik vazifalar / Nazorat ro'yxati (Subtasks) */}
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <ListTodo size={15} className="text-sky-400" />
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-300">
                  Nazorat Ro'yxati (Subtasks)
                </h3>
                {list.length > 0 && (
                  <span className="rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                    {completedSubtasks}/{list.length} bajarildi
                  </span>
                )}
              </div>
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                <Plus size={13} className="text-sky-300" />
                <span>Band qo'shish</span>
              </button>
            </div>

            {/* Yangi band qo'shish formasi */}
            {addingItem && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newItemText.trim()) {
                    addChecklistItem(task.id, newItemText.trim());
                    setNewItemText('');
                    setAddingItem(false);
                  }
                }}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  autoFocus
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Kichik qadam yoki band nomi…"
                  className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newItemText.trim()}
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-sky-400 disabled:opacity-40"
                >
                  Qo'shish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingItem(false);
                    setNewItemText('');
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                >
                  Bekor qilish
                </button>
              </form>
            )}

            {/* Bandlar ro'yxati */}
            <div className="mt-3 space-y-2">
              {list.map((c) => (
                <div
                  key={c.id}
                  className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2 hover:border-white/[0.12] transition"
                >
                  <button
                    onClick={() => toggleCheck(task.id, c.id)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition ${
                        c.done
                          ? 'border-sky-400 bg-sky-500 text-white shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                          : 'border-zinc-600 bg-transparent text-transparent hover:border-sky-400'
                      }`}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span
                      className={`text-[13px] ${
                        c.done ? 'text-zinc-500 line-through' : 'text-zinc-200'
                      }`}
                    >
                      {c.text}
                    </span>
                  </button>
                  <button
                    onClick={() => removeChecklistItem(task.id, c.id)}
                    title="O'chirish"
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {list.length === 0 && !addingItem && (
                <p className="py-2 text-[12.5px] text-zinc-500">
                  Hozircha kichik qadamlar yo'q. "Band qo'shish" orqali vazifani kichik bo'laklarga ajratishingiz mumkin.
                </p>
              )}
            </div>
          </section>

          {/* Qaydlar va izohlar (Notes) */}
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.05]">
              <FileText size={15} className="text-sky-400" />
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-300">
                Qaydlar va izohlar
              </h3>
            </div>
            <div className="mt-3">
              <textarea
                value={note}
                onChange={(e) => updateNote(task.id, e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder="Ushbu vazifa bo'yicha qo'shimcha eslatmalar, havolalar yoki tafsilotlarni yozing…"
                className="w-full rounded-xl border border-white/10 bg-black/40 p-3.5 text-[13px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none transition resize-y font-normal"
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
