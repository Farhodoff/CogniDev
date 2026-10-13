import React, { useState, useMemo } from 'react';
import {
  Lightbulb,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  Filter,
  ListTodo,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { decomposeIdeaToTasks } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';
import type { ProjectIdea } from '../lib/types';

const STACK_PRESETS = [
  'Barchasi',
  'Go',
  'Python',
  'Rust',
  'PostgreSQL',
  'TypeScript',
  'C',
  'Docker',
];

export default function IdeasWorkspace() {
  const {
    projectIdeas,
    createIdea,
    updateIdea,
    deleteIdea,
    exportIdeaTasksToStream,
    setHud,
    setMainView,
  } = useSynapse();

  const [selectedStackFilter, setSelectedStackFilter] = useState('Barchasi');
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [aiLoadingIdeaId, setAiLoadingIdeaId] = useState<string | null>(null);

  // New idea form
  const [newTitle, setNewTitle] = useState('');
  const [newStack, setNewStack] = useState('Go');
  const [newDescription, setNewDescription] = useState('');

  // Filter ideas by stack
  const filteredIdeas = useMemo(() => {
    if (selectedStackFilter === 'Barchasi') return projectIdeas;
    return projectIdeas.filter((i) =>
      i.stack.toLowerCase().includes(selectedStackFilter.toLowerCase()),
    );
  }, [projectIdeas, selectedStackFilter]);

  // Handle creating idea
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createIdea(newTitle.trim(), newStack.trim(), newDescription.trim());
    setNewTitle('');
    setNewDescription('');
    setShowCreateModal(false);
    setHud("Yangi loyiha g'oyasi saqlandi ✓");
  };

  // AI Decomposition
  const handleDecompose = async (idea: ProjectIdea) => {
    setAiLoadingIdeaId(idea.id);
    setHud(`AI "${idea.title}" uchun vazifalarni rejalashtirmoqda...`);

    try {
      const generated = await decomposeIdeaToTasks(
        idea.title,
        idea.stack,
        idea.description,
        selectedProvider,
      );

      const tasks = generated.map((t, idx) => ({
        id: `task-${idx + 1}`,
        title: t.title,
        priority: t.priority,
        done: false,
      }));

      await updateIdea(idea.id, {
        tasks,
        status: idea.status === 'idea' ? 'planning' : idea.status,
      });

      setHud(`AI ${tasks.length} ta aniq vazifani shakllantirdi! ✓`);
    } catch {
      setHud("AI vazifalarni ajratishda xatolik yuz berdi. Provayderni tekshiring.");
    } finally {
      setAiLoadingIdeaId(null);
    }
  };

  // Export tasks to Stream and switch view
  const handleExportToStream = async (ideaId: string) => {
    const count = await exportIdeaTasksToStream(ideaId);
    if (count > 0) {
      setTimeout(() => {
        setMainView('stream');
      }, 700);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-[#0d0e12]">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#121318]/90 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Lightbulb size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold text-white tracking-wide">
                G'oyalar & Loyihalar Inkubatori
              </h1>
              <span className="rounded-md bg-white/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-zinc-400">
                {projectIdeas.length} ta g'oya
              </span>
            </div>
            <p className="text-[12px] text-zinc-400">
              Dasturlash tillari bo'yicha loyihalar, arxitektura va AI vazifalar taqsimoti
            </p>
          </div>
        </div>

        {/* Action button & AI provider */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
            className="rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                AI: {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-lg hover:brightness-110 transition"
          >
            <Plus size={14} /> Yangi G'oya
          </button>
        </div>
      </div>

      {/* Stack filter tags */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-black/20 px-6 py-2 overflow-x-auto">
        <span className="font-mono text-[10.5px] text-zinc-500 uppercase mr-2 tracking-wider flex items-center gap-1">
          <Filter size={11} /> Filtr:
        </span>
        {STACK_PRESETS.map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStackFilter(st)}
            className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
              selectedStackFilter === st
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30 font-semibold'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* ── IDEAS GRID ── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-[960px] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredIdeas.map((idea) => {
              const completedTasks = idea.tasks.filter((t) => t.done).length;
              const isAiWorking = aiLoadingIdeaId === idea.id;

              return (
                <div
                  key={idea.id}
                  className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#121318]/70 p-5 shadow-xl hover:border-white/15 transition space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                          {idea.stack}
                        </span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-zinc-400">
                          {idea.status === 'idea' && '💡 G‘oya'}
                          {idea.status === 'planning' && '📋 Rejalashtirilgan'}
                          {idea.status === 'in_progress' && '🚀 Jarayonda'}
                          {idea.status === 'completed' && '✅ Bajarildi'}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-bold text-white leading-snug">
                        {idea.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm("Ushbu g'oyani o'chirishni xohlaysizmi?")) {
                          deleteIdea(idea.id);
                        }
                      }}
                      title="O'chirish"
                      className="p-1 text-zinc-500 hover:text-rose-400 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed flex-1">
                    {idea.description || "Loyiha tavsifi kiritilmagan."}
                  </p>

                  {/* Tasks breakdown preview */}
                  <div className="rounded-xl border border-white/[0.05] bg-black/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                        <ListTodo size={12} className="text-sky-400" />
                        Ishlab Chiqish Vazifalari ({idea.tasks.length})
                      </span>
                      {idea.tasks.length > 0 && (
                        <span className="font-mono text-[10.5px] text-zinc-500">
                          {completedTasks}/{idea.tasks.length}
                        </span>
                      )}
                    </div>

                    {idea.tasks.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {idea.tasks.slice(0, 4).map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 text-[12px] text-zinc-300"
                          >
                            <span className="text-[10px] font-mono rounded bg-white/[0.07] px-1.5 py-0.2 text-zinc-400 shrink-0">
                              {t.priority}
                            </span>
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}
                        {idea.tasks.length > 4 && (
                          <p className="text-[11px] text-zinc-500 font-mono italic">
                            + yana {idea.tasks.length - 4} ta vazifa
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-zinc-500 italic py-1">
                        Hali vazifalarga ajratilmagan. Quyidagi AI tugmasini bosing!
                      </p>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                    <button
                      disabled={isAiWorking}
                      onClick={() => handleDecompose(idea)}
                      className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-[11.5px] font-semibold text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-40"
                    >
                      <Sparkles size={12} />
                      {isAiWorking ? "Rejalashtirilmoqda..." : "AI orqali tasklarga ajratish"}
                    </button>

                    {idea.tasks.length > 0 && (
                      <button
                        onClick={() => handleExportToStream(idea.id)}
                        title="Vazifalarni CogniDev Vazifalar Oqimiga eksport qilish"
                        className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-sky-400 transition shadow-sm"
                      >
                        <span>Oqimga eksport</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredIdeas.length === 0 && (
            <div className="p-12 text-center text-zinc-500 rounded-2xl border border-dashed border-white/10 space-y-3">
              <span className="text-4xl block">💡</span>
              <h3 className="text-[15px] font-semibold text-zinc-300">
                Ushbu filtr bo'yicha g'oyalar mavjud emas
              </h3>
              <p className="text-[12.5px] text-zinc-500 max-w-sm mx-auto">
                Yangi til yoki stack bo'yicha loyiha g'oyangizni qo'shing va AI orqali tasklarga ajrating!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 rounded-xl bg-amber-500 px-4 py-2 text-[12px] font-semibold text-white shadow-lg hover:bg-amber-400 transition"
              >
                + Yangi G'oya qo'shish
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE IDEA MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#16171d] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <h3 className="text-[15px] font-bold text-white">Yangi Loyiha G'oyasi</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-zinc-300 mb-1">
                  Loyiha Nomi *
                </label>
                <input
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Masalan: High-load Distributed Rate Limiter..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zinc-300 mb-1">
                  Dasturlash tili va Stack *
                </label>
                <input
                  required
                  value={newStack}
                  onChange={(e) => setNewStack(e.target.value)}
                  placeholder="Masalan: Go + Redis, Python + Asyncio, Rust, C..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zinc-300 mb-1">
                  Konsept va Texnik Maqsad
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Loyiha qanday muammoni hal qiladi? Qanday arxitektura ishlatiladi?..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-[12px] text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-[12px] font-semibold text-white hover:bg-amber-400 disabled:opacity-40"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
