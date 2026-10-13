import { useState } from 'react';
import { X, Cpu, Check, Copy } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { SOURCE_LABELS } from '../lib/providers';
import { MiniMarkdown } from './WorkspaceEditor';

export default function StandupModal() {
  const { showStandupModal, setStandupModal, standup, standupSource } = useSynapse();
  const [copied, setCopied] = useState(false);

  if (!showStandupModal || !standup) return null;

  function copyMarkdown() {
    navigator.clipboard?.writeText(standup ?? '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setStandupModal(false)}>
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <Cpu size={15} className="text-violet-300" />
          <h2 className="text-[14px] font-bold text-white">Kunlik Standup</h2>
          <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10.5px] ${standupSource === 'fallback' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {standupSource ? SOURCE_LABELS[standupSource] : 'Oflayn shablon'}
          </span>
          <button onClick={() => setStandupModal(false)} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <MiniMarkdown source={standup} />
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button
            onClick={copyMarkdown}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-200 hover:bg-white/10 transition"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Nusxalandi' : 'Nusxa olish'}
          </button>
          <button
            onClick={() => setStandupModal(false)}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110 shadow-sm transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
