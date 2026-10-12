import { useRef, useState } from 'react';
import { ChevronDown, Mic, Search, TriangleAlert, Bot } from 'lucide-react';
import { useSynapse } from '../lib/store';
import TaskModal from './TaskModal';
import LogChatModal from './LogChatModal';
import VoiceRecorderModal from './VoiceRecorderModal';

export default function Header({ onPalette }: { onPalette: () => void }) {
  const {
    workspaces, activeWorkspaceId, setWorkspace,
    selectedTaskId, flagBlocker, setHud,
    showTaskModal, setTaskModal, showChatModal, setChatModal,
  } = useSynapse();
  const [wsOpen, setWsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  function handleBlockerClick() {
    if (!selectedTaskId) {
      setHud("Iltimos, avval to'siq deb belgilash uchun vazifani tanlang");
      return;
    }
    flagBlocker(selectedTaskId);
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0c0d12]/90 px-4 backdrop-blur-md select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold shadow-lg shadow-sky-500/20 text-[13px]">
              CD
            </span>
            <div className="leading-tight">
              <h1 className="text-[13px] font-bold text-white tracking-wide">CogniDev</h1>
              <p className="font-mono text-[9.5px] text-zinc-500 uppercase tracking-widest">AI OS</p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setWsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-medium text-zinc-200 hover:bg-white/10 transition"
            >
              <span>{active ? active.name : 'Personal Sandbox'}</span>
              <ChevronDown size={12} className="text-zinc-500" />
            </button>
            {wsOpen && (
              <div className="absolute left-0 top-9 z-50 w-48 rounded-xl border border-white/10 bg-[#16171d] shadow-2xl py-1">
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { setWorkspace(w.id); setWsOpen(false); }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-zinc-300 hover:bg-white/5 transition"
                  >
                    <span>{w.name}</span>
                    {w.id === activeWorkspaceId && <span className="text-sky-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPalette}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 transition"
          >
            <Search size={13} />
            <span>Qidiruv...</span>
            <kbd className="rounded bg-white/10 px-1 font-mono text-[10px] text-zinc-400">⌘K</kbd>
          </button>

          <button onClick={() => setChatModal(true)} className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-violet-200 hover:bg-violet-500/20">
            <Bot size={13} className="text-violet-400" /> Universal Ingest
          </button>
          <button onClick={() => setTaskModal(true)} className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[12px] font-medium text-sky-200 hover:bg-sky-500/20">
            <span>+</span> Vazifa
          </button>
          <button onClick={() => setVoiceOpen(true)} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/20">
            <span>+</span> <Mic size={13} className="text-emerald-300" /> Ovozli
          </button>
          <button onClick={handleBlockerClick} className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[12px] font-medium text-amber-200 hover:bg-amber-500/20">
            <span>+</span> <TriangleAlert size={13} /> To'siq
          </button>
        </div>
      </header>

      <input ref={fileRef} type="file" accept=".json" className="hidden" />
      {showTaskModal && <TaskModal open={showTaskModal} onClose={() => setTaskModal(false)} />}
      {showChatModal && <LogChatModal open={showChatModal} onClose={() => setChatModal(false)} />}
      {voiceOpen && <VoiceRecorderModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />}
    </>
  );
}
