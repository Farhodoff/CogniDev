import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, FileText, MessagesSquare, Plus, Trash2, ChevronDown, Copy, Mic, Sparkles } from 'lucide-react';
import { useSynapse } from '../lib/store';

/** Minimal markdown renderer: headings, code fences, inline code, bold, quote. */
export function MiniMarkdown({ source }: { source: string }) {
  const blocks = useMemo(() => renderMarkdown(source), [source]);
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

function useInlineDictation(taskId: string | null, notes: Record<string, string>, updateNote: (id: string, md: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setRecording(false);
  }, []);

  const start = useCallback(() => {
    if (!taskId) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Web Speech API not supported'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recognitionRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimResult = '';
      let finalResult = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalResult += res[0].transcript + ' ';
        else interimResult += res[0].transcript;
      }
      if (finalResult) {
        setFinalText((prev) => prev + finalResult);
        setInterim('');
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      } else if (interimResult) {
        setInterim(interimResult);
      }
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error', e.error);
    };
    rec.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [taskId]);

  const commit = useCallback(() => {
    if (!taskId) return;
    const full = (finalText + interim).trim();
    if (!full) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const block = `\n\n---\n### Voice Memo (${now})\n${full}`;
    updateNote(taskId, (notes[taskId] ?? '') + block);
    setFinalText('');
    setInterim('');
  }, [taskId, notes, updateNote]);

  return { recording, seconds, interim, finalText, start, stop, commit };
}

