import { useState, useMemo } from 'react';
import {
  Trophy,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  Brain,
  FileCheck,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { callAi, isBlocker } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';
import FormattedAiText from './FormattedAiText';

export default function RetroWorkspace() {
  const {
    tasks,
    notesDocs,
    learningLogs,
    setHud,
    setMainView,
    selectTask,
  } = useSynapse();

  const [aiLoading, setAiLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');
  const [retroAnalysis, setRetroAnalysis] = useState<string | null>(null);

  // Group tasks
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'completed'),
    [tasks],
  );

  const activeBlockers = useMemo(
    () => tasks.filter(isBlocker),
    [tasks],
  );

  const inProgressTasks = useMemo(
    () => tasks.filter((t) => t.status === 'active' || t.status === 'in_review'),
    [tasks],
  );

  // Generate comprehensive AI weekly feedback
  const handleGenerateFeedback = async () => {
    setAiLoading(true);
    setHud("AI haftalik ishlar va muammolar bo'yicha hisobot tayyorlamoqda...");

    const completedSummary = completedTasks
      .slice(0, 8)
      .map((t) => `- ${t.id} [${t.priority}]: ${t.title}`)
      .join('\n') || "- Yopilgan vazifalar yo'q";

    const blockersSummary = activeBlockers
      .slice(0, 6)
      .map((t) => `- ${t.id} [${t.priority}]: ${t.title}`)
      .join('\n') || "- Faol to'siqlar yo'q";

    const prompt = `Siz katta muhandislik murabbiyi va Tech Leadsiz. Quyidagi dasturchining haftalik faoliyati bo'yicha chuqur tahlil va samimiy, amaliy feedback bering.

Bajarilgan va hal qilingan vazifalar:
${completedSummary}

Faol to'siqlar va muammolar:
${blockersSummary}

O'rganish jurnallari soni: ${learningLogs.length} ta
Texnik qaydlar soni: ${notesDocs.length} ta

Iltimos, o'zbek tilida 3 ta aniq bo'limda xulosa bering:
1. 🏆 Hal qilingan asosiy muammolar tahlili: Qaysi texnik ishlar eng katta qiymat berdi?
2. ⚠️ To'siqlar va xatolar: Qayerda qotib qolish xavfi bor va ularni qanday oldini olish mumkin?
3. 🚀 Junior dasturchiga keyingi haftaga 3 ta aniq tavsiya va fokus nuqtasi.`;

    try {
      const res = await callAi(
        prompt,
        "Siz dasturiy ta'minot bo'yicha yetakchi murabbiysiz. Tahlilni o'zbek tilida, professional, ortiqcha tinish belgilari, sun'iy ASCII jadvallar va panjaralarsiz (##), toza va o'qishga qulay punktlar shaklida bering.",
        selectedProvider,
      );
      setRetroAnalysis(res.text);
      setHud("Haftalik AI tahlili tayyorlandi ✓");
    } catch {
      setHud("AI tahlilida xatolik yuz berdi. Provayder kalitini tekshiring.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-[#0d0e12]">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#121318]/90 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Trophy size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold text-white tracking-wide">
                Haftalik Tahlil & Muammolar Yechimi
              </h1>
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[10.5px] text-emerald-300">
                Weekly Retrospective
              </span>
            </div>
            <p className="text-[12px] text-zinc-400">
              Qilingan va qilinmagan ishlar sarhisobi, hal etilgan to'siqlar va AI feedback
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
            className="rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                AI: {p.name}
              </option>
            ))}
          </select>

          <button
            disabled={aiLoading}
            onClick={handleGenerateFeedback}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition"
          >
            <Sparkles size={14} />
            {aiLoading ? "Tahlil qilinmoqda..." : "AI dan Feedback Olish"}
          </button>
        </div>
      </div>

      {/* ── METRICS STRIP ── */}
      <div className="grid grid-cols-4 gap-4 border-b border-white/[0.06] bg-black/20 px-6 py-4">
        <div className="rounded-xl border border-white/[0.06] bg-[#121318]/60 p-3.5">
          <span className="text-[11px] font-semibold uppercase text-emerald-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={13} /> Hal Qilingan
          </span>
          <p className="text-[22px] font-extrabold text-white">{completedTasks.length}</p>
          <span className="text-[11px] text-zinc-500 font-mono">Bajarilgan vazifalar</span>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#121318]/60 p-3.5">
          <span className="text-[11px] font-semibold uppercase text-rose-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={13} /> To'siqlar (P0)
          </span>
          <p className="text-[22px] font-extrabold text-white">{activeBlockers.length}</p>
          <span className="text-[11px] text-zinc-500 font-mono">Faol muammolar</span>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#121318]/60 p-3.5">
          <span className="text-[11px] font-semibold uppercase text-sky-400 flex items-center gap-1.5 mb-1">
            <Clock size={13} /> Jarayonda
          </span>
          <p className="text-[22px] font-extrabold text-white">{inProgressTasks.length}</p>
          <span className="text-[11px] text-zinc-500 font-mono">Faol vazifalar</span>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#121318]/60 p-3.5">
          <span className="text-[11px] font-semibold uppercase text-purple-400 flex items-center gap-1.5 mb-1">
            <FileCheck size={13} /> Texnik Docs
          </span>
          <p className="text-[22px] font-extrabold text-white">{notesDocs.length}</p>
          <span className="text-[11px] text-zinc-500 font-mono">Notion qaydlar</span>
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-[900px] space-y-6">
          {/* AI Comprehensive Analysis Card */}
          {retroAnalysis ? (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-purple-400" />
                <h3 className="text-[16px] font-bold text-white">
                  Senior Tech Lead & AI Murabbiy Tahlili
                </h3>
                <span className="ml-auto rounded-full bg-purple-500/20 px-2.5 py-0.5 font-mono text-[11px] text-purple-300">
                  {selectedProvider.toUpperCase()}
                </span>
              </div>

              <div className="bg-black/40 rounded-xl p-5 border border-white/10">
                <FormattedAiText content={retroAnalysis} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-6 text-center space-y-2">
              <Sparkles size={24} className="mx-auto text-emerald-400" />
              <h3 className="text-[15px] font-bold text-white">
                Haftalik AI Feedback Olishga Tayyormisiz?
              </h3>
              <p className="text-[13px] text-zinc-400 max-w-md mx-auto">
                Yuqoridagi "AI dan Feedback Olish" tugmasini bosing. AI bajarilgan ishlaringizni, yechilgan muammolarni va to'siqlarni tahlil qilib, amaliy yo'riqnoma beradi.
              </p>
            </div>
          )}

          {/* Solved Problems & Completed Tasks */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Muvaffaqiyatli Hal Qilingan Vazifalar ({completedTasks.length})
            </h4>

            <div className="space-y-2">
              {completedTasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    selectTask(t.id);
                    setMainView('stream');
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.05] bg-[#121318]/60 p-3 hover:border-white/10 hover:bg-white/[0.03] transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                      {t.id}
                    </span>
                    <span className="text-[13px] text-zinc-200 font-medium">{t.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-zinc-400">
                      {t.priority}
                    </span>
                    <ArrowUpRight size={13} className="text-zinc-500" />
                  </div>
                </div>
              ))}

              {completedTasks.length === 0 && (
                <p className="text-[12.5px] text-zinc-500 italic p-3">
                  Hozircha yakunlangan vazifalar mavjud emas.
                </p>
              )}
            </div>
          </div>

          {/* Active Blockers */}
          {activeBlockers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[13px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} /> E'tibor Talab Qiluvchi To'siqlar ({activeBlockers.length})
              </h4>

              <div className="space-y-2">
                {activeBlockers.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      selectTask(t.id);
                      setMainView('stream');
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3 hover:bg-rose-500/[0.08] transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[11px] text-rose-400 font-semibold">
                        {t.id}
                      </span>
                      <span className="text-[13px] text-rose-200 font-medium">{t.title}</span>
                    </div>

                    <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[10.5px] text-rose-300">
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
