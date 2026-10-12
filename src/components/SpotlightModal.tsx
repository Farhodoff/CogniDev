import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  GitCommit as GitCommitIcon,
  CheckCircle2,
  ArrowRight,
  X,
  Zap,
  Code2,
  Layers,
  Users,
  Plus,
} from 'lucide-react';
import { useSynapse } from '../lib/store';

export const SpotlightModal: React.FC = () => {
  const {
    showSpotlight,
    setSpotlight,
    quickCapture,
    syncGitCommits,
    gitCommits,
    convertCommitToTask,
    triggerWeeklyCoach,
    triggerStandup,
    setChatModal,
    activeWorkspaceId,
    workspaces,
    groups,
    setActiveGroup,
  } = useSynapse();

  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'capture' | 'git' | 'groups'>('capture');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K or Cmd+Shift+Space
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSpotlight(!showSpotlight);
      }
      if (e.key === 'Escape' && showSpotlight) {
        setSpotlight(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSpotlight, setSpotlight]);

  useEffect(() => {
    if (showSpotlight) {
      syncGitCommits();
    }
  }, [showSpotlight, syncGitCommits]);

  if (!showSpotlight) return null;

  const currentWs = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await quickCapture(input.trim());
    setInput('');
    setSpotlight(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0e1017]/95 shadow-2xl shadow-cyan-500/10 overflow-hidden text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top search & input bar */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 bg-white/[0.02]">
          <Search size={18} className="text-sky-400 shrink-0" />
          <form onSubmit={handleCaptureSubmit} className="flex-1">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Vazifa, yechilgan xatolik yoki buyruq yozing (masalan: 'Auth token muammosi hal qilindi')..."
              className="w-full bg-transparent text-[14px] text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </form>
          {input.trim() && (
            <button
              onClick={handleCaptureSubmit}
              className="flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-sky-400 transition"
            >
              <span>Qo'shish</span>
              <ArrowRight size={13} />
            </button>
          )}
          <button
            onClick={() => setSpotlight(false)}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] bg-black/20 text-[12px]">
          <button
            onClick={() => setActiveTab('capture')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
              activeTab === 'capture'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap size={13} />
            <span>Tezkor</span>
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
              activeTab === 'git'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitCommitIcon size={13} />
            <span>Git Commits ({gitCommits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
              activeTab === 'groups'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users size={13} />
            <span>Guruhlar ({groups.length})</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-3 max-h-[380px] overflow-y-auto space-y-1">
          {activeTab === 'capture' && (
            <div className="space-y-1">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Harakatlar
              </p>

              <button
                onClick={() => {
                  setSpotlight(false);
                  setChatModal(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-sky-500/15 border border-transparent hover:border-sky-500/30 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 group-hover:scale-105 transition">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-zinc-100 group-hover:text-sky-300 transition">
                      AI Import
                    </h4>
                    <p className="text-[11.5px] text-zinc-400">
                      Gemini / ChatGPT / Claude xulosasi va kodlarini 1 tugma bilan taskka aylantirish
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 group-hover:text-sky-400">⌘I</span>
              </button>

              <button
                onClick={async () => {
                  setSpotlight(false);
                  await triggerWeeklyCoach();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-violet-500/15 border border-transparent hover:border-violet-500/30 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400 group-hover:scale-105 transition">
                    <Code2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-zinc-100 group-hover:text-violet-300 transition">
                      Haftalik Tahlil
                    </h4>
                    <p className="text-[11.5px] text-zinc-400">
                      Bajarilgan vazifalar, sekinlashtirgan muammolar va yangi o'rganilgan bilimlar xulosasi
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 group-hover:text-violet-400">⌘R</span>
              </button>

              <button
                onClick={async () => {
                  setSpotlight(false);
                  await triggerStandup();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/15 border border-transparent hover:border-emerald-500/30 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-zinc-100 group-hover:text-emerald-300 transition">
                      Kunlik Standup
                    </h4>
                    <p className="text-[11.5px] text-zinc-400">
                      Bugungi yutuqlar, faol tasklar va jamoaviy blockerlar hisobotini darhol tayyorlash
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 group-hover:text-emerald-400">⌘S</span>
              </button>
            </div>
          )}

          {activeTab === 'git' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  So'nggi commitlar
                </p>
                <div className="flex items-center gap-2">
                  {gitCommits.length > 0 && (
                    <button
                      onClick={async () => {
                        await useSynapse.getState().syncAllCommits();
                        setSpotlight(false);
                      }}
                      className="rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition"
                    >
                      Hammasini sync ({gitCommits.length})
                    </button>
                  )}
                  <button
                    onClick={() => syncGitCommits()}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 transition"
                  >
                    Yangilash
                  </button>
                </div>
              </div>

              {gitCommits.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-[12.5px]">
                  Lokal git commitlar topilmadi yoki bu papka git repozitoriy emas.
                </div>
              ) : (
                gitCommits.map((c) => (
                  <div
                    key={c.hash}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-3">
                      <span className="mt-0.5 rounded px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 font-mono text-[11px]">
                        {c.hash}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-zinc-200 truncate group-hover:text-white">
                          {c.message}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {c.author} • {c.relative_time}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await convertCommitToTask(c);
                        setSpotlight(false);
                      }}
                      className="shrink-0 flex items-center gap-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-1 text-[11.5px] font-semibold border border-emerald-400/30 transition"
                    >
                      <Plus size={12} />
                      <span>Taskga</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-1.5">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Guruhlar
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setActiveGroup(null);
                    setSpotlight(false);
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left transition"
                >
                  <Layers size={15} className="text-sky-400" />
                  <div>
                    <h5 className="text-[12.5px] font-medium text-zinc-200">Barchasi</h5>
                    <p className="text-[11px] text-zinc-500">Hamma tasklar</p>
                  </div>
                </button>

                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroup(g.id);
                      setSpotlight(false);
                    }}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left transition"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: g.color || '#38bdf8' }}
                    />
                    <div className="min-w-0">
                      <h5 className="text-[12.5px] font-medium text-zinc-200 truncate">{g.name}</h5>
                      <p className="text-[11px] text-zinc-500">{currentWs?.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-black/40 px-4 py-2.5 text-[11px] text-zinc-400">
          <div className="flex items-center gap-3 font-mono">
            <span>
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-zinc-300">↵</kbd> saqlash
            </span>
            <span>
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-zinc-300">esc</kbd> yopish
            </span>
            <span>
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-zinc-300">⌘K</kbd> qidiruv
            </span>
          </div>
          <span className="text-zinc-500 font-medium">CogniDev AI</span>
        </div>
      </div>
    </div>
  );
};
