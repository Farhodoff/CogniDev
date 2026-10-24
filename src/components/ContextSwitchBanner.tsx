import React from 'react';
import {
  AlertTriangle,
  Target,
  ArrowRight,
  X,
  BrainCircuit,
  Headphones,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { useFocusStore } from '../lib/focusStore';

export default function ContextSwitchBanner() {
  const {
    contextSwitchWarning,
    dismissContextSwitchWarning,
    tasks,
    selectTask,
    setHud,
  } = useSynapse();

  if (!contextSwitchWarning || !contextSwitchWarning.isHighThrashing) {
    return null;
  }

  const {
    totalSwitches,
    uniqueEntities,
    estimatedLostFocusMinutes,
    switchHistory,
    advice,
  } = contextSwitchWarning;

  // Find top priority active task to recommend
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const recommendedTask =
    activeTasks.find((t) => t.tags.includes('focus')) ||
    activeTasks.find((t) => t.priority === 'High Priority') ||
    activeTasks[0];

  const handleReturnToFocus = async () => {
    if (recommendedTask) {
      await selectTask(recommendedTask.id);
      setHud(`🎯 Asosiy fokusga qaytildi: "${recommendedTask.title.slice(0, 30)}..."`);
    }
    dismissContextSwitchWarning();
  };

  const handleStartDeepWorkSprint = () => {
    if (recommendedTask) {
      useFocusStore.getState().startFocus(25, recommendedTask.id, recommendedTask.title);
    } else {
      useFocusStore.getState().startFocus(25);
    }
    useFocusStore.getState().setShowModal(true);
    setHud('🎧 25 daqiqalik Deep Work sprint va neyro-audio fon boshlandi!');
    dismissContextSwitchWarning();
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] max-w-lg w-full px-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-[#16171d]/95 p-5 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(245,158,11,0.25)] backdrop-blur-xl">
        {/* Animated warning beam */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse">
              <BrainCircuit size={20} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle size={11} /> Context-Switching Aniqlanadi
                </span>
                <span className="text-[11px] font-mono text-rose-400 font-semibold">
                  ~{estimatedLostFocusMinutes} min kognitiv yo‘qotish
                </span>
              </div>

              <h4 className="text-sm font-bold text-white pt-0.5">
                So‘nggi 1 soatda {totalSwitches} marta almashtirildi ({uniqueEntities} xil vazifa)
              </h4>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                {advice}
              </p>
            </div>
          </div>

          <button
            onClick={dismissContextSwitchWarning}
            className="text-zinc-500 hover:text-white transition p-1 hover:bg-white/10 rounded-lg shrink-0"
            title="Yopish"
          >
            <X size={16} />
          </button>
        </div>

        {/* Trail of recent switches */}
        {switchHistory.length > 1 && (
          <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center gap-1.5 overflow-x-auto text-[11px] text-zinc-400 scrollbar-none">
            <span className="text-zinc-500 text-[10px] uppercase font-mono shrink-0">Ketma-ketlik:</span>
            {switchHistory.slice(-4).map((sw, idx) => (
              <React.Fragment key={sw.id}>
                {idx > 0 && <ArrowRight size={10} className="text-zinc-600 shrink-0" />}
                <span className="truncate max-w-[110px] rounded-md bg-white/5 px-2 py-0.5 text-zinc-300 border border-white/5 font-mono text-[10.5px] shrink-0" title={sw.title}>
                  {sw.title}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="mt-4 flex items-center gap-2.5 pt-1">
          {recommendedTask && (
            <button
              onClick={handleReturnToFocus}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2.5 text-xs font-bold text-black shadow-lg shadow-amber-500/20 active:scale-95 transition"
            >
              <Target size={14} />
              <span>Bitta Fokusga Qaytish</span>
            </button>
          )}

          <button
            onClick={handleStartDeepWorkSprint}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/20 active:scale-95 transition"
          >
            <Headphones size={14} />
            <span>25m Deep Work Sprint</span>
          </button>
        </div>
      </div>
    </div>
  );
}
