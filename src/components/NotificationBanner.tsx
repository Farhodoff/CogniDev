import { Bell, CheckCircle2, Clock, Mic, Volume2, VolumeX, X } from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { DailyRoutineStage } from '../lib/types';

export default function NotificationBanner() {
  const {
    activeAlertReminder,
    dismissAlertReminder,
    snoozeReminder,
    updateTaskStatus,
    soundEnabled,
    toggleSoundEnabled,
    setHud,
    openVoiceStandup,
  } = useSynapse();

  if (!activeAlertReminder) return null;

  const isRoutine = activeAlertReminder.id?.startsWith('routine-');
  const routineStage: DailyRoutineStage | null = isRoutine
    ? activeAlertReminder.id.includes('morning_10')
      ? 'morning_10'
      : activeAlertReminder.id.includes('midday_14')
      ? 'midday_14'
      : activeAlertReminder.id.includes('evening_22')
      ? 'evening_22'
      : 'morning_10'
    : null;

  const handleOpenVoiceStandup = () => {
    if (routineStage) {
      openVoiceStandup(routineStage, activeAlertReminder.title);
      dismissAlertReminder();
    }
  };

  const handleComplete = () => {
    if (activeAlertReminder.source_type === 'task' && activeAlertReminder.source_id) {
      updateTaskStatus(activeAlertReminder.source_id, 'completed');
      setHud(`"${activeAlertReminder.title}" vazifasi bajarildi deb belgilandi ✓`);
    } else {
      setHud(`"${activeAlertReminder.title}" bajarildi deb belgilandi ✓`);
    }
    dismissAlertReminder();
  };

  const handleSnooze = () => {
    snoozeReminder(activeAlertReminder.id, 10);
  };

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xl px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-[#16171d]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.2)] backdrop-blur-xl">
        {/* Glowing top line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 animate-pulse" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-bounce">
              <Bell size={20} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                  ⏰ Bildirishnoma Vaqti Keldi
                </span>
                <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1">
                  <Clock size={11} className="text-zinc-500" />
                  {activeAlertReminder.time_string}
                </span>
              </div>

              <h3 className="text-[14.5px] font-bold text-white leading-snug">
                {activeAlertReminder.title}
              </h3>

              {activeAlertReminder.description && activeAlertReminder.description !== activeAlertReminder.title && (
                <p className="text-[12px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {activeAlertReminder.description}
                </p>
              )}
            </div>
          </div>

          {/* Sound & close buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleSoundEnabled}
              title={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-zinc-600" />}
            </button>
            <button
              onClick={dismissAlertReminder}
              title="Yopish"
              className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-white/[0.08] pt-3">
          {isRoutine && routineStage && (
            <button
              onClick={handleOpenVoiceStandup}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:brightness-110 transition animate-pulse mr-auto"
            >
              <Mic size={13} />
              <span>
                {routineStage === 'morning_10'
                  ? '🎙 Ovoz bilan javob berish (Joriy Fokus)'
                  : routineStage === 'evening_22'
                  ? '🎙 Ovozli sabab va xulosa (Retro & Log)'
                  : '🎙 Ovoz bilan javob berish'}
              </span>
            </button>
          )}

          <button
            onClick={handleSnooze}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <Clock size={12} className="text-amber-400" />
            <span>10 daqiqaga kechiktirish</span>
          </button>

          <button
            onClick={handleComplete}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-[11.5px] font-semibold text-white shadow-lg hover:brightness-110 transition"
          >
            <CheckCircle2 size={13} />
            <span>Bajarildi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
