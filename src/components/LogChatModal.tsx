import { useState } from 'react';
import { X, Bot } from 'lucide-react';
import { useSynapse, nextTaskId } from '../lib/store';
import type { Task, PromptEntry } from '../lib/types';
import { uid } from '../lib/db';

export default function LogChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, activeWorkspaceId, addTask, addPrompt, selectTask, updateNote } = useSynapse();
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('Claude 3.5 Sonnet');
  const [promptText, setPromptText] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const id = nextTaskId(tasks);
    const newTask: Task = {
      id,
      workspace_id: activeWorkspaceId,
      title: title.trim(),
      status: 'active',
      priority: 'Normal',
      git_branch: null,
      pr_url: null,
      ai_source: model,
      assignee_name: 'Farhod',
      assignee_avatar: null,
      assignee_name2: null,
      assignee_avatar2: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addTask(newTask);

    if (promptText.trim()) {
      const p: PromptEntry = {
        id: uid('pr'),
        task_id: id,
        prompt_hash: null,
        raw_prompt: promptText.trim(),
        ai_response: null,
        model_name: model,
        created_at: new Date().toISOString(),
      };
      addPrompt(p);
      updateNote(id, `## AI Suhbat: ${model}\n\n${promptText.trim()}`);
    }

    selectTask(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121318] p-5 shadow-2xl text-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <h3 className="font-semibold text-white flex items-center gap-2"><Bot size={16} /> AI Suhbatni Qayd Qilish</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-[12px] text-zinc-400">Vazifa Sarlavhasi</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: API optimizatsiyasi bo'yicha maslahat"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[12px] text-zinc-400">AI Modeli</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:outline-none"
            >
              <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
              <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
              <option value="ChatGPT (GPT-4o)">ChatGPT (GPT-4o)</option>
              <option value="Ollama (Local)">Ollama (Local)</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] text-zinc-400">Prompt yoki Suhbat matni</label>
            <textarea
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Prompt yoki xulosani bu yerga yozing..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:outline-none font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-400">Bekor</button>
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-[12px] font-semibold text-white">Saqlash</button>
          </div>
        </form>
      </div>
    </div>
  );
}
