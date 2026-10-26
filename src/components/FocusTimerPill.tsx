import { useEffect } from 'react';
import { Play, Pause, Coffee } from 'lucide-react';
import { useFocusStore } from '../lib/focusStore';

export default function FocusTimerPill() {
  const {
    mode,
    status,
    timeRemaining,
    totalDuration,
    tick,
    setShowModal,
    resumeTimer,
    pauseTimer,
  } = useFocusStore();

  const syncWithTargetTime = useFocusStore((s) => s.syncWithTargetTime);

  // Run 1-second interval while running
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (status === 'running') {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }

    // Immediately resync time on visibility change or window focus
    const handleSync = () => {
      syncWithTargetTime();
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    // Tauri native second_tick event listener (keeps ticking even in background)
    let unlistenTick: (() => void) | null = null;
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('second_tick', () => {
          if (useFocusStore.getState().status === 'running') {
            useFocusStore.getState().tick();
          }
        }).then((unlisten) => {
          unlistenTick = unlisten;
        });
      })
      .catch(() => {});

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
      if (unlistenTick) unlistenTick();
    };
  }, [status, tick, syncWithTargetTime]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const progressPercent = Math.max(0, Math.min(100, ((totalDuration - timeRemaining) / totalDuration) * 100));

  const isBreak = mode === 'short_break' || mode === 'long_break';
  const isRunning = status === 'running';

  const pillColor = isBreak
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : isRunning
    ? 'border-rose-500/30 bg-rose-500/15 text-rose-300 shadow-rose-500/10 shadow-sm'
    : 'border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/10 hover:text-white';

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setShowModal(true)}
        title={`Pomodoro & Deep Work Fokus Taymeri (${mode})`}
        className={`group relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-mono transition ${pillColor}`}
      >
        {isBreak ? (
          <Coffee size={12} className="text-emerald-400" />
        ) : (
          <span className="text-[12px] leading-none">🍅</span>
        )}

        <span className="font-semibold tracking-tight">{timeFormatted}</span>

        {isRunning && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500"></span>
          </span>
        )}

        {/* Mini progress line under pill */}
        {isRunning && (
          <div className="absolute -bottom-0.5 left-2 right-2 h-[1.5px] overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all duration-1000 ${isBreak ? 'bg-emerald-400' : 'bg-rose-400'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </button>

      {/* Quick toggle play/pause button on hover or active */}
      {status !== 'idle' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isRunning) {
              pauseTimer();
            } else {
              resumeTimer();
            }
          }}
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/40 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          title={isRunning ? "Pauza" : "Davom ettirish"}
        >
          {isRunning ? <Pause size={10} /> : <Play size={10} className="ml-0.5 text-emerald-400" />}
        </button>
      )}
    </div>
  );
}
