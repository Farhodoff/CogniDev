import { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Coffee,
  X,
  Volume2,
  VolumeX,
  Headphones,
  Target,
  Flame,
  CloudRain,
  Radio,
} from 'lucide-react';
import { useFocusStore, type AmbientType } from '../lib/focusStore';
import { useSynapse } from '../lib/store';

export default function FocusModal() {
  const {
    showModal,
    setShowModal,
    mode,
    status,
    timeRemaining,
    totalDuration,
    startFocus,
    startBreak,
    pauseTimer,
    resumeTimer,
    resetTimer,
    skipStep,
    ambientSound,
    setAmbientSound,
    soundEnabled,
    toggleSound,
    linkedTaskId,
    linkedTaskTitle,
    linkTask,
    completedPomodorosToday,
    totalDeepWorkMinutesToday,
    history,
  } = useFocusStore();

  const { tasks } = useSynapse();
  const [selectedTaskDropdown, setSelectedTaskDropdown] = useState(linkedTaskId || '');

  if (!showModal) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const progressPercent = Math.max(0, Math.min(100, ((totalDuration - timeRemaining) / totalDuration) * 100));

  const isRunning = status === 'running';
  const isBreak = mode === 'short_break' || mode === 'long_break';

  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskDropdown(taskId);
    const found = tasks.find((t) => t.id === taskId);
    linkTask(taskId, found ? found.title : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setShowModal(false)}
    >
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121317] shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${isBreak ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' : 'border-rose-500/30 bg-rose-500/15 text-rose-400'}`}>
              {isBreak ? <Coffee size={16} /> : <Flame size={16} />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isBreak ? 'Dam Olish & Tanaffus' : 'Deep Work & Fokus Taymeri'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {isBreak ? 'Miyangizni dam oldiring va suv iching' : 'Chalg‘ituvchi omillarni yoping va dasturlashga sho‘ng‘ing'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Tovushlarni o'chirish" : "Tovushlarni yoqish"}
              className={`rounded-xl p-2 transition border ${soundEnabled ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-center gap-1.5 border-b border-white/[0.06] bg-black/20 p-2">
          <button
            onClick={() => startFocus(25)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'focus' && totalDuration === 25 * 60 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
          >
            25m Fokus
          </button>
          <button
            onClick={() => startFocus(50)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'focus' && totalDuration === 50 * 60 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
          >
            50m Chuqur Sprint
          </button>
          <button
            onClick={() => startBreak(false)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'short_break' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
          >
            5m Tanaffus
          </button>
          <button
            onClick={() => startBreak(true)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'long_break' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
          >
            15m Katta Dam
          </button>
        </div>

        {/* Main Countdown Display */}
        <div className="flex flex-col items-center justify-center py-8 px-6 bg-gradient-to-b from-transparent to-black/30">
          {/* Linked Task Indicator */}
          <div className="mb-4 flex items-center gap-2 max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-xs text-zinc-300">
            <Target size={13} className="text-sky-400 shrink-0" />
            <span className="truncate">
              {linkedTaskTitle ? linkedTaskTitle : "Fokus maqsadini tanlang"}
            </span>
          </div>

          {/* Huge Digits with Subtle Glow */}
          <div className="relative flex flex-col items-center">
            <div
              className={`font-mono text-7xl font-extrabold tracking-tighter ${isBreak ? 'text-emerald-300' : 'text-white'}`}
              style={{
                textShadow: isRunning
                  ? isBreak
                    ? '0 0 35px rgba(16, 185, 129, 0.3)'
                    : '0 0 35px rgba(244, 63, 94, 0.35)'
                  : 'none',
              }}
            >
              {timeFormatted}
            </div>

            <p className="mt-2 text-xs font-medium text-zinc-400 uppercase tracking-widest">
              {status === 'running' ? '⚡️ Fokus Jarayoni' : status === 'paused' ? '⏸ Pauza qilingan' : 'Kutish holatida'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 w-72 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all duration-1000 ${isBreak ? 'bg-emerald-400' : 'bg-gradient-to-r from-rose-500 to-orange-400'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Primary Action Controls */}
          <div className="mt-7 flex items-center gap-3">
            <button
              onClick={resetTimer}
              title="Qayta boshlash"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition active:scale-95"
            >
              <RotateCcw size={16} />
            </button>

            {isRunning ? (
              <button
                onClick={pauseTimer}
                className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 active:scale-95 transition"
              >
                <Pause size={17} />
                <span>Pauza</span>
              </button>
            ) : (
              <button
                onClick={() => (status === 'paused' ? resumeTimer() : startFocus(Math.round(totalDuration / 60)))}
                className={`flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-bold text-white shadow-xl active:scale-95 transition ${isBreak ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'}`}
              >
                <Play size={17} className="ml-0.5" />
                <span>{status === 'paused' ? 'Davom ettirish' : 'Boshlash'}</span>
              </button>
            )}

            <button
              onClick={skipStep}
              title="Keyingisiga o‘tish"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition active:scale-95"
            >
              <SkipForward size={16} />
            </button>
          </div>
        </div>

        {/* Ambient Noise & Task Selector Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] border-t border-white/[0.07] bg-black/30 p-4 text-xs">
          {/* Ambient Flow Noise */}
          <div className="space-y-2 pr-0 sm:pr-3 pb-3 sm:pb-0">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
              <Headphones size={13} className="text-purple-400" />
              <span>Offline Ambient Ovoz (Diqqat)</span>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'none', label: 'O‘chiq', icon: Radio },
                  { id: 'brown', label: 'Brown Noise', icon: Headphones },
                  { id: 'rain', label: 'Yomg‘ir', icon: CloudRain },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAmbientSound(opt.id as AmbientType)}
                  className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition ${ambientSound === opt.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                >
                  <opt.icon size={11} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Task Linker */}
          <div className="space-y-1.5 pl-0 sm:pl-3 pt-3 sm:pt-0">
            <div className="flex items-center justify-between font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Target size={13} className="text-sky-400" />
                <span>Faol Vazifa Bog‘lash:</span>
              </span>
            </div>
            <select
              value={selectedTaskDropdown}
              onChange={(e) => handleSelectTask(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-[11.5px] text-zinc-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="">(Vazifasiz umumiy fokus)</option>
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.title.slice(0, 42)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer: Today's Stats & Summary */}
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-black/40 px-6 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300 border border-rose-500/20">
              🍅 {completedPomodorosToday} Pomodoro
            </span>
            <span className="text-zinc-500 font-mono">·</span>
            <span className="font-mono text-zinc-300">
              {totalDeepWorkMinutesToday} minut Deep Work
            </span>
          </div>

          {history.length > 0 && (
            <span className="text-[11px] text-zinc-500">
              Oxirgi: {history[0].completedAt} ({history[0].durationMinutes}m)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
