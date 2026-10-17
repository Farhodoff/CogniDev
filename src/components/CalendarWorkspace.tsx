import { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  AlertCircle,
  ArrowRight,
  BarChart2,
  Sparkles,
  CalendarDays,
  X,
  Bell,
  Radio,
} from 'lucide-react';
import { useSynapse } from '../lib/store';

const DAY_NAMES_UZ = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTH_NAMES_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

export default function CalendarWorkspace() {
  const {
    scheduleBlocks,
    toggleScheduleBlockDone,
    addScheduleBlock,
    deleteScheduleBlock,
    reminders,
    addReminder,
    deleteReminder,
    tasks,
    setMainView,
    setSelectedMeetingId,
    setFilter,
    setHud,
    setTaskModal,
  } = useSynapse();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'agenda'>('day');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Block Form State
  const [newTitle, setNewTitle] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:30');
  const [newCategory, setNewCategory] = useState<'work' | 'study' | 'personal' | 'health'>('work');
  const [newTag, setNewTag] = useState('#Focus');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newReminderEnabled, setNewReminderEnabled] = useState(true);

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    if (selectedCategory === 'all') return scheduleBlocks;
    return scheduleBlocks.filter((b) => b.category === selectedCategory);
  }, [scheduleBlocks, selectedCategory]);

  // Statistics
  const totalBlocks = scheduleBlocks.length;
  const completedBlocks = scheduleBlocks.filter((b) => b.done).length;
  const progressPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  // Category counts
  const workCount = scheduleBlocks.filter((b) => b.category === 'work').length;
  const studyCount = scheduleBlocks.filter((b) => b.category === 'study').length;
  const healthCount = scheduleBlocks.filter((b) => b.category === 'health').length;
  const personalCount = scheduleBlocks.filter((b) => b.category === 'personal').length;

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Add Block Handler
  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addScheduleBlock({
      title: newTitle.trim(),
      time_range: `${newStartTime} - ${newEndTime}`,
      category: newCategory,
      tag: newTag.startsWith('#') ? newTag : `#${newTag}`,
      color: newColor,
      done: false,
    });

    if (newReminderEnabled) {
      const [h, m] = newStartTime.split(':').map((v) => parseInt(v, 10));
      const target = new Date();
      target.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
      if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1);
      }
      addReminder({
        title: `Vaqt bloki boshlandi: ${newTitle.trim()}`,
        description: `${newStartTime} - ${newEndTime} oralig'idagi reja`,
        time_string: newStartTime,
        target_time: target.toISOString(),
        source_type: 'calendar',
      });
    }

    setNewTitle('');
    setShowAddModal(false);
    setHud(`"${newTitle.trim()}" vaqt bloki jadvalga kiritildi ${newReminderEnabled ? 'va eslatma yoqildi 🔔' : '✓'}`);
  };

  const formattedDateTitle = useMemo(() => {
    const day = currentDate.getDate();
    const month = MONTH_NAMES_UZ[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    const dayName = DAY_NAMES_UZ[currentDate.getDay()];
    if (viewMode === 'day') return `${dayName}, ${day}-${month} ${year}`;
    if (viewMode === 'month') return `${month} ${year}`;
    if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      const dayDiff = (currentDate.getDay() + 6) % 7; // monday as start
      startOfWeek.setDate(currentDate.getDate() - dayDiff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.getDate()}-${MONTH_NAMES_UZ[startOfWeek.getMonth()]} — ${endOfWeek.getDate()}-${MONTH_NAMES_UZ[endOfWeek.getMonth()]} ${year}`;
    }
    return `${month} ${year}`;
  }, [currentDate, viewMode]);

  // Stable today reference
  const [today] = useState(() => new Date());
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  // Week days generator
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    const dayDiff = (currentDate.getDay() + 6) % 7; // Monday = 0
    startOfWeek.setDate(currentDate.getDate() - dayDiff);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const isToday =
        d.getDate() === todayDate &&
        d.getMonth() === todayMonth &&
        d.getFullYear() === todayYear;
      days.push({
        date: d,
        dayNum: d.getDate(),
        dayName: ['Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'][i],
        isToday,
      });
    }
    return days;
  }, [currentDate, todayDate, todayMonth, todayYear]);

  // Month grid generator
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = (firstDay.getDay() + 6) % 7; // Monday as 0
    const totalDays = lastDay.getDate();

    const cells = [];
    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayIndex - 1; i >= 0; i--) {
      cells.push({
        dayNum: prevMonthLastDay - i,
        currentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const isToday =
        i === todayDate &&
        month === todayMonth &&
        year === todayYear;
      cells.push({
        dayNum: i,
        currentMonth: true,
        isToday,
      });
    }

    // Next month filler days to complete grid (42 cells = 6 weeks)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        dayNum: i,
        currentMonth: false,
        isToday: false,
      });
    }

    return cells;
  }, [currentDate, todayDate, todayMonth, todayYear]);

  // Non-completed tasks as upcoming milestones
  const upcomingDeadlines = tasks.filter((t) => t.status !== 'completed').slice(0, 5);

  // Time Slots 08:00 - 22:00 for Day View
  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 to 22

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#0a0b0f] text-zinc-100 select-none">
      {/* 1. Header Toolbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0d0e14]/90 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CalendarIcon size={18} />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-white tracking-wide flex items-center gap-2">
              Kalendar & Vaqt Rejasi
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                {totalBlocks} ta reja
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 font-medium">
              {formattedDateTitle}
            </p>
          </div>
        </div>

        {/* View Mode & Date Controls */}
        <div className="flex items-center gap-3">
          {/* Prev, Today, Next */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 shadow-inner">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
              title="Oldingi"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-lg transition"
            >
              Bugun
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
              title="Keyingi"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5">
            <button
              onClick={() => setViewMode('day')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === 'day'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Kunlik
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Haftalik
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Oylik
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === 'agenda'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Jadval
            </button>
          </div>

          {/* Add Block Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm hover:bg-blue-500 transition active:scale-95"
          >
            <Plus size={14} />
            <span>Yangi Blok</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left/Center: Timeline & Grid */}
        <div className="flex-1 flex flex-col overflow-y-auto p-5 scrollbar-thin">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <span className="text-[11px] text-zinc-500 font-medium">Toifa:</span>
            {[
              { id: 'all', label: 'Barchasi', count: totalBlocks },
              { id: 'work', label: 'Ish / Backend', count: workCount },
              { id: 'study', label: 'O‘qish / Til', count: studyCount },
              { id: 'health', label: 'Sport & Sog‘lik', count: healthCount },
              { id: 'personal', label: 'Shaxsiy', count: personalCount },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-medium transition border ${
                  selectedCategory === cat.id
                    ? 'border-blue-500/40 bg-blue-500/10 text-white'
                    : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                }`}
              >
                <span>{cat.label}</span>
                <span className="ml-1.5 text-[10px] text-zinc-500 font-mono">({cat.count})</span>
              </button>
            ))}
          </div>

          {/* VIEW: DAY VIEW */}
          {viewMode === 'day' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111218]/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-400" />
                  <span className="text-[13px] font-semibold text-white">Kunlik Soatbay Reja (08:00 — 22:00)</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {completedBlocks}/{totalBlocks} bajarildi ({progressPercent}%)
                </span>
              </div>

              {filteredBlocks.length === 0 ? (
                <div className="py-12 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                  <CalendarDays size={32} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-[13px] font-medium text-zinc-300">Ushbu toifada vaqt bloklari yo‘q</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Bugungi kun tartibini tuzish uchun blok qo‘shing.</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-500 transition"
                  >
                    <Plus size={13} />
                    <span>Reja qo‘shish</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBlocks.map((block) => (
                    <div
                      key={block.id}
                      onClick={() => toggleScheduleBlockDone(block.id)}
                      className={`group relative flex items-center justify-between rounded-xl border p-3.5 transition cursor-pointer ${
                        block.done
                          ? 'border-white/[0.04] bg-white/[0.02] opacity-60'
                          : 'border-white/[0.08] bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                      }`}
                      style={{ borderLeftWidth: 4, borderLeftColor: block.color || '#3b82f6' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScheduleBlockDone(block.id);
                          }}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                            block.done
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                              : 'border-white/20 hover:border-blue-400'
                          }`}
                        >
                          {block.done && <CheckCircle2 size={13} />}
                        </button>

                        <div className="min-w-0">
                          <p
                            className={`text-[13px] font-medium truncate ${
                              block.done ? 'line-through text-zinc-500' : 'text-zinc-200'
                            }`}
                          >
                            {block.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1">
                              <Clock size={11} className="text-zinc-500" />
                              {block.time_range}
                            </span>
                            <span
                              className="rounded-md px-1.5 py-0.2 text-[9.5px] font-semibold capitalize"
                              style={{
                                backgroundColor: `${block.color}15`,
                                color: block.color,
                                border: `1px solid ${block.color}30`,
                              }}
                            >
                              {block.category}
                            </span>
                            {block.tag && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {block.tag}
                              </span>
                            )}
                            {block.meeting_id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMeetingId(block.meeting_id!);
                                  setMainView('meetings');
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 text-[9.5px] font-semibold text-purple-300 hover:bg-purple-500/25 transition"
                                title="Biriktirilgan uchrashuv yozuvi va AI konspektini ochish"
                              >
                                <Radio size={10} className="text-purple-400" />
                                <span>Uchrashuv ↗</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {(() => {
                          const isReminderActive = reminders.some(
                            (r) => r.source_type === 'calendar' && r.title.includes(block.title) && r.status === 'pending'
                          );
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isReminderActive) {
                                  const existing = reminders.find(
                                    (r) => r.source_type === 'calendar' && r.title.includes(block.title) && r.status === 'pending'
                                  );
                                  if (existing) deleteReminder(existing.id);
                                  setHud(`"${block.title}" uchun bildirishnoma bekor qilindi`);
                                } else {
                                  const startTime = block.time_range.split('-')[0]?.trim() || '09:00';
                                  const [h, m] = startTime.split(':').map((v) => parseInt(v, 10));
                                  const target = new Date();
                                  target.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
                                  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
                                  addReminder({
                                    title: `Vaqt bloki boshlandi: ${block.title}`,
                                    description: `${block.time_range} vaqt oralig'i`,
                                    time_string: startTime,
                                    target_time: target.toISOString(),
                                    source_type: 'calendar',
                                  });
                                  setHud(`"${block.title}" uchun ${startTime} ga bildirishnoma yoqildi 🔔`);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                isReminderActive
                                  ? 'text-amber-400 bg-amber-500/10 opacity-100 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                  : 'opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-amber-300 hover:bg-white/5'
                              }`}
                              title={isReminderActive ? "Bildirishnoma yoqilgan (o'chirish)" : "Bildirishnoma yoqish"}
                            >
                              <Bell size={13} />
                            </button>
                          );
                        })()}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteScheduleBlock(block.id);
                            setHud(`Vaqt bloki o‘chirildi`);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="O‘chirish"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hourly Grid Guide */}
              <div className="mt-8 border-t border-white/[0.06] pt-5">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Kunlik Timeline Shabloni
                </h3>
                <div className="space-y-2">
                  {hours.map((h) => {
                    const timeStr = `${h.toString().padStart(2, '0')}:00`;
                    const match = filteredBlocks.find((b) => b.time_range.startsWith(timeStr.slice(0, 2)));
                    return (
                      <div
                        key={h}
                        className="flex items-center gap-3 text-[11px] font-mono py-1 border-b border-white/[0.03] group hover:bg-white/[0.02] px-2 rounded-lg"
                      >
                        <span className="w-12 text-zinc-500 shrink-0">{timeStr}</span>
                        {match ? (
                          <div
                            className="flex-1 rounded-lg px-2.5 py-1 text-xs font-sans font-medium flex items-center justify-between"
                            style={{
                              backgroundColor: `${match.color}15`,
                              borderLeft: `3px solid ${match.color}`,
                              color: '#fff',
                            }}
                          >
                            <span>{match.title}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{match.time_range}</span>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-between text-zinc-600 text-[10px]">
                            <span>— Bo‘sh oraliq —</span>
                            <button
                              onClick={() => {
                                setNewStartTime(timeStr);
                                setNewEndTime(`${(h + 1).toString().padStart(2, '0')}:00`);
                                setShowAddModal(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <Plus size={10} /> Reja qo‘yish
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111218]/80 p-5 shadow-sm">
              <div className="grid grid-cols-7 gap-3">
                {weekDays.map((w, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col rounded-xl border p-3 min-h-[340px] ${
                      w.isToday
                        ? 'border-blue-500/40 bg-blue-500/[0.03]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2">
                      <span className="text-[11px] font-medium text-zinc-400">{w.dayName}</span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
                          w.isToday
                            ? 'bg-blue-600 text-white'
                            : 'text-zinc-300'
                        }`}
                      >
                        {w.dayNum}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2">
                      {w.isToday && filteredBlocks.length > 0 ? (
                        filteredBlocks.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-lg p-2 border border-white/[0.08] text-[11px] bg-white/[0.04]"
                            style={{ borderLeft: `3px solid ${b.color || '#3b82f6'}` }}
                          >
                            <p className={`font-medium truncate ${b.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                              {b.title}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{b.time_range}</p>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-zinc-600 text-[10px] text-center">
                          {w.isToday ? 'Rejalar mavjud emas' : 'Rejalar yo‘q'}
                        </div>
                      )}
                    </div>

                    {w.isToday && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-2 w-full py-1 text-center text-[10px] text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                      >
                        + Qo‘shish
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111218]/80 p-5 shadow-sm">
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-semibold text-zinc-400">
                <span>Dush</span>
                <span>Sesh</span>
                <span>Chor</span>
                <span>Pay</span>
                <span>Juma</span>
                <span>Shan</span>
                <span>Yak</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthGrid.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (c.currentMonth) {
                        const d = new Date(currentDate);
                        d.setDate(c.dayNum);
                        setCurrentDate(d);
                        setViewMode('day');
                      }
                    }}
                    className={`h-20 rounded-xl border p-2 flex flex-col justify-between transition cursor-pointer ${
                      c.isToday
                        ? 'border-blue-500/50 bg-blue-500/10 shadow-sm'
                        : c.currentMonth
                        ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                        : 'border-transparent text-zinc-700 bg-white/[0.005]'
                    }`}
                  >
                    <span className={`text-[12px] font-bold ${c.isToday ? 'text-blue-400' : c.currentMonth ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {c.dayNum}
                    </span>

                    {c.isToday && filteredBlocks.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                        <span className="text-[9px] font-mono text-zinc-400 truncate">
                          {filteredBlocks.length} ta reja
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: AGENDA VIEW */}
          {viewMode === 'agenda' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111218]/80 p-5 shadow-sm space-y-4">
              <h3 className="text-[13px] font-semibold text-white">Xronologik Vazifalar va Rejalar Ro‘yxati</h3>
              <div className="divide-y divide-white/[0.06]">
                {filteredBlocks.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: b.color || '#3b82f6' }}
                      />
                      <div>
                        <p className={`text-[12.5px] font-medium ${b.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {b.title}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-400">{b.time_range} · {b.tag}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.meeting_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMeetingId(b.meeting_id!);
                            setMainView('meetings');
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[9.5px] font-semibold text-purple-300 hover:bg-purple-500/25 transition"
                          title="Uchrashuv konspektini ochish"
                        >
                          <Radio size={10} className="text-purple-400" />
                          <span>Uchrashuv ↗</span>
                        </button>
                      )}
                      <span className="text-[11px] text-zinc-500 uppercase font-mono">{b.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Agenda, Deadlines, Statistics */}
        <aside className="w-[300px] shrink-0 border-l border-white/[0.06] bg-[#0c0d12]/95 p-5 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
          {/* 1. Vaqt Taqsimoti (Time Stats) */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                <BarChart2 size={14} className="text-blue-400" />
                Vaqt Balansi
              </h3>
              <span className="text-[11px] font-mono text-blue-400">{progressPercent}% bajarildi</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Categories breakdown */}
            <div className="space-y-2 pt-1 text-[11px]">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Ish & Dasturlash
                </span>
                <span className="font-mono text-zinc-300">{workCount} ta</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  O‘qish & Til
                </span>
                <span className="font-mono text-zinc-300">{studyCount} ta</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Sport & Salomatlik
                </span>
                <span className="font-mono text-zinc-300">{healthCount} ta</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                  Shaxsiy
                </span>
                <span className="font-mono text-zinc-300">{personalCount} ta</span>
              </div>
            </div>
          </div>

          {/* 2. Yaqinlashayotgan Muddatlar (Real Task Deadlines) */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-400" />
                Vazifalar & Muddatlar
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">{upcomingDeadlines.length} ta faol</span>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <p className="text-[11px] text-zinc-500 py-3 text-center">Barcha vazifalar yopilgan! Yangi sprint oching.</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      setMainView('stream');
                      setFilter(null);
                    }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 hover:border-blue-500/30 hover:bg-white/[0.06] transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11.5px] font-medium text-zinc-200 truncate group-hover:text-blue-300">
                        {task.title}
                      </p>
                      <ArrowRight size={11} className="text-zinc-600 group-hover:text-blue-400 shrink-0 ml-1" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9.5px] font-mono text-zinc-400">
                        {task.priority}
                      </span>
                      {task.tags[0] && (
                        <span className="text-[9px] text-blue-400 font-mono">
                          #{task.tags[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setTaskModal(true)}
              className="w-full py-1.5 text-center text-[11px] font-medium text-blue-400 hover:bg-blue-500/10 rounded-xl border border-blue-500/20 transition"
            >
              + Yangi Vazifa Qo‘shish
            </button>
          </div>

          {/* 3. AI Kunlik Fokus */}
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4 space-y-2">
            <h4 className="text-[12px] font-semibold text-purple-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-purple-400" />
              AI Samaradorlik Maslahati
            </h4>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Kun davomida chuqur ishlash (Deep Work) bloklarini 90 daqiqalik intervallar bilan belgilang. Har bir blokdan so‘ng 10 daqiqa dam olish kognitiv yuklamani pasaytiradi.
            </p>
          </div>
        </aside>
      </div>

      {/* 3. Add Schedule Block Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12131a] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-blue-400" />
                Yangi Vaqt Bloki Qo‘shish
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Nomi / Maqsad
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Django ORM optimallashtirish"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Boshlanish vaqti
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-mono text-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Tugash vaqti
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-mono text-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Toifa
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as 'work' | 'study' | 'personal' | 'health')}
                    className="w-full rounded-xl border border-white/10 bg-[#171822] px-3 py-2 text-[12px] text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="work">Ish / Dasturlash</option>
                    <option value="study">O‘qish / Til</option>
                    <option value="health">Sport & Sog‘lik</option>
                    <option value="personal">Shaxsiy</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Teg (#hashtag)
                  </label>
                  <input
                    type="text"
                    placeholder="#Focus"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Rangni tanlang
                </label>
                <div className="flex items-center gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewColor(col)}
                      className={`h-6 w-6 rounded-full border-2 transition ${
                        newColor === col ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              {/* Notification / Reminder toggle */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                    newReminderEnabled ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-zinc-500'
                  }`}>
                    <Bell size={15} />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-white">Boshlanishida bildirishnoma yuborilsin</p>
                    <p className="text-[10.5px] text-zinc-400">Belgilangan vaqtda ekran xabarnomasi va ovozli signal chiqadi</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewReminderEnabled(!newReminderEnabled)}
                  className={`h-5 w-9 rounded-full transition-colors relative ${
                    newReminderEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      newReminderEnabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