export default function WorkspaceEditor() {
  const {
    tasks,
    selectedTaskId,
    editorTab,
    setTab,
    notes,
    checklists,
    toggleCheck,
    addChecklistItem,
    removeChecklistItem,
    prompts,
    deleteTask,
    updateTaskStatus,
    updateTaskPriority,
    setTaskModal,
    setChatModal,
    updateNote,
    triggerWeeklyCoach,
    groups,
    assignTaskToGroup,
  } = useSynapse();

  const dictation = useInlineDictation(selectedTaskId, notes, updateNote);
  const [editing, setEditing] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  const task = tasks.find((t) => t.id === selectedTaskId);
  const note = selectedTaskId ? (notes[selectedTaskId] ?? '') : '';
  const list = selectedTaskId ? (checklists[selectedTaskId] ?? []) : [];
  const threadCount = prompts.length;

  if (!task) {
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#0f1013]/80 p-8 text-center relative">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-500 shadow-inner">
          <FileText size={26} className="text-zinc-400" />
        </div>
        <h3 className="mt-4 text-[16px] font-semibold text-zinc-200">Hech qanday vazifa tanlanmagan</h3>
        <p className="mt-1.5 max-w-sm text-[13px] text-zinc-500 leading-relaxed">
          Chap tomondagi oqimdan kerakli vazifani tanlang yoki quyidagi tugma orqali yangi vazifa yarating.
        </p>
        <button
          onClick={() => setTaskModal(true)}
          className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg hover:brightness-110 transition"
        >
          <Plus size={15} /> Yangi Vazifa yaratish
        </button>
      </main>
    );
  }

  const isEditing = editing || !note;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#0f1013]/80 relative overflow-hidden">
      {/* Yuqori tablar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 pt-3">
        <TabBtn active={editorTab === 'note'} onClick={() => setTab('note')} label="Active Log & Problem Solved" icon={<FileText size={14} />} />
        <TabBtn active={editorTab === 'thread'} onClick={() => setTab('thread')} label="AI Prompt Vault" badge={String(threadCount)} icon={<MessagesSquare size={14} />} />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (window.confirm(`${task.id} vazifasini o'chirishni tasdiqlaysizmi?`)) {
                deleteTask(task.id);
              }
            }}
            title="Vazifani o'chirish"
            className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11.5px] text-red-300 hover:bg-red-500/20 transition"
          >
            <Trash2 size={12} /> O'chirish
          </button>
          <span className="hidden font-mono text-[11px] text-zinc-600 lg:block">
            {task.id} · {task.updated_at.slice(0, 10)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {editorTab === 'note' ? (
          <div className="mx-auto max-w-[720px] space-y-5 pb-28">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[11px] font-bold text-zinc-200">{task.id}</span>
                <span className="text-[12px] text-zinc-500">
                  {task.ai_source ?? 'Qo‘lda'} · {task.git_branch ?? task.pr_url ?? "filial yo'q"}
                </span>

                {/* Status tanlash */}
                <select
                  value={task.status}
                  onChange={(e) => updateTaskStatus(task.id, e.target.value as any)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] font-medium text-zinc-300 hover:border-white/20 focus:border-sky-400 focus:outline-none cursor-pointer transition"
                >
                  <option value="active" className="bg-[#17181d] text-zinc-200">Holat: Faol</option>
                  <option value="in_review" className="bg-[#17181d] text-sky-300">Holat: Ko'rib chiqilmoqda</option>
                  <option value="completed" className="bg-[#17181d] text-emerald-300">Holat: Bajarildi</option>
                  <option value="blocker" className="bg-[#17181d] text-amber-300">Holat: P0 To'siq</option>
                </select>

                {/* Muhimlik darajasi tanlash */}
                <select
                  value={task.priority}
                  onChange={(e) => updateTaskPriority(task.id, e.target.value as any)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] font-medium text-zinc-300 hover:border-white/20 focus:border-sky-400 focus:outline-none cursor-pointer transition"
                >
                  <option value="Normal" className="bg-[#17181d] text-zinc-200">Muhimlik: Oddiy</option>
                  <option value="High Priority" className="bg-[#17181d] text-violet-300">Muhimlik: Yuqori daraja</option>
                  <option value="Critical" className="bg-[#17181d] text-red-300">Muhimlik: O'ta muhim</option>
                  <option value="P0 Blocker" className="bg-[#17181d] text-amber-300">Muhimlik: P0 To'siq</option>
                </select>

                {/* Team Group / Squad tanlash */}
                <select
                  value={task.group_id ?? ''}
                  onChange={(e) => assignTaskToGroup(task.id, e.target.value ? e.target.value : null)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] font-medium text-zinc-300 hover:border-white/20 focus:border-sky-400 focus:outline-none cursor-pointer transition"
                >
                  <option value="" className="bg-[#17181d] text-zinc-400">Guruhsiz (Umumiy)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[#17181d] text-zinc-200">
                      Guruh: {g.name}
                    </option>
                  ))}
                </select>

                {/* Ovozli eslatma (Mic) */}
                <button
                  onClick={dictation.recording ? dictation.stop : dictation.start}
                  disabled={!selectedTaskId}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition ${
                    dictation.recording
                      ? 'bg-red-500/20 border border-red-400/40 text-red-300 shadow-[0_0_16px_-4px_rgba(248,113,113,0.6)] animate-pulse'
                      : 'border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={dictation.recording ? 'Stop & Append' : 'Start voice dictation (appends to note)'}
                >
                  {dictation.recording ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      <span className="font-mono">{String(Math.floor(dictation.seconds / 60)).padStart(2, '0')}:{String(dictation.seconds % 60).padStart(2, '0')}</span>
                      <Mic size={13} className="text-red-400" />
                    </>
                  ) : (
                    <Mic size={13} className="text-sky-300" />
                  )}
                </button>

                {note && (
                  <button onClick={() => setEditing((v) => !v)} className="ml-auto rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/10 transition">
                    {isEditing ? "Ko'rish" : 'Tahrirlash'}
                  </button>
                )}
              </div>
              <h1 className="mt-2 text-[20px] font-bold leading-tight text-white">{task.title}</h1>
            </div>

            {dictation.recording && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 font-mono text-[12px] text-red-200 animate-pulse">
                Listening… <span className="text-zinc-400">{dictation.finalText || '(waiting for speech)'}</span> <span className="text-zinc-500 italic">{dictation.interim}</span>
              </div>
            )}

            {(dictation.finalText || dictation.interim) && !dictation.recording && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                <p className="flex-1 font-mono text-[12px] text-emerald-200">Ready to append: <span className="text-zinc-300">{dictation.finalText}{dictation.interim && ` <span class="italic text-zinc-500">${dictation.interim}</span>`}</span></p>
                <button onClick={dictation.commit} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-400">Append to Note</button>
                <button onClick={() => { dictation.stop(); }} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/10">Discard</button>
              </div>
            )}

            {isEditing ? (
              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                  {note ? "Arxitektura eslatmasi (Markdown)" : "Arxitektura eslatmasi (bo'sh — yozish orqali saqlang)"}
                </p>
                <EditorArea taskId={task.id} value={note} placeholder="Arxitektura qarorlari, texnik kontekst yoki yechim bosqichlarini yozing (markdown qo'llab-quvvatlanadi)…" />
              </div>
            ) : (
              <MiniMarkdown source={note} />
            )}

            {/* Yechim nazorat ro'yxati */}
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Yechim Nazorat Ro'yxati</h3>
                <button
                  onClick={() => setAddingItem(true)}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
                >
                  <Plus size={13} className="text-sky-300" /> Ro'yxat bandi qo'shish
                </button>
              </div>

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
                    placeholder="Band matnini kiriting…"
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
                    onClick={() => { setAddingItem(false); setNewItemText(''); }}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  >
                    Bekor qilish
                  </button>
                </form>
              )}

              <div className="mt-3 space-y-2">
                {list.map((c) => (
                  <div key={c.id} className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 hover:border-white/[0.12] transition">
                    <button
                      onClick={() => toggleCheck(task.id, c.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${c.done ? 'border-sky-400/70 bg-sky-500 text-white shadow-[0_0_10px_-2px_rgba(56,189,248,0.8)]' : 'border-zinc-600 bg-transparent text-transparent'}`}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span className={`text-[13px] ${c.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{c.text}</span>
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
                  <p className="text-[13px] text-zinc-600">Hozircha nazorat ro'yxati bandlari yo'q.</p>
                )}
              </div>
            </section>

            {/* Prompt Vault integratsiyasi */}
            <LocalPromptVault taskId={task.id} onOpenChat={() => setChatModal(true)} />
          </div>
        ) : (
          <div className="mx-auto max-w-[720px] space-y-4 pb-28">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
              <span className="text-[12px] text-zinc-400">
                {task.id} uchun qayd etilgan AI suhbatlari ({prompts.length})
              </span>
              <button
                onClick={() => setChatModal(true)}
                className="flex items-center gap-1 rounded-lg bg-violet-600/80 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-violet-600 transition"
              >
                <Plus size={13} /> Yangi AI suhbat qo'shish
              </button>
            </div>

            {prompts.map((p, idx) => (
              <div key={p.id} className="space-y-3">
                <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-violet-600/90 px-4 py-3 text-[13px] text-white shadow-lg">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-violet-200">Siz · {p.prompt_hash ?? `#${idx + 1}`}</p>
                  {p.raw_prompt}
                </div>
                {p.ai_response && (
                  <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[13px] text-zinc-200">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{p.model_name ?? 'AI'}</p>
                    {p.ai_response}
                  </div>
                )}
              </div>
            ))}
            {prompts.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[13px] text-zinc-600">Ushbu {task.id} vazifasi uchun hali AI suhbati saqlanmagan.</p>
                <button
                  onClick={() => setChatModal(true)}
                  className="mt-3 text-[12.5px] text-violet-400 hover:underline"
                >
                  + AI suhbatini qayd etish
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating AI Weekly Coach & Retrospective Karta (Prototip dizayni kabi) */}
      <div className="absolute bottom-5 right-6 z-20 w-80 overflow-hidden rounded-2xl border border-violet-500/30 bg-[#12131a]/95 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-300">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600/30 text-violet-300">
            <Sparkles size={13} />
          </div>
          <span className="text-[12.5px] font-bold text-white tracking-tight">AI Weekly Coach & Retrospective</span>
        </div>
        <div className="space-y-1.5 text-[11.5px] text-zinc-300">
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span>{tasks.filter((t) => t.status === 'completed').length} ta vazifa bajarildi, {Math.max(tasks.filter((t) => t.status === 'active').length, 1)} ta qoldirildi</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="truncate">Bottleneck: SQLite tranzaksiyalari & API limitlari</span>
          </p>
          <p className="flex items-center gap-2 text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
            <span className="truncate">Tavsiya: Yechilgan kodlarni saqlash</span>
          </p>
        </div>
        <button
          onClick={() => triggerWeeklyCoach()}
          className="mt-3 w-full rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/20 py-1.5 text-center text-[12px] font-semibold text-violet-200 hover:text-white transition shadow-sm"
        >
          Feedback & Tahlil
        </button>
      </div>
    </main>
  );
}

function LocalPromptVault({ taskId, onOpenChat }: { taskId: string; onOpenChat: () => void }) {
  const { prompts } = useSynapse();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const first = prompts[0];

  if (!first) {
    return (
      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-4 text-center">
        <p className="text-[13px] text-zinc-400">Ushbu vazifada yechim topishda ishlatilgan AI prompt bormi?</p>
        <button
          onClick={onOpenChat}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600/80 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-600 transition"
        >
          <Plus size={13} /> AI Prompt Omboriga saqlash
        </button>
      </section>
    );
  }

  function copy() {
    navigator.clipboard?.writeText(first.raw_prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/[0.08] to-transparent">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className="text-[13px] font-bold text-violet-100">AI Prompt Ombori <span className="font-normal text-violet-300/80">(Yechim Generatori)</span></span>
        <span className="ml-auto rounded-md bg-violet-500/15 px-1.5 py-0.5 font-mono text-[11px] text-violet-200">Xesh: {first.prompt_hash ?? '#—'}</span>
        <ChevronDown size={15} className={`text-violet-300 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="border-t border-violet-400/10 px-4 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">{first.model_name ?? 'AI'} ga yuborilgan aniq prompt:</p>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/50 p-3.5 font-mono text-[12px] leading-relaxed text-zinc-300">{first.raw_prompt}</pre>
          <div className="mt-2.5 flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-[12px] font-semibold text-violet-100 hover:bg-violet-500/30">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Nusxa olindi' : 'Promptdan nusxa olish'}
            </button>
            <span className="font-mono text-[11px] text-zinc-600">vazifa: {taskId}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function TabBtn({ active, onClick, label, icon, badge }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 pb-3 pt-1 text-[13px] font-semibold transition ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {icon}
      {label}
      {badge && <span className="rounded-md bg-white/[0.08] px-1.5 py-px font-mono text-[10.5px] text-zinc-300">{badge}</span>}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" />}
    </button>
  );
}

function EditorArea({ taskId, value, placeholder }: { taskId: string; value: string; placeholder?: string }) {
  const { updateNote } = useSynapse();
  return (
    <textarea
      value={value}
      onChange={(e) => updateNote(taskId, e.target.value)}
      rows={12}
      spellCheck={false}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
    />
  );
}
