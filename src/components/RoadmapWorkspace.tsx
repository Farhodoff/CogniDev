import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Sparkles,
  TrendingUp,
  Brain,
  Check,
  Flame,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { analyzeLearningLog } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';

export default function RoadmapWorkspace() {
  const {
    roadmaps,
    selectedRoadmapId,
    toggleTopicDone,
    learningLogs,
    addLearningLog,
    setHud,
  } = useSynapse();

  const [activeTab, setActiveTab] = useState<'milestones' | 'log' | 'coach'>('milestones');
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');

  // Daily log form state
  const [learnedInput, setLearnedInput] = useState('');
  const [solvedProblemInput, setSolvedProblemInput] = useState('');
  const [nextGoalInput, setNextGoalInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [recentAiFeedback, setRecentAiFeedback] = useState<string | null>(null);

  const [todayStr] = useState(() => new Date().toLocaleDateString('uz-UZ'));

  // Active roadmap
  const currentRoadmap = useMemo(
    () => roadmaps.find((r) => r.id === selectedRoadmapId) ?? roadmaps[0] ?? null,
    [roadmaps, selectedRoadmapId],
  );

  // Calculate progress
  const progressStats = useMemo(() => {
    if (!currentRoadmap) return { total: 0, done: 0, percentage: 0 };
    let total = 0;
    let done = 0;
    for (const m of currentRoadmap.milestones) {
      for (const t of m.topics) {
        total++;
        if (t.done) done++;
      }
    }
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percentage };
  }, [currentRoadmap]);

  // Submit daily learning check
  const handleSubmitDailyCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoadmap || !learnedInput.trim()) return;

    setAiLoading(true);
    setHud("AI Murabbiy hisobotingizni tahlil qilmoqda...");

    try {
      const feedback = await analyzeLearningLog(
        learnedInput.trim(),
        solvedProblemInput.trim(),
        nextGoalInput.trim(),
        selectedProvider,
      );

      await addLearningLog(
        currentRoadmap.id,
        learnedInput.trim(),
        solvedProblemInput.trim(),
        nextGoalInput.trim(),
        feedback,
      );

      setRecentAiFeedback(feedback);
      setLearnedInput('');
      setSolvedProblemInput('');
      setNextGoalInput('');
      setHud("Bugungi o'rganish jurnali saqlandi va AI feedback olindi ✓");
      setActiveTab('coach');
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold text-white tracking-wide">
                {currentRoadmap?.title || "Dasturchi Yo'l Xaritasi"}
              </h1>
              <span className="rounded-md bg-white/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-amber-300">
                Junior → Senior Track
              </span>
            </div>
            <p className="text-[12px] text-zinc-400">
              {currentRoadmap?.stack || "Backend texnologiyalar va tillar"}
            </p>
          </div>
        </div>

        {/* Tab navigation & AI Provider */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/40 p-0.5">
            <button
              onClick={() => setActiveTab('milestones')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'milestones' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen size={13} /> Bosqichlar ({progressStats.done}/{progressStats.total})
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'log' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar size={13} /> Kunlik Check & Hisobot
            </button>
            <button
              onClick={() => setActiveTab('coach')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'coach' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles size={13} className="text-purple-400" /> AI Murabbiy
            </button>
          </div>

          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
            className="rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Bar strip */}
      <div className="border-b border-white/[0.06] bg-black/20 px-6 py-2.5">
        <div className="flex items-center justify-between text-[12px] mb-1.5">
          <span className="font-medium text-zinc-300">
            Umumiy o'zlashtirish darajasi: <strong className="text-white">{progressStats.percentage}%</strong>
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {progressStats.done} ta mavzu o'rganildi · {progressStats.total - progressStats.done} ta qoldi
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressStats.percentage}%` }}
          />
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-[900px]">
          {/* ── TAB 1: MILESTONES ── */}
          {activeTab === 'milestones' && currentRoadmap && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="text-[14px] font-semibold text-white mb-1">
                  🎯 Yo'l Xaritasi Maqsadi
                </h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  {currentRoadmap.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11.5px] text-zinc-500 font-mono">
                  <span>Tavsiya muddat: 8–12 oy</span>
                  <span>·</span>
                  <span>Kuniga: 2–3 soat</span>
                  <span>·</span>
                  <span className="text-amber-400">Har bosqichda bitta asosiy til + amaliy loyiha</span>
                </div>
              </div>

              {/* Milestones accordion list */}
              <div className="space-y-4">
                {currentRoadmap.milestones.map((ms, idx) => {
                  const msDone = ms.topics.filter((t) => t.done).length;
                  const msTotal = ms.topics.length;
                  const isCompleted = msDone === msTotal && msTotal > 0;

                  return (
                    <div
                      key={ms.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        isCompleted
                          ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                          : 'border-white/[0.08] bg-[#121318]/70'
                      }`}
                    >
                      {/* Milestone Header */}
                      <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[12px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/[0.07] text-zinc-300'
                            }`}
                          >
                            {isCompleted ? <Check size={14} /> : idx + 1}
                          </span>
                          <div>
                            <h4 className="text-[14px] font-bold text-white leading-snug">
                              {ms.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                              {ms.duration && <span>⏱ {ms.duration}</span>}
                              {ms.priority && (
                                <span className="inline-flex items-center text-amber-400">
                                  <Flame size={11} className="mr-0.5" /> {ms.priority} prioritet
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[12px] text-zinc-400">
                            {msDone}/{msTotal} o'zlashtirildi
                          </span>
                        </div>
                      </div>

                      {/* Topics Checklist */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2 bg-black/20">
                        {ms.topics.map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => toggleTopicDone(currentRoadmap.id, ms.id, topic.id)}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                              topic.done
                                ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-zinc-400'
                                : 'border-white/[0.05] bg-white/[0.015] text-zinc-200 hover:border-white/10 hover:bg-white/[0.04]'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                topic.done
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-zinc-600 bg-transparent text-transparent'
                              }`}
                            >
                              <Check size={11} strokeWidth={3} />
                            </span>
                            <span className={`text-[12.5px] leading-snug ${topic.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                              {topic.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 2: DAILY LEARNING LOG & CHECK ── */}
          {activeTab === 'log' && (
            <div className="space-y-6">
              {/* Daily Log Form */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121318] p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={16} className="text-sky-400" />
                  <h3 className="text-[15px] font-bold text-white">
                    Bugungi O'rganish Hisoboti (Daily Check)
                  </h3>
                  <span className="ml-auto font-mono text-[11px] text-zinc-500">
                    Sana: {todayStr}
                  </span>
                </div>

                <form onSubmit={handleSubmitDailyCheck} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-300 mb-1.5">
                      1. Bugun aniq nimalarni o'rgandingiz? (Mavzular, kod bloklari, tushunchalar) *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={learnedInput}
                      onChange={(e) => setLearnedInput(e.target.value)}
                      placeholder="Masalan: Python asyncio coroutinelari, aiohttp orqali parallel 100 ta API so'rov yuborish va gather() bilan kutish..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-300 mb-1.5">
                      2. Qanday muammo yoki xatoga duch keldingiz va uni qanday hal qildingiz?
                    </label>
                    <textarea
                      rows={2}
                      value={solvedProblemInput}
                      onChange={(e) => setSolvedProblemInput(e.target.value)}
                      placeholder="Masalan: Event loop allaqachon ishlab turganda RuntimeError berdi. Uni asyncio.get_event_loop() o'rniga asyncio.run() bilan tuzatdim..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-300 mb-1.5">
                      3. Ertangi o'rganish rejasi / maqsadi
                    </label>
                    <input
                      value={nextGoalInput}
                      onChange={(e) => setNextGoalInput(e.target.value)}
                      placeholder="Masalan: Multiprocessing vs Threading farqi va CPU-bound vazifalarda sinab ko'rish"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={aiLoading || !learnedInput.trim()}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition"
                    >
                      <Sparkles size={15} />
                      {aiLoading ? "AI tahlil qilmoqda..." : "Saqlash va AI Murabbiydan Tahlil Olish"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Past logs history */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider">
                  O'tgan kunlar jurnali ({learningLogs.length})
                </h4>

                {learningLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-white/[0.06] bg-[#121318]/60 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                      <span className="font-mono text-[12px] text-sky-400 font-semibold">
                        🗓 {log.date}
                      </span>
                      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10.5px] text-zinc-500">
                        Qayd #{log.id.slice(-4)}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase text-zinc-500 mb-1">O'rganildi:</p>
                      <p className="text-[13px] text-zinc-200">{log.learned}</p>
                    </div>

                    {log.solved_problem && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                        <p className="text-[11px] font-semibold uppercase text-emerald-400 mb-0.5">
                          ✓ Hal qilingan muammo:
                        </p>
                        <p className="text-[12.5px] text-emerald-200">{log.solved_problem}</p>
                      </div>
                    )}

                    {log.next_goal && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-zinc-500 mb-0.5">Keyingi maqsad:</p>
                        <p className="text-[12.5px] text-zinc-400">{log.next_goal}</p>
                      </div>
                    )}

                    {log.ai_feedback && (
                      <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-[12px]">
                          <Sparkles size={13} /> AI Murabbiy Tahlili:
                        </div>
                        <p className="text-[12.5px] text-zinc-300 whitespace-pre-line leading-relaxed">
                          {log.ai_feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {learningLogs.length === 0 && (
                  <div className="p-8 text-center text-[13px] text-zinc-600 rounded-2xl border border-dashed border-white/10">
                    Hozircha o'rganish jurnallari kiritilmagan. Yuqoridagi formadan bugungi birinchi hisobotingizni yozing!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: AI COACH (MURABBIY) ── */}
          {activeTab === 'coach' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Brain size={20} className="text-purple-400" />
                  <h3 className="text-[16px] font-bold text-white">
                    Senior Murabbiy & Karyera Maslahatchisi
                  </h3>
                  <span className="ml-auto rounded-full bg-purple-500/20 px-2.5 py-0.5 font-mono text-[11px] text-purple-300">
                    Provayder: {selectedProvider.toUpperCase()}
                  </span>
                </div>

                <p className="text-[13px] text-zinc-300 leading-relaxed">
                  Murabbiy sizning kunlik o'rganish sur'atingiz, hal qilayotgan muammolaringiz va backend yo'l xaritasidagi progressni hisobga olgan holda amaliy yo'l-yo'riq beradi.
                </p>

                {recentAiFeedback ? (
                  <div className="rounded-xl border border-white/10 bg-black/50 p-5 space-y-3">
                    <h4 className="text-[13px] font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles size={14} /> Oxirgi Hisobotingiz Tahlili:
                    </h4>
                    <div className="text-[13px] leading-relaxed text-zinc-200 whitespace-pre-line">
                      {recentAiFeedback}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-zinc-500 text-[13px]">
                    Hali yangi tahlil olinmadi. "Kunlik Check" bo'limidan hisobot yuboring yoki savol bering.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
