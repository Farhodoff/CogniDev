import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Search,
  Eye,
  Edit3,
  Copy,
  Check,
  Hash,
  Columns,
  Code2,
  Lightbulb,
  ArrowRight,
  ListTodo,
  Quote,
  Minus,
  Mic,
} from 'lucide-react';
import VoiceRecorderModal from './VoiceRecorderModal';
import { useSynapse } from '../lib/store';
import { enhanceNoteWithAi } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';

const EMOJI_OPTIONS = ['📝', '🐘', '🐍', '🚀', '💡', '🐛', '⚡', '⚙️', '🦀', '🐳', '🧠', '📚', '🎯', '🛠️', '💎', '🔥'];

export default function NotionNotesWorkspace() {
  const {
    notesDocs,
    selectedNoteId,
    selectNote,
    createNote,
    updateNoteDoc,
    deleteNoteDoc,
    setHud,
    addTask,
    activeWorkspaceId,
    userProfile,
  } = useSynapse();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');
  const [newTagInput, setNewTagInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Selected note
  const currentNote = useMemo(
    () => notesDocs.find((n) => n.id === selectedNoteId) ?? notesDocs[0] ?? null,
    [notesDocs, selectedNoteId],
  );

  // Filtered notes
  const filteredNotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return notesDocs;
    return notesDocs.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [notesDocs, searchQuery]);

  // Insert Notion-style block into editor
  const insertBlock = (template: string) => {
    if (!editorRef.current || !currentNote) return;
    const el = editorRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = currentNote.content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newContent = `${before}${before.endsWith('\n') || start === 0 ? '' : '\n'}${template}\n${after}`;

    updateNoteDoc(currentNote.id, { content: newContent });
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 400);

    // Reposition cursor
    setTimeout(() => {
      el.focus();
      const pos = start + template.length + 1;
      el.setSelectionRange(pos, pos);
    }, 50);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentNote) return;
    updateNoteDoc(currentNote.id, { title: e.target.value });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentNote) return;
    setSaveStatus('saving');
    updateNoteDoc(currentNote.id, { content: e.target.value });
    setTimeout(() => setSaveStatus('saved'), 500);
  };

  // Add tag
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentNote || !newTagInput.trim()) return;
    const clean = newTagInput.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
    if (clean && !currentNote.tags.includes(clean)) {
      updateNoteDoc(currentNote.id, { tags: [...currentNote.tags, clean] });
      setNewTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    if (!currentNote) return;
    updateNoteDoc(currentNote.id, { tags: currentNote.tags.filter((t) => t !== tag) });
  };

  // AI Actions on Note
  const handleAiAction = async (action: 'summarize' | 'action_items' | 'code_review' | 'format') => {
    if (!currentNote || !currentNote.content.trim()) return;
    setAiLoading(true);
    setHud("AI qaydni tahlil qilmoqda...");

    try {
      const result = await enhanceNoteWithAi(currentNote.content, action, selectedProvider);
      if (action === 'format') {
        updateNoteDoc(currentNote.id, { content: result });
        setHud("Qayd Notion formatiga keltirildi ✓");
      } else {
        const appended = `${currentNote.content}\n\n---\n### 🤖 AI Xulosasi (${selectedProvider.toUpperCase()})\n\n${result}\n`;
        updateNoteDoc(currentNote.id, { content: appended });
        setHud("AI xulosasi qaydga qo'shildi ✓");
      }
    } catch {
      setHud("AI so'rovi muvaffaqiyatsiz bo'ldi. Provayder kalitini tekshiring.");
    } finally {
      setAiLoading(false);
    }
  };

  // Turn note action items into real tasks
  const handleExtractTasks = () => {
    if (!currentNote) return;
    const lines = currentNote.content.split('\n');
    let added = 0;
    for (const line of lines) {
      const match = line.match(/^[-*]\s*\[\s*\]\s*(.+)$/);
      if (match && match[1]) {
        const taskTitle = match[1].trim();
        addTask({
          id: `TASK-${Date.now().toString().slice(-4)}`,
          workspace_id: activeWorkspaceId,
          title: `${currentNote.title}: ${taskTitle}`,
          status: 'active',
          priority: 'Normal',
          git_branch: null,
          pr_url: null,
          ai_source: 'Notion Doc',
          assignee_name: userProfile.full_name,
          assignee_avatar: userProfile.avatar_color,
          assignee_name2: null,
          assignee_avatar2: null,
          tags: [...currentNote.tags, 'notion-action'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        added++;
      }
    }
    if (added > 0) {
      setHud(`${added} ta vazifa Oqimga (Task Stream) eksport qilindi! 🚀`);
    } else {
      setHud("Belgilangan '- [ ]' ro'yxat bandlari topilmadi. Avval AI orqali Action Items generatsiya qiling.");
    }
  };

  // Keyboard shortcut for quick actions
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setViewMode((m) => (m === 'preview' ? 'edit' : m === 'edit' ? 'split' : 'preview'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full w-full flex-1 overflow-hidden bg-[#0d0e12]">
      {/* ── SUB-SIDEBAR: Document List ── */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-white/[0.06] bg-[#121318]/90">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h2 className="text-[13px] font-bold text-white tracking-wide">Qaydlar & Docs</h2>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
              {notesDocs.length}
            </span>
          </div>
          <button
            onClick={() => createNote('Yangi Texnik Hujjat')}
            title="Yangi sahifa yaratish"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white transition"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qaydlarni qidirish..."
              className="w-full rounded-xl border border-white/[0.08] bg-black/40 pl-8 pr-3 py-1.5 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Document items list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {filteredNotes.map((note) => {
            const isSelected = currentNote?.id === note.id;
            return (
              <div
                key={note.id}
                onClick={() => selectNote(note.id)}
                className={`group relative flex cursor-pointer items-start gap-2.5 rounded-xl p-2.5 transition ${
                  isSelected
                    ? 'bg-white/[0.08] text-white shadow-sm ring-1 ring-white/10'
                    : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                }`}
              >
                <span className="mt-0.5 text-base shrink-0 select-none">{note.icon || '📝'}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[13px] font-medium leading-snug">
                    {note.title || 'Sarlavhasiz qayd'}
                  </h4>
                  <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
                    {note.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9.5px] text-zinc-500 truncate"
                      >
                        #{t}
                      </span>
                    ))}
                    <span className="ml-auto font-mono text-[10px] text-zinc-600 shrink-0">
                      {new Date(note.updated_at).toLocaleDateString('uz-UZ', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Ushbu qaydni o'chirishga ishonchingiz komilmi?")) {
                      deleteNoteDoc(note.id);
                    }
                  }}
                  title="O'chirish"
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}

          {filteredNotes.length === 0 && (
            <div className="p-4 text-center text-[12px] text-zinc-600">
              Qaydlar topilmadi
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN NOTION CANVAS ── */}
      {currentNote ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar: Controls & AI actions */}
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#121318]/50 px-6 py-2.5">
            {/* View toggles & save state */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
                    viewMode === 'edit' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Edit3 size={13} /> Tahrir
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
                    viewMode === 'split' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Columns size={13} /> Bo'lingan
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
                    viewMode === 'preview' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Eye size={13} /> Ko'rish
                </button>
              </div>

              <span className="font-mono text-[11px] text-zinc-500">
                {saveStatus === 'saved' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Check size={12} /> Saqlandi
                  </span>
                ) : (
                  <span className="text-zinc-400">Saqlanmoqda...</span>
                )}
              </span>
            </div>

            {/* AI Assistant Toolbar */}
            <div className="flex items-center gap-2">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
                className="rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1 text-[11px] font-mono text-zinc-300 focus:outline-none"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                disabled={aiLoading}
                onClick={() => handleAiAction('summarize')}
                className="flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[11.5px] font-medium text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-40"
              >
                <Sparkles size={12} /> Xulosa
              </button>

              <button
                disabled={aiLoading}
                onClick={() => handleAiAction('action_items')}
                className="flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11.5px] font-medium text-sky-300 hover:bg-sky-500/20 transition disabled:opacity-40"
              >
                <ListTodo size={12} /> Vazifalar
              </button>

              <button
                onClick={() => setVoiceModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11.5px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
                title="Ovoz bilan matn yozish (Voice Note)"
              >
                <Mic size={12} /> Ovozli qayd
              </button>

              <button
                onClick={handleExtractTasks}
                title="Qayddagi checklist bandlarini Oqimga vazifa qilib ko'chirish"
                className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <ArrowRight size={12} /> Taskka eksport
              </button>
            </div>
          </div>

          {/* Notion Block Shortcuts Bar */}
          <div className="flex items-center gap-1 border-b border-white/[0.04] bg-[#0f1013] px-6 py-1.5 overflow-x-auto text-zinc-400">
            <span className="font-mono text-[10px] uppercase text-zinc-600 mr-2 tracking-wider">Bloklar:</span>
            <button
              onClick={() => insertBlock('# Sarlavha 1')}
              className="rounded px-2 py-0.5 text-[11px] hover:bg-white/10 hover:text-white transition"
            >
              H1
            </button>
            <button
              onClick={() => insertBlock('## Sarlavha 2')}
              className="rounded px-2 py-0.5 text-[11px] hover:bg-white/10 hover:text-white transition"
            >
              H2
            </button>
            <button
              onClick={() => insertBlock('### Sarlavha 3')}
              className="rounded px-2 py-0.5 text-[11px] hover:bg-white/10 hover:text-white transition"
            >
              H3
            </button>
            <button
              onClick={() => insertBlock('> 💡 **Fikr / Eslatma:** Bu yerda muhim kontekst yoziladi.')}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] hover:bg-white/10 text-amber-300 transition"
            >
              <Lightbulb size={11} /> Callout
            </button>
            <button
              onClick={() => insertBlock('```python\n# Kod namunasi\ndef solution():\n    pass\n```')}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] hover:bg-white/10 text-sky-300 transition"
            >
              <Code2 size={11} /> Kod bloki
            </button>
            <button
              onClick={() => setVoiceModalOpen(true)}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] hover:bg-white/10 text-rose-300 transition"
              title="Ovozli eslatma yozish"
            >
              <Mic size={11} /> Ovozli matn
            </button>
            <button
              onClick={() => insertBlock('- [ ] Yangi vazifa / tekshirish bandi')}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] hover:bg-white/10 text-emerald-300 transition"
            >
              <Check size={11} /> Todo band
            </button>
            <button
              onClick={() => insertBlock('> Iqtibos yoki mezon tavsifi')}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] hover:bg-white/10 transition"
            >
              <Quote size={11} /> Iqtibos
            </button>
            <button
              onClick={() => insertBlock('---')}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] hover:bg-white/10 transition"
            >
              <Minus size={11} /> Ajratgich
            </button>
          </div>

          {/* Canvas Scroll Area */}
          <div className="flex-1 overflow-y-auto px-10 py-8">
            <div className="mx-auto max-w-[860px]">
              {/* Document Header: Icon & Big Title */}
              <div className="mb-6 space-y-4">
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    title="Ikonkani o'zgartirish"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl hover:scale-105 transition"
                  >
                    {currentNote.icon || '📝'}
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute left-0 top-14 z-20 grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-[#181920] p-2 shadow-2xl">
                      {EMOJI_OPTIONS.map((em) => (
                        <button
                          key={em}
                          onClick={() => {
                            updateNoteDoc(currentNote.id, { icon: em });
                            setShowEmojiPicker(false);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-white/10 transition"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Title */}
                <input
                  value={currentNote.title}
                  onChange={handleTitleChange}
                  placeholder="Sarlavhasiz hujjat..."
                  className="w-full bg-transparent text-[32px] font-extrabold tracking-tight text-white placeholder:text-zinc-700 focus:outline-none"
                />

                {/* Tags Bar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {currentNote.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                    >
                      <Hash size={10} className="text-zinc-500" />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-zinc-500 hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <form onSubmit={handleAddTag} className="inline-block">
                    <input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      placeholder="+ teg qo'shish..."
                      className="rounded-md border border-dashed border-white/10 bg-transparent px-2 py-0.5 text-[11px] text-zinc-400 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </form>
                </div>
              </div>

              {/* Editor / Preview Grid */}
              <div
                className={`grid gap-6 ${
                  viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {/* Editor textarea */}
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div className="flex flex-col">
                    <textarea
                      ref={editorRef}
                      value={currentNote.content}
                      onChange={handleContentChange}
                      placeholder="Ushbu sahifada fikrlar, arxitektura rejalari, muammolar va yechimlarni yozing..."
                      className="min-h-[550px] w-full resize-none bg-transparent font-mono text-[13.5px] leading-relaxed text-zinc-200 placeholder:text-zinc-700 focus:outline-none"
                    />
                  </div>
                )}

                {/* Rich Notion-style Preview */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 leading-relaxed">
                    <NotionRenderedContent content={currentNote.content} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-500">
          <span className="text-4xl mb-3">📝</span>
          <h3 className="text-[16px] font-semibold text-zinc-300">Qayd tanlanmagan</h3>
          <p className="mt-1 text-[13px] text-zinc-500 max-w-sm">
            Chap tarafdan istalgan texnik hujjatni tanlang yoki yangi sahifa yarating.
          </p>
          <button
            onClick={() => createNote('Yangi Texnik Hujjat')}
            className="mt-4 rounded-xl bg-sky-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg hover:bg-sky-400 transition"
          >
            + Yangi sahifa ochish
          </button>
        </div>
      )}

      {/* Voice Recorder Modal for Notion Document */}
      {voiceModalOpen && (
        <VoiceRecorderModal
          open={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          targetNoteDocId={currentNote?.id}
        />
      )}
    </div>
  );
}

/** Rich Notion-like formatted renderer with syntax highlighting and callouts */
function NotionRenderedContent({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.split('\n');
    const out: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim() || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        const rawCode = codeLines.join('\n');
        out.push(
          <div key={key++} className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#07080a]">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5">
              <span className="font-mono text-[11px] text-zinc-400 uppercase tracking-wider">{lang}</span>
              <button
                onClick={() => navigator.clipboard.writeText(rawCode)}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <Copy size={11} /> Nusxa olish
              </button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-emerald-300">
              <code>{rawCode}</code>
            </pre>
          </div>,
        );
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        out.push(
          <h1 key={key++} className="mt-6 mb-3 text-[24px] font-extrabold text-white tracking-tight border-b border-white/[0.06] pb-2">
            {line.slice(2)}
          </h1>,
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        out.push(
          <h2 key={key++} className="mt-5 mb-2.5 text-[19px] font-bold text-zinc-100 tracking-tight">
            {line.slice(3)}
          </h2>,
        );
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        out.push(
          <h3 key={key++} className="mt-4 mb-2 text-[15.5px] font-semibold text-zinc-200">
            {line.slice(4)}
          </h3>,
        );
        i++;
        continue;
      }

      // Callout block (> 💡 or > ⚠️ or >)
      if (line.startsWith('> ')) {
        const text = line.slice(2);
        const isIdea = text.includes('💡') || text.toLowerCase().includes('fikr');
        const isWarning = text.includes('⚠️') || text.toLowerCase().includes('diqqat');
        out.push(
          <blockquote
            key={key++}
            className={`my-3 rounded-xl border-l-4 p-3.5 text-[13px] leading-relaxed ${
              isWarning
                ? 'border-amber-400 bg-amber-500/[0.07] text-amber-200'
                : isIdea
                ? 'border-sky-400 bg-sky-500/[0.07] text-sky-200'
                : 'border-purple-400 bg-purple-500/[0.07] text-zinc-200'
            }`}
          >
            {text}
          </blockquote>,
        );
        i++;
        continue;
      }

      // Todo Checklist items (- [ ] or - [x])
      if (line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)) {
        const match = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)!;
        const checked = match[1].toLowerCase() === 'x';
        const taskText = match[2];
        out.push(
          <div key={key++} className="my-1.5 flex items-center gap-2.5 text-[13px]">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                checked
                  ? 'border-sky-400 bg-sky-500 text-white'
                  : 'border-zinc-600 bg-transparent text-transparent'
              }`}
            >
              <Check size={11} strokeWidth={3} />
            </span>
            <span className={checked ? 'line-through text-zinc-500' : 'text-zinc-200'}>
              {taskText}
            </span>
          </div>,
        );
        i++;
        continue;
      }

      // Horizontal rule
      if (line.trim() === '---') {
        out.push(<hr key={key++} className="my-5 border-white/[0.08]" />);
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Normal paragraph
      out.push(
        <p key={key++} className="my-2 text-[13.5px] leading-relaxed text-zinc-300">
          {line}
        </p>,
      );
      i++;
    }

    return out;
  }, [content]);

  return <div className="space-y-1">{blocks}</div>;
}
