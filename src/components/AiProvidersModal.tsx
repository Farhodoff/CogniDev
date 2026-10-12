import { useState } from 'react';
import { Bot, Check, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import {
  PROVIDERS, getProvider, setProvider, testProvider, getProviderOrder, moveProvider,
  type CloudProviderId,
} from '../lib/providers';
import { getJevKey, setJevKey, testJev } from '../lib/jev';

export default function AiProvidersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [jevKey, setJevKeyState] = useState(getJevKey());

  if (!open) return null;
  void tick;

  function refresh() {
    setTick((t) => t + 1);
  }

  async function onTest(id: CloudProviderId) {
    setTesting(id);
    try {
      const res = await testProvider(id);
      setResults((r) => ({ ...r, [id]: res }));
    } finally {
      setTesting(null);
    }
  }

  async function onTestJev() {
    setTesting('jev');
    try {
      const res = await testJev();
      setResults((r) => ({ ...r, jev: res }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <Bot size={15} className="text-violet-300" />
          <h2 className="text-[14px] font-bold text-white">AI Provayderlar</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto px-5 py-4">
          <p className="text-[12px] leading-relaxed text-zinc-500">
            Yoqilgan provayderlar <span className="text-zinc-300">yuqoridan pastga</span> tartibda uriniladi → keyin lokal Ollama → oxirida oflayn shablon. ↑↓ bilan birinchi ishlaydigan AI'ni belgilang. Kalitlar faqat brauzer xotirasida (localStorage) saqlanadi.
          </p>

          {getProviderOrder().map((id, idx, arr) => {
            const p = PROVIDERS.find((x) => x.id === id)!;
            const s = getProvider(p.id);
            const r = results[p.id];
            return (
              <div key={p.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col gap-0">
                    <button
                      onClick={() => { moveProvider(p.id, -1); refresh(); }}
                      disabled={idx === 0}
                      title="Yuqoriga (birinchi urinish)"
                      className="rounded p-0.5 text-zinc-500 hover:text-white disabled:opacity-25"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => { moveProvider(p.id, 1); refresh(); }}
                      disabled={idx === arr.length - 1}
                      title="Pastga"
                      className="rounded p-0.5 text-zinc-500 hover:text-white disabled:opacity-25"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <button
                    onClick={() => { setProvider(p.id, { enabled: !s.enabled }); refresh(); }}
                    className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${s.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    title={s.enabled ? 'O‘chirish' : 'Yoqish'}
                  >
                    <span className={`h-4 w-4 rounded-full bg-white transition-transform ${s.enabled ? 'translate-x-4' : ''}`} />
                  </button>
                  <span className="text-[13.5px] font-bold text-zinc-100">{p.name}</span>
                  <a href={p.keyUrl} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-sky-400 hover:underline">
                    kalit olish →
                  </a>
                </div>
                <div className="mt-2.5 grid grid-cols-[1fr_170px] gap-2">
                  <input
                    type="password"
                    value={s.apiKey}
                    onChange={(e) => { setProvider(p.id, { apiKey: e.target.value }); refresh(); }}
                    placeholder={p.keyHint}
                    className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/60 focus:outline-none"
                  />
                  <input
                    value={s.model}
                    onChange={(e) => { setProvider(p.id, { model: e.target.value }); refresh(); }}
                    placeholder="model"
                    title="Model ID (o‘zgartirish mumkin)"
                    className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/60 focus:outline-none"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => onTest(p.id)}
                    disabled={testing !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[12px] font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    {testing === p.id ? <Loader2 size={12} className="animate-spin" /> : null} Test
                  </button>
                  {r && (
                    <span className={`flex items-center gap-1 font-mono text-[11px] ${r.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                      {r.ok && <Check size={12} />} {r.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Jev — decision model (no text generation) */}
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.04] p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[13.5px] font-bold text-zinc-100">Jev <span className="font-mono text-[10.5px] font-normal text-cyan-300">System One · triage/qarorlar</span></span>
              <a href="https://console.typesafe.ai/keys" target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-sky-400 hover:underline">
                kalit olish →
              </a>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              Matn yozmaydi — vazifalarni prioritet/blokerlik bo‘yicha ishonch foizi bilan baholaydi. "To‘siqlarni Tahlil Qilish" da ishlatiladi.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="password"
                value={jevKey}
                onChange={(e) => { setJevKeyState(e.target.value); setJevKey(e.target.value); }}
                placeholder="TYPESAFE_API_KEY (console.typesafe.ai)"
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-400/60 focus:outline-none"
              />
              <button
                onClick={onTestJev}
                disabled={testing !== null}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[12px] font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
              >
                {testing === 'jev' ? <Loader2 size={12} className="animate-spin" /> : null} Test
              </button>
            </div>
            {results.jev && (
              <span className={`mt-1.5 flex items-center gap-1 font-mono text-[11px] ${results.jev.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {results.jev.ok && <Check size={12} />} {results.jev.detail}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="rounded-lg bg-violet-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110">
            Tayyor
          </button>
        </div>
      </div>
    </div>
  );
}
