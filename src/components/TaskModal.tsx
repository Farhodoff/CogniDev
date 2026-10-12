import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { nextTaskId, parseTagsInput, useSynapse } from '../lib/store';
import { insertTask } from '../lib/db';
import type { TaskPriority } from '../lib/types';

const PRIORITIES: Array<{ id: TaskPriority; label: string }> = [
  { id: 'Normal', label: 'Oddiy' },
  { id: 'High Priority', label: 'Yuqori daraja' },
  { id: 'Critical', label: "O'ta muhim" },
  { id: 'P0 Blocker', label: "P0 To'siq (Blocker)" },
];

const AI_SOURCES = ['Claude 3.5 Sonnet', 'Gemini 1.5 Pro', 'ChatGPT', 'Ollama Local', "Qo'lda kiritilgan"];

export default function TaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, activeWorkspaceId, addTask, selectTask, dbMode, setHud } = useSynapse();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [branch, setBranch] = useState('');
  const [aiSource, setAiSource] = useState(AI_SOURCES[0]);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;
  const id = nextTaskId(tasks);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const t = {
      id,
      workspace_id: activeWorkspaceId,
      title: title.trim(),
      status: (priority === 'P0 Blocker' ? 'blocker' : 'active') as 'blocker' | 'active',
      priority,
      git_branch: branch.trim() || null,
      pr_url: null,
      ai_source: aiSource,
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: parseTagsInput(tagsInput),
      created_at: now,
      updated_at: now,
    };
    try {
      if (dbMode === 'sqlite') await insertTask(t);
      addTask(t);
      await selectTask(t.id);
      setHud(`${id} vazifasi yaratildi va saqlandi`);
      onClose();
    } catch {
      setHud('SQLite bazasiga yozishda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <Plus size={15} className="text-sky-300" />
          <h2 className="text-[14px] font-bold text-white">Yangi Vazifa <span className="ml-1 font-mono text-[11px] text-zinc-500">{id}</span></h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Vazifa Sarlavhasi</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Masalan: Keshlash tizimini qayta optimallashtirish"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Muhimlik Darajasi</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 focus:border-sky-400/60 focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">AI Manbasi</span>
              <select
                value={aiSource}
                onChange={(e) => setAiSource(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 focus:border-sky-400/60 focus:outline-none"
              >
                {AI_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Git Filiali (Branch)</span>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat/cache-layer"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Teglar (vergul bilan)</span>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="bugfix, database, arch"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-200 hover:bg-white/10">
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
          >
            {saving ? 'Yaratilmoqda…' : `Yaratish (${id})`}
          </button>
        </div>
      </div>
    </div>
  );
}
