import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Pencil,
  FileEdit,
  RefreshCw,
  ExternalLink,
  Search,
  RotateCcw,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { analyzeLearningLog } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';
import { exportRoadmapToMarkdown } from '../lib/roadmapParser';
import type { RoadmapMilestone } from '../lib/types';
import {
  getDueFlashcards,
  getCuratedTopicResources,
  type CuratedTopicResource,
} from '../lib/spacedRepetition';
import FormattedAiText from './FormattedAiText';

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
    updateRoadmap,
    updateMilestone,
    updateTopic,
    updateRoadmapMarkdown,
    batchReplaceYearInRoadmaps,
    syncDailyRoadmapFocus,
    setHud,
    flashcards,
    addFlashcards,
    reviewFlashcard,
    deleteFlashcard,
    generateFlashcardsForTopicAction,
  } = useSynapse();

  const [activeTab, setActiveTab] = useState<'milestones' | 'log' | 'coach' | 'flashcards'>('milestones');
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');

  // Modals state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditRoadmapModal, setShowEditRoadmapModal] = useState(false);

  // Markdown editor modal state
  const [showMarkdownEditorModal, setShowMarkdownEditorModal] = useState(false);
  const [markdownEditorContent, setMarkdownEditorContent] = useState('');

  // Milestone edit modal state
  const [editingMilestone, setEditingMilestone] = useState<RoadmapMilestone | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneDuration, setEditMilestoneDuration] = useState('2–4 hafta');
  const [editMilestonePriority, setEditMilestonePriority] = useState('Yuqori');

  // Topic edit state
  const [editingTopic, setEditingTopic] = useState<{ milestoneId: string; topicId: string; title: string } | null>(null);

  // Batch Year replacer modal
  const [showBatchYearModal, setShowBatchYearModal] = useState(false);
  const [batchYearFrom, setBatchYearFrom] = useState('2027');
  const [batchYearTo, setBatchYearTo] = useState('2026');

  // Edit roadmap modal state
  const [editRoadmapTitle, setEditRoadmapTitle] = useState('');
  const [editRoadmapStack, setEditRoadmapStack] = useState('');
  const [editRoadmapDesc, setEditRoadmapDesc] = useState('');

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

  // Flashcards & Spaced Repetition state
  const [studyFilter, setStudyFilter] = useState<'due' | 'all'>('due');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [curatedResources, setCuratedResources] = useState<Record<string, CuratedTopicResource[]>>({});
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [showManualCardModal, setShowManualCardModal] = useState(false);
  const [manualCardQuestion, setManualCardQuestion] = useState('');
  const [manualCardAnswer, setManualCardAnswer] = useState('');
  const [manualCardExplanation, setManualCardExplanation] = useState('');
  const [manualCardCode, setManualCardCode] = useState('');
  const [manualCardTopicTitle, setManualCardTopicTitle] = useState('');

  // Hidden file input for .md upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active roadmap
  const currentRoadmap = useMemo(
    () => roadmaps.find((r) => r.id === selectedRoadmapId) ?? roadmaps[0] ?? null,
    [roadmaps, selectedRoadmapId],
  );

  // Flashcards for current roadmap (or all if no roadmap selected)
  const roadmapFlashcards = useMemo(() => {
    if (!currentRoadmap) return flashcards;
    return flashcards.filter((c) => c.roadmap_id === currentRoadmap.id);
  }, [flashcards, currentRoadmap]);

  const dueCards = useMemo(() => {
    return getDueFlashcards(roadmapFlashcards);
  }, [roadmapFlashcards]);

  const matureCards = useMemo(() => {
    return roadmapFlashcards.filter((c) => c.interval_days >= 7);
  }, [roadmapFlashcards]);

  const activeStudyCards = useMemo(() => {
    return studyFilter === 'due' ? dueCards : roadmapFlashcards;
  }, [studyFilter, dueCards, roadmapFlashcards]);

  const filteredCardsCatalog = useMemo(() => {
    if (!cardSearchQuery.trim()) return roadmapFlashcards;
    const q = cardSearchQuery.toLowerCase();
    return roadmapFlashcards.filter(
      (c) =>
        c.question.toLowerCase().includes(q) ||
        c.topic_title.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q)
    );
  }, [roadmapFlashcards, cardSearchQuery]);

  // Load curated resources when active card changes
  useEffect(() => {
    const card = activeStudyCards[currentCardIndex];
    if (card && !curatedResources[card.topic_title]) {
      getCuratedTopicResources(card.topic_title, currentRoadmap?.stack || 'Backend').then((res) => {
        setCuratedResources((prev) => ({ ...prev, [card.topic_title]: res }));
      });
    }
  }, [activeStudyCards, currentCardIndex, currentRoadmap?.stack, curatedResources]);

  const handleReviewCard = async (rating: 1 | 2 | 3) => {
    if (!activeStudyCards[currentCardIndex]) return;
    const cardId = activeStudyCards[currentCardIndex].id;
    await reviewFlashcard(cardId, rating);
    setIsFlipped(false);
    if (currentCardIndex >= activeStudyCards.length - 1) {
      setCurrentCardIndex(0);
    }
  };

  const handleGenerateTopicCards = async (topicId: string, topicTitle: string) => {
    if (!currentRoadmap) return;
    setGeneratingTopicId(topicId);
    try {
      const count = await generateFlashcardsForTopicAction(
        currentRoadmap.id,
        topicId,
        topicTitle,
        currentRoadmap.title,
        currentRoadmap.stack,
        selectedProvider
      );
      if (count > 0) {
        setActiveTab('flashcards');
        setStudyFilter('all');
        setCardSearchQuery(topicTitle);
      }
    } finally {
      setGeneratingTopicId(null);
    }
  };

  const handleGenerateAllRoadmapCards = async () => {
    if (!currentRoadmap) return;
    const existingTitles = new Set(roadmapFlashcards.map((c) => c.topic_title.toLowerCase()));
    const allTopics = currentRoadmap.milestones.flatMap((m) => m.topics);
    const targetTopics = allTopics.filter((t) => !existingTitles.has(t.title.toLowerCase())).slice(0, 5);

    if (targetTopics.length === 0) {
      setHud('Barcha mavzular uchun flashcardlar allaqachon mavjud yoki xaritada mavzu yo‘q');
      return;
    }

    setAiLoading(true);
    setHud(`AI: ${targetTopics.length} ta mavzu uchun flashcardlar to‘plami generatsiya qilinmoqda...`);
    try {
      let totalCreated = 0;
      for (const t of targetTopics) {
        const count = await generateFlashcardsForTopicAction(
          currentRoadmap.id,
          t.id,
          t.title,
          currentRoadmap.title,
          currentRoadmap.stack,
          selectedProvider
        );
        totalCreated += count;
      }
      setHud(`AI: Jami ${totalCreated} ta yangi texnik flashcard muvaffaqiyatli yaratildi! ✓`);
      setActiveTab('flashcards');
    } finally {
      setAiLoading(false);
    }
  };

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

  // Open Edit Roadmap Modal
  const handleOpenEditRoadmap = () => {
    if (!currentRoadmap) return;
    setEditRoadmapTitle(currentRoadmap.title);
    setEditRoadmapStack(currentRoadmap.stack);
    setEditRoadmapDesc(currentRoadmap.description);
    setShowEditRoadmapModal(true);
  };

  // Save Edit Roadmap
  const handleSaveEditRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoadmap || !editRoadmapTitle.trim()) return;
    await updateRoadmap(currentRoadmap.id, {
      title: editRoadmapTitle.trim(),
      stack: editRoadmapStack.trim(),
      description: editRoadmapDesc.trim(),
    });
    setShowEditRoadmapModal(false);
  };

  // Open Markdown Editor
  const handleOpenMarkdownEditor = () => {
    if (!currentRoadmap) return;
    const md = exportRoadmapToMarkdown(currentRoadmap);
    setMarkdownEditorContent(md);
    setShowMarkdownEditorModal(true);
  };

  // Save Markdown Editor
  const handleSaveMarkdownEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoadmap || !markdownEditorContent.trim()) return;
    await updateRoadmapMarkdown(currentRoadmap.id, markdownEditorContent.trim());
    setShowMarkdownEditorModal(false);
  };

  // Quick replace 2027 -> 2026 inside markdown editor
  const handleQuickReplaceEditorYear = () => {
    let replaced = markdownEditorContent;
    replaced = replaced.replaceAll('2027', '2026');
    replaced = replaced.replaceAll('27-yil', '26-yil');
    replaced = replaced.replaceAll('27 yil', '26 yil');
    setMarkdownEditorContent(replaced);
    setHud("Matndagi '2027' yillari '2026' ga almashtirildi ✓");
  };

  // Open Edit Milestone
  const handleOpenEditMilestone = (ms: (typeof currentRoadmap.milestones)[0]) => {
    setEditingMilestone(ms);
    setEditMilestoneTitle(ms.title);
    setEditMilestoneDuration(ms.duration || '2–4 hafta');
    setEditMilestonePriority(ms.priority || 'Yuqori');
  };

  // Save Edit Milestone
  const handleSaveEditMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoadmap || !editingMilestone || !editMilestoneTitle.trim()) return;
    await updateMilestone(currentRoadmap.id, editingMilestone.id, {
      title: editMilestoneTitle.trim(),
      duration: editMilestoneDuration.trim(),
      priority: editMilestonePriority,
    });
    setEditingMilestone(null);
  };

  // Save Edit Topic
  const handleSaveEditTopic = async (milestoneId: string, topicId: string, newTitle: string) => {
    if (!currentRoadmap || !newTitle.trim()) return;
    await updateTopic(currentRoadmap.id, milestoneId, topicId, {
      title: newTitle.trim(),
    });
    setEditingTopic(null);
  };

  // Run Batch Year Replacer across all roadmaps
  const handleRunBatchYearReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchYearFrom.trim() || !batchYearTo.trim()) return;
    await batchReplaceYearInRoadmaps(batchYearFrom.trim(), batchYearTo.trim());
    setShowBatchYearModal(false);
  };

  // Run Daily Focus Sync
  const handleSyncDailyFocus = async () => {
    const count = await syncDailyRoadmapFocus(new Date());
    if (count > 0) {
      setHud(`AI: Bugungi kun uchun ${count} ta vazifa Home Focus blokiga qo'shildi! 🚀`);
    }
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
              <h1 className="text-[15px] font-bold text-white tracking-wide">
                {currentRoadmap?.title || "Dasturchi Yo‘l Xaritasi"}
              </h1>
              {currentRoadmap && (
                <button
                  onClick={handleOpenEditRoadmap}
                  className="rounded-lg p-1 text-zinc-400 hover:text-amber-300 hover:bg-white/[0.06] transition"
                  title="Yo‘l xaritasi nomini tahrirlash"
                >
                  <Pencil size={12} />
                </button>
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
                onClick={handleSyncDailyFocus}
                title="Barcha yo‘l xaritalarini skanerlab, bugungi kun maqsadlarini Home Focus joyiga chiqarish"
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-[12px] font-semibold text-rose-300 hover:bg-rose-500/25 transition shadow-sm"
              >
                <Sparkles size={13} className="text-rose-400 animate-pulse" />
                <span>Bugungi Fokus (AI Sync)</span>
              </button>

              <button
                onClick={handleOpenMarkdownEditor}
                title="Yo‘l xaritasini to‘liq Markdown matni ko‘rinishida tahrirlash (2027 larni 2026 qilish, maqsadlarni o‘zgartirish)"
                className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-[12px] font-medium text-purple-300 hover:bg-purple-500/20 transition"
              >
                <FileEdit size={13} />
                <span>.md Tahrirlash</span>
              </button>

              <button
                onClick={() => setShowBatchYearModal(true)}
                title="Barcha xaritalardagi '2027' yil yozuvlarini '2026' ga almashtirish"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <RefreshCw size={13} />
                <span>2027 → 2026</span>
              </button>

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
            <button
              onClick={() => setActiveTab('flashcards')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                activeTab === 'flashcards'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Brain size={13} className={dueCards.length > 0 ? 'text-amber-400 animate-pulse' : 'text-zinc-400'} />
              <span>Flashcards</span>
              {dueCards.length > 0 && (
                <span className="rounded-full bg-amber-500/30 text-amber-300 font-bold px-1.5 py-0.2 text-[10px]">
                  {dueCards.length}
                </span>
              )}
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

      {/* ── ROADMAPS SWITCHER TAB BAR (ALL UPLOADED ROADMAPS) ── */}
      {roadmaps.length > 0 && (
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0c0d12] px-6 py-2 overflow-x-auto scrollbar-thin shrink-0">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1.5">
            <BookOpen size={12} className="text-zinc-500" />
            Yo‘l Xaritalari ({roadmaps.length}):
          </span>
          {roadmaps.map((r) => {
            const isSelected = r.id === currentRoadmap?.id;
            const total = r.milestones.reduce((acc, m) => acc + m.topics.length, 0);
            const done = r.milestones.reduce((acc, m) => acc + m.topics.filter((t) => t.done).length, 0);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <button
                key={r.id}
                onClick={() => selectRoadmap(r.id)}
                className={`group flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] font-medium transition border shrink-0 ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/15 text-white font-semibold shadow-sm'
                    : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <TrendingUp size={13} className={isSelected ? 'text-amber-400' : 'text-zinc-500'} />
                <span className="max-w-[170px] truncate">{r.title}</span>
                <span
                  className={`text-[10px] font-mono rounded-md px-1.5 py-0.2 ${
                    isSelected ? 'bg-amber-500/25 text-amber-300' : 'bg-white/[0.04] text-zinc-500'
                  }`}
                >
                  {pct}% ({done}/{total})
                </span>
              </button>
            );
          })}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-xl border border-dashed border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-white hover:border-white/20 transition shrink-0"
            title="Yangi .md yo‘l xaritasi yuklash"
          >
            <Plus size={12} />
            <span>+ Yangi .md</span>
          </button>
        </div>
      )}

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

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-zinc-400">
                            {msDone}/{msTotal} o‘zlashtirildi
                          </span>
                          <button
                            onClick={() => handleOpenEditMilestone(ms)}
                            title="Bosqichni tahrirlash (nom, muddat, prioritet)"
                            className="p-1.5 text-zinc-400 hover:text-amber-300 hover:bg-white/[0.06] rounded-lg transition"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteMilestoneFromRoadmap(currentRoadmap.id, ms.id)}
                            title="Ushbu bosqichni o‘chirish"
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
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
                            {editingTopic?.topicId === topic.id ? (
                              <div
                                className="flex flex-1 items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={editingTopic.title}
                                  onChange={(e) =>
                                    setEditingTopic({ ...editingTopic, title: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditTopic(ms.id, topic.id, editingTopic.title);
                                    } else if (e.key === 'Escape') {
                                      setEditingTopic(null);
                                    }
                                  }}
                                  autoFocus
                                  className="flex-1 rounded-lg border border-amber-400/50 bg-black/80 px-2.5 py-1 text-[12px] text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveEditTopic(ms.id, topic.id, editingTopic.title)
                                  }
                                  className="rounded-md bg-amber-500 text-black px-2 py-1 text-[10.5px] font-bold hover:bg-amber-400 transition"
                                >
                                  Saqlash
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTopic(null)}
                                  className="rounded-md bg-white/10 text-zinc-300 px-2 py-1 text-[10.5px] hover:bg-white/20 transition"
                                >
                                  Bekor
                                </button>
                              </div>
                            ) : (
                              <>
                                <div
                                  onClick={() => toggleTopicDone(currentRoadmap.id, ms.id, topic.id)}
                                  className="flex flex-1 cursor-pointer items-start gap-2.5 select-none min-w-0"
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
                                  <span
                                    className={`text-[12.5px] leading-snug break-words ${
                                      topic.done ? 'line-through text-zinc-500' : 'text-zinc-200'
                                    }`}
                                  >
                                    {topic.title}
                                  </span>
                                </div>

                                {/* Topic action buttons */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                  {(() => {
                                    const topicCardCount = flashcards.filter(
                                      (c) =>
                                        c.topic_id === topic.id ||
                                        c.topic_title.toLowerCase() === topic.title.toLowerCase()
                                    ).length;
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGenerateTopicCards(topic.id, topic.title);
                                        }}
                                        disabled={generatingTopicId === topic.id}
                                        title="Ushbu mavzu bo‘yicha AI Flashcard (Quiz) tuzish yoki takrorlash"
                                        className="flex items-center gap-1 rounded bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30 transition disabled:opacity-50"
                                      >
                                        <Brain size={10} className={generatingTopicId === topic.id ? 'animate-spin' : ''} />
                                        <span>{topicCardCount > 0 ? `Quiz (${topicCardCount})` : 'Quiz'}</span>
                                      </button>
                                    );
                                  })()}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTopic({
                                        milestoneId: ms.id,
                                        topicId: topic.id,
                                        title: topic.title,
                                      });
                                    }}
                                    title="Mavzuni tahrirlash"
                                    className="p-1 text-zinc-400 hover:text-amber-300 hover:bg-white/[0.06] rounded transition"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTopicFromMilestone(currentRoadmap.id, ms.id, topic.id);
                                    }}
                                    title="Mavzuni o‘chirish"
                                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </>
                            )}
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
                      <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-[12px]">
                          <Sparkles size={13} /> AI Murabbiy Tahlili:
                        </div>
                        <FormattedAiText content={log.ai_feedback} />
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

                {(() => {
                  const displayFeedback = recentAiFeedback || learningLogs.find((l) => l.ai_feedback)?.ai_feedback || null;
                  return displayFeedback ? (
                    <div className="rounded-xl border border-white/10 bg-black/50 p-5 space-y-3">
                      <h4 className="text-[13px] font-bold text-purple-300 flex items-center gap-1.5">
                        <Sparkles size={14} /> Oxirgi Hisobotingiz Tahlili:
                      </h4>
                      <FormattedAiText content={displayFeedback} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-zinc-500 text-[13px]">
                      Hali yangi tahlil olinmadi. "Kunlik Check" bo‘limidan hisobot yuboring yoki savol bering.
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── TAB 4: FLASHCARDS & SPACED REPETITION ── */}
          {activeTab === 'flashcards' && (
            <div className="space-y-6">
              {/* 1. Header / Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[12px] font-medium">Jami Kartochkalar</span>
                    <Layers size={15} className="text-zinc-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white font-mono">
                    {roadmapFlashcards.length}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500 truncate">
                    {currentRoadmap ? currentRoadmap.title : 'Barcha xaritalar'}
                  </div>
                </div>

                {/* Due Today */}
                <div className={`rounded-2xl border p-4 transition ${
                  dueCards.length > 0
                    ? 'border-amber-500/40 bg-amber-500/[0.08] shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-medium ${dueCards.length > 0 ? 'text-amber-300' : 'text-zinc-400'}`}>
                      Bugun Takrorlash
                    </span>
                    <Calendar size={15} className={dueCards.length > 0 ? 'text-amber-400 animate-pulse' : 'text-zinc-500'} />
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white flex items-center gap-2">
                    <span>{dueCards.length}</span>
                    {dueCards.length > 0 && (
                      <span className="text-[10px] font-sans font-semibold rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5">
                        Kutilmoqda
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">
                    SM-2 intervali bo‘yicha
                  </div>
                </div>

                {/* Mature Cards */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[12px] font-medium">Mustahkamlangan</span>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white font-mono">
                    {matureCards.length}
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-400/80">
                    Interval &ge; 7 kun (Uzoq muddatli xotira)
                  </div>
                </div>

                {/* Ease factor */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[12px] font-medium">O‘rtacha Osonlik</span>
                    <TrendingUp size={15} className="text-sky-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white font-mono">
                    {roadmapFlashcards.length > 0
                      ? (roadmapFlashcards.reduce((acc, c) => acc + c.ease_factor, 0) / roadmapFlashcards.length).toFixed(2)
                      : '2.50'}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Standart SM-2: 2.50
                  </div>
                </div>
              </div>

              {/* 2. Mode & Actions bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/[0.06] py-3">
                {/* Mode Switcher */}
                <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/40 p-0.5">
                  <button
                    onClick={() => {
                      setStudyFilter('due');
                      setCurrentCardIndex(0);
                      setIsFlipped(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                      studyFilter === 'due'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Calendar size={13} /> Bugun kutilayotgan ({dueCards.length})
                  </button>
                  <button
                    onClick={() => {
                      setStudyFilter('all');
                      setCurrentCardIndex(0);
                      setIsFlipped(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                      studyFilter === 'all'
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Layers size={13} /> Barcha kartochkalar ({roadmapFlashcards.length})
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateAllRoadmapCards}
                    disabled={aiLoading || !currentRoadmap}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-[12px] font-semibold text-amber-300 transition disabled:opacity-50"
                  >
                    <Sparkles size={13} className={aiLoading ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                    <span>{aiLoading ? 'AI generatsiya qilmoqda...' : 'AI bilan kartochkalar yaratish'}</span>
                  </button>
                  <button
                    onClick={() => setShowManualCardModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white transition"
                  >
                    <Plus size={13} />
                    <span>Qo‘lda qo‘shish</span>
                  </button>
                </div>
              </div>

              {/* 3. Study Interactive Player (Flip Card) */}
              {activeStudyCards.length > 0 ? (
                (() => {
                  const currentCard = activeStudyCards[currentCardIndex] || activeStudyCards[0];
                  const currentResources = curatedResources[currentCard.topic_title] || [];
                  return (
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181922] to-[#121319] p-6 shadow-2xl space-y-5">
                      {/* Player Header */}
                      <div className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold px-2.5 py-1 text-[11px]">
                            ⚡ {currentCard.topic_title}
                          </span>
                          <span className="text-zinc-400">
                            Interval: <strong className="text-zinc-200">{currentCard.interval_days} kun</strong> · Takrorlash: <strong className="text-zinc-200">{currentCard.repetition_count}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-zinc-400">
                            {currentCardIndex + 1} / {activeStudyCards.length}
                          </span>
                          <button
                            onClick={() => {
                              setCurrentCardIndex((prev) => (prev > 0 ? prev - 1 : activeStudyCards.length - 1));
                              setIsFlipped(false);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-400 hover:text-white"
                          >
                            &larr; Oldingi
                          </button>
                          <button
                            onClick={() => {
                              setCurrentCardIndex((prev) => (prev + 1 < activeStudyCards.length ? prev + 1 : 0));
                              setIsFlipped(false);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-400 hover:text-white"
                          >
                            Keyingi &rarr;
                          </button>
                        </div>
                      </div>

                      {/* The 3D Flip Card Container */}
                      <div
                        onClick={() => setIsFlipped((prev) => !prev)}
                        className="group cursor-pointer select-none rounded-2xl border border-white/15 bg-black/40 p-6 sm:p-8 min-h-[220px] flex flex-col justify-between hover:border-amber-500/40 transition duration-300 shadow-inner"
                      >
                        {!isFlipped ? (
                          /* FRONT (SAVOL) */
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">
                              <span>❓ Savol (Front)</span>
                              <span className="text-amber-400/80 group-hover:text-amber-300 transition">
                                Javobni ko‘rish uchun bosing (Flip) &rarr;
                              </span>
                            </div>
                            <h3 className="text-[17px] sm:text-[19px] font-bold text-white leading-relaxed">
                              {currentCard.question}
                            </h3>
                            {currentCard.code_snippet && (
                              <div className="mt-3 rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-[12px] text-emerald-300 overflow-x-auto">
                                <pre>{currentCard.code_snippet}</pre>
                              </div>
                            )}
                            <div className="pt-2 text-center">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-1.5 text-[12px] text-zinc-400 group-hover:text-white group-hover:bg-amber-500/20 group-hover:text-amber-300 transition">
                                <RotateCcw size={13} />
                                <span>Javobni ochish (Aylantirish)</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* BACK (JAVOB VA TUSHUNTIRISH) */
                          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold">
                              <span className="text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 size={13} /> Javob & Tushuntirish
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsFlipped(false)}
                                className="text-zinc-500 hover:text-zinc-300 text-[11px] underline"
                              >
                                Savolga qaytish &larr;
                              </button>
                            </div>

                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                              <p className="text-[14px] sm:text-[15px] font-medium text-emerald-200 leading-relaxed">
                                {currentCard.answer}
                              </p>
                            </div>

                            {currentCard.explanation && (
                              <div className="text-[13px] text-zinc-300 leading-relaxed pl-1">
                                <strong className="text-white">Izoh: </strong>
                                {currentCard.explanation}
                              </div>
                            )}

                            {/* Curated Resources */}
                            {currentResources.length > 0 && (
                              <div className="pt-2 border-t border-white/[0.08]">
                                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                                  📚 Rasmiy manbalar va tavsiyalar:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {currentResources.map((res, idx) => (
                                    <a
                                      key={idx}
                                      href={res.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-500/10 hover:border-sky-500/30 transition"
                                    >
                                      <span>{res.title}</span>
                                      <ExternalLink size={10} />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* SM-2 Rating Evaluation Buttons */}
                      {isFlipped && (
                        <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-3">
                          <div className="flex items-center justify-between text-[12px] text-zinc-400">
                            <span>Ushbu mavzuni qanchalik yaxshi esladingiz? (SM-2 algoritmi)</span>
                            <span className="text-[11px] text-zinc-500">Keyingi takrorlash sanasi avtomatik hisoblanadi</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <button
                              onClick={() => handleReviewCard(1)}
                              className="flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 p-3 hover:bg-red-500/20 hover:border-red-500/50 transition group"
                            >
                              <span className="text-[14px] font-bold text-red-400 group-hover:scale-105 transition">
                                🔴 Qiyin (Again)
                              </span>
                              <span className="text-[11px] text-zinc-400 mt-0.5">
                                Ertaga qayta takrorlash (1 kun)
                              </span>
                            </button>

                            <button
                              onClick={() => handleReviewCard(2)}
                              className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 hover:bg-amber-500/20 hover:border-amber-500/50 transition group"
                            >
                              <span className="text-[14px] font-bold text-amber-300 group-hover:scale-105 transition">
                                🟡 Yaxshi (Good)
                              </span>
                              <span className="text-[11px] text-zinc-400 mt-0.5">
                                Normal intervalli surilish
                              </span>
                            </button>

                            <button
                              onClick={() => handleReviewCard(3)}
                              className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition group"
                            >
                              <span className="text-[14px] font-bold text-emerald-400 group-hover:scale-105 transition">
                                🟢 Oson (Easy)
                              </span>
                              <span className="text-[11px] text-zinc-400 mt-0.5">
                                Tezkor progress + Ease bonus
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                /* Empty State when no cards due */
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-10 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                    <Brain size={28} />
                  </div>
                  <h3 className="text-[16px] font-bold text-white">
                    {studyFilter === 'due'
                      ? '🎉 Bugungi barcha kartochkalar takrorlandi!'
                      : 'Hozircha flashcardlar mavjud emas'}
                  </h3>
                  <p className="mx-auto max-w-md text-[13px] text-zinc-400">
                    {studyFilter === 'due'
                      ? 'Ajoyib natija! Bugungi kutilgan barcha savol-javoblar xotirada mustahkamlandi. Barcha kartochkalarni ko‘rish yoki yangilarini generatsiya qilish mumkin.'
                      : 'Yo‘l xaritasidagi mavzular asosida AI avtomatik tarzda professional texnik savol-javob kartochkalarini tuzib beradi.'}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    {studyFilter === 'due' && roadmapFlashcards.length > 0 && (
                      <button
                        onClick={() => {
                          setStudyFilter('all');
                          setCurrentCardIndex(0);
                          setIsFlipped(false);
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-[12.5px] font-medium text-white transition"
                      >
                        Barcha kartochkalarni ko‘rish ({roadmapFlashcards.length})
                      </button>
                    )}
                    <button
                      onClick={handleGenerateAllRoadmapCards}
                      disabled={aiLoading || !currentRoadmap}
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-[12.5px] font-semibold text-white shadow-lg hover:brightness-110 transition disabled:opacity-50"
                    >
                      {aiLoading ? 'Generatsiya qilinmoqda...' : '✨ AI bilan kartochkalar yaratish'}
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Full Cards Catalog & Manager */}
              {roadmapFlashcards.length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-amber-400" />
                      <h4 className="text-[14px] font-bold text-white">
                        Kartochkalar Ro‘yxati ({filteredCardsCatalog.length})
                      </h4>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={cardSearchQuery}
                        onChange={(e) => setCardSearchQuery(e.target.value)}
                        placeholder="Qidiruv (mavzu, savol)..."
                        className="w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 py-1.5 text-[12px] text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredCardsCatalog.map((card) => {
                      const isDue = card.next_review_date <= new Date().toISOString().split('T')[0];
                      return (
                        <div
                          key={card.id}
                          className="group flex items-start justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3 hover:border-white/10 hover:bg-white/[0.03] transition"
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="font-semibold text-amber-300 rounded bg-amber-500/10 px-2 py-0.5">
                                {card.topic_title}
                              </span>
                              <span className="text-zinc-500">
                                Keyingi takrorlash: <strong className={isDue ? 'text-amber-400' : 'text-zinc-400'}>{card.next_review_date}</strong>
                              </span>
                              <span className="text-zinc-500">
                                Interval: {card.interval_days} kun (Ease: {card.ease_factor})
                              </span>
                            </div>
                            <div className="text-[13px] font-medium text-white line-clamp-2">
                              {card.question}
                            </div>
                            <div className="text-[12px] text-zinc-400 line-clamp-1">
                              {card.answer}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pt-1">
                            <button
                              onClick={() => {
                                const idx = activeStudyCards.findIndex((c) => c.id === card.id);
                                if (idx !== -1) {
                                  setCurrentCardIndex(idx);
                                  setIsFlipped(false);
                                } else {
                                  setStudyFilter('all');
                                  const allIdx = roadmapFlashcards.findIndex((c) => c.id === card.id);
                                  setCurrentCardIndex(allIdx !== -1 ? allIdx : 0);
                                  setIsFlipped(false);
                                }
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              title="Ushbu kartochkani hozir takrorlash"
                              className="rounded-lg border border-white/10 bg-white/5 hover:bg-amber-500/20 hover:border-amber-500/30 px-2.5 py-1 text-[11px] font-medium text-amber-300 transition"
                            >
                              Ochish
                            </button>
                            <button
                              onClick={() => deleteFlashcard(card.id)}
                              title="Kartochkani o‘chirish"
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

      {/* ── MODAL 5: EDIT ROADMAP TITLE & STACK ── */}
      {showEditRoadmapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171f] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                <Pencil size={16} className="text-amber-400" />
                Yo‘l xaritasi ma’lumotlarini tahrirlash
              </h3>
              <button
                onClick={() => setShowEditRoadmapModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditRoadmap} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Nomi (Title)
                </label>
                <input
                  type="text"
                  value={editRoadmapTitle}
                  onChange={(e) => setEditRoadmapTitle(e.target.value)}
                  placeholder="Masalan: Python Backend Track yoki Vue 3"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Texnologiyalar steki (Stack)
                </label>
                <input
                  type="text"
                  value={editRoadmapStack}
                  onChange={(e) => setEditRoadmapStack(e.target.value)}
                  placeholder="Masalan: Spring Boot → Go → System Design"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Tavsif (Description)
                </label>
                <textarea
                  rows={3}
                  value={editRoadmapDesc}
                  onChange={(e) => setEditRoadmapDesc(e.target.value)}
                  placeholder="Ushbu yo‘l xaritasi haqida qisqacha ma’lumot..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowEditRoadmapModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 hover:bg-amber-500 px-5 py-2 text-[12.5px] font-semibold text-white shadow-lg transition"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 6: FULL MARKDOWN EDITOR MODAL ── */}
      {showMarkdownEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileEdit size={18} className="text-purple-400" />
                <h3 className="text-[15px] font-bold text-white">
                  Markdown Tahrirlash — {currentRoadmap?.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickReplaceEditorYear}
                  title="Ushbu matndagi barcha 2027 yillarini 2026 ga o‘zgartirish"
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <RefreshCw size={12} />
                  <span>2027 → 2026</span>
                </button>
                <button
                  onClick={() => setShowMarkdownEditorModal(false)}
                  className="text-zinc-500 hover:text-white p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <p className="text-[12px] text-zinc-400">
              Yo‘l xaritasining Markdown manbasini to‘liq tahrirlashingiz, yillarni o‘zgartirishingiz yoki yangi maqsadlar qo‘shishingiz mumkin.
            </p>

            <form onSubmit={handleSaveMarkdownEditor} className="space-y-4">
              <textarea
                rows={16}
                value={markdownEditorContent}
                onChange={(e) => setMarkdownEditorContent(e.target.value)}
                className="w-full font-mono text-[12.5px] rounded-xl border border-white/10 bg-black/60 p-4 text-zinc-100 placeholder:text-zinc-600 focus:border-purple-400 focus:outline-none resize-y leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <span className="text-[11px] text-zinc-500">
                  Format: # Sarlavha · ### Bosqich · - [ ] Mavzu
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMarkdownEditorModal(false)}
                    className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2 text-[12.5px] font-semibold text-white shadow-lg transition"
                  >
                    Saqlash va Yangilash
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 7: EDIT MILESTONE (TITLE, DURATION, PRIORITY) ── */}
      {editingMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171f] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                <Pencil size={16} className="text-amber-400" />
                Bosqich ma’lumotlarini tahrirlash
              </h3>
              <button
                onClick={() => setEditingMilestone(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditMilestone} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Bosqich Nomi *
                </label>
                <input
                  type="text"
                  value={editMilestoneTitle}
                  onChange={(e) => setEditMilestoneTitle(e.target.value)}
                  placeholder="Masalan: 1. Asosiy Mavzular (2026-yil)"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Taxminiy Muddat
                  </label>
                  <input
                    type="text"
                    value={editMilestoneDuration}
                    onChange={(e) => setEditMilestoneDuration(e.target.value)}
                    placeholder="2–4 hafta"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Prioritet
                  </label>
                  <select
                    value={editMilestonePriority}
                    onChange={(e) => setEditMilestonePriority(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#121318] px-3 py-2 text-[13px] text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Yuqori">🔥 Yuqori</option>
                    <option value="O‘rta">⚡ O‘rta</option>
                    <option value="Boshlang‘ich">🌱 Boshlang‘ich</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditingMilestone(null)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 hover:bg-amber-500 px-5 py-2 text-[12.5px] font-semibold text-white shadow-lg transition"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 8: BATCH YEAR REPLACER (ALL ROADMAPS) ── */}
      {showBatchYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#121518] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                <RefreshCw size={16} className="text-emerald-400" />
                Yillarni Almashtirish (Barcha Yo‘l Xaritalari)
              </h3>
              <button
                onClick={() => setShowBatchYearModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-[12.5px] text-zinc-300 leading-relaxed">
              Mavjud barcha ({roadmaps.length} ta) yo‘l xaritalaringizdagi yillarni bir zumda almashtiring (masalan, 2027-yil deb belgilangan rejalarni 2026-yil qilish).
            </p>

            <form onSubmit={handleRunBatchYearReplace} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Eski Yil (From)
                  </label>
                  <input
                    type="text"
                    value={batchYearFrom}
                    onChange={(e) => setBatchYearFrom(e.target.value)}
                    placeholder="2027"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Yangi Yil (To)
                  </label>
                  <input
                    type="text"
                    value={batchYearTo}
                    onChange={(e) => setBatchYearTo(e.target.value)}
                    placeholder="2026"
                    className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300 focus:border-emerald-400 focus:outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowBatchYearModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-[12.5px] font-semibold text-white shadow-lg transition"
                >
                  Barcha Xaritalarda Almashtirish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 7: MANUAL FLASHCARD MODAL ── */}
      {showManualCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-amber-400" />
                <h3 className="text-[15px] font-bold text-white">Yangi Flashcard Qo‘shish</h3>
              </div>
              <button onClick={() => setShowManualCardModal(false)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!manualCardQuestion.trim() || !manualCardAnswer.trim()) return;
                const todayIso = new Date().toISOString().split('T')[0];
                await addFlashcards([
                  {
                    roadmap_id: currentRoadmap?.id || 'manual',
                    topic_title: manualCardTopicTitle.trim() || currentRoadmap?.title || 'Umumiy Mavzu',
                    question: manualCardQuestion.trim(),
                    answer: manualCardAnswer.trim(),
                    explanation: manualCardExplanation.trim() || undefined,
                    code_snippet: manualCardCode.trim() || undefined,
                    interval_days: 1,
                    repetition_count: 0,
                    ease_factor: 2.5,
                    next_review_date: todayIso,
                  },
                ]);
                setShowManualCardModal(false);
                setManualCardQuestion('');
                setManualCardAnswer('');
                setManualCardExplanation('');
                setManualCardCode('');
                setManualCardTopicTitle('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Mavzu / Texnologiya Nomi *
                </label>
                <input
                  type="text"
                  required
                  value={manualCardTopicTitle}
                  onChange={(e) => setManualCardTopicTitle(e.target.value)}
                  placeholder="Masalan: Goroutines & Channels"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Savol *
                </label>
                <textarea
                  required
                  rows={2}
                  value={manualCardQuestion}
                  onChange={(e) => setManualCardQuestion(e.target.value)}
                  placeholder="Texnik savol matnini kiriting..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Javob *
                </label>
                <textarea
                  required
                  rows={2}
                  value={manualCardAnswer}
                  onChange={(e) => setManualCardAnswer(e.target.value)}
                  placeholder="Aniq va lo‘nda javob..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Izoh / Tushuntirish (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={manualCardExplanation}
                  onChange={(e) => setManualCardExplanation(e.target.value)}
                  placeholder="Qo‘shimcha arxitektura yoki ishlash mexanizmi..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                  Kod Namunasi (Ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  value={manualCardCode}
                  onChange={(e) => setManualCardCode(e.target.value)}
                  placeholder="// Misol kod..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-mono text-emerald-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowManualCardModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-[12.5px] font-semibold text-black transition"
                >
                  Kartochkani Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
