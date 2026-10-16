import { Loader2 } from 'lucide-react';

export default function WorkspaceLoading({ label = "Yuklanmoqda..." }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full min-h-[320px] w-full bg-obsidian-950 text-zinc-400 animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl border border-white/5 bg-obsidian-900/60 backdrop-blur-md shadow-2xl">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-8 w-8 rounded-full bg-sky-500/10 animate-ping" />
          <Loader2 className="h-5 w-5 animate-spin text-sky-400 relative z-10" />
        </div>
        <span className="text-xs font-medium tracking-wide text-zinc-400/90">{label}</span>
      </div>
    </div>
  );
}
