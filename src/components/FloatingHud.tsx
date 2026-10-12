import { useEffect, useState } from 'react';
import { Sparkles, TriangleAlert, X, Loader2, Bot } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { isBlocker, analyzeBlockers } from '../lib/ai';
import { getJevKey, jevTriage, triageToMarkdown } from '../lib/jev';
import { firstEnabledProvider } from '../lib/providers';

export default function FloatingHud() {
  const { tasks, setStandup, setStandupModal, setHud, setFilter, hudMessage, triggerStandup, setProvidersModal } = useSynapse();
  const [busy, setBusy] = useState<'standup' | 'blockers' | null>(null);
  const blockers = tasks.filter(isBlocker);
  const activeAi = firstEnabledProvider();

  async function onStandup() {
    setBusy('standup');
    try {
      await triggerStandup();
    } finally {
      setBusy(null);
    }
  }

  async function onBlockers() {
    setBusy('blockers');
    setFilter('high');
    try {
      let extra = '';
      // Jev triage when a key is configured — calibrated priority scoring.
      if (getJevKey().trim()) {
        try {
          extra = triageToMarkdown(await jevTriage(tasks));
        } catch {
          extra = '\n\n*Jev ulanmadi — lokal tahlil ko‘rsatilmoqda.*';
        }
      }
      setStandup(`## To'siqlar Tahlili\n\n${analyzeBlockers(tasks)}${extra}`, 'fallback');
      setStandupModal(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/[0.10] bg-[#17181d]/80 px-2.5 py-2 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <button
            onClick={() => setProvidersModal(true)}
            title="Qaysi AI ishlashini tanlash"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[12px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <Bot size={13} className={activeAi ? 'text-emerald-300' : 'text-zinc-500'} />
            <span className="max-w-[90px] truncate">AI: {activeAi ? activeAi.name : 'Ollama'}</span>
          </button>
          <button
            onClick={onStandup}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_24px_-4px_rgba(56,189,248,0.8)] transition hover:brightness-110 disabled:opacity-60"
          >
            {busy === 'standup' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Kunlik Standup
          </button>
          <button
            onClick={onBlockers}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-[13px] font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
          >
            {busy === 'blockers' ? <Loader2 size={14} className="animate-spin" /> : <TriangleAlert size={14} />}
            To'siqlar ({blockers.length})
          </button>
        </div>
      </div>

      {hudMessage && (
        <Toast message={hudMessage} onClose={() => setHud(null)} />
      )}
    </>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3400);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/85 px-4 py-2 text-[12.5px] text-zinc-100 shadow-2xl backdrop-blur-xl">
        <span>{message}</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={13} /></button>
      </div>
    </div>
  );
}
