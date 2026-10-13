import { useState } from 'react';
import { ChevronDown, Copy, Database, Check } from 'lucide-react';
import { useSynapse } from '../lib/store';

export default function PromptVault({ taskId }: { taskId: string }) {
  const { prompts } = useSynapse();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const first = prompts[0];

  if (!first) return null;

  function copy() {
    navigator.clipboard?.writeText(first.raw_prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/[0.08] to-transparent">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Database size={14} className="text-violet-300" />
        <span className="text-[13px] font-bold text-violet-100">AI Prompt Ombori <span className="font-normal text-violet-300/80">(Yechim Generatori)</span></span>
        <span className="ml-auto rounded-md bg-violet-500/15 px-1.5 py-0.5 font-mono text-[11px] text-violet-200">Xesh: {first.prompt_hash ?? '#—'}</span>
        <ChevronDown size={15} className={`text-violet-300 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="border-t border-violet-400/10 px-4 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">{first.model_name} ga yuborilgan asl prompt (qayta yaratish uchun):</p>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/50 p-3.5 font-mono text-[12px] leading-relaxed text-zinc-300">{first.raw_prompt}</pre>
          <div className="mt-2.5 flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-[12px] font-semibold text-violet-100 hover:bg-violet-500/30 transition">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Nusxalandi' : 'Prompt nusxasi'}
            </button>
            <span className="font-mono text-[11px] text-zinc-600">vazifa: {taskId}</span>
          </div>
        </div>
      )}
    </section>
  );
}
