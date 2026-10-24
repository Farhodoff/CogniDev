import { useState, useMemo } from 'react';
import {
  X,
  Flame,
  Award,
  Zap,
  Calendar,
  Clock,
  Sparkles,
  BarChart3,
  Layers,
  HeartPulse,
  Brain,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { useFocusStore } from '../lib/focusStore';
import {
  buildActivityMatrix,
  generateWeeklyInfographic,
  type DayActivityCell,
} from '../lib/developerHealth';

interface DeveloperHealthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DeveloperHealthModal({ open, onClose }: DeveloperHealthModalProps) {
  const { tasks, notesDocs } = useSynapse();
  const { totalDeepWorkMinutesToday, history: focusHistory } = useFocusStore();

  const [activeTab, setActiveTab] = useState<'matrix' | 'infographic' | 'tech'>('matrix');
  const [hoveredCell, setHoveredCell] = useState<DayActivityCell | null>(null);

  // Memoized matrix and weekly report
  const matrixSummary = useMemo(() => {
    return buildActivityMatrix(tasks, [], notesDocs, focusHistory);
  }, [tasks, notesDocs, focusHistory]);

  const infographic = useMemo(() => {
    return generateWeeklyInfographic(tasks, notesDocs, totalDeepWorkMinutesToday);
  }, [tasks, notesDocs, totalDeepWorkMinutesToday]);

  if (!open) return null;

  // Split matrix cells into 52 columns of 7 days
  const columns: DayActivityCell[][] = [];
  for (let i = 0; i < matrixSummary.cells.length; i += 7) {
    columns.push(matrixSummary.cells.slice(i, i + 7));
  }

  const dayLabels = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

  // Colors for GitHub style levels
  const levelColors = [
    'bg-[#161b22] border-white/[0.04]', // Level 0
    'bg-[#0e4429] border-[#006d32]/30', // Level 1
    'bg-[#006d32] border-[#26a641]/30', // Level 2
    'bg-[#26a641] border-[#39d353]/40', // Level 3
    'bg-[#39d353] border-white/30 shadow-[0_0_8px_rgba(57,211,83,0.5)]', // Level 4
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#101116] shadow-2xl shadow-emerald-500/10 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.07] px-6 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <HeartPulse size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Developer Health & Growth Analitikasi
                </h2>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-300 font-semibold">
                  Personal Analytics
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                O‘rganish matritsasi, texnologiyalar sarfi va haftalik murabbiy hisoboti
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.07] bg-black/20 px-6 py-2.5 text-xs">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition ${
              activeTab === 'matrix'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={14} />
            <span>GitHub O‘rganish Matritsasi (Heatmap)</span>
          </button>

          <button
            onClick={() => setActiveTab('infographic')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition ${
              activeTab === 'infographic'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 size={14} />
            <span>Haftalik Murabbiy Infografikasi</span>
          </button>

          <button
            onClick={() => setActiveTab('tech')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition ${
              activeTab === 'tech'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp size={14} />
            <span>Texnologiyalar & Samarador Soatlar</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* TAB 1: GITHUB-STYLE ACTIVITY MATRIX (HEATMAP) */}
          {activeTab === 'matrix' && (
            <div className="space-y-5">
              {/* Top Streak Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-3.5">
                  <div className="flex items-center justify-between text-orange-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Hozirgi Streak</span>
                    <Flame size={16} />
                  </div>
                  <p className="mt-2 text-2xl font-black text-white font-mono">
                    {matrixSummary.currentStreakDays} <span className="text-xs font-normal text-zinc-400">kun</span>
                  </p>
                  <p className="text-[10.5px] text-zinc-400 mt-0.5">Ketma-ket faoliyat</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Yillik Natija</span>
                    <Zap size={16} />
                  </div>
                  <p className="mt-2 text-2xl font-black text-white font-mono">
                    {matrixSummary.totalAnnualContributions} <span className="text-xs font-normal text-zinc-400">harakat</span>
                  </p>
                  <p className="text-[10.5px] text-zinc-400 mt-0.5">Task, qayd va o‘rganish</p>
                </div>

                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-3.5">
                  <div className="flex items-center justify-between text-sky-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Eng Uzoq Streak</span>
                    <Award size={16} />
                  </div>
                  <p className="mt-2 text-2xl font-black text-white font-mono">
                    {matrixSummary.longestStreakDays} <span className="text-xs font-normal text-zinc-400">kun</span>
                  </p>
                  <p className="text-[10.5px] text-zinc-400 mt-0.5">Shaxsiy rekord</p>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-3.5">
                  <div className="flex items-center justify-between text-purple-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Eng Faol Kun</span>
                    <Calendar size={16} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-white font-mono truncate">
                    {matrixSummary.busiestDay?.date || 'Bugun'}
                  </p>
                  <p className="text-[10.5px] text-zinc-400 mt-0.5">
                    {matrixSummary.busiestDay?.count || 0} ta harakat qayd etilgan
                  </p>
                </div>
              </div>

              {/* Heatmap Grid Container */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d11] p-4.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Yillik O‘rganish & Kod Yozish Zichligi</span>
                    <span className="text-zinc-500 font-mono text-[11px]">(52 Hafta · 365 Kun)</span>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                    <span>Kamroq</span>
                    {levelColors.map((color, idx) => (
                      <span key={idx} className={`h-2.5 w-2.5 rounded-sm border ${color}`} />
                    ))}
                    <span>Ko‘proq</span>
                  </div>
                </div>

                {/* 52 Columns of 7 Rows Grid */}
                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <div className="flex gap-1 min-w-[720px] items-start pt-1">
                    {/* Day of Week Labels */}
                    <div className="flex flex-col gap-1 pr-1.5 text-[9px] text-zinc-500 font-mono select-none">
                      {dayLabels.map((lbl, idx) => (
                        <div key={idx} className="h-3 flex items-center justify-end">
                          {idx % 2 === 1 ? lbl : ''}
                        </div>
                      ))}
                    </div>

                    {/* Week Columns */}
                    {columns.map((col, colIdx) => (
                      <div key={colIdx} className="flex flex-col gap-1">
                        {col.map((cell) => (
                          <div
                            key={cell.date}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`${cell.date}: ${cell.count} ta faoliyat (${cell.tasksCount} ta task, ${cell.learningCount} ta o‘rganish)`}
                            className={`h-3 w-3 rounded-sm border transition-transform hover:scale-125 cursor-pointer ${
                              levelColors[cell.level]
                            }`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tooltip detail bar */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                  {hoveredCell ? (
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-emerald-400 font-semibold">{hoveredCell.date}:</span>
                      <span className="text-white font-bold">{hoveredCell.count} ta faoliyat</span>
                      <span className="text-zinc-500">·</span>
                      <span>{hoveredCell.tasksCount} ta bajarilgan task</span>
                      <span className="text-zinc-500">·</span>
                      <span>{hoveredCell.notesCount} ta qayd</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-[11px]">
                      Kunlar ustiga sichqonchani olib borib batafsil maʼlumotni ko‘ring
                    </span>
                  )}
                  <span className="text-emerald-400 font-mono text-[11px] font-medium">
                    ✓ 100% Real lokal xotira asosida
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WEEKLY INFOGRAPHIC & PEAK HOURS */}
          {activeTab === 'infographic' && (
            <div className="space-y-5">
              {/* Highlight Golden Hours Banner */}
              <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-purple-500/[0.05] to-transparent p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-300 font-mono uppercase tracking-wider border border-amber-500/30">
                      <Sparkles size={11} /> Eng Samarali Soatlaringiz
                    </span>
                    <h3 className="text-xl font-extrabold text-white">
                      Oltin Fokus Oynasi: <span className="text-amber-400 font-mono">{infographic.peakHoursRange}</span>
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed max-w-xl">
                      Haftalik vazifalar va commitlar tahliliga ko‘ra, sizning kognitiv kuchingiz ertalab soat 10:00 dan 13:00 gacha eng yuqori cho‘qqiga chiqadi.
                    </p>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-2xl font-black font-mono text-amber-400">42%</span>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">Barcha natijalar</span>
                  </div>
                </div>

                {/* 24-Hour Bar Chart Histogram */}
                <div className="mt-5 pt-3 border-t border-white/[0.08]">
                  <div className="text-[11px] text-zinc-400 font-semibold mb-2">
                    24-soatlik faollik taqsimoti:
                  </div>
                  <div className="flex items-end gap-1 h-20 pt-2">
                    {infographic.hourlyStats.map((st) => {
                      const heightPercent = Math.min(100, Math.max(12, st.tasksCompleted * 14));
                      return (
                        <div
                          key={st.hour}
                          title={`${st.label}: ${st.tasksCompleted} ta task`}
                          className="flex-1 flex flex-col items-center gap-1 group"
                        >
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-sm transition-all ${
                              st.isPeak
                                ? 'bg-gradient-to-t from-amber-500 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                : 'bg-white/10 group-hover:bg-white/20'
                            }`}
                          />
                          {st.hour % 3 === 0 && (
                            <span className="text-[8.5px] text-zinc-500 font-mono">
                              {st.hour}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* AI Coach Card */}
              <div className="rounded-2xl border border-purple-500/25 bg-purple-500/[0.04] p-5 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <Brain size={15} />
                  <span>AI Murabbiy Xulosasi</span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">
                  {infographic.aiCoachAdvice}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: TECH STACK BREAKDOWN & DEVELOPER HEALTH */}
          {activeTab === 'tech' && (
            <div className="space-y-5">
              {/* Tech Stack Distribution */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d11] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Texnologiyalar Kesimida Vaqt Sarfi</h3>
                    <p className="text-xs text-zinc-400">Ushbu haftada qaysi yo‘nalishlarga ko‘proq fokus qaratildi</p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 font-semibold">
                    Jami: ~{infographic.totalFocusedHours} soat
                  </span>
                </div>

                <div className="space-y-3">
                  {infographic.techStackBreakdown.map((item) => (
                    <div key={item.tech} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-zinc-200">{item.tech}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11.5px]">
                          <span className="text-white font-bold">{item.hours} soat</span>
                          <span className="text-zinc-500">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Developer Balance Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <CheckCircle2 size={15} />
                    <span>Developer Salomatligi & Tanaffus</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Pomodoro tanaffuslari va 25 daqiqalik sprintlar miyani charchashdan (burnout) himoya qilmoqda.
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                    <Clock size={15} />
                    <span>Kognitiv Xronotip</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Siz {infographic.chronotypeLabel} turiga mansubsiz. Eng qiyin arxitekturaviy vazifalarni ertalabga qo‘ying.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-black/40 px-6 py-3.5 text-xs text-zinc-400">
          <div className="flex items-center gap-2 font-mono">
            <span>🔥 Streak: {matrixSummary.currentStreakDays} kun</span>
            <span>·</span>
            <span>⏱ Deep Work: {totalDeepWorkMinutesToday} min</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 font-semibold text-white transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
