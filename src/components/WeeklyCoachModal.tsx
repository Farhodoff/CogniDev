import { useState } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, Copy, Check, TrendingUp } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { SOURCE_LABELS, type AiSource } from '../lib/providers';

export default function WeeklyCoachModal() {
  const {
    showWeeklyCoachModal,
    setWeeklyCoachModal,
    weeklyCoach,
    triggerWeeklyCoach,
    setDeveloperHealthModal,
    setHud,
  } = useSynapse();

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!showWeeklyCoachModal || !weeklyCoach) return null;

  async function handleRefresh() {
    setLoading(true);
    try {
      await triggerWeeklyCoach();
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!weeklyCoach) return;
    const text = `## AI Haftalik Fidbek & Retrospektiv (${weeklyCoach.generatedAt})\n\n${weeklyCoach.summary}\n\n### Aniqlangan to'siqlar:\n${weeklyCoach.bottlenecks.map((b) => `- ${b}`).join('\n')}\n\n### Tavsiyalar:\n${weeklyCoach.recommendations.map((r) => `- ${r}`).join('\n')}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setHud("Haftalik hisobot nusxalandi");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-violet-500/30 bg-[#121319] shadow-2xl shadow-violet-500/10">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-sky-600/15 blur-3xl" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.08] px-6 py-4.5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-white">Haftalik Tahlil</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${weeklyCoach.aiPowered ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-amber-400/30 bg-amber-500/15 text-amber-300'}`}>
                  {weeklyCoach.aiPowered
                    ? `${weeklyCoach.aiSource && weeklyCoach.aiSource in SOURCE_LABELS ? SOURCE_LABELS[weeklyCoach.aiSource as AiSource] : 'AI'} yozgan${weeklyCoach.aiModel ? ` · ${weeklyCoach.aiModel}` : ''}`
                    : 'Lokal shablon'}
                </span>
              </div>
              <p className="text-[12px] text-zinc-400">
                Haftalik ishlar va AI xulosasi · {weeklyCoach.generatedAt}
              </p>
            </div>
          </div>
          <button
            onClick={() => setWeeklyCoachModal(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Metrikalar paneli */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider">Bajarildi</span>
                <CheckCircle2 size={16} />
              </div>
              <p className="mt-2 text-2xl font-bold text-white font-mono">{weeklyCoach.completedCount}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Bajarilgan</p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3.5">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider">Qoldirildi</span>
                <TrendingUp size={16} />
              </div>
              <p className="mt-2 text-2xl font-bold text-white font-mono">{weeklyCoach.deferredCount}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Qoldirilgan</p>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-3.5">
              <div className="flex items-center justify-between text-sky-400">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider">To'siqlar</span>
                <AlertTriangle size={16} />
              </div>
              <p className="mt-2 text-2xl font-bold text-white font-mono">{weeklyCoach.blockersCount}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">To'siqlar</p>
            </div>
          </div>

          {/* Umumiy xulosa */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Sparkles size={14} className="text-violet-400" /> Xulosa
            </h3>
            <p className="text-[13.5px] leading-relaxed text-zinc-200">
              {weeklyCoach.summary}
            </p>
          </div>

          {/* Aniqlangan to'siqlar */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={14} /> Asosiy to'siqlar
            </h3>
            <ul className="space-y-1.5 pl-1">
              {weeklyCoach.bottlenecks.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-300 leading-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tavsiyalar */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
              <Lightbulb size={14} /> AI tavsiyalari
            </h3>
            <ul className="space-y-2 pl-1">
              {weeklyCoach.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-zinc-200 leading-normal">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-3.5 bg-white/[0.02]">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[12px] font-medium text-zinc-300 hover:bg-white/10 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Yangilash
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setWeeklyCoachModal(false);
                setDeveloperHealthModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[12.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <TrendingUp size={14} />
              <span>Infografika & Heatmap</span>
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[12.5px] font-semibold text-zinc-200 hover:bg-white/10 transition"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Nusxa olindi' : 'Nusxa olish'}
            </button>
            <button
              onClick={() => setWeeklyCoachModal(false)}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:brightness-110 shadow-lg shadow-violet-600/20 transition"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
