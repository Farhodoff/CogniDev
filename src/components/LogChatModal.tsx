import { useState } from 'react';
import { Bot, Sparkles, X, Clipboard, Check, Plus, Code, ArrowRight, Lightbulb, Tag } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { parseRawAiConversation, type ParsedAiIngestion } from '../lib/ai';

const MODELS = [
  { id: 'Claude 3.5 Sonnet', label: 'Claude 3.5', color: 'border-violet-500/30 text-violet-300 bg-violet-500/10' },
  { id: 'Gemini 1.5 Pro', label: 'Gemini 1.5', color: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10' },
  { id: 'ChatGPT (GPT-4o)', label: 'ChatGPT', color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
  { id: 'DeepSeek V3', label: 'DeepSeek', color: 'border-amber-500/30 text-amber-300 bg-amber-500/10' },
];

export default function LogChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, selectedTaskId, ingestAiConversation, setHud } = useSynapse();

  const [rawText, setRawText] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [mode, setMode] = useState<'new_task' | 'attach_task'>('new_task');
  const [targetId, setTargetId] = useState(selectedTaskId ?? tasks[0]?.id ?? '');
  const [parsed, setParsed] = useState<ParsedAiIngestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedClip, setCopiedClip] = useState(false);

  if (!open) return null;

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text && text.trim()) {
        setRawText(text.trim());
        const result = parseRawAiConversation(text.trim());
        setParsed(result);
        setModel(result.detectedModel);
        setCopiedClip(true);
        setTimeout(() => setCopiedClip(false), 2000);
      } else {
        setHud("Clipboardda matn topilmadi");
      }
    } catch {
      setHud("Clipboarddan o'qish uchun ruxsat berilmadi");
    }
  }

  function handleAutoParse() {
    if (!rawText.trim()) return;
    const result = parseRawAiConversation(rawText.trim());
    setParsed(result);
    setModel(result.detectedModel);
    setHud("Suhbat muvaffaqiyatli tahlil qilindi");
  }

  async function handleIngest() {
    if (!rawText.trim() || saving) return;
    setSaving(true);
    try {
      const baseData = parsed ?? parseRawAiConversation(rawText.trim());
      const ingestData: ParsedAiIngestion = { ...baseData, detectedModel: model };

      await ingestAiConversation(ingestData, mode, targetId);
      onClose();
    } catch {
      setHud("Import qilishda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-violet-500/30 bg-[#121319] shadow-2xl shadow-violet-500/10">
        {/* Glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-sky-600/15 blur-3xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
              <Bot size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-white">Universal AI Context Ingestion</h2>
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                  1-Click Import
                </span>
              </div>
              <p className="text-[11.5px] text-zinc-400">
                Claude, Gemini yoki ChatGPT dagi suhbat va yechimlarni markaziy bilimga aylantirish
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Model tanlash */}
          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">AI Manbasi</span>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition"
              >
                {copiedClip ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
                <span>{copiedClip ? "Clipboarddan olindi!" : "Clipboarddan tashlash"}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  className={`rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                    model === m.id
                      ? `${m.color} ring-1 ring-white/20 shadow-sm`
                      : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asl matn / Chat maydoni */}
          <div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                AI Suhbat Matni yoki Yechim Kodi
              </span>
              {rawText && (
                <button
                  type="button"
                  onClick={handleAutoParse}
                  className="flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition"
                >
                  <Sparkles size={11} /> 1-Click Tahlil qilish
                </button>
              )}
            </div>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (e.target.value.length > 50 && !parsed) {
                  setParsed(parseRawAiConversation(e.target.value));
                }
              }}
              rows={5}
              spellCheck={false}
              placeholder="Claude, Gemini yoki ChatGPT dan nusxalangan suhbat, prompt yoki kod namunalarini bu yerga joylang..."
              className="w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/60 focus:outline-none"
            />
          </div>

          {/* Tahlil natijasi (Parsed Live Preview) */}
          {parsed && (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.04] p-3.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                  <Sparkles size={13} /> Ajratib olingan struktura
                </span>
                <span className="font-mono text-[10.5px] text-zinc-400">Model: {parsed.detectedModel}</span>
              </div>

              {/* Sarlavha */}
              <div className="rounded-xl border border-white/[0.08] bg-black/40 p-2.5">
                <p className="text-[10px] font-mono uppercase text-zinc-500">Aniqlangan Sarlavha / Vazifa:</p>
                <input
                  value={parsed.title}
                  onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
                  className="w-full bg-transparent font-semibold text-[13.5px] text-white focus:outline-none mt-0.5"
                />
              </div>

              {/* Kod bo'lagi */}
              {parsed.solutionSnippet && (
                <div className="rounded-xl border border-white/[0.08] bg-black/50 p-2.5 font-mono text-[11px]">
                  <p className="text-[10px] uppercase text-zinc-500 flex items-center gap-1 mb-1">
                    <Code size={11} className="text-emerald-400" /> Yechim Kodi:
                  </p>
                  <pre className="max-h-24 overflow-x-auto text-emerald-300 leading-relaxed">
                    {parsed.solutionSnippet.slice(0, 300)}...
                  </pre>
                </div>
              )}

              {/* Key Learnings */}
              {parsed.keyLearnings.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-mono uppercase text-zinc-400 flex items-center gap-1 mb-1.5">
                    <Lightbulb size={11} className="text-amber-400" /> O'rganilgan bilimlar:
                  </p>
                  <ul className="space-y-1">
                    {parsed.keyLearnings.map((k, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12px] text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                        <span>{k}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Teglar */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Tag size={12} className="text-zinc-500" />
                {parsed.tags.map((t) => (
                  <span key={t} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Saqlash rejimi (Yangi vazifa vs Mavjudga biriktirish) */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Qanday saqlansin?
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('new_task')}
                className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-[12px] font-semibold transition ${
                  mode === 'new_task'
                    ? 'border border-sky-400/50 bg-sky-500/20 text-sky-200'
                    : 'border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white'
                }`}
              >
                <Plus size={14} /> Yangi Vazifa yaratish
              </button>

              <button
                type="button"
                onClick={() => setMode('attach_task')}
                className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-[12px] font-semibold transition ${
                  mode === 'attach_task'
                    ? 'border border-violet-400/50 bg-violet-500/20 text-violet-200'
                    : 'border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white'
                }`}
              >
                <ArrowRight size={14} /> Mavjud vazifaga biriktirish
              </button>
            </div>

            {mode === 'attach_task' && (
              <div className="mt-2.5">
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-zinc-100 focus:border-violet-400/60 focus:outline-none"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} — {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3.5 bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[12.5px] font-medium text-zinc-300 hover:bg-white/10 transition"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleIngest}
            disabled={!rawText.trim() || saving}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:brightness-110 shadow-lg shadow-violet-600/25 disabled:opacity-40 transition"
          >
            <Sparkles size={14} />
            <span>{saving ? 'Import qilinmoqda…' : 'Omborga Import Qilish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
