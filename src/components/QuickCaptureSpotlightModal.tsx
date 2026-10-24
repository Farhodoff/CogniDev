import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Target,
  Lightbulb,
  Bug,
  Sparkles,
  X,
  CornerDownLeft,
  GitBranch,
  Check,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import {
  classifyQuickCaptureWithAi,
  syncTrayFocusTasks,
  extractTop3FocusTasks,
  type QuickCaptureType,
} from '../lib/quickCapture';
import type { Task, TaskPriority } from '../lib/types';

interface QuickCaptureSpotlightModalProps {
  open?: boolean;
  onClose?: () => void;
}

export default function QuickCaptureSpotlightModal({
  open: propOpen,
  onClose: propClose,
}: QuickCaptureSpotlightModalProps) {
  const {
    showQuickCaptureModal,
    setQuickCaptureModal,
    addTask,
    createIdea,
    tasks,
    setHud,
    activeWorkspaceId,
    userProfile,
  } = useSynapse();

  const isOpen = propOpen ?? showQuickCaptureModal;
  const handleClose = propClose ?? (() => setQuickCaptureModal(false));

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<QuickCaptureType>('focus');
  const [priority, setPriority] = useState<TaskPriority>('High Priority');
  const [aiExpand, setAiExpand] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branchSuggestion, setBranchSuggestion] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Update dynamic branch suggestion as user types
  useEffect(() => {
    if (!input.trim()) {
      setBranchSuggestion('');
      return;
    }
    const clean = input
      .trim()
      .toLowerCase()
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^(?:bug|fix|feat|idea|focus):\s*/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 28)
      .replace(/^-|-$/g, '');

    const prefix = mode === 'bug' ? 'fix' : mode === 'idea' ? 'concept' : 'feat';
    setBranchSuggestion(`${prefix}/${clean || 'task'}`);
  }, [input, mode]);

  if (!isOpen) return null;

  const placeholders: Record<QuickCaptureType, string> = {
    focus: "Bugun nima ustida ishlaysiz? masalan: 'Redis kesh va gRPC ulanishini sozlash'...",
    idea: "Qanday ajoyib g‘oya yoki texnik arxitektura keldi? masalan: 'AI PR code review bot'...",
    bug: "Qanday muammo yoki xatolik yuz berdi? masalan: 'WebSocket xotira oqishi'...",
    auto: "Tezkor yozing (AI o‘zi toifa va muhimlikni aniqlaydi)...",
  };

  const handleModeCycle = () => {
    const modes: QuickCaptureType[] = ['focus', 'idea', 'bug', 'auto'];
    const nextIdx = (modes.indexOf(mode) + 1) % modes.length;
    setMode(modes[nextIdx]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = input.trim();
    if (!clean || isSubmitting) return;

    setIsSubmitting(true);
    setHud('⚡️ Quick Capture qayta ishlanmoqda...');

    try {
      let parsed: {
        type: 'focus' | 'idea' | 'bug';
        title: string;
        description: string;
        priority: TaskPriority;
        tags: string[];
        suggestedBranch?: string;
      } = {
        type: (mode === 'auto' ? 'focus' : mode) as 'focus' | 'idea' | 'bug',
        title: clean,
        description: `Quick capture orqali kiritildi`,
        priority,
        tags: [mode === 'auto' ? 'focus' : mode, 'quick-capture'],
        suggestedBranch: branchSuggestion,
      };

      if (aiExpand || mode === 'auto') {
        parsed = await classifyQuickCaptureWithAi(clean, mode);
      }

      const now = new Date().toISOString();
      const newId = `task-${Date.now()}`;

      if (parsed.type === 'idea') {
        // Save to Project Ideas
        if (createIdea) {
          await createIdea(parsed.title, 'Quick Note', parsed.description);
        }
        setHud(`💡 Yangi g‘oya muvaffaqiyatli saqlandi: "${parsed.title.slice(0, 30)}..." ✓`);
      } else {
        // Save as Task (Focus or Bug)
        const tags = Array.from(new Set([...parsed.tags, parsed.type === 'focus' ? 'focus' : 'bug']));
        const newTask: Task = {
          id: newId,
          workspace_id: activeWorkspaceId || 'personal',
          group_id: null,
          space_id: null,
          title: parsed.title,
          status: 'active',
          priority: parsed.priority || priority,
          git_branch: parsed.suggestedBranch || branchSuggestion || null,
          pr_url: null,
          ai_source: 'quick_capture',
          assignee_name: userProfile?.full_name || 'Muhandis',
          assignee_avatar: (userProfile?.full_name || 'M').slice(0, 2).toUpperCase(),
          assignee_name2: null,
          assignee_avatar2: null,
          tags,
          created_at: now,
          updated_at: now,
        };

        addTask(newTask);

        // Update macOS Menu Bar Tray top 3 focus items immediately
        const updatedTasks = [newTask, ...tasks];
        const top3 = extractTop3FocusTasks(updatedTasks);
        syncTrayFocusTasks(top3).catch(() => {});

        const emoji = parsed.type === 'bug' ? '🐛 Bug' : '🎯 Fokus vazifa';
        setHud(`${emoji} saqlandi: "${parsed.title.slice(0, 30)}..." ✓`);
      }

      handleClose();
    } catch (err) {
      console.warn('[QuickCapture] submit error:', err);
      setHud('Xatolik yuz berdi, qaytadan urinib ko‘ring.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 pt-[14vh] backdrop-blur-md select-none"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[660px] overflow-hidden rounded-3xl border border-white/[0.14] bg-[#121319]/95 shadow-[0_20px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle top ambient glow banner */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-400 opacity-80" />

        {/* Top Header Row */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Zap size={15} />
            </div>
            <h2 className="text-[13.5px] font-bold text-white tracking-wide">
              CogniDev Quick Capture
            </h2>
            <span className="rounded-md bg-white/[0.06] border border-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
              ⌘ ⇧ Space
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 px-6 pt-4 pb-2">
          {[
            {
              id: 'focus',
              label: 'Fokus Vazifa',
              icon: Target,
              activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
            },
            {
              id: 'idea',
              label: 'Yangi G‘oya',
              icon: Lightbulb,
              activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10',
            },
            {
              id: 'bug',
              label: 'Xatolik / Bug',
              icon: Bug,
              activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10',
            },
            {
              id: 'auto',
              label: 'AI Auto-Detect',
              icon: Sparkles,
              activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as QuickCaptureType)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                  isActive
                    ? `${tab.activeClass} shadow-md font-bold`
                    : 'border-white/5 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Spotlight Big Input */}
        <form onSubmit={handleSubmit} className="px-6 py-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  handleModeCycle();
                } else if (e.key === 'Escape') {
                  handleClose();
                }
              }}
              placeholder={placeholders[mode]}
              className="w-full bg-transparent text-[16px] font-medium text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>

          {/* Quick Settings & Branch Preview */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-zinc-400">
            {/* Priority Selector (for focus/bug) */}
            {mode !== 'idea' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-500 font-medium">Muhimlik:</span>
                {[
                  { id: 'P0 Blocker', label: 'P0', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
                  { id: 'Critical', label: 'Critical', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
                  { id: 'High Priority', label: 'High', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
                  { id: 'Normal', label: 'Normal', color: 'text-zinc-400 bg-white/5 border-white/10' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as TaskPriority)}
                    className={`rounded-lg border px-2 py-0.5 text-[10.5px] font-mono transition ${
                      priority === p.id
                        ? `${p.color} font-bold ring-1 ring-white/20`
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* AI Auto-Expand switch */}
            <button
              type="button"
              onClick={() => setAiExpand(!aiExpand)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition ${
                aiExpand
                  ? 'border-purple-500/30 bg-purple-500/15 text-purple-300'
                  : 'border-white/5 bg-white/[0.02] text-zinc-500'
              }`}
              title="AI avtomatik ravishda texnik tavsif va teglar qo'shadi"
            >
              <Sparkles size={11} className={aiExpand ? 'text-purple-400' : 'text-zinc-500'} />
              <span>AI Kengaytirish</span>
              {aiExpand && <Check size={11} className="text-purple-400" />}
            </button>

            {/* Branch preview pill */}
            {branchSuggestion && mode !== 'idea' && (
              <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 bg-white/[0.03] border border-white/5 rounded-lg px-2 py-0.5">
                <GitBranch size={11} className="text-emerald-400" />
                <span>{branchSuggestion}</span>
              </div>
            )}
          </div>
        </form>

        {/* Footer shortcuts bar */}
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-black/35 px-6 py-3">
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                ↵ Enter
              </kbd>
              <span>Saqlash</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                Tab
              </kbd>
              <span>Toifa</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                Esc
              </kbd>
              <span>Yopish</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition"
            >
              <CornerDownLeft size={13} />
              <span>{isSubmitting ? 'Saqlanmoqda…' : 'Saqlash'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
