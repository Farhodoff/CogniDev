import { useState } from 'react';
import { X, Cpu, Check, Copy, GitBranch, RefreshCw } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { SOURCE_LABELS } from '../lib/providers';
import { MiniMarkdown } from './WorkspaceEditor';

export default function StandupModal() {
  const { showStandupModal, setStandupModal, standup, standupSource, generateGitStandup } = useSynapse();
  const [copied, setCopied] = useState(false);
  const [loadingGit, setLoadingGit] = useState(false);

  if (!showStandupModal || !standup) return null;

  function copyMarkdown() {
    navigator.clipboard?.writeText(standup ?? '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleRefreshWithGit() {
    setLoadingGit(true);
    try {
      await generateGitStandup();
    } finally {
      setLoadingGit(false);
    }
  }

  const isGitSource = String(standupSource).includes('git');
  const sourceLabel = isGitSource
    ? '🐙 Real Git Diff & Commitlar'
    : (standupSource && SOURCE_LABELS[standupSource]) || 'Oflayn shablon';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm select-none"
      onClick={() => setStandupModal(false)}
    >
      <div
        className="w-full max-w-[680px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          {isGitSource ? (
            <GitBranch size={16} className="text-emerald-400" />
          ) : (
            <Cpu size={16} className="text-violet-300" />
          )}
          <h2 className="text-[14px] font-bold text-white">Kunlik Standup</h2>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
              isGitSource
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : standupSource === 'fallback'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
            }`}
          >
            {sourceLabel}
          </span>
          <button
            onClick={() => setStandupModal(false)}
            className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 scrollbar-thin">
          <MiniMarkdown source={standup} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-3 bg-black/20">
          <button
            onClick={handleRefreshWithGit}
            disabled={loadingGit}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-[12px] font-medium text-emerald-300 transition disabled:opacity-40"
            title="Oxirgi 24 soatdagi barcha git commitlar va diff statistikasi asosida standup tuzish"
          >
            <RefreshCw size={12} className={loadingGit ? 'animate-spin' : ''} />
            <span>{loadingGit ? 'Git tahlil qilinmoqda…' : '🐙 Git Diff orqali qayta tuzish'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={copyMarkdown}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-200 hover:bg-white/10 transition"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Nusxalandi' : 'Nusxa olish'}
            </button>
            <button
              onClick={() => setStandupModal(false)}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
