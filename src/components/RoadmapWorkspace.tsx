import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  Calendar,
  Sparkles,
  TrendingUp,
  Brain,
  Check,
  Flame,
  Plus,
  Download,
  Trash2,
  FileText,
  X,
  PlusCircle,
  FolderUp,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { analyzeLearningLog } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';
import { exportRoadmapToMarkdown } from '../lib/roadmapParser';

/** Helper to trigger browser download for markdown file */
function downloadMarkdownFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RoadmapWorkspace() {
  const {
    roadmaps,
    selectedRoadmapId,
    selectRoadmap,
    toggleTopicDone,
    learningLogs,
    addLearningLog,
    importRoadmapFromMarkdown,
    createRoadmap,
    addMilestoneToRoadmap,
    addTopicToMilestone,
    deleteTopicFromMilestone,
    deleteMilestoneFromRoadmap,
    deleteRoadmap,
    setHud,
  } = useSynapse();

  const [activeTab, setActiveTab] = useState<'milestones' | 'log' | 'coach'>('milestones');
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');

  // Modals state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states for modals
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteStack, setPasteStack] = useState('Backend / Software Engineering');
  const [pasteContent, setPasteContent] = useState('');

  const [createTitle, setCreateTitle] = useState('');
  const [createStack, setCreateStack] = useState('Python → Go → Rust');
  const [createDescription, setCreateDescription] = useState('');

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDuration, setNewMilestoneDuration] = useState('2–4 hafta');
  const [newMilestonePriority, setNewMilestonePriority] = useState('Yuqori');

  // Inline topic inputs per milestone: milestoneId -> text
  const [topicInputs, setTopicInputs] = useState<Record<string, string>>({});

  // Daily log form state
  const [learnedInput, setLearnedInput] = useState('');
  const [solvedProblemInput, setSolvedProblemInput] = useState('');
  const [nextGoalInput, setNextGoalInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [recentAiFeedback, setRecentAiFeedback] = useState<string | null>(null);

  const [todayStr] = useState(() => new Date().toLocaleDateString('uz-UZ'));

  // Hidden file input for .md upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active roadmap
  const currentRoadmap = useMemo(
    () => roadmaps.find((r) => r.id === selectedRoadmapId) ?? roadmaps[0] ?? null,
    [roadmaps, selectedRoadmapId],
  );

  // Calculate progress
  const progressStats = useMemo(() => {
    if (!currentRoadmap) return { total: 0, done: 0, percentage: 0 };
    let total = 0;
    let done = 0;
    for (const m of currentRoadmap.milestones) {
      for (const t of m.topics) {
        total++;
        if (t.done) done++;
      }
    }
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percentage };
  }, [currentRoadmap]);

  // Handle .md file upload via native file input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      try {
        await importRoadmapFromMarkdown(defaultTitle, 'Backend / Software Engineering', content);
      } catch (err) {
        console.error('Failed to import roadmap:', err);
        setHud("Markdown faylni o‘qishda xatolik yuz berdi");
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-imported if needed
    e.target.value = '';
  };

  // Submit pasted markdown
  const handleImportPastedMarkdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    await importRoadmapFromMarkdown(
      pasteTitle.trim() || 'Mening Yo‘l Xaritam',
      pasteStack.trim() || 'Backend / Software Engineering',
      pasteContent.trim(),
    );

    setPasteTitle('');
    setPasteContent('');
    setShowPasteModal(false);
  };

  // Submit manual roadmap creation
  const handleCreateManualRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;

    await createRoadmap(
      createTitle.trim(),
      createStack.trim() || 'Backend / Systems',
      createDescription.trim() || 'Yangi o‘rganish yo‘l xaritasi',
    );

    setCreateTitle('');
    setCreateDescription('');
    setShowCreateModal(false);
  };

  // Submit new milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoadmap || !newMilestoneTitle.trim()) return;

    await addMilestoneToRoadmap(
      currentRoadmap.id,
      newMilestoneTitle.trim(),
      newMilestoneDuration.trim(),
      newMilestonePriority,
    );

    setNewMilestoneTitle('');
    setShowAddMilestoneModal(false);
  };

  // Inline topic add
  const handleAddTopic = async (milestoneId: string) => {
    if (!currentRoadmap) return;
    const text = topicInputs[milestoneId]?.trim();
    if (!text) return;

    await addTopicToMilestone(currentRoadmap.id, milestoneId, text);
    setTopicInputs((prev) => ({ ...prev, [milestoneId]: '' }));
  };

  // Export roadmap to markdown file
  const handleExportMarkdown = () => {
    if (!currentRoadmap) return;
    const md = exportRoadmapToMarkdown(currentRoadmap);
    const safeTitle = currentRoadmap.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadMarkdownFile(`${safeTitle}_roadmap.md`, md);
    setHud("Yo‘l xaritasi .md fayl sifatida yuklab olindi ✓");
  };

  // Delete current roadmap
  const handleDeleteCurrentRoadmap = async () => {
    if (!currentRoadmap) return;
    await deleteRoadmap(currentRoadmap.id);
    setShowDeleteConfirm(false);
  };

  // Submit daily learning check
  const handleSubmitDailyCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoadmap || !learnedInput.trim()) return;

    setAiLoading(true);
    setHud("AI Murabbiy hisobotingizni tahlil qilmoqda...");

    try {
      const feedback = await analyzeLearningLog(
        learnedInput.trim(),
        solvedProblemInput.trim(),
        nextGoalInput.trim(),
        selectedProvider,
      );

      await addLearningLog(
        currentRoadmap.id,
        learnedInput.trim(),
        solvedProblemInput.trim(),
        nextGoalInput.trim(),
        feedback,
      );

      setRecentAiFeedback(feedback);
      setLearnedInput('');
      setSolvedProblemInput('');
      setNextGoalInput('');
      setHud("Bugungi o‘rganish jurnali saqlandi va AI tahlili olindi ✓");
      setActiveTab('coach');
    } catch {
      setHud("AI tahlilida xatolik yuz berdi. Provayder kalitini tekshiring.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-[#0d0e12]">
      {/* Hidden file input for uploading .md roadmaps */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ── TOP HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-[#121318]/90 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {roadmaps.length > 1 ? (
                <select
                  value={currentRoadmap?.id ?? ''}
                  onChange={(e) => selectRoadmap(e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[14px] font-bold text-white focus:outline-none"
                >
                  {roadmaps.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#181920] text-white">
                      {r.title}
                    </option>
                  ))}
                </select>
              ) : (
                <h1 className="text-[15px] font-bold text-white tracking-wide">
                  {currentRoadmap?.title || "Dasturchi Yo‘l Xaritasi"}
                </h1>
              )}
              <span className="rounded-md bg-white/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-amber-300">
                Junior → Senior Track
              </span>
            </div>
            <p className="text-[12px] text-zinc-400 truncate max-w-[400px]">
              {currentRoadmap?.stack || "Backend texnologiyalar va tillar"}
            </p>
          </div>
        </div>

        {/* Action Controls & Tab navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Roadmap Actions */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Markdown (.md) fayl yuklash"
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[12px] font-medium text-sky-300 hover:bg-sky-500/20 transition"
          >
            <FolderUp size={14} />
            <span>.md Yuklash</span>
          </button>

          <button
            onClick={() => setShowPasteModal(true)}
            title="Markdown matnini tashlash"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] transition"
          >
            <FileText size={14} />
            <span>Matn Tashlash</span>
          </button>

          {currentRoadmap && (
            <>
              <button
                onClick={handleExportMarkdown}
                title="Yo‘l xaritasini .md qilib eksport qilish"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] transition"
              >
                <Download size={14} />
                <span>Eksport</span>
              </button>

              <button
                onClick={() => setShowAddMilestoneModal(true)}
                title="Yangi bosqich qo‘shish"
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[12px] font-medium text-amber-300 hover:bg-amber-500/20 transition"
              >
                <Plus size={14} />
                <span>Bosqich</span>
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Yo‘l xaritasini o‘chirish"
                className="flex items-center rounded-xl border border-red-500/20 bg-red-500/5 p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}

          {/* Tab selector */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/40 p-0.5">
            <button
              onClick={() => setActiveTab('milestones')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'milestones' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen size={13} /> Bosqichlar ({progressStats.done}/{progressStats.total})
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'log' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar size={13} /> Kunlik Check
            </button>
            <button
              onClick={() => setActiveTab('coach')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'coach' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles size={13} className="text-purple-400" /> AI Murabbiy
            </button>
          </div>

          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
            className="rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#181920] text-zinc-200">
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Bar strip (only if roadmap exists) */}
      {currentRoadmap && (
        <div className="border-b border-white/[0.06] bg-black/20 px-6 py-2.5">
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="font-medium text-zinc-300">
              Umumiy o‘zlashtirish darajasi: <strong className="text-white">{progressStats.percentage}%</strong>
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {progressStats.done} ta mavzu o‘rganildi · {progressStats.total - progressStats.done} ta qoldi
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressStats.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-[950px]">
          {/* ── EMPTY STATE: IF NO ROADMAPS EXIST ── */}
          {!currentRoadmap && (
            <div className="rounded-3xl border border-white/10 bg-[#121318]/70 p-8 md:p-12 text-center shadow-2xl backdrop-blur-xl space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-sky-500/20 text-amber-400 border border-white/10">
                <BookOpen size={32} />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Hozircha Yo‘l Xaritasi Mavjud Emas
                </h2>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Backend, frontend yoki har qanday dasturlash yo‘nalishi bo‘yicha tayyor Markdown (.md) faylingizni yuklang yoki noldan yangi xarita yarating.
                </p>
              </div>

              {/* 3 Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-4">
                {/* 1. Upload Markdown File */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer group rounded-2xl border border-sky-500/30 bg-sky-500/[0.04] p-5 hover:border-sky-500 hover:bg-sky-500/[0.08] transition shadow-lg"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 group-hover:scale-110 transition">
                    <FolderUp size={20} />
                  </div>
                  <h3 className="mt-3 text-[14px] font-bold text-white group-hover:text-sky-300 transition">
                    .md Fayldan Yuklash
                  </h3>
                  <p className="mt-1 text-[12px] text-zinc-400">
                    Tayyor markdown faylni tanlang. Sarlavhalar va <code className="text-sky-300">- [ ]</code> checkboxlar avtomatik tartiblanadi.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-sky-400">
                    <span>Faylni tanlash</span> &rarr;
                  </div>
                </div>

                {/* 2. Paste Markdown Text */}
                <div
                  onClick={() => setShowPasteModal(true)}
                  className="cursor-pointer group rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] p-5 hover:border-purple-500 hover:bg-purple-500/[0.08] transition shadow-lg"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition">
                    <FileText size={20} />
                  </div>
                  <h3 className="mt-3 text-[14px] font-bold text-white group-hover:text-purple-300 transition">
                    Matnini Joylash (Paste)
                  </h3>
                  <p className="mt-1 text-[12px] text-zinc-400">
                    Nusxalangan markdown matnini tashlang. U avtomatik tarzda bosqich va mavzularga bo‘linadi.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-purple-400">
                    <span>Matn tashlash</span> &rarr;
                  </div>
                </div>

                {/* 3. Create Manually */}
                <div
                  onClick={() => setShowCreateModal(true)}
                  className="cursor-pointer group rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 hover:border-emerald-500 hover:bg-emerald-500/[0.08] transition shadow-lg"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition">
                    <PlusCircle size={20} />
                  </div>
                  <h3 className="mt-3 text-[14px] font-bold text-white group-hover:text-emerald-300 transition">
                    Qo‘lda Yaratish
                  </h3>
                  <p className="mt-1 text-[12px] text-zinc-400">
                    Noldan yangi reja oching va bosqichlar hamda mavzularni o‘zingiz birma-bir qo‘shib boring.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400">
                    <span>Yangi xarita</span> &rarr;
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 1: MILESTONES ── */}
          {activeTab === 'milestones' && currentRoadmap && (
            <div className="space-y-6">
              {/* Roadmap Header Summary Card */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2">
                      <span>🎯 Yo‘l Xaritasi Maqsadi</span>
                    </h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed">
                      {currentRoadmap.description || "Muhandislik o‘rganish yo‘l xaritasi"}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddMilestoneModal(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 text-[12px] font-medium text-white transition"
                  >
                    <Plus size={14} className="text-amber-400" />
                    <span>Bosqich Qo‘shish</span>
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-zinc-500 font-mono">
                  <span>Jami bosqichlar: {currentRoadmap.milestones.length} ta</span>
                  <span>·</span>
                  <span>Jami mavzular: {progressStats.total} ta</span>
                  <span>·</span>
                  <span className="text-emerald-400">{progressStats.done} ta tugallangan</span>
                </div>
              </div>

              {/* Milestones accordion list */}
              <div className="space-y-4">
                {currentRoadmap.milestones.map((ms, idx) => {
                  const msDone = ms.topics.filter((t) => t.done).length;
                  const msTotal = ms.topics.length;
                  const isCompleted = msDone === msTotal && msTotal > 0;

                  return (
                    <div
                      key={ms.id}
                      className={`overflow-hidden rounded-2xl border transition shadow-md ${
                        isCompleted
                          ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                          : 'border-white/[0.08] bg-[#121318]/70'
                      }`}
                    >
                      {/* Milestone Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/[0.05]">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/[0.07] text-zinc-300'
                            }`}
                          >
                            {isCompleted ? <Check size={14} /> : idx + 1}
                          </span>
                          <div>
                            <h4 className="text-[14px] font-bold text-white leading-snug">
                              {ms.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                              {ms.duration && <span>⏱ {ms.duration}</span>}
                              {ms.priority && (
                                <span className="inline-flex items-center text-amber-400">
                                  <Flame size={11} className="mr-0.5" /> {ms.priority} prioritet
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[12px] text-zinc-400">
                            {msDone}/{msTotal} o‘zlashtirildi
                          </span>
                          <button
                            onClick={() => deleteMilestoneFromRoadmap(currentRoadmap.id, ms.id)}
                            title="Ushbu bosqichni o‘chirish"
                            className="p-1 text-zinc-500 hover:text-red-400 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Topics Checklist */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2 bg-black/20">
                        {ms.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className={`group flex items-start justify-between gap-2.5 rounded-xl border p-2.5 transition ${
                              topic.done
                                ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-zinc-400'
                                : 'border-white/[0.05] bg-white/[0.015] text-zinc-200 hover:border-white/10 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div
                              onClick={() => toggleTopicDone(currentRoadmap.id, ms.id, topic.id)}
                              className="flex flex-1 cursor-pointer items-start gap-2.5 select-none"
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                  topic.done
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-zinc-600 bg-transparent text-transparent hover:border-zinc-400'
                                }`}
                              >
                                <Check size={11} strokeWidth={3} />
                              </span>
                              <span className={`text-[12.5px] leading-snug break-words ${topic.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                {topic.title}
                              </span>
                            </div>

                            {/* Delete topic button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTopicFromMilestone(currentRoadmap.id, ms.id, topic.id);
                              }}
                              title="Mavzuni o‘chirish"
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400 transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Inline Add Topic to this milestone */}
                      <div className="p-3 border-t border-white/[0.04] bg-black/30 flex items-center gap-2">
                        <input
                          value={topicInputs[ms.id] || ''}
                          onChange={(e) =>
                            setTopicInputs((prev) => ({ ...prev, [ms.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTopic(ms.id);
                            }
                          }}
                          placeholder="+ Yangi mavzu nomini yozing va Enter bosing..."
                          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-amber-400/50 focus:outline-none"
                        />
                        <button
                          onClick={() => handleAddTopic(ms.id)}
                          disabled={!topicInputs[ms.id]?.trim()}
                          className="rounded-lg bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-30 px-3 py-1.5 text-[11px] font-semibold text-white transition"
                        >
                          Qo‘shish
                        </button>
                      </div>
                    </div>
                  );
                })}

                {currentRoadmap.milestones.length === 0 && (
                  <div className="p-8 text-center text-[13px] text-zinc-500 rounded-2xl border border-dashed border-white/10">
                    Ushbu yo‘l xaritasida hali bosqichlar yo‘q. Yuqoridagi "+ Bosqich" tugmasi orqali yangi bosqich qo‘shing.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 2: DAILY LEARNING LOG & CHECK ── */}
          {activeTab === 'log' && (
            <div className="space-y-6">
              {/* Daily Log Form */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121318] p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={16} className="text-sky-400" />
                  <h3 className="text-[15px] font-bold text-white">
                    Bugungi O‘rganish Hisoboti (Daily Check)
                  </h3>
                  <span className="ml-auto font-mono text-[11px] text-zinc-500">
                    Sana: {todayStr}
                  </span>
                </div>

                <form onSubmit={handleSubmitDailyCheck} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-300 mb-1.5">
                      1. Bugun aniq nimalarni o‘rgandingiz? (Mavzular, kod bloklari, tushunchalar) *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={learnedInput}
                      onChange={(e) => setLearnedInput(e.target.value)}
                      placeholder="Masalan: Python asyncio coroutinelari, aiohttp orqali parallel API so‘rov yuborish..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-300 mb-1.5">
                      2. Qanday muammo yoki xatoga duch keldingiz va uni qanday hal qildingiz?
                    </label>
                    <textarea
                      rows={2}
                      value={solvedProblemInput}
                      onChange={(e) => setSolvedProblemInput(e.target.value)}
                      placeholder="Masalan: Event loop allaqachon ishlab turganda RuntimeError berdi. Uni asyncio.get_event_loop() o‘rniga asyncio.run() bilan tuzatdim..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-300 mb-1.5">
                      3. Ertangi o‘rganish rejasi / maqsadi
                    </label>
                    <input
                      value={nextGoalInput}
                      onChange={(e) => setNextGoalInput(e.target.value)}
                      placeholder="Masalan: Multiprocessing vs Threading farqi va CPU-bound vazifalarda sinab ko‘rish"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={aiLoading || !learnedInput.trim() || !currentRoadmap}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition"
                    >
                      <Sparkles size={15} />
                      {aiLoading ? "AI tahlil qilmoqda..." : "Saqlash va AI Murabbiydan Tahlil Olish"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Past logs history */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider">
                  O‘tgan kunlar jurnali ({learningLogs.length})
                </h4>

                {learningLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-white/[0.06] bg-[#121318]/60 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                      <span className="font-mono text-[12px] text-sky-400 font-semibold">
                        🗓 {log.date}
                      </span>
                      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10.5px] text-zinc-500">
                        Qayd #{log.id.slice(-4)}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase text-zinc-500 mb-1">O‘rganildi:</p>
                      <p className="text-[13px] text-zinc-200">{log.learned}</p>
                    </div>

                    {log.solved_problem && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                        <p className="text-[11px] font-semibold uppercase text-emerald-400 mb-0.5">
                          ✓ Hal qilingan muammo:
                        </p>
                        <p className="text-[12.5px] text-emerald-200">{log.solved_problem}</p>
                      </div>
                    )}

                    {log.next_goal && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-zinc-500 mb-0.5">Keyingi maqsad:</p>
                        <p className="text-[12.5px] text-zinc-400">{log.next_goal}</p>
                      </div>
                    )}

                    {log.ai_feedback && (
                      <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-[12px]">
                          <Sparkles size={13} /> AI Murabbiy Tahlili:
                        </div>
                        <p className="text-[12.5px] text-zinc-300 whitespace-pre-line leading-relaxed">
                          {log.ai_feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {learningLogs.length === 0 && (
                  <div className="p-8 text-center text-[13px] text-zinc-600 rounded-2xl border border-dashed border-white/10">
                    Hozircha o‘rganish jurnallari kiritilmagan. Yuqoridagi formadan bugungi birinchi hisobotingizni yozing!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: AI COACH (MURABBIY) ── */}
          {activeTab === 'coach' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Brain size={20} className="text-purple-400" />
                  <h3 className="text-[16px] font-bold text-white">
                    Senior Murabbiy & Karyera Maslahatchisi
                  </h3>
                  <span className="ml-auto rounded-full bg-purple-500/20 px-2.5 py-0.5 font-mono text-[11px] text-purple-300">
                    Provayder: {selectedProvider.toUpperCase()}
                  </span>
                </div>

                <p className="text-[13px] text-zinc-300 leading-relaxed">
                  Murabbiy sizning kunlik o‘rganish sur‘atingiz, hal qilayotgan muammolaringiz va backend yo‘l xaritasidagi progressni hisobga olgan holda amaliy yo‘l-yo‘riq beradi.
                </p>

                {recentAiFeedback ? (
                  <div className="rounded-xl border border-white/10 bg-black/50 p-5 space-y-3">
                    <h4 className="text-[13px] font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles size={14} /> Oxirgi Hisobotingiz Tahlili:
                    </h4>
                    <div className="text-[13px] leading-relaxed text-zinc-200 whitespace-pre-line">
                      {recentAiFeedback}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-zinc-500 text-[13px]">
                    Hali yangi tahlil olinmadi. "Kunlik Check" bo‘limidan hisobot yuboring yoki savol bering.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL 1: PASTE MARKDOWN TEXT ── */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-purple-400" />
                <h3 className="text-[15px] font-bold text-white">
                  Markdown Matnini Tashlash (Paste)
                </h3>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleImportPastedMarkdown} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                    Yo‘l Xaritasi Nomi (Ixtiyoriy)
                  </label>
                  <input
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                    placeholder="Masalan: Backend & Software Engineering"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-purple-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                    Texnologiyalar Steki
                  </label>
                  <input
                    value={pasteStack}
                    onChange={(e) => setPasteStack(e.target.value)}
                    placeholder="Masalan: Python → PostgreSQL → Docker → Go"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-purple-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Markdown Matni (H1/H2 sarlavhalar va - [ ] / - [x] / - mavzular) *
                </label>
                <textarea
                  required
                  rows={10}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`# 1. Python\n### A. Core\n- [ ] Variables and references\n- [ ] OOP\n\n# 2. SQL & PostgreSQL\n- [ ] Indexes\n- [ ] Transactions`}
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-purple-400 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!pasteContent.trim()}
                  className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2 text-[13px] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition"
                >
                  Yuklash va Ochish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CREATE ROADMAP MANUALLY ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-400" />
                <h3 className="text-[15px] font-bold text-white">
                  Yangi Yo‘l Xaritasi Yaratish
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateManualRoadmap} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Yo‘l Xaritasi Nomi *
                </label>
                <input
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Masalan: Go & High-load Microservices Track"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Texnologiyalar Steki
                </label>
                <input
                  value={createStack}
                  onChange={(e) => setCreateStack(e.target.value)}
                  placeholder="Masalan: Go → Gin → gRPC → Kafka → PostgreSQL"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Qisqacha Tavsif / Maqsad
                </label>
                <textarea
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Masalan: Tizimli dasturlash, konkurentlik va taqsimlangan arxitekturani noldan production darajasigacha o‘rganish."
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!createTitle.trim()}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-[13px] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition"
                >
                  Yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ADD MILESTONE ── */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                <h3 className="text-[15px] font-bold text-white">
                  Yangi Bosqich Qo‘shish
                </h3>
              </div>
              <button
                onClick={() => setShowAddMilestoneModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Bosqich Nomi *
                </label>
                <input
                  required
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="Masalan: 1. Python Advanced & Async IO"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                    Taxminiy Muddat
                  </label>
                  <input
                    value={newMilestoneDuration}
                    onChange={(e) => setNewMilestoneDuration(e.target.value)}
                    placeholder="2–4 hafta"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                    Prioritet
                  </label>
                  <select
                    value={newMilestonePriority}
                    onChange={(e) => setNewMilestonePriority(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="Yuqori">🔥 Yuqori</option>
                    <option value="O‘rta">⚡ O‘rta</option>
                    <option value="Boshlang‘ich">🌱 Boshlang‘ich</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMilestoneModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!newMilestoneTitle.trim()}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-[13px] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition"
                >
                  Qo‘shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CONFIRM DELETE ROADMAP ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#141012] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 size={22} />
              <h3 className="text-[15px] font-bold text-white">
                Yo‘l xaritasini o‘chirish
              </h3>
            </div>
            <p className="text-[13px] text-zinc-300">
              Haqiqatan ham <strong className="text-white">"{currentRoadmap?.title}"</strong> yo‘l xaritasini va undagi barcha mavzularni o‘chirmoqchimisiz?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentRoadmap}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-[12px] font-semibold text-white shadow-lg transition"
              >
                Ha, O‘chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
