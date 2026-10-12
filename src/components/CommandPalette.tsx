import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Hash, MessagesSquare, Search } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { fetchAllPrompts } from '../lib/db';
import type { PromptEntry } from '../lib/types';

type Hit =
  | { kind: 'vazifa'; id: string; title: string; sub: string }
  | { kind: 'eslatma'; id: string; title: string; sub: string }
  | { kind: 'prompt'; id: string; title: string; sub: string };

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, notes, prompts, selectTask, setTab, setSearch, dbMode } = useSynapse();
  const [q, setQ] = useState('');
  const [allPrompts, setAllPrompts] = useState<PromptEntry[]>(() => (dbMode === 'sqlite' ? [] : prompts));
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (dbMode === 'sqlite') {
      fetchAllPrompts().then(setAllPrompts).catch(() => {});
    }
  }, [dbMode]);

  const hits: Hit[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tasks.slice(0, 6).map((t) => ({ kind: 'vazifa' as const, id: t.id, title: `${t.id} — ${t.title}`, sub: `${t.status} · ${t.priority}` }));
    const out: Hit[] = [];
    for (const t of tasks) {
      if (t.id.toLowerCase().includes(needle) || t.title.toLowerCase().includes(needle)) {
        out.push({ kind: 'vazifa', id: t.id, title: `${t.id} — ${t.title}`, sub: `${t.status} · ${t.priority}` });
      }
      if (out.length >= 6) break;
    }
    for (const [taskId, md] of Object.entries(notes)) {
      if (md.toLowerCase().includes(needle) && out.length < 10) {
        const line = md.split('\n').find((l) => l.toLowerCase().includes(needle))?.slice(0, 80) ?? '';
        out.push({ kind: 'eslatma', id: taskId, title: `Eslatma · ${taskId}`, sub: line });
      }
    }
    for (const p of allPrompts) {
      if ((p.raw_prompt.toLowerCase().includes(needle) || (p.prompt_hash ?? '').toLowerCase().includes(needle)) && out.length < 14) {
        out.push({ kind: 'prompt', id: p.task_id, title: `Prompt ${p.prompt_hash ?? ''} · ${p.task_id}`, sub: p.raw_prompt.slice(0, 80) });
      }
    }
    return out;
  }, [q, tasks, notes, allPrompts]);

  const activeCursor = hits.length === 0 ? 0 : Math.min(cursor, hits.length - 1);

  if (!open) return null;

  async function go(h: Hit) {
    await selectTask(h.id);
    setTab(h.kind === 'prompt' ? 'thread' : 'note');
    setSearch('');
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { const h = hits[activeCursor]; if (h) void go(h); }
    else if (e.key === 'Escape') onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 pt-[14vh] backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d]/95 px-2 py-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5">
          <Search size={15} className="shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Vazifalar, arxitektura eslatmalari, AI promptlarni qidirish…"
            className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">esc</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto py-1.5">
          {hits.map((h, i) => (
            <button
              key={`${h.kind}-${h.title}-${i}`}
              onClick={() => void go(h)}
              onMouseEnter={() => setCursor(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${i === activeCursor ? 'bg-sky-500/15' : 'hover:bg-white/5'}`}
            >
              <span className="text-zinc-500">
                {h.kind === 'vazifa' ? <Hash size={14} /> : h.kind === 'eslatma' ? <FileText size={14} /> : <MessagesSquare size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-100">{h.title}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-500">{h.sub}</span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-600">{h.kind}</span>
            </button>
          ))}
          {hits.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-zinc-500">
              {q ? `“${q}” bo‘yicha hech narsa topilmadi.` : "Hozircha hech qanday vazifa yoki yozuv mavjud emas."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
