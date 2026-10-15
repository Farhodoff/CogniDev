import { useState } from 'react';
import { Plus, X, Bell } from 'lucide-react';
import { nextTaskId, parseTagsInput, useSynapse } from '../lib/store';
import { insertTask } from '../lib/db';
import type { TaskPriority, Task } from '../lib/types';

const PRIORITIES: Array<{ id: TaskPriority; label: string }> = [
  { id: 'Normal', label: 'Oddiy' },
  { id: 'High Priority', label: 'Yuqori' },
  { id: 'Critical', label: 'Kritik' },
  { id: 'P0 Blocker', label: "P0 To'siq (Blocker)" },
];

const AI_SOURCES = ['Claude 3.5 Sonnet', 'Gemini 1.5 Pro', 'ChatGPT', 'Ollama Local', "Qo'lda kiritilgan"];

export default function TaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, activeWorkspaceId, addTask, selectTask, dbMode, setHud, userProfile, addReminder } = useSynapse();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [aiSource, setAiSource] = useState(AI_SOURCES[0]);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Reminder / Notification
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('10:00');
  const [reminderDateOption, setReminderDateOption] = useState<'today' | 'tomorrow'>('today');

  if (!open) return null;
  const id = nextTaskId(tasks);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const now = new Date().toISOString();

    const t: Task = {
      id,
      workspace_id: activeWorkspaceId,
      title: title.trim(),
      status: (priority === 'P0 Blocker' ? 'blocker' : 'active') as 'blocker' | 'active',
      priority,
      git_branch: null,
      pr_url: null,
      ai_source: aiSource,
      assignee_name: userProfile.full_name || 'Muhandis',
      assignee_avatar: userProfile.avatar_initials || 'CD',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: parseTagsInput(tagsInput),
      due_time: reminderEnabled ? `${reminderDateOption === 'tomorrow' ? 'Ertaga' : 'Bugun'}, ${reminderTime}` : null,
      reminder_enabled: reminderEnabled,
      created_at: now,
      updated_at: now,
    };

    try {
      if (dbMode === 'sqlite') await insertTask(t);
      addTask(t);
      await selectTask(t.id);

      // If reminder enabled, schedule notification
      if (reminderEnabled) {
        const target = new Date();
        const [hh, mm] = reminderTime.split(':').map(Number);
        target.setHours(hh || 10, mm || 0, 0, 0);
        if (reminderDateOption === 'tomorrow' || target.getTime() <= Date.now()) {
          target.setDate(target.getDate() + 1);
        }

        const displayTime = `${reminderDateOption === 'tomorrow' ? 'Ertaga' : 'Bugun'}, ${reminderTime}`;
        await addReminder({
          title: t.title,
          description: `Vazifa muddati keldi (${id}): ${t.title}`,
          source_type: 'task',
          source_id: t.id,
          target_time: target.toISOString(),
          time_string: displayTime,
          sound_enabled: true,
        });

        setHud(`${id} vazifasi yaratildi va ${displayTime} ga bildirishnoma o'rnatildi ⏰ ✓`);
      } else {
        setHud(`${id} vazifasi yaratildi va saqlandi ✓`);
      }

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
          <h2 className="text-[14px] font-bold text-white">Yangi vazifa <span className="ml-1 font-mono text-[11px] text-zinc-500">{id}</span></h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Sarlavha</span>
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
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Muhimlik</span>
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
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">AI manba</span>
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
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Teglar (vergul bilan)</span>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="bugfix, database, arch"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
            />
          </label>

          {/* Reminder / Notification Section */}
          <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30"
                />
                <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Bell size={13} className={reminderEnabled ? "text-amber-400" : "text-zinc-500"} />
                  Eslatma & Bildirishnoma (Notification)
                </span>
              </label>
              {reminderEnabled && (
                <span className="font-mono text-[10.5px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {reminderDateOption === 'tomorrow' ? 'Ertaga' : 'Bugun'} {reminderTime}
                </span>
              )}
            </div>

            {reminderEnabled && (
              <div className="pt-1.5 space-y-2 border-t border-white/[0.06] animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setReminderDateOption('today')}
                      className={`px-2.5 py-1 rounded-md transition ${reminderDateOption === 'today' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Bugun
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderDateOption('tomorrow')}
                      className={`px-2.5 py-1 rounded-md transition ${reminderDateOption === 'tomorrow' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Ertaga
                    </button>
                  </div>

                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[12.5px] font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* Quick presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-500 font-mono">Tezkor:</span>
                  {[
                    {
                      label: '+15 daq',
                      fn: () => {
                        const d = new Date(Date.now() + 15 * 60 * 1000);
                        setReminderTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                        setReminderDateOption('today');
                      },
                    },
                    {
                      label: '+1 soat',
                      fn: () => {
                        const d = new Date(Date.now() + 60 * 60 * 1000);
                        setReminderTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                        setReminderDateOption('today');
                      },
                    },
                    { label: '10:00', fn: () => setReminderTime('10:00') },
                    { label: '14:30', fn: () => setReminderTime('14:30') },
                    { label: '18:00', fn: () => setReminderTime('18:00') },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={p.fn}
                      className="rounded px-2 py-0.5 font-mono text-[10.5px] bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-amber-300 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition">
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50 transition shadow-sm"
          >
            {saving ? 'Yaratilmoqda…' : reminderEnabled ? 'Saqlash & Eslatma o‘rnatish' : 'Vazifani saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
