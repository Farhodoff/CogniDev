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
  Zap,
  Sparkles,
  Waves,
  Sliders,
  AlertTriangle,
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
    volume,
    setVolume,
    soundEnabled,
    toggleSound,
    linkedTaskId,
    linkedTaskTitle,
    linkTask,
    completedPomodorosToday,
    totalDeepWorkMinutesToday,
    history,
  } = useFocusStore();

  const { tasks, contextSwitchWarning } = useSynapse();
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

  const soundscapes: { id: AmbientType; label: string; icon: any; desc: string; badge: string }[] = [
    { id: 'none', label: 'O‘chiq', icon: Radio, desc: 'Sukunat', badge: 'Mute' },
    { id: 'rain', label: 'Yomg‘ir', icon: CloudRain, desc: 'Tabiiy yomg‘ir shivir-shiviri', badge: 'Nature' },
    { id: 'cyberpunk', label: 'Kiberpank', icon: Zap, desc: 'Lo-Fi sint drone & LFO rezonans', badge: 'Lo-Fi' },
    { id: 'binaural', label: 'Binaural', icon: Sparkles, desc: '10Hz Alpha neyro-sinhronizatsiya', badge: '10Hz' },
    { id: 'white', label: 'White Noise', icon: Waves, desc: 'Keng polosali ovoz niqobi', badge: 'Noise' },
    { id: 'brown', label: 'Brown Noise', icon: Headphones, desc: 'Chuqur sokin guldurash', badge: 'Ground' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setShowModal(false)}
    >
      <div
        className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121317] shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${isBreak ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' : 'border-rose-500/30 bg-rose-500/15 text-rose-400'}`}>
              {isBreak ? <Coffee size={16} /> : <Flame size={16} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {isBreak ? 'Dam Olish & Tanaffus' : 'Deep Work & Fokus Taymeri'}
                </h2>
                {contextSwitchWarning?.isHighThrashing && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                    <AlertTriangle size={10} /> Context-Switching Yuqori
                  </span>
                )}
              </div>
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
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Central Display: Mode Tabs, Timer & Action Controls */}
        <div className="flex flex-col items-center justify-center px-6 py-7">
          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 text-xs">
            <button
              onClick={() => startFocus(25)}
              className={`rounded-xl px-4 py-1.5 font-medium transition ${mode === 'focus' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              🍅 Fokus (25m)
            </button>
            <button
              onClick={() => startBreak(false)}
              className={`rounded-xl px-4 py-1.5 font-medium transition ${mode === 'short_break' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              ☕️ Qisqa Tanaffus (5m)
            </button>
            <button
              onClick={() => startBreak(true)}
              className={`rounded-xl px-4 py-1.5 font-medium transition ${mode === 'long_break' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              🌴 Katta Tanaffus (15m)
            </button>
          </div>

          {/* Linked Task Chip */}
          {linkedTaskTitle && (
            <div className="mt-4 flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs text-sky-300">
              <Target size={12} />
              <span className="font-medium truncate max-w-xs">{linkedTaskTitle}</span>
            </div>
          )}

          {/* Large Countdown Timer */}
          <div className="relative mt-5 text-center">
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

            <div className="mt-2 flex items-center justify-center gap-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                {status === 'running' ? '⚡️ Fokus Jarayoni' : status === 'paused' ? '⏸ Pauza qilingan' : 'Kutish holatida'}
              </p>
              {isRunning && ambientSound !== 'none' && (
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="h-2 w-0.5 bg-rose-400 animate-pulse rounded-full" />
                  <span className="h-3.5 w-0.5 bg-rose-400 animate-pulse delay-75 rounded-full" />
                  <span className="h-2 w-0.5 bg-rose-400 animate-pulse delay-150 rounded-full" />
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 w-80 h-1.5 overflow-hidden rounded-full bg-white/10">
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

        {/* Focus Soundscapes & Neuro-Audio Selector */}
        <div className="border-t border-white/[0.07] bg-black/30 p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones size={15} className="text-purple-400" />
              <span className="text-xs font-bold text-zinc-200">
                Neyro-Audio & Lo-Fi Soundscapes
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">(100% Offline Web Audio)</span>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2 text-zinc-400">
              <Sliders size={12} className="text-zinc-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
                title={`Ovoz balandligi: ${Math.round(volume * 100)}%`}
              />
              <span className="text-[10.5px] font-mono text-zinc-400 min-w-[28px]">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>

          {/* Soundscape Options Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {soundscapes.map((opt) => {
              const Icon = opt.icon;
              const isSelected = ambientSound === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setAmbientSound(opt.id)}
                  className={`flex flex-col items-start gap-1 p-2.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'border-purple-500/50 bg-purple-500/15 shadow-md shadow-purple-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className={isSelected ? 'text-purple-300' : 'text-zinc-400'} />
                      <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                        {opt.label}
                      </span>
                    </div>
                    <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-purple-500/30 text-purple-200' : 'bg-white/5 text-zinc-500'
                    }`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-zinc-400 line-clamp-1">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Task Linker & Stats Footer */}
        <div className="border-t border-white/[0.07] bg-black/40 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Task Linker */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="flex items-center gap-1.5 text-zinc-400 shrink-0 font-medium text-[11.5px]">
              <Target size={13} className="text-sky-400" />
              <span>Bog‘lash:</span>
            </span>
            <select
              value={selectedTaskDropdown}
              onChange={(e) => handleSelectTask(e.target.value)}
              className="w-full sm:w-60 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] text-zinc-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="">(Umumiy fokus, vazifasiz)</option>
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.title.slice(0, 32)}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-300 border border-rose-500/20 text-[11.5px]">
              🍅 {completedPomodorosToday} Pomodoro
            </span>
            <span className="font-mono text-zinc-300 text-[11.5px]">
              {totalDeepWorkMinutesToday} min Deep Work
            </span>
            {history.length > 0 && (
              <span className="text-[10.5px] text-zinc-500 font-mono hidden md:inline">
                · Oxirgi: {history[0].completedAt}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
