import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  CheckCircle2,
  Sparkles,
  Trash2,
  Trophy,
  Activity,
  Code,
  BookOpen,
  CheckSquare,
  Languages,
  Coffee,
  X,
  Check,
  TrendingUp,
  Brain,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { callAi } from '../lib/ai';

const HABIT_ICONS: Record<string, any> = {
  Code,
  BookOpen,
  Activity,
  CheckSquare,
  Languages,
  Coffee,
  Brain,
  TrendingUp,
  Flame,
};

const CATEGORIES = [
  { id: 'all', label: 'Barchasi' },
  { id: 'code', label: 'Muhandislik', icon: Code },
  { id: 'study', label: 'O‘rganish', icon: BookOpen },
  { id: 'health', label: 'Salomatlik', icon: Activity },
  { id: 'productivity', label: 'Unumdorlik', icon: CheckSquare },
];

export default function HabitTrackerWorkspace() {
  const { habits, toggleHabitDay, addHabit, deleteHabit, setHud } = useSynapse();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiCoachLoading, setAiCoachLoading] = useState(false);
  const [aiCoachMessage, setAiCoachMessage] = useState<string | null>(null);

  // New habit form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'code' | 'study' | 'health' | 'productivity' | 'life'>('code');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newIcon, setNewIcon] = useState('Code');
  const [newTargetDays, setNewTargetDays] = useState(6);

  // Generate the last 7 days (ending today)
  const days = useMemo(() => {
    const list: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('uz-UZ', { weekday: 'short' });
      const label = d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
      list.push({
        dateStr,
        label,
        dayName,
        isToday: i === 0,
      });
    }
    return list;
  }, []);

  const todayStr = days[days.length - 1].dateStr;

  // Filtered habits
  const filteredHabits = useMemo(() => {
    if (activeCategory === 'all') return habits;
    return habits.filter((h) => h.category === activeCategory);
  }, [habits, activeCategory]);

  // Statistics
  const todayCompletedCount = habits.filter((h) => h.history[todayStr]).length;
  const todayTotalCount = habits.length;
  const todayProgressPercent = todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0;
  const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
  const bestAllTimeStreak = habits.reduce((max, h) => Math.max(max, h.best_streak || 0), 0);

  // Handle Add Habit
  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addHabit({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      category: newCategory,
      color: newColor,
      icon: newIcon,
      target_days_per_week: newTargetDays,
    });

    setHud(`"${newTitle.trim()}" odati muvaffaqiyatli qo‘shildi ✓`);
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  // AI Habit Coach advice
  const handleRequestAiAdvice = async () => {
    setAiCoachLoading(true);
    setAiCoachMessage(null);
    try {
      const context = `
Hozirgi odatlar holati:
- Jami odatlar: ${habits.length} ta
- Bugungi bajarilish: ${todayCompletedCount}/${todayTotalCount} (${todayProgressPercent}%)
- Eng yuqori joriy streak: ${maxStreak} kun
- Barcha odatlar ro'yxati:
${habits.map((h) => `• ${h.title} (Kategoriya: ${h.category}, Streak: ${h.streak} kun, Maqsad: haftasiga ${h.target_days_per_week} kun)`).join('\n')}
      `.trim();

      const prompt = `Siz muhandislar va dasturchilar uchun unumdorlik va odatlar bo'yicha shaxsiy psixolog/kouchniz.
Quyidagi ma'lumotlar asosida menga 2-3 jumlada juda amaliy, professional va ruhlantiruvchi o'zbekcha tavsiya bering: qaysi odatga ko'proq e'tibor qaratish kerak va intizomni yo'qotmaslik uchun nima qilish lozim?`;

      const res = await callAi(context + '\n\n' + prompt, "Siz shaxsiy muhandislik intizomi murabbiyisiz.");
      setAiCoachMessage(res.text.trim());
    } catch {
      setAiCoachMessage("Odatlarni shakllantirishda davomiylik eng muhimi. Kichik qadamlar bilan boshlang va har kuni 20 daqiqa bo'lsa ham diqqatni jamlang!");
    } finally {
      setAiCoachLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-6 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/30 border border-orange-500/30 text-amber-400 shadow-lg shadow-orange-500/10">
              <Flame size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">Habit Tracker & Consistency Cockpit</h1>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  Intizom & Streak
                </span>
              </div>
              <p className="text-[12.5px] text-zinc-400 mt-0.5">
                Doimiy odatlar, chuqur diqqat (Deep Work) va kunlik mahsuldorlik ko‘rsatkichlari
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestAiAdvice}
              disabled={aiCoachLoading}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 px-3.5 py-2 text-[12px] font-semibold text-purple-300 transition shadow-sm disabled:opacity-50"
            >
              <Sparkles size={14} className={aiCoachLoading ? 'animate-spin' : ''} />
              <span>{aiCoachLoading ? 'Tahlil qilinmoqda...' : 'AI Odat Maslahatchisi'}</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow-md shadow-blue-600/20 transition"
            >
              <Plus size={15} />
              <span>Yangi Odat</span>
            </button>
          </div>
        </div>

        {/* AI Habit Coach Advice Box (If active) */}
        {aiCoachMessage && (
          <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-2 relative animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-300 font-semibold text-[13px]">
                <Sparkles size={16} />
                <span>AI Intizom Murabbiyi Xulosasi</span>
              </div>
              <button
                onClick={() => setAiCoachMessage(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[12.5px] text-purple-200/90 leading-relaxed font-sans pl-6">
              {aiCoachMessage}
            </p>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-[11.5px] font-medium">
              <span>Bugungi Natija</span>
              <CheckCircle2 size={15} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{todayCompletedCount} / {todayTotalCount}</span>
              <span className="text-[11px] font-semibold text-emerald-400 font-mono">({todayProgressPercent}%)</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${todayProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-[11.5px] font-medium">
              <span>Eng Yuqori Faol Streak</span>
              <Flame size={15} className="text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400 font-mono">{maxStreak}</span>
              <span className="text-[11px] text-zinc-400">kun ketma-ket</span>
            </div>
            <p className="text-[10.5px] text-zinc-500">Doimiylik eng asosiy quroldir</p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-[11.5px] font-medium">
              <span>Rekord (All-Time)</span>
              <Trophy size={15} className="text-yellow-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-yellow-400 font-mono">{bestAllTimeStreak}</span>
              <span className="text-[11px] text-zinc-400">kun rekord</span>
            </div>
            <p className="text-[10.5px] text-zinc-500">Har bir muvaffaqiyat saqlanadi</p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-[11.5px] font-medium">
              <span>Faol Odatlar</span>
              <Activity size={15} className="text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{habits.length}</span>
              <span className="text-[11px] text-zinc-400">ta tizimda</span>
            </div>
            <p className="text-[10.5px] text-zinc-500">Kategoriya bo‘yicha taqsimlangan</p>
          </div>
        </div>

        {/* 100% Completion Celebration Banner */}
        {todayTotalCount > 0 && todayCompletedCount === todayTotalCount && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center justify-between gap-3 text-emerald-300">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                <Trophy size={18} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Tabriklaymiz! Bugungi barcha odatlar 100% bajarildi! 🎉</p>
                <p className="text-[11.5px] text-emerald-200/80">Intizom va davomiylik har kuni yangi natijalarga olib keladi.</p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400">100% DONE</span>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition ${
                activeCategory === cat.id
                  ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              {cat.icon && <cat.icon size={13} />}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Habits Consistency Table / Grid */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 overflow-hidden shadow-xl">
          {/* Header Row */}
          <div className="grid grid-cols-12 items-center border-b border-white/[0.08] bg-black/30 px-5 py-3.5 text-[11.5px] font-semibold text-zinc-400 uppercase tracking-wider">
            <div className="col-span-5 md:col-span-5">Odat & Yo‘nalish</div>
            <div className="col-span-2 md:col-span-2 text-center">Streak & Maqsad</div>
            <div className="col-span-5 md:col-span-5 grid grid-cols-7 gap-1 text-center">
              {days.map((d) => (
                <div key={d.dateStr} className={`flex flex-col items-center ${d.isToday ? 'text-blue-400 font-bold' : ''}`}>
                  <span className="text-[10px] uppercase font-mono">{d.dayName}</span>
                  <span className="text-[11px] font-mono">{d.dateStr.split('-')[2]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Habit Rows */}
          {filteredHabits.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-zinc-400 text-sm">Ushbu toifada odatlar topilmadi.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Plus size={13} />
                <span>Yangi Odat Qo‘shish</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {filteredHabits.map((h) => {
                const IconComponent = HABIT_ICONS[h.icon] || Flame;

                return (
                  <div
                    key={h.id}
                    className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-white/[0.02] transition group"
                  >
                    {/* Habit Info */}
                    <div className="col-span-5 md:col-span-5 flex items-center gap-3 min-w-0 pr-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-white/10"
                        style={{ backgroundColor: `${h.color}25`, color: h.color }}
                      >
                        <IconComponent size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-zinc-100 truncate">
                            {h.title}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteHabit(h.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 rounded transition"
                            title="Odatni o'chirish"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {h.description && (
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {h.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Streak Info */}
                    <div className="col-span-2 md:col-span-2 text-center space-y-0.5">
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-400 font-mono">
                        <Flame size={12} />
                        <span>{h.streak || 0} kun</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {h.target_days_per_week || 7} kun / hafta
                      </p>
                    </div>

                    {/* 7-Day Matrix */}
                    <div className="col-span-5 md:col-span-5 grid grid-cols-7 gap-1 items-center justify-items-center">
                      {days.map((d) => {
                        const isDone = !!h.history[d.dateStr];
                        return (
                          <button
                            key={d.dateStr}
                            type="button"
                            onClick={() => toggleHabitDay(h.id, d.dateStr)}
                            className={`flex h-8 w-8 items-center justify-center rounded-xl transition duration-150 ${
                              isDone
                                ? 'shadow-md scale-105'
                                : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-transparent hover:text-zinc-500'
                            }`}
                            style={
                              isDone
                                ? { backgroundColor: h.color, color: '#ffffff' }
                                : undefined
                            }
                            title={`${h.title} - ${d.label} (${isDone ? 'Bajarilgan' : 'Bajarilmagan'})`}
                          >
                            <Check size={14} className={isDone ? 'stroke-[3]' : 'opacity-40'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Add New Habit */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171d] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame size={18} className="text-amber-400" />
                  <span>Yangi Odat Qo‘shish</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateHabit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Odat Nomi *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="masalan: Algoritmlar (LeetCode 1 ta masala)"
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Qisqa Tavsif / Maqsad
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="masalan: Graf nazariyasi va massivlar"
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                      Kategoriya
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="code">Muhandislik</option>
                      <option value="study">O‘rganish</option>
                      <option value="health">Salomatlik</option>
                      <option value="productivity">Unumdorlik</option>
                      <option value="life">Hayot</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                      Haftalik Maqsad
                    </label>
                    <select
                      value={newTargetDays}
                      onChange={(e) => setNewTargetDays(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      {[7, 6, 5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{n} kun / hafta</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Rang Tanlash
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className={`h-5 w-5 rounded-full transition ${newColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-60'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Belgi (Icon)
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.keys(HABIT_ICONS).map((iconKey) => {
                      const IconComp = HABIT_ICONS[iconKey];
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setNewIcon(iconKey)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                            newIcon === iconKey
                              ? 'bg-blue-600/40 border border-blue-400 text-blue-300'
                              : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <IconComp size={14} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-xl px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/30"
                  >
                    Odatni Saqlash
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
