import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useSynapse } from '../lib/store';

export function MiniMarkdown({ source }: { source: string }) {
  const blocks = useMemo(() => renderMarkdown(source), [source]);
  return <div className="space-y-3 text-[13.5px] leading-relaxed text-zinc-300">{blocks}</div>;
}

function renderMarkdown(src: string): React.ReactNode[] {
  const lines = src.split('\n');
  return lines.map((l, i) => <p key={i}>{l}</p>);
}

export default function WorkspaceEditor() {
  const {
    tasks,
    selectedTaskId,
    notes,
    deleteTask,
    updateNote,
  } = useSynapse();

  const task = tasks.find((t) => t.id === selectedTaskId);
  const note = selectedTaskId ? (notes[selectedTaskId] ?? '') : '';

  if (!task) {
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#0f1013]/80 p-8 text-center">
        <h3 className="text-[16px] font-semibold text-zinc-200">Hech qanday vazifa tanlanmagan</h3>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#0f1013]/80 relative overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 pt-3 pb-2">
        <span className="font-bold text-zinc-100">{task.id} - {task.title}</span>
        <button
          onClick={() => deleteTask(task.id)}
          className="ml-auto flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11.5px] text-red-300"
        >
          <Trash2 size={12} /> O'chirish
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <textarea
          value={note}
          onChange={(e) => updateNote(task.id, e.target.value)}
          placeholder="Muammo va yechim notelarini yozing..."
          className="w-full h-96 rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-[13px] text-zinc-200 focus:outline-none"
        />
      </div>
    </main>
  );
}
