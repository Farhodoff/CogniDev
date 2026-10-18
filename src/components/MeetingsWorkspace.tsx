import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import {
  Mic,
  Play,
  Pause,
  Sparkles,
  Settings,
  Upload,
  CheckCircle2,
  ListTodo,
  FileText,
  Trash2,
  Copy,
  Volume2,
  VolumeX,
  MessageSquare,
  Clock,
  Calendar,
  Search,
  Plus,
  X,
  ShieldCheck,
  Activity,
  Check,
  FolderPlus,
  Send,
  Loader2,
  Headphones,
  Radio,
  FileAudio,
  AlertCircle,
  Download,
  Globe,
  Edit3,
  Tag,
  Layers,
  Briefcase,
  ChevronDown,
  User,
  Flag,
  Share2,
  Monitor,
  BarChart3,
  Users,
  Archive,
  ArchiveRestore,
  CheckSquare,
  Square,
  BookOpen,
} from 'lucide-react';
import { useSynapse, nextTaskId } from '../lib/store';
import type { MeetingItem, MeetingActionItem, MeetingAiConfig, TaskPriority } from '../lib/types';
import {
  getMeetingAiConfig,
  saveMeetingAiConfig,
  analyzeMeetingWithAi,
  askMeetingQuestion,
  exportMeetingToMarkdown,
  exportMeetingToTelegram,
  exportMeetingToSlack,
  exportMeetingToPlainText,
  downloadTextFile,
  MEETING_TEMPLATES,
  getMeetingTemplate,
  type MeetingTemplateId,
  diarizeTranscriptWithAi,
  renameSpeakerInTranscript,
  speakText,
} from '../lib/meetings';
import {
  blobToWav16k,
  pickAudioMime,
  transcribeAudioDetailed,
  downloadAudioFile,
  createLiveSpeechRecognizer,
  requestMicrophoneStream,
  requestScreenAudioStream,
  mixAudioStreams,
  openMicSettings,
  resetMicPermission,
  type SttLanguage,
  type AudioSourceOption,
} from '../lib/stt';
import {
  persistMeetingAudio,
  resolveMeetingAudioUrl,
  deleteMeetingAudio,
} from '../lib/audioDb';

export default function MeetingsWorkspace() {
  const {
    meetings,
    selectedMeetingId,
    setSelectedMeetingId,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    toggleMeetingActionDone,
    addTask,
    selectTask,
    selectNote,
    createNote,
    updateNoteDoc,
    setHud,
    tasks,
    setMainView,
    addScheduleBlock,
    scheduleBlocks,
    spaces,
    activeProjects,
  } = useSynapse();

  // Sync selected meeting with store
  useEffect(() => {
    if (!selectedMeetingId && meetings.length > 0) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [selectedMeetingId, meetings, setSelectedMeetingId]);

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) ?? meetings[0] ?? null,
    [meetings, selectedMeetingId]
  );

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'analyzed' | 'audio_only' | 'archived'>('all');
  const [spaceFilter, setSpaceFilter] = useState<string>('all');

  // Active Tab in Detail View
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'chat'>('summary');

  // Modals & Panels
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Batch Selection Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Set<string>>(new Set());

  // Click-to-Seek Audio Sync
  const [seekTarget, setSeekTarget] = useState<{ time: number; nonce: number } | null>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(0);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsControllerRef = useRef<{ stop: () => void } | null>(null);

  // Meeting Chat Q&A State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Assalomu alaykum! Ushbu uchrashuv transkripti bo‘yicha istalgan savolingizni bering. Masalan: "Kimga qanday vazifa yuklatildi?" yoki "Qanday qarorlar qabul qilindi?"',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // AI Re-analysis status
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // ── Manual Content Editing States ──────────────────────────
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  const [isAddingDecision, setIsAddingDecision] = useState(false);
  const [newDecisionDraft, setNewDecisionDraft] = useState('');
  const [editingDecisionIdx, setEditingDecisionIdx] = useState<number | null>(null);
  const [editDecisionDraft, setEditDecisionDraft] = useState('');

  const [isAddingAction, setIsAddingAction] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');
  const [newActionPriority, setNewActionPriority] = useState<TaskPriority>('Normal');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editActionText, setEditActionText] = useState('');
  const [editActionAssignee, setEditActionAssignee] = useState('');
  const [editActionPriority, setEditActionPriority] = useState<TaskPriority>('Normal');
  const [editActionDueDate, setEditActionDueDate] = useState('');

  const [isAddingTakeaway, setIsAddingTakeaway] = useState(false);
  const [newTakeawayDraft, setNewTakeawayDraft] = useState('');
  const [editingTakeawayIdx, setEditingTakeawayIdx] = useState<number | null>(null);
  const [editTakeawayDraft, setEditTakeawayDraft] = useState('');

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Reset editing states whenever selected meeting changes
  useEffect(() => {
    setIsEditingSummary(false);
    setIsAddingDecision(false);
    setEditingDecisionIdx(null);
    setIsAddingAction(false);
    setEditingActionId(null);
    setIsAddingTakeaway(false);
    setEditingTakeawayIdx(null);
    setIsAddingTag(false);
  }, [selectedMeetingId]);

  // Deferred Search for fast non-blocking filtering of meetings
  const deferredSearch = useDeferredValue(search);

  // Filtered Meetings list
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const isArchived = m.tags?.includes('archived');
      if (filterMode === 'archived') {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
        if (filterMode === 'analyzed' && m.mode !== 'analyzed') return false;
        if (filterMode === 'audio_only' && m.mode !== 'audio_only') return false;
      }
      if (spaceFilter !== 'all') {
        if (spaceFilter === 'none' && m.space_id) return false;
        if (spaceFilter !== 'none' && m.space_id !== spaceFilter) return false;
      }
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchTranscript = m.transcript.toLowerCase().includes(q);
        const matchSummary = (m.summary || '').toLowerCase().includes(q);
        const matchTag = m.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchTranscript && !matchSummary && !matchTag) return false;
      }
      return true;
    });
  }, [meetings, filterMode, spaceFilter, deferredSearch]);

  // Handle TTS
  const handleToggleTts = () => {
    if (isSpeaking) {
      ttsControllerRef.current?.stop();
      setIsSpeaking(false);
    } else {
      if (!selectedMeeting?.summary) return;
      setIsSpeaking(true);
      ttsControllerRef.current = speakText(
        selectedMeeting.summary,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    }
  };

  // ── Manual Decision Management Handlers ───────────────────
  const handleAddDecision = () => {
    if (!selectedMeeting || !newDecisionDraft.trim()) return;
    const nextDecisions = [...(selectedMeeting.decisions || []), newDecisionDraft.trim()];
    updateMeeting(selectedMeeting.id, { decisions: nextDecisions });
    setNewDecisionDraft('');
    setIsAddingDecision(false);
    setHud("Yangi qaror qo‘shildi ✓");
  };

  const handleSaveEditDecision = (idx: number) => {
    if (!selectedMeeting || !editDecisionDraft.trim()) return;
    const nextDecisions = (selectedMeeting.decisions || []).map((d, i) => (i === idx ? editDecisionDraft.trim() : d));
    updateMeeting(selectedMeeting.id, { decisions: nextDecisions });
    setEditingDecisionIdx(null);
    setEditDecisionDraft('');
    setHud("Qaror tahrirlandi ✓");
  };

  const handleDeleteDecision = (idx: number) => {
    if (!selectedMeeting) return;
    const nextDecisions = (selectedMeeting.decisions || []).filter((_, i) => i !== idx);
    updateMeeting(selectedMeeting.id, { decisions: nextDecisions });
    setHud("Qaror ro‘yxatdan o‘chirildi");
  };

  // ── Manual Action Items Management Handlers ───────────────
  const handleSaveNewAction = () => {
    if (!selectedMeeting || !newActionText.trim()) return;
    const newAction: MeetingActionItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: newActionText.trim(),
      assignee: newActionAssignee.trim() || 'Jamoa',
      priority: newActionPriority,
      due_date: newActionDueDate.trim() || undefined,
      added_to_tasks: false,
      completed: false,
    };
    updateMeeting(selectedMeeting.id, {
      action_items: [...(selectedMeeting.action_items || []), newAction],
    });
    setNewActionText('');
    setNewActionAssignee('');
    setNewActionPriority('Normal');
    setNewActionDueDate('');
    setIsAddingAction(false);
    setHud("Yangi topshiriq qo‘shildi ✓");
  };

  const handleStartEditAction = (act: MeetingActionItem) => {
    setEditingActionId(act.id);
    setEditActionText(act.text);
    setEditActionAssignee(act.assignee || '');
    setEditActionPriority(act.priority || 'Normal');
    setEditActionDueDate(act.due_date || '');
  };

  const handleSaveEditAction = (actionId: string) => {
    if (!selectedMeeting || !editActionText.trim()) return;
    const nextActions = (selectedMeeting.action_items || []).map((a) => {
      if (a.id === actionId) {
        return {
          ...a,
          text: editActionText.trim(),
          assignee: editActionAssignee.trim() || 'Jamoa',
          priority: editActionPriority,
          due_date: editActionDueDate.trim() || undefined,
        };
      }
      return a;
    });
    updateMeeting(selectedMeeting.id, { action_items: nextActions });
    setEditingActionId(null);
    setHud("Topshiriq yangilandi ✓");
  };

  const handleDeleteAction = (actionId: string) => {
    if (!selectedMeeting) return;
    const nextActions = (selectedMeeting.action_items || []).filter((a) => a.id !== actionId);
    updateMeeting(selectedMeeting.id, { action_items: nextActions });
    setHud("Topshiriq o‘chirildi");
  };

  // ── Manual Takeaways Management Handlers ──────────────────
  const handleAddTakeaway = () => {
    if (!selectedMeeting || !newTakeawayDraft.trim()) return;
    const next = [...(selectedMeeting.key_takeaways || []), newTakeawayDraft.trim()];
    updateMeeting(selectedMeeting.id, { key_takeaways: next });
    setNewTakeawayDraft('');
    setIsAddingTakeaway(false);
    setHud("Yangi xulosa qo‘shildi ✓");
  };

  const handleSaveEditTakeaway = (idx: number) => {
    if (!selectedMeeting || !editTakeawayDraft.trim()) return;
    const next = (selectedMeeting.key_takeaways || []).map((t, i) => (i === idx ? editTakeawayDraft.trim() : t));
    updateMeeting(selectedMeeting.id, { key_takeaways: next });
    setEditingTakeawayIdx(null);
    setEditTakeawayDraft('');
    setHud("Xulosa yangilandi ✓");
  };

  const handleDeleteTakeaway = (idx: number) => {
    if (!selectedMeeting) return;
    const next = (selectedMeeting.key_takeaways || []).filter((_, i) => i !== idx);
    updateMeeting(selectedMeeting.id, { key_takeaways: next });
    setHud("Xulosa o‘chirildi");
  };

  // Convert Action Item to CogniDev Task with bidirectional sync
  const handleAddActionItemToTasks = (action: MeetingActionItem) => {
    if (!selectedMeeting) return;
    const newId = nextTaskId(tasks);
    addTask({
      id: newId,
      workspace_id: 'default',
      space_id: selectedMeeting.space_id ?? null,
      title: action.text,
      status: action.completed ? 'completed' : 'active',
      priority: action.priority ?? 'High Priority',
      git_branch: null,
      pr_url: null,
      ai_source: `Meeting: ${selectedMeeting.title}`,
      assignee_name: action.assignee ?? 'Jamoa',
      assignee_avatar: null,
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['meeting', ...selectedMeeting.tags],
      due_time: action.due_date ?? null,
      reminder_enabled: !!action.due_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Mark as added in meeting with bidirectional link
    const updatedActionItems = (selectedMeeting.action_items || []).map((a) =>
      a.id === action.id ? { ...a, added_to_tasks: true, task_id: newId, completed: !!a.completed } : a
    );
    updateMeeting(selectedMeeting.id, { action_items: updatedActionItems });
    setHud(`Vazifa Tasks doskasiga ulandi: #${newId} ✓`);
  };

  // Export to Notion Notes with bidirectional link
  const handleExportToNotes = async () => {
    if (!selectedMeeting) return;
    const md = exportMeetingToMarkdown(selectedMeeting);
    const newNoteId = await createNote(selectedMeeting.title);
    await updateNoteDoc(newNoteId, { content: md });
    updateMeeting(selectedMeeting.id, { note_id: newNoteId });
    setHud(`"${selectedMeeting.title}" qaydlar (Notes) bo‘limiga saqlandi ✓`);
  };

  // Open linked note in Notion Notes
  const handleOpenLinkedNote = (noteId: string) => {
    selectNote(noteId);
    setMainView('notes');
  };

  // Calendar sync
  const isScheduledInCalendar = useMemo(() => {
    if (!selectedMeeting) return false;
    return scheduleBlocks.some((b) => b.meeting_id === selectedMeeting.id) || !!selectedMeeting.calendar_block_id;
  }, [scheduleBlocks, selectedMeeting]);

  const handleAddToCalendar = () => {
    if (!selectedMeeting) return;
    const now = new Date();
    const startH = String(now.getHours()).padStart(2, '0');
    const endH = String(Math.min(23, now.getHours() + 1)).padStart(2, '0');
    const timeRange = `${startH}:00 - ${endH}:00`;
    const newBlockId = 'sch-' + Date.now();
    addScheduleBlock({
      title: `🎙️ ${selectedMeeting.title}`,
      time_range: timeRange,
      category: 'work',
      tag: '#Meeting',
      color: '#8b5cf6',
      done: false,
      meeting_id: selectedMeeting.id,
    });
    updateMeeting(selectedMeeting.id, { calendar_block_id: newBlockId });
    setHud(`"${selectedMeeting.title}" taqvim jadvaliga biriktirildi ✓`);
  };

  // Copy Markdown
  const handleCopyMarkdown = () => {
    if (!selectedMeeting) return;
    const md = exportMeetingToMarkdown(selectedMeeting);
    navigator.clipboard.writeText(md);
    setHud("Uchrashuv xulosasi Markdown formatida ko‘chirildi ✓");
  };

  // Re-analyze with AI & Template
  const handleReanalyzeWithTemplate = async (templateId: MeetingTemplateId = 'general') => {
    if (!selectedMeeting || isReanalyzing) return;
    setIsTemplatePickerOpen(false);
    setIsReanalyzing(true);
    const tmpl = getMeetingTemplate(templateId);
    setHud(`AI uchrashuvni "${tmpl.label}" shablonida qayta tahlil qilmoqda...`);
    try {
      const res = await analyzeMeetingWithAi(selectedMeeting.transcript, undefined, templateId);
      const cleanTags = (selectedMeeting.tags || []).filter(
        (t) => !MEETING_TEMPLATES.some((m) => m.id === t)
      );
      updateMeeting(selectedMeeting.id, {
        summary: res.summary,
        decisions: res.decisions,
        action_items: res.action_items,
        key_takeaways: res.key_takeaways,
        ai_provider: res.providerUsed,
        ai_model: res.modelUsed,
        tags: [...cleanTags, templateId],
        mode: 'analyzed',
      });
      setHud(`"${tmpl.label}" shabloni bo‘yicha tahlil yangilandi ✓`);
    } catch {
      setHud("Tahlilda xatolik yuz berdi");
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Handle Q&A Chat Submit
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedMeeting || isChatLoading) return;
    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: question }]);
    setIsChatLoading(true);

    try {
      const ans = await askMeetingQuestion(selectedMeeting.transcript, question, selectedMeeting);
      setChatMessages((prev) => [...prev, { role: 'assistant', text: ans }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Kechirasiz, savolingizga javob olishda xatolik yuz berdi.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Delete Meeting
  const handleDeleteMeeting = (id: string) => {
    if (confirm("Haqiqatan ham ushbu uchrashuv yozuvini o'chirmoqchimisiz?")) {
      const target = meetings.find((m) => m.id === id);
      if (target) deleteMeetingAudio(target);
      deleteMeeting(id);
      if (selectedMeetingId === id) {
        setSelectedMeetingId(meetings.find((m) => m.id !== id)?.id ?? null);
      }
      setHud("Uchrashuv o'chirildi");
    }
  };

  // Upload Audio File
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setHud("Audio fayl yuklanmoqda va Rubai STT orqali transkripsiya qilinmoqda...");

    try {
      const meetId = `meet-${Date.now()}`;
      const { audio_path, audio_url: persistedUrl } = await persistMeetingAudio(meetId, file, 'wav');
      const wav = await blobToWav16k(file);
      const sttRes = await transcribeAudioDetailed(wav, 'auto');
      const text = sttRes.text;
      const detectedLang = sttRes.detectedLang || 'uz';

      const newMeeting: MeetingItem = {
        id: meetId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        date: new Date().toISOString(),
        duration: Math.round(file.size / 32000) || 60,
        language: detectedLang,
        mode: text ? 'analyzed' : 'audio_only',
        audio_url: persistedUrl,
        audio_path: audio_path,
        transcript: text || 'Audio fayldan so‘z aniqlanmadi (yoki fon musiqasi).',
        tags: ['uploaded', 'audio', detectedLang],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (text) {
        setHud("AI orqali uchrashuv xulosasi chiqarilmoqda...");
        const aiRes = await analyzeMeetingWithAi(text);
        newMeeting.summary = aiRes.summary;
        newMeeting.decisions = aiRes.decisions;
        newMeeting.action_items = aiRes.action_items;
        newMeeting.key_takeaways = aiRes.key_takeaways;
        newMeeting.ai_provider = aiRes.providerUsed;
        newMeeting.ai_model = aiRes.modelUsed;
      }

      addMeeting(newMeeting);
      setSelectedMeetingId(newMeeting.id);
      setHud(`Audio yuklandi va tahlil qilindi ✓ (${detectedLang.toUpperCase()})`);
    } catch (err: any) {
      alert(`Xatolik: ${err instanceof Error ? err.message : 'Audio yuklashda xatolik yuz berdi'}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Active vs Archived meeting counts
  const activeMeetingsCount = useMemo(
    () => meetings.filter((m) => !m.tags?.includes('archived')).length,
    [meetings]
  );
  const archivedMeetingsCount = useMemo(
    () => meetings.filter((m) => m.tags?.includes('archived')).length,
    [meetings]
  );

  // ── Batch Operations Handlers ──────────────────────────────
  const handleToggleSelectMeeting = (id: string) => {
    setSelectedMeetingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMeetingIds.size === filteredMeetings.length) {
      setSelectedMeetingIds(new Set());
    } else {
      setSelectedMeetingIds(new Set(filteredMeetings.map((m) => m.id)));
    }
  };

  const handleBatchArchive = (archive: boolean) => {
    if (selectedMeetingIds.size === 0) return;
    selectedMeetingIds.forEach((id) => {
      const target = meetings.find((m) => m.id === id);
      if (!target) return;
      const currentTags = target.tags || [];
      const newTags = archive
        ? Array.from(new Set([...currentTags, 'archived']))
        : currentTags.filter((t) => t !== 'archived');
      updateMeeting(id, { tags: newTags });
    });
    setHud(`${selectedMeetingIds.size} ta uchrashuv ${archive ? 'arxivlandi' : 'arxivdan chiqarildi'} 📦`);
    setSelectedMeetingIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedMeetingIds.size === 0) return;
    if (!window.confirm(`${selectedMeetingIds.size} ta uchrashuvni butunlay o‘chirib tashlamoqchimisiz?`)) {
      return;
    }
    const count = selectedMeetingIds.size;
    for (const id of Array.from(selectedMeetingIds)) {
      deleteMeeting(id);
      await deleteMeetingAudio(id).catch(() => {});
    }
    setSelectedMeetingIds(new Set());
    setHud(`${count} ta uchrashuv o‘chirildi ✓`);
  };

  const handleBatchExport = () => {
    if (selectedMeetingIds.size === 0) return;
    const selectedList = meetings.filter((m) => selectedMeetingIds.has(m.id));
    let exportText = `====================================================\n`;
    exportText += `CogniDev Uchrashuvlar Ommaviy Eksporti (${selectedList.length} ta)\n`;
    exportText += `Sana: ${new Date().toLocaleString('uz-UZ')}\n`;
    exportText += `====================================================\n\n`;

    selectedList.forEach((m, idx) => {
      exportText += `### [${idx + 1}] ${m.title}\n`;
      exportText += `Sana: ${new Date(m.date).toLocaleString('uz-UZ')} | Davomiyligi: ${Math.floor(m.duration / 60)} daq ${m.duration % 60} son\n`;
      if (m.summary) {
        exportText += `\n📌 AI Konspekt:\n${m.summary}\n`;
      }
      if (m.action_items && m.action_items.length > 0) {
        exportText += `\n✅ Topshiriqlar (${m.action_items.length} ta):\n`;
        m.action_items.forEach((a) => {
          exportText += `  - [${a.completed ? 'x' : ' '}] ${a.text} (Mas'ul: ${a.assignee || 'Jamoa'}${a.due_date ? ', Muddat: ' + a.due_date : ''})\n`;
        });
      }
      if (m.decisions && m.decisions.length > 0) {
        exportText += `\n💡 Asosiy Qarorlar:\n`;
        m.decisions.forEach((d) => {
          exportText += `  • ${d}\n`;
        });
      }
      if (m.transcript) {
        exportText += `\n📝 Transkript:\n${m.transcript}\n`;
      }
      exportText += `\n----------------------------------------------------\n\n`;
    });

    downloadTextFile(`cognidev-uchrashuvlar-eksport-${new Date().toISOString().slice(0, 10)}.txt`, exportText);
    setHud(`${selectedList.length} ta uchrashuv eksport qilindi ✓`);
  };

  const handleToggleArchiveSelected = () => {
    if (!selectedMeeting) return;
    const isArchived = selectedMeeting.tags?.includes('archived');
    const newTags = isArchived
      ? (selectedMeeting.tags || []).filter((t) => t !== 'archived')
      : Array.from(new Set([...(selectedMeeting.tags || []), 'archived']));
    updateMeeting(selectedMeeting.id, { tags: newTags });
    setHud(isArchived ? "Uchrashuv arxivdan qaytarildi 📥" : "Uchrashuv arxivlandi 📦");
  };

  // ── Speaker Diarization & Rename Handlers ───────────────────
  const [isDiarizing, setIsDiarizing] = useState(false);

  const handleDiarizeTranscript = async () => {
    if (!selectedMeeting || !selectedMeeting.transcript) return;
    setIsDiarizing(true);
    setHud("AI spikerlarni tahlil qilmoqda… 👥");
    try {
      const diarized = await diarizeTranscriptWithAi(selectedMeeting.transcript);
      updateMeeting(selectedMeeting.id, { transcript: diarized });
      setHud("Spikerlar bo‘yicha muvaffaqiyatli ajratildi ✓");
    } catch (err: any) {
      console.warn('Diarize error:', err);
      setHud("Spikerlarni ajratishda xatolik yuz berdi");
    } finally {
      setIsDiarizing(false);
    }
  };

  const handleRenameSpeaker = (oldName: string, newName: string) => {
    if (!selectedMeeting || !oldName.trim() || !newName.trim()) return;
    const newTranscript = renameSpeakerInTranscript(selectedMeeting.transcript, oldName, newName);
    updateMeeting(selectedMeeting.id, { transcript: newTranscript });
    setHud(`"${oldName}" -> "${newName}" ga o‘zgartirildi ✓`);
  };

  return (
    <div className="flex flex-1 h-full min-h-0 bg-[#090a0f] text-zinc-200 overflow-hidden select-none">
      {/* ─── LEFT PANEL: Meeting Library ─── */}
      <div className="flex flex-col w-[340px] shrink-0 border-r border-white/[0.08] bg-[#0c0d14]/90 backdrop-blur-md">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/20">
                <Radio size={16} className="animate-pulse" />
              </div>
              <div>
                <h1 className="text-[14px] font-bold text-white tracking-wide">
                  AI Meetings
                </h1>
                <p className="text-[11px] text-zinc-400">Audio, Transkript & Konspekt</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsStatsOpen(true)}
                title="Uchrashuvlar Analitikasi & Statistika"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-300 hover:bg-white/10 transition"
              >
                <BarChart3 size={15} />
              </button>
              <button
                onClick={() => {
                  setIsBatchMode((prev) => !prev);
                  setSelectedMeetingIds(new Set());
                }}
                title={isBatchMode ? "Belgilash rejimidan chiqish" : "Ommaviy boshqaruv (Batch mode)"}
                className={`p-1.5 rounded-lg transition ${
                  isBatchMode
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <CheckSquare size={15} />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="AI & Audio Sozlamalari (Dedicated API)"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsRecordingModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-3 py-2 text-[12px] font-bold text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition"
            >
              <Mic size={14} className="animate-pulse" />
              <span>Yozib Olish</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-medium text-zinc-200 hover:bg-white/10 hover:text-white active:scale-95 transition disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={13} className="animate-spin text-sky-400" /> : <Upload size={13} />}
              <span>{isUploading ? 'O‘qilmoqda…' : 'Fayl Yuklash'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Uchrashuv, mavzu yoki so‘zni izlash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-black/40 pl-8 pr-3 py-1.5 text-[12px] text-zinc-200 placeholder-zinc-500 focus:border-purple-500/50 focus:outline-none transition"
            />
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1 text-[11px] overflow-x-auto scrollbar-none pb-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2 py-1 rounded-lg transition font-medium shrink-0 ${
                filterMode === 'all'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              Barchasi ({activeMeetingsCount})
            </button>
            <button
              onClick={() => setFilterMode('analyzed')}
              className={`px-2 py-1 rounded-lg transition font-medium shrink-0 ${
                filterMode === 'analyzed'
                  ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              AI Konspekt
            </button>
            <button
              onClick={() => setFilterMode('audio_only')}
              className={`px-2 py-1 rounded-lg transition font-medium shrink-0 ${
                filterMode === 'audio_only'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              Audio
            </button>
            <button
              onClick={() => setFilterMode('archived')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition font-medium shrink-0 ${
                filterMode === 'archived'
                  ? 'bg-zinc-750 text-amber-300 font-semibold border border-amber-500/30 bg-amber-500/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Archive size={11} />
              <span>Arxiv ({archivedMeetingsCount})</span>
            </button>
          </div>

          {/* Space Filter dropdown */}
          <div className="relative pt-0.5">
            <select
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
              className="w-full appearance-none bg-black/40 border border-white/[0.08] hover:border-white/20 text-zinc-300 text-[11px] rounded-lg pl-6 pr-6 py-1 focus:outline-none focus:border-purple-500 transition cursor-pointer"
            >
              <option value="all" className="bg-[#171822]">🌐 Barcha Space'lar</option>
              <option value="none" className="bg-[#171822]">Space'siz uchrashuvlar</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#171822]">
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            <Layers size={11} className="absolute left-2 top-2 text-zinc-400 pointer-events-none" />
            <ChevronDown size={11} className="absolute right-2 top-2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        {/* Batch Operations Bar */}
        {isBatchMode && (
          <div className="p-2.5 mx-3 mt-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-[11.5px] space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-purple-300 hover:text-white flex items-center gap-1.5 font-medium"
              >
                {selectedMeetingIds.size === filteredMeetings.length && filteredMeetings.length > 0 ? (
                  <CheckSquare size={13} className="text-purple-400" />
                ) : (
                  <Square size={13} />
                )}
                <span>
                  {selectedMeetingIds.size === filteredMeetings.length && filteredMeetings.length > 0
                    ? 'Barchasini bekor qilish'
                    : 'Barchasini tanlash'}
                </span>
              </button>
              <span className="text-zinc-400 font-mono text-[11px]">
                {selectedMeetingIds.size} / {filteredMeetings.length} ta
              </span>
            </div>

            {selectedMeetingIds.size > 0 && (
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-purple-500/20">
                <button
                  type="button"
                  onClick={() => handleBatchArchive(filterMode !== 'archived')}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition"
                  title={filterMode === 'archived' ? 'Arxivdan chiqarish' : 'Arxivga o‘tkazish'}
                >
                  {filterMode === 'archived' ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                  <span>{filterMode === 'archived' ? 'Qaytarish' : 'Arxivlash'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchExport}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 font-medium transition"
                  title="Tanlangan uchrashuvlarni bitta matn faylga eksport qilish"
                >
                  <Download size={12} />
                  <span>Eksport</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchDelete}
                  className="flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/30 text-rose-300 font-medium transition"
                  title="Tanlangan uchrashuvlarni butunlay o‘chirish"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Meeting List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
          {filteredMeetings.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-[12px] space-y-2">
              <Headphones size={28} className="mx-auto text-zinc-600" />
              <p>Uchrashuvlar topilmadi</p>
              <button
                onClick={() => setIsRecordingModalOpen(true)}
                className="text-[11.5px] text-purple-400 hover:underline"
              >
                + Birinchi uchrashuvni yozib oling
              </button>
            </div>
          ) : (
            filteredMeetings.map((m) => {
              const isSelected = m.id === selectedMeetingId;
              const mins = Math.floor(m.duration / 60);
              const secs = m.duration % 60;
              const durStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
              const actionCount = m.action_items?.length ?? 0;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (isBatchMode) {
                      handleToggleSelectMeeting(m.id);
                    } else {
                      setSelectedMeetingId(m.id);
                    }
                  }}
                  className={`group relative rounded-xl p-3 cursor-pointer transition border ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border-purple-500/40 shadow-md shadow-purple-500/5'
                      : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isBatchMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectMeeting(m.id);
                          }}
                          className="shrink-0 text-zinc-400 hover:text-white"
                        >
                          {selectedMeetingIds.has(m.id) ? (
                            <CheckSquare size={14} className="text-purple-400" />
                          ) : (
                            <Square size={14} className="text-zinc-600 hover:text-zinc-400" />
                          )}
                        </button>
                      )}
                      <h3 className="text-[12.5px] font-semibold text-white line-clamp-1 group-hover:text-purple-300 transition">
                        {m.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const isArch = m.tags?.includes('archived');
                          const newTags = isArch
                            ? (m.tags || []).filter((t) => t !== 'archived')
                            : Array.from(new Set([...(m.tags || []), 'archived']));
                          updateMeeting(m.id, { tags: newTags });
                          setHud(isArch ? "Arxivdan chiqarildi 📥" : "Arxivlandi 📦");
                        }}
                        className="p-1 text-zinc-500 hover:text-amber-300 transition"
                        title={m.tags?.includes('archived') ? "Arxivdan qaytarish" : "Arxivlash"}
                      >
                        {m.tags?.includes('archived') ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMeeting(m.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition"
                        title="O'chirish"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {m.summary || m.transcript}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04] text-[10.5px] text-zinc-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} />
                      <span>{durStr}</span>
                      <span>·</span>
                      <span>{new Date(m.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {m.space_id && (
                        <span className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-indigo-500/15 text-indigo-300 text-[9.5px] font-sans font-medium border border-indigo-500/20">
                          <Layers size={8} />
                          {spaces.find((s) => s.id === m.space_id)?.name || 'Space'}
                        </span>
                      )}
                      {m.language && (
                        <span className="rounded px-1.5 py-0.5 bg-white/5 text-zinc-300 text-[9.5px] font-mono border border-white/5">
                          {m.language === 'uz' ? '🇺🇿 UZ' : m.language === 'ru' ? '🇷🇺 RU' : m.language === 'en' ? '🇬🇧 EN' : m.language.toUpperCase()}
                        </span>
                      )}
                      {m.mode === 'analyzed' ? (
                        <span className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-purple-500/15 text-purple-300 text-[10px] font-sans font-medium">
                          <Sparkles size={9} /> {actionCount} vazifa
                        </span>
                      ) : (
                        <span className="rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-300 text-[10px] font-sans font-medium">
                          Audio
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── RIGHT / CENTER PANEL: Active Meeting Details ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0e0f17]">
        {selectedMeeting ? (
          <>
            {/* Header / Action Bar */}
            <div className="px-6 py-4 border-b border-white/[0.08] bg-[#12131d]/60 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedMeeting.title}
                      onChange={(e) => updateMeeting(selectedMeeting.id, { title: e.target.value })}
                      className="text-[18px] font-bold text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-purple-500 focus:outline-none transition w-full"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-zinc-500" />
                      {new Date(selectedMeeting.date).toLocaleString('uz-UZ')}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-zinc-500" />
                      {Math.floor(selectedMeeting.duration / 60)} daqiqa {selectedMeeting.duration % 60} soniya
                    </span>
                    {selectedMeeting.language && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full text-[10.5px]">
                          <Globe size={11} className="text-sky-400" />
                          {selectedMeeting.language === 'uz' ? 'O‘zbekcha' : selectedMeeting.language === 'ru' ? 'Русский' : selectedMeeting.language === 'en' ? 'English' : selectedMeeting.language}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Space & Project Pickers */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Space Selector */}
                    <div className="relative inline-flex items-center">
                      <select
                        value={selectedMeeting.space_id || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          updateMeeting(selectedMeeting.id, { space_id: val });
                          setHud(val ? `Uchrashuv "${spaces.find((s) => s.id === val)?.name}" space'iga biriktirildi ✓` : 'Space ajratildi');
                        }}
                        className="appearance-none bg-white/[0.04] border border-white/10 hover:border-white/20 text-zinc-300 text-[11px] rounded-lg pl-6 pr-6 py-1 cursor-pointer focus:outline-none focus:border-purple-500 transition"
                      >
                        <option value="" className="bg-[#171822] text-zinc-400">🌐 Space tanlanmagan</option>
                        {spaces.map((sp) => (
                          <option key={sp.id} value={sp.id} className="bg-[#171822] text-zinc-200">
                            {sp.icon} {sp.name}
                          </option>
                        ))}
                      </select>
                      <Layers size={11} className="absolute left-2 top-2 text-zinc-400 pointer-events-none" />
                      <ChevronDown size={11} className="absolute right-2 top-2 text-zinc-500 pointer-events-none" />
                    </div>

                    {/* Project Selector */}
                    <div className="relative inline-flex items-center">
                      <select
                        value={selectedMeeting.project_id || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          updateMeeting(selectedMeeting.id, { project_id: val });
                          setHud(val ? `Uchrashuv "${activeProjects.find((p) => p.id === val)?.title}" loyihasiga biriktirildi ✓` : 'Loyiha ajratildi');
                        }}
                        className="appearance-none bg-white/[0.04] border border-white/10 hover:border-white/20 text-zinc-300 text-[11px] rounded-lg pl-6 pr-6 py-1 cursor-pointer focus:outline-none focus:border-purple-500 transition"
                      >
                        <option value="" className="bg-[#171822] text-zinc-400">📁 Loyiha tanlanmagan</option>
                        {activeProjects.map((p) => (
                          <option key={p.id} value={p.id} className="bg-[#171822] text-zinc-200">
                            {p.title}
                          </option>
                        ))}
                      </select>
                      <Briefcase size={11} className="absolute left-2 top-2 text-zinc-400 pointer-events-none" />
                      <ChevronDown size={11} className="absolute right-2 top-2 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Tags Pill Editor */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10.5px] text-zinc-500 font-mono flex items-center gap-1">
                      <Tag size={10} /> Teglar:
                    </span>
                    {(selectedMeeting.tags || []).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10.5px] text-zinc-300 group hover:border-purple-500/40"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextTags = selectedMeeting.tags.filter((_, i) => i !== tIdx);
                            updateMeeting(selectedMeeting.id, { tags: nextTags });
                          }}
                          className="text-zinc-500 hover:text-rose-400 transition ml-0.5"
                          title="Tegni o'chirish"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {isAddingTag ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const clean = newTagInput.trim().replace(/^#/, '');
                              if (clean) {
                                const nextTags = Array.from(new Set([...(selectedMeeting.tags || []), clean]));
                                updateMeeting(selectedMeeting.id, { tags: nextTags });
                                setNewTagInput('');
                                setIsAddingTag(false);
                              }
                            } else if (e.key === 'Escape') {
                              setIsAddingTag(false);
                              setNewTagInput('');
                            }
                          }}
                          placeholder="Yangi teg..."
                          autoFocus
                          className="bg-black/60 border border-purple-500/50 rounded px-1.5 py-0.5 text-[10.5px] text-white w-24 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const clean = newTagInput.trim().replace(/^#/, '');
                            if (clean) {
                              const nextTags = Array.from(new Set([...(selectedMeeting.tags || []), clean]));
                              updateMeeting(selectedMeeting.id, { tags: nextTags });
                            }
                            setIsAddingTag(false);
                            setNewTagInput('');
                          }}
                          className="p-0.5 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingTag(false);
                            setNewTagInput('');
                          }}
                          className="p-0.5 text-zinc-500 hover:text-zinc-300"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingTag(true)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition border border-dashed border-purple-500/30"
                      >
                        <Plus size={10} /> Teg qo‘shish
                      </button>
                    )}
                  </div>
                </div>

                {/* Top Action Bar Buttons */}
                <div className="flex items-center gap-2">
                  {(selectedMeeting.audio_url || selectedMeeting.audio_path) && (
                    <button
                      onClick={async () => {
                        const url = selectedMeeting.audio_url || (await resolveMeetingAudioUrl(selectedMeeting));
                        if (url) {
                          downloadAudioFile(url, selectedMeeting.title);
                          setHud(`"${selectedMeeting.title}.wav" audio yuklab olindi ✓`);
                        }
                      }}
                      title="Audioni .wav ko‘rinishida kompyuterga saqlab olish"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white transition"
                    >
                      <Download size={13} />
                      <span>Audioni Yuklash</span>
                    </button>
                  )}

                  <button
                    onClick={handleToggleTts}
                    title={isSpeaking ? "Ovozni to'xtatish" : "AI xulosasini ovozda o'qish (TTS)"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium border transition ${
                      isSpeaking
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    <span>{isSpeaking ? "To'xtatish" : "Tinglash"}</span>
                  </button>

                  <button
                    onClick={() => setIsTemplatePickerOpen(true)}
                    disabled={isReanalyzing}
                    title="AI shablonini tanlash va qayta tahlil qilish"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition disabled:opacity-50"
                  >
                    {isReanalyzing ? <Loader2 size={13} className="animate-spin text-purple-300" /> : <Sparkles size={13} />}
                    <span>Qayta Tahlil</span>
                  </button>

                  {/* Notes Integratsiyasi */}
                  {selectedMeeting.note_id ? (
                    <button
                      onClick={() => handleOpenLinkedNote(selectedMeeting.note_id!)}
                      title="Bog‘langan Notion qaydini ochish"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition"
                    >
                      <FolderPlus size={13} className="text-emerald-400" />
                      <span>Qaydni Ochish ↗</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleExportToNotes}
                      title="Notion Notes bo'limiga hujjat sifatida saqlash"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white transition"
                    >
                      <FolderPlus size={13} />
                      <span>Notes'ga Saqlash</span>
                    </button>
                  )}

                  {/* Calendar Integratsiyasi */}
                  {isScheduledInCalendar ? (
                    <button
                      onClick={() => setMainView('calendar')}
                      title="Taqvim jadvalida ochish"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition"
                    >
                      <Calendar size={13} className="text-purple-400" />
                      <span>Taqvimda Ko‘rish ↗</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToCalendar}
                      title="Uchrashuvni taqvimga voqea sifatida biriktirish"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white transition"
                    >
                      <Calendar size={13} />
                      <span>Taqvimga Biriktirish</span>
                    </button>
                  )}

                  {/* Eksport qilish (Telegram, Slack, Markdown, Plain Text) */}
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    title="Telegram, Slack, Markdown va boshqa formatlarda eksport qilish"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-sky-600/20 via-indigo-600/20 to-purple-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 hover:text-white transition shadow-sm"
                  >
                    <Share2 size={13} />
                    <span>Eksport</span>
                  </button>

                  <button
                    onClick={handleCopyMarkdown}
                    title="Markdown ko'chirish"
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition"
                  >
                    <Copy size={14} />
                  </button>

                  <button
                    onClick={handleToggleArchiveSelected}
                    title={selectedMeeting.tags?.includes('archived') ? "Arxivdan chiqarish" : "Uchrashuvni arxivlash"}
                    className="p-2 rounded-xl text-zinc-400 hover:text-amber-300 hover:bg-white/10 transition"
                  >
                    {selectedMeeting.tags?.includes('archived') ? (
                      <ArchiveRestore size={14} className="text-amber-400" />
                    ) : (
                      <Archive size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* Mini Audio Player Bar (isolated from parent renders for maximum playback performance) */}
              {(selectedMeeting.audio_url || selectedMeeting.audio_path) && (
                <MeetingAudioPlayer
                  meeting={selectedMeeting}
                  seekTime={seekTarget}
                  onTimeUpdate={(t) => setCurrentAudioTime(t)}
                  onDownload={() => {
                    setHud(`"${selectedMeeting.title}.wav" audio yuklab olindi ✓`);
                  }}
                />
              )}

              {/* Workspace Navigation Tabs */}
              <div className="flex items-center gap-6 mt-4 border-b border-white/[0.06]">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`pb-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'summary'
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sparkles size={14} className={activeTab === 'summary' ? 'text-purple-400' : ''} />
                  <span>Konspekt & Vazifalar</span>
                  {selectedMeeting.action_items?.length ? (
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.2 text-[10.5px] text-purple-300 font-mono">
                      {selectedMeeting.action_items.length}
                    </span>
                  ) : null}
                </button>

                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`pb-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'transcript'
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileText size={14} className={activeTab === 'transcript' ? 'text-purple-400' : ''} />
                  <span>Transkripsiya</span>
                </button>

                <button
                  onClick={() => setActiveTab('chat')}
                  className={`pb-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'chat'
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <MessageSquare size={14} className={activeTab === 'chat' ? 'text-purple-400' : ''} />
                  <span>AI Chat</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {activeTab === 'summary' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Executive Summary Box */}
                  <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-[#13141f] to-indigo-950/20 p-5 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-purple-300 uppercase tracking-wider font-mono">
                        <Sparkles size={15} />
                        <span>Qisqacha Mazmun (Executive Summary)</span>
                      </div>
                      {!isEditingSummary ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSummaryDraft(selectedMeeting.summary || '');
                            setIsEditingSummary(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] text-zinc-400 hover:text-white hover:bg-white/10 transition"
                          title="Mazmunni tahrirlash"
                        >
                          <Edit3 size={12} />
                          <span>Tahrirlash</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              updateMeeting(selectedMeeting.id, { summary: summaryDraft });
                              setIsEditingSummary(false);
                              setHud("Qisqacha mazmun yangilandi ✓");
                            }}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11.5px] font-semibold hover:bg-emerald-500/30 transition"
                          >
                            <Check size={12} />
                            <span>Saqlash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingSummary(false)}
                            className="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-zinc-200 text-[11.5px] transition"
                          >
                            Bekor qilish
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingSummary ? (
                      <div className="space-y-2">
                        <textarea
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                          rows={4}
                          autoFocus
                          className="w-full rounded-xl border border-purple-500/40 bg-black/60 p-3 text-[13px] text-white focus:outline-none focus:border-purple-400 leading-relaxed font-sans"
                          placeholder="Uchrashuv qisqacha mazmunini yozing..."
                        />
                      </div>
                    ) : (
                      <p className="text-[13.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {selectedMeeting.summary || 'Ushbu uchrashuv hozircha faqat audio formatda saqlangan. Yuqoridagi "Qayta Tahlil" tugmasini bosing yoki qo‘lda tahrirlang.'}
                      </p>
                    )}
                  </div>

                  {/* Key Decisions */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12131d]/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                        <CheckCircle2 size={16} />
                        <span>Qabul Qilingan Qarorlar ({selectedMeeting.decisions?.length || 0})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingDecision(true);
                          setNewDecisionDraft('');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[11.5px] hover:bg-emerald-500/25 transition font-medium"
                      >
                        <Plus size={12} />
                        <span>Qaror qo‘shish</span>
                      </button>
                    </div>

                    {/* Add decision row */}
                    {isAddingDecision && (
                      <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                        <input
                          type="text"
                          value={newDecisionDraft}
                          onChange={(e) => setNewDecisionDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddDecision();
                            if (e.key === 'Escape') setIsAddingDecision(false);
                          }}
                          placeholder="Yangi kelishilgan qarorni yozing... (Enter)"
                          autoFocus
                          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-[12.5px] text-white focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingDecision(false)}
                            className="px-2.5 py-1 text-[11.5px] text-zinc-400 hover:text-white"
                          >
                            Bekor qilish
                          </button>
                          <button
                            type="button"
                            onClick={handleAddDecision}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11.5px] font-semibold hover:bg-emerald-500 transition"
                          >
                            <Check size={12} /> Qo‘shish
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedMeeting.decisions && selectedMeeting.decisions.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMeeting.decisions.map((d, i) => {
                          const isEditing = editingDecisionIdx === i;
                          return (
                            <div
                              key={i}
                              className="group flex items-start justify-between gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition text-[13px] text-zinc-200"
                            >
                              {isEditing ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editDecisionDraft}
                                    onChange={(e) => setEditDecisionDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditDecision(i);
                                      if (e.key === 'Escape') setEditingDecisionIdx(null);
                                    }}
                                    autoFocus
                                    className="flex-1 rounded-lg border border-emerald-500/50 bg-black/60 px-3 py-1 text-[12.5px] text-white focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditDecision(i)}
                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-xs"
                                    title="Saqlash"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingDecisionIdx(null)}
                                    className="p-1 text-zinc-400 hover:text-white text-xs"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] mt-0.5">
                                      ✓
                                    </span>
                                    <span className="leading-relaxed whitespace-pre-wrap">{d}</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDecisionIdx(i);
                                        setEditDecisionDraft(d);
                                      }}
                                      title="Qarorni tahrirlash"
                                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDecision(i)}
                                      title="O‘chirish"
                                      className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-white/10"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : !isAddingDecision ? (
                      <p className="text-[12.5px] text-zinc-500 py-2 text-center">
                        Qabul qilingan qarorlar mavjud emas. Yuqoridagi "+ Qaror qo‘shish" tugmasini bosing.
                      </p>
                    ) : null}
                  </div>

                  {/* Action Items / Tasks */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12131d]/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-sky-400 uppercase tracking-wider font-mono">
                        <ListTodo size={16} />
                        <span>Vazifalar & Topshiriqlar ({selectedMeeting.action_items?.length || 0})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingAction(true);
                            setNewActionText('');
                            setNewActionAssignee('');
                            setNewActionPriority('Normal');
                            setNewActionDueDate('');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/25 text-[11.5px] hover:bg-sky-500/25 transition font-medium"
                        >
                          <Plus size={12} />
                          <span>Yangi vazifa</span>
                        </button>
                      </div>
                    </div>

                    {/* Add Action Item Form */}
                    {isAddingAction && (
                      <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-3">
                        <input
                          type="text"
                          value={newActionText}
                          onChange={(e) => setNewActionText(e.target.value)}
                          placeholder="Bajarilishi kerak bo‘lgan vazifa nomi..."
                          autoFocus
                          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[12.5px] text-white focus:outline-none focus:border-sky-500"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                            <User size={12} className="text-zinc-500 shrink-0" />
                            <input
                              type="text"
                              value={newActionAssignee}
                              onChange={(e) => setNewActionAssignee(e.target.value)}
                              placeholder="Mas'ul (masalan: Jamshid)"
                              className="bg-transparent text-[11.5px] text-white w-full focus:outline-none placeholder-zinc-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                            <Flag size={12} className="text-zinc-500 shrink-0" />
                            <select
                              value={newActionPriority}
                              onChange={(e) => setNewActionPriority(e.target.value as TaskPriority)}
                              className="bg-transparent text-[11.5px] text-white w-full focus:outline-none cursor-pointer"
                            >
                              <option value="Normal" className="bg-[#171822]">Normal</option>
                              <option value="High Priority" className="bg-[#171822]">High Priority</option>
                              <option value="Critical" className="bg-[#171822]">Critical</option>
                              <option value="P0 Blocker" className="bg-[#171822]">P0 Blocker</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                            <Clock size={12} className="text-zinc-500 shrink-0" />
                            <input
                              type="text"
                              value={newActionDueDate}
                              onChange={(e) => setNewActionDueDate(e.target.value)}
                              placeholder="Muddat (masalan: Ertaga)"
                              className="bg-transparent text-[11.5px] text-white w-full focus:outline-none placeholder-zinc-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingAction(false)}
                            className="px-3 py-1 text-[11.5px] text-zinc-400 hover:text-white"
                          >
                            Bekor qilish
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveNewAction}
                            disabled={!newActionText.trim()}
                            className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-sky-600 text-white text-[11.5px] font-semibold hover:bg-sky-500 transition disabled:opacity-50"
                          >
                            <Check size={12} /> Qo‘shish
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedMeeting.action_items && selectedMeeting.action_items.length > 0 ? (
                      <div className="space-y-2.5">
                        {selectedMeeting.action_items.map((act) => {
                          const isEditing = editingActionId === act.id;

                          if (isEditing) {
                            return (
                              <div key={act.id} className="p-3.5 rounded-xl border border-sky-500/40 bg-sky-950/25 space-y-2.5">
                                <input
                                  type="text"
                                  value={editActionText}
                                  onChange={(e) => setEditActionText(e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[12.5px] text-white focus:outline-none focus:border-sky-500"
                                  autoFocus
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                                    <User size={12} className="text-zinc-500 shrink-0" />
                                    <input
                                      type="text"
                                      value={editActionAssignee}
                                      onChange={(e) => setEditActionAssignee(e.target.value)}
                                      placeholder="Mas'ul shaxs"
                                      className="bg-transparent text-[11.5px] text-white w-full focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                                    <Flag size={12} className="text-zinc-500 shrink-0" />
                                    <select
                                      value={editActionPriority}
                                      onChange={(e) => setEditActionPriority(e.target.value as TaskPriority)}
                                      className="bg-transparent text-[11.5px] text-white w-full focus:outline-none cursor-pointer"
                                    >
                                      <option value="Normal" className="bg-[#171822]">Normal</option>
                                      <option value="High Priority" className="bg-[#171822]">High Priority</option>
                                      <option value="Critical" className="bg-[#171822]">Critical</option>
                                      <option value="P0 Blocker" className="bg-[#171822]">P0 Blocker</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                                    <Clock size={12} className="text-zinc-500 shrink-0" />
                                    <input
                                      type="text"
                                      value={editActionDueDate}
                                      onChange={(e) => setEditActionDueDate(e.target.value)}
                                      placeholder="Muddat"
                                      className="bg-transparent text-[11.5px] text-white w-full focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingActionId(null)}
                                    className="px-2.5 py-1 text-[11.5px] text-zinc-400 hover:text-white"
                                  >
                                    Bekor qilish
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditAction(act.id)}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-600 text-white text-[11.5px] font-semibold hover:bg-sky-500 transition"
                                  >
                                    <Check size={12} /> Saqlash
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={act.id}
                              className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                                act.completed
                                  ? 'border-emerald-500/20 bg-emerald-950/10'
                                  : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                {/* Holat Checkbox */}
                                <button
                                  type="button"
                                  onClick={() => toggleMeetingActionDone(selectedMeeting.id, act.id)}
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition mt-0.5 ${
                                    act.completed
                                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                                      : 'border-white/20 hover:border-sky-400 bg-white/5'
                                  }`}
                                  title={act.completed ? "Bajarildi (holatni o'zgartirish)" : "Bajarildi deb belgilash"}
                                >
                                  {act.completed ? <Check size={12} className="stroke-[3]" /> : null}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-[13px] font-medium transition ${
                                      act.completed ? 'line-through text-zinc-500' : 'text-white'
                                    }`}
                                  >
                                    {act.text}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-zinc-400 font-mono">
                                    {act.assignee && (
                                      <span className="text-zinc-300">👤 {act.assignee}</span>
                                    )}
                                    {act.due_date && (
                                      <>
                                        <span>·</span>
                                        <span className="text-amber-400/90">⏰ {act.due_date}</span>
                                      </>
                                    )}
                                    {act.priority && (
                                      <>
                                        <span>·</span>
                                        <span className="text-rose-400">{act.priority}</span>
                                      </>
                                    )}
                                    {act.task_id && (
                                      <>
                                        <span>·</span>
                                        <span className={act.completed ? 'text-emerald-400' : 'text-sky-400'}>
                                          Sinxron: {act.completed ? 'Bajarildi ✓' : 'Faol'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Tugmalar: Tasks bog'lanma, Tahrirlash, O'chirish */}
                              <div className="shrink-0 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAction(act)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                                  title="Tahrirlash"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAction(act.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition"
                                  title="O‘chirish"
                                >
                                  <Trash2 size={13} />
                                </button>

                                {act.added_to_tasks && act.task_id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMainView('stream');
                                      selectTask(act.task_id!);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-mono hover:bg-sky-500/25 transition active:scale-95"
                                    title="Tasks doskasida ushbu vazifani ochish"
                                  >
                                    <Check size={12} className="text-emerald-400" />
                                    <span>#{act.task_id}</span>
                                    <span className="text-[10px] text-zinc-400">↗</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAddActionItemToTasks(act)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:brightness-110 active:scale-95 shadow-md transition"
                                    title="Ushbu topshiriqni Tasks doskasiga yangi vazifa qilib kiritish"
                                  >
                                    <Plus size={12} />
                                    <span>Tasks’ga</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isAddingAction ? (
                      <p className="text-[12.5px] text-zinc-500 py-3 text-center">
                        Topshiriqlar ro‘yxati bo‘sh. Yuqoridagi "+ Yangi vazifa" tugmasi orqali kiriting.
                      </p>
                    ) : null}
                  </div>

                  {/* Key Takeaways */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12131d]/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                        <Activity size={16} />
                        <span>Asosiy Xulosalar & Eslatmalar ({selectedMeeting.key_takeaways?.length || 0})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingTakeaway(true);
                          setNewTakeawayDraft('');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[11.5px] hover:bg-amber-500/25 transition font-medium"
                      >
                        <Plus size={12} />
                        <span>Xulosa qo‘shish</span>
                      </button>
                    </div>

                    {isAddingTakeaway && (
                      <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2">
                        <input
                          type="text"
                          value={newTakeawayDraft}
                          onChange={(e) => setNewTakeawayDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTakeaway();
                            if (e.key === 'Escape') setIsAddingTakeaway(false);
                          }}
                          placeholder="Asosiy fakt yoki eslatmani yozing... (Enter)"
                          autoFocus
                          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-[12.5px] text-white focus:outline-none focus:border-amber-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingTakeaway(false)}
                            className="px-2.5 py-1 text-[11.5px] text-zinc-400 hover:text-white"
                          >
                            Bekor qilish
                          </button>
                          <button
                            type="button"
                            onClick={handleAddTakeaway}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 text-white text-[11.5px] font-semibold hover:bg-amber-500 transition"
                          >
                            <Check size={12} /> Qo‘shish
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedMeeting.key_takeaways && selectedMeeting.key_takeaways.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {selectedMeeting.key_takeaways.map((k, i) => {
                          const isEditing = editingTakeawayIdx === i;

                          if (isEditing) {
                            return (
                              <div key={i} className="p-3 rounded-xl bg-black/60 border border-amber-500/40 space-y-2">
                                <input
                                  type="text"
                                  value={editTakeawayDraft}
                                  onChange={(e) => setEditTakeawayDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditTakeaway(i);
                                    if (e.key === 'Escape') setEditingTakeawayIdx(null);
                                  }}
                                  autoFocus
                                  className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-[12.5px] text-white focus:outline-none"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingTakeawayIdx(null)}
                                    className="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-white"
                                  >
                                    Bekor
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditTakeaway(i)}
                                    className="px-2.5 py-0.5 bg-amber-600 text-white rounded text-[11px] font-medium"
                                  >
                                    Saqlash
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={i}
                              className="group flex items-start justify-between gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[12.5px] text-zinc-300 hover:border-white/10 transition"
                            >
                              <span className="leading-relaxed whitespace-pre-wrap flex-1">• {k}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTakeawayIdx(i);
                                    setEditTakeawayDraft(k);
                                  }}
                                  title="Tahrirlash"
                                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                                >
                                  <Edit3 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTakeaway(i)}
                                  title="O‘chirish"
                                  className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-white/10"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isAddingTakeaway ? (
                      <p className="text-[12.5px] text-zinc-500 py-2 text-center">
                        Xulosalar qayd etilmagan.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {activeTab === 'transcript' && (
                <OptimizedTranscriptViewer
                  transcript={selectedMeeting.transcript}
                  duration={selectedMeeting.duration}
                  currentAudioTime={currentAudioTime}
                  onSeekToTime={(timeSecs) => {
                    setSeekTarget({ time: timeSecs, nonce: Date.now() });
                    setHud(`Audio ${Math.floor(timeSecs / 60)}:${Math.floor(timeSecs % 60).toString().padStart(2, '0')} ga sakradi ⏱️`);
                  }}
                  onCopyAll={() => {
                    navigator.clipboard.writeText(selectedMeeting.transcript);
                    setHud("Transkript matni ko‘chirildi ✓");
                  }}
                  onSaveTranscript={(newText) => {
                    updateMeeting(selectedMeeting.id, { transcript: newText });
                    setHud("Transkript matni yangilandi ✓");
                  }}
                  onDiarizeTranscript={handleDiarizeTranscript}
                  isDiarizing={isDiarizing}
                  onRenameSpeaker={handleRenameSpeaker}
                />
              )}

              {activeTab === 'chat' && (
                <div className="max-w-3xl mx-auto flex flex-col h-full min-h-[480px]">
                  {/* Messages container */}
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 p-3.5 rounded-2xl text-[13px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-purple-600/20 text-purple-100 border border-purple-500/30 ml-8'
                            : 'bg-white/[0.04] text-zinc-200 border border-white/[0.06] mr-8'
                        }`}
                      >
                        <div className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center bg-white/10 text-white font-bold text-[11px]">
                          {msg.role === 'user' ? 'Siz' : 'AI'}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex items-center gap-2 p-3 text-[12.5px] text-purple-300 font-mono animate-pulse">
                        <Loader2 size={14} className="animate-spin" />
                        <span>AI uchrashuv transkriptini tahlil qilmoqda…</span>
                      </div>
                    )}
                  </div>

                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {[
                      'Qisqacha xulosa nima?',
                      'Kimga qanday vazifa berildi?',
                      'Qanday qarorlar qabul qilindi?',
                      'Keyingi reja nima?',
                    ].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => {
                          setChatInput(chip);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400 hover:text-white hover:bg-white/10 transition"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Chat Input form */}
                  <form onSubmit={handleSendChat} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Uchrashuv haqida AI'dan so‘rang..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-[13px] text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition shadow-md"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-xl">
              <Radio size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-[17px] font-bold text-white">Uchrashuv tanlanmagan</h2>
              <p className="text-[13px] text-zinc-400 max-w-sm">
                Chap tomondagi ro‘yxatdan uchrashuvni tanlang yoki yangi audio yozib oling.
              </p>
            </div>
            <button
              onClick={() => setIsRecordingModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-[13px] font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition"
            >
              <Mic size={15} />
              <span>Yangi Uchrashuv Yozish</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: Recording Console Studio ─── */}
      {isRecordingModalOpen && (
        <RecordingStudioModal
          open={isRecordingModalOpen}
          onClose={() => setIsRecordingModalOpen(false)}
          onMeetingCreated={(newMeet) => {
            addMeeting(newMeet);
            setSelectedMeetingId(newMeet.id);
            setIsRecordingModalOpen(false);
          }}
        />
      )}

      {/* ─── MODAL 2: Dedicated AI & Audio Settings ─── */}
      {isSettingsOpen && (
        <MeetingSettingsModal
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* ─── MODAL 3: Export Modal (Telegram, Slack, Markdown, Plain Text) ─── */}
      {isExportModalOpen && selectedMeeting && (
        <MeetingExportModal
          meeting={selectedMeeting}
          onClose={() => setIsExportModalOpen(false)}
          onHud={(msg) => setHud(msg)}
        />
      )}

      {/* ─── MODAL 4: AI Template Picker & Re-analyze ─── */}
      {isTemplatePickerOpen && selectedMeeting && (
        <MeetingTemplatePickerModal
          currentTemplate={selectedMeeting.tags?.find((t) => MEETING_TEMPLATES.some((m) => m.id === t))}
          isAnalyzing={isReanalyzing}
          onClose={() => setIsTemplatePickerOpen(false)}
          onSelectTemplate={(templateId) => handleReanalyzeWithTemplate(templateId)}
        />
      )}

      {/* ─── MODAL 5: Meeting Stats & Insights Dashboard ─── */}
      {isStatsOpen && (
        <MeetingStatsModal
          meetings={meetings}
          spaces={spaces}
          onClose={() => setIsStatsOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: Meeting Export Modal (Telegram, Slack, Markdown, Plain Text)
// ─────────────────────────────────────────────────────────────
interface MeetingExportModalProps {
  meeting: MeetingItem;
  onClose: () => void;
  onHud: (msg: string) => void;
}

function MeetingExportModal({ meeting, onClose, onHud }: MeetingExportModalProps) {
  const [tab, setTab] = useState<'telegram' | 'slack' | 'markdown' | 'text'>('telegram');

  const exportData = useMemo(() => {
    return {
      telegram: exportMeetingToTelegram(meeting),
      slack: exportMeetingToSlack(meeting),
      markdown: exportMeetingToMarkdown(meeting),
      text: exportMeetingToPlainText(meeting),
    };
  }, [meeting]);

  const currentContent = exportData[tab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    const names = {
      telegram: 'Telegram',
      slack: 'Slack',
      markdown: 'Markdown',
      text: 'Oddiy matn',
    };
    onHud(`${names[tab]} formati buferga nusxalandi ✓`);
  };

  const handleDownload = () => {
    const safeTitle = meeting.title.replace(/[^a-zA-Z0-9_\u0400-\u04FF\s-]/g, '').trim() || 'uchrashuv';
    if (tab === 'markdown') {
      downloadTextFile(currentContent, `${safeTitle}.md`);
      onHud('Markdown fayli yuklab olindi ✓');
    } else {
      downloadTextFile(currentContent, `${safeTitle}.txt`);
      onHud('Matn fayli yuklab olindi ✓');
    }
  };

  const handleShareTelegram = () => {
    const encoded = encodeURIComponent(currentContent);
    window.open(`https://t.me/share/url?url=&text=${encoded}`, '_blank');
    onHud("Telegram ilovasi ochilmoqda...");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#12131d] shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md">
              <Share2 size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Uchrashuvni Eksport Qilish</h2>
              <p className="text-[11px] text-zinc-400">Telegram, Slack, Markdown va boshqa formatlar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Format Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.08]">
          {[
            { id: 'telegram', label: '✈️ Telegram', badge: 'Markdown' },
            { id: 'slack', label: '💬 Slack', badge: 'mrkdwn' },
            { id: 'markdown', label: '📋 Markdown', badge: '.md' },
            { id: 'text', label: '📄 Oddiy Matn', badge: '.txt' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-medium transition flex items-center justify-center gap-1.5 ${
                tab === t.id
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>{t.label}</span>
              <span className="text-[10px] opacity-70">({t.badge})</span>
            </button>
          ))}
        </div>

        {/* Content Preview Box */}
        <div className="relative">
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11.5px] font-medium backdrop-blur transition"
            >
              <Copy size={12} />
              <span>Nusxalash</span>
            </button>
            {tab === 'telegram' && (
              <button
                type="button"
                onClick={handleShareTelegram}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11.5px] font-medium shadow transition"
              >
                <Send size={12} />
                <span>Telegram'ga</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11.5px] font-medium backdrop-blur transition"
            >
              <Download size={12} />
              <span>Yuklab olish</span>
            </button>
          </div>

          <textarea
            readOnly
            value={currentContent}
            rows={13}
            className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 pt-10 font-mono text-[12px] text-zinc-300 leading-relaxed focus:outline-none resize-none selection:bg-purple-500/30"
          />
        </div>

        <div className="flex items-center justify-between text-[11.5px] text-zinc-400 pt-1">
          <span>💡 Telegram va Slack chatlariga to‘g‘ridan-to‘g‘ri yuborish uchun qulay formatlangan.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: AI Template Picker & Re-analyze Modal
// ─────────────────────────────────────────────────────────────
interface MeetingTemplatePickerModalProps {
  currentTemplate?: string;
  isAnalyzing: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: MeetingTemplateId) => void;
}

function MeetingTemplatePickerModal({
  currentTemplate = 'general',
  isAnalyzing,
  onClose,
  onSelectTemplate,
}: MeetingTemplatePickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#12131d] shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md">
              <Sparkles size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">AI Uchrashuv Shabloni</h2>
              <p className="text-[11px] text-zinc-400">Kerakli shablonni tanlab uchrashuvni qayta tahlil qiling</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {MEETING_TEMPLATES.map((tmpl) => {
            const isSelected = currentTemplate === tmpl.id;
            return (
              <button
                key={tmpl.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => onSelectTemplate(tmpl.id)}
                className={`w-full flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition ${
                  isSelected
                    ? 'bg-purple-900/30 border-purple-500/60 shadow-lg'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
                } disabled:opacity-50`}
              >
                <div className="text-2xl shrink-0 p-1">{tmpl.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[13px] font-bold text-white">{tmpl.label}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-purple-300">
                      {tmpl.badge}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-zinc-400 mt-1 leading-snug">{tmpl.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECORDING STUDIO MODAL (Pause/Resume, Cancel, Screen/System Audio, Templates)
// ─────────────────────────────────────────────────────────────
function RecordingStudioModal({
  onClose,
  onMeetingCreated,
}: {
  open?: boolean;
  onClose: () => void;
  onMeetingCreated: (m: MeetingItem) => void;
}) {
  const [meetingTitle, setMeetingTitle] = useState(() =>
    `Uchrashuv — ${new Date().toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  );
  const [selectedLang, setSelectedLang] = useState<SttLanguage>('auto');
  const [audioSource, setAudioSource] = useState<AudioSourceOption>('mic');
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplateId>('general');
  const [liveText, setLiveText] = useState('');
  const [liveAgenda, setLiveAgenda] = useState('');
  const liveSpeechRef = useRef<ReturnType<typeof createLiveSpeechRecognizer> | null>(null);

  const [recording, setRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const mixedAudioCleanupRef = useRef<(() => void) | null>(null);

  const config = getMeetingAiConfig();

  // Start Audio Recording with Hardware DSP and chosen Audio Source
  const startRecording = async () => {
    setMicError(null);
    try {
      activeStreamsRef.current = [];
      mixedAudioCleanupRef.current = null;

      let recordStream: MediaStream;

      if (audioSource === 'mic') {
        const micStream = await requestMicrophoneStream({
          noiseSuppression: config.noiseSuppression,
          autoGainControl: config.autoGainControl,
          echoCancellation: config.echoCancellation,
        });
        activeStreamsRef.current.push(micStream);
        recordStream = micStream;
      } else if (audioSource === 'system') {
        const sysStream = await requestScreenAudioStream();
        activeStreamsRef.current.push(sysStream);
        recordStream = sysStream;
      } else {
        // 'mixed' (Microphone + System Audio)
        const micStream = await requestMicrophoneStream({
          noiseSuppression: config.noiseSuppression,
          autoGainControl: config.autoGainControl,
          echoCancellation: config.echoCancellation,
        });
        activeStreamsRef.current.push(micStream);

        const sysStream = await requestScreenAudioStream();
        activeStreamsRef.current.push(sysStream);

        const { mixedStream, cleanup } = mixAudioStreams(micStream, sysStream);
        mixedAudioCleanupRef.current = cleanup;
        recordStream = mixedStream;
      }

      // Track screen audio stop event if triggered externally
      activeStreamsRef.current.forEach((st) => {
        st.getVideoTracks().forEach((vt) => {
          vt.onended = () => {
            console.log('[RecordingStudio] Screen capture track ended by user');
          };
        });
      });

      // Setup Web Audio Analyser for live visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(recordStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      drawWaveform();

      // Setup MediaRecorder
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(recordStream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(250);
      setRecording(true);
      setIsPaused(false);
      setSeconds(0);
      setLiveText('');

      // Start live speech recognizer for live captioning
      try {
        const recognizer = createLiveSpeechRecognizer(selectedLang, (text) => setLiveText(text));
        recognizer.start();
        liveSpeechRef.current = recognizer;
      } catch {
        /* ignore */
      }

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('[MeetingsWorkspace] startRecording error:', err);
      activeStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      activeStreamsRef.current = [];
      mixedAudioCleanupRef.current?.();
      mixedAudioCleanupRef.current = null;

      const msg = err instanceof Error ? err.message : String(err);
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        msg.toLowerCase().includes('not allowed') ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('denied')
      ) {
        setMicError('PERMISSION_DENIED');
      } else {
        setMicError(msg || 'Ovoz yozish qurilmasidan foydalanishda xatolik');
      }
    }
  };

  // Waveform canvas animation loop
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 1.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, '#8b5cf6');
        grad.addColorStop(1, '#ec4899');
        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  const stopWaveform = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
  };

  // Pause Recording
  const handlePauseRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    try {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPaused(true);
    } catch (e) {
      console.warn('pause error:', e);
    }
  };

  // Resume Recording
  const handleResumeRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;
    try {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (e) {
      console.warn('resume error:', e);
    }
  };

  // Cancel & Discard Recording
  const handleDiscardRecording = () => {
    if (seconds > 2) {
      if (!confirm("Haqiqatan ham yozib olingan audioni bekor qilib o‘chirmoqchimisiz?")) {
        return;
      }
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopWaveform();

    try {
      liveSpeechRef.current?.stop();
    } catch {
      /* ignore */
    }

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
    }

    activeStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    activeStreamsRef.current = [];
    mixedAudioCleanupRef.current?.();
    mixedAudioCleanupRef.current = null;

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecording(false);
    setIsPaused(false);
    setSeconds(0);
    setLiveText('');
    setMicLevel(0);
  };

  // Stop Recording and finish with AI or Audio-only
  const handleStopAndSave = async (mode: 'analyze' | 'audio_only') => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopWaveform();

    const liveTranscript = liveSpeechRef.current?.stop() || liveText;

    const recorder = mediaRecorderRef.current;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    activeStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    activeStreamsRef.current = [];
    mixedAudioCleanupRef.current?.();
    mixedAudioCleanupRef.current = null;

    const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
    const meetId = `meet-${Date.now()}`;
    const { audio_path, audio_url: persistedUrl } = await persistMeetingAudio(meetId, blob, 'wav');
    const finalDuration = seconds || 1;
    const template = getMeetingTemplate(selectedTemplate);

    if (mode === 'audio_only') {
      const meet: MeetingItem = {
        id: meetId,
        title: meetingTitle.trim() || 'Ovozli Uchrashuv',
        date: new Date().toISOString(),
        duration: finalDuration,
        language: selectedLang === 'auto' ? 'uz' : selectedLang,
        mode: 'audio_only',
        audio_url: persistedUrl,
        audio_path: audio_path,
        transcript: liveTranscript || 'Ushbu uchrashuv faqat audio sifatida saqlangan (AI sarflanmadi).',
        tags: ['audio-only', selectedLang, template.id, audioSource],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onMeetingCreated(meet);
      return;
    }

    // AI Analysis Pipeline with Selected Template
    setTranscribing(true);
    try {
      let text = '';
      let detectedLang = selectedLang === 'auto' ? 'uz' : selectedLang;
      try {
        const wav = await blobToWav16k(blob);
        const sttRes = await transcribeAudioDetailed(wav, selectedLang, liveTranscript);
        text = sttRes.text || liveTranscript;
        detectedLang = (sttRes.detectedLang as any) || detectedLang;
      } catch (sttErr: any) {
        console.warn('STT transkripsiya xatosi:', sttErr);
        text = liveTranscript || 'Uchrashuv ovozli yozuvi saqlandi.';
      }

      setTranscribing(false);
      setAnalyzingAi(true);

      const aiRes = await analyzeMeetingWithAi(
        text || 'Qisqa audio yozuv.',
        undefined,
        selectedTemplate,
        liveAgenda.trim() || undefined
      );

      const finalTakeaways = liveAgenda.trim()
        ? [`📝 Jonli kun tartibi & qaydlar: ${liveAgenda.trim()}`, ...(aiRes.key_takeaways || [])]
        : aiRes.key_takeaways;

      const meet: MeetingItem = {
        id: meetId,
        title: meetingTitle.trim() || aiRes.title,
        date: new Date().toISOString(),
        duration: finalDuration,
        language: detectedLang,
        mode: 'analyzed',
        audio_url: persistedUrl,
        audio_path: audio_path,
        transcript: text || 'So‘zlar aniqlanmadi.',
        summary: aiRes.summary,
        decisions: aiRes.decisions,
        action_items: aiRes.action_items,
        key_takeaways: finalTakeaways,
        ai_provider: aiRes.providerUsed,
        ai_model: aiRes.modelUsed,
        tags: [
          'ai-meeting',
          detectedLang,
          template.id,
          audioSource,
          ...(liveAgenda.trim() ? ['with-agenda'] : []),
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onMeetingCreated(meet);
    } catch (err: any) {
      alert(`Xatolik: ${err instanceof Error ? err.message : 'Tahlilda xatolik yuz berdi'}`);
    } finally {
      setTranscribing(false);
      setAnalyzingAi(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopWaveform();
      activeStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      activeStreamsRef.current = [];
      mixedAudioCleanupRef.current?.();
      mixedAudioCleanupRef.current = null;
    };
  }, []);

  const formatTimer = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-[580px] overflow-hidden rounded-3xl border border-white/10 bg-[#12131d] shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 text-white shadow-md">
              <Mic size={18} className={recording && !isPaused ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Uchrashuv Yozish Studiyasi</h2>
              <p className="text-[11px] text-zinc-400">Jonli audio, ekran ovozi & avtomatik AI tahlil</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Uchrashuv Sarlavhasi
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            disabled={recording}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-[13px] text-white focus:border-purple-500 focus:outline-none transition disabled:opacity-60"
          />
        </div>

        {/* Audio Source Selector */}
        {!recording && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              Audio Manbasi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'mic', label: 'Mikrofon', icon: Mic, desc: 'Faqat sizning ovozingiz' },
                { id: 'system', label: 'Ekran / Tizim', icon: Monitor, desc: 'Meet, Zoom, Web ovozi' },
                { id: 'mixed', label: 'Aralash (Miks)', icon: Radio, desc: 'Mikrofon + Tizim' },
              ].map((src) => {
                const Icon = src.icon;
                const isSelected = audioSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setAudioSource(src.id as AudioSourceOption)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/50 text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-[12px] mb-0.5">
                      <Icon size={14} className={isSelected ? 'text-purple-400' : 'text-zinc-400'} />
                      <span>{src.label}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 leading-tight">{src.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Template Selector */}
        {!recording && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              AI Uchrashuv Shabloni
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MEETING_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`p-2 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-purple-500/60 text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-[11.5px] truncate">
                      <span>{tmpl.icon}</span>
                      <span className="truncate">{tmpl.label}</span>
                    </div>
                    <p className="text-[9.5px] text-zinc-500 line-clamp-1 mt-0.5">{tmpl.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Language Selection Row */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-300 font-medium">
            <Globe size={13} className="text-purple-400" />
            <span>Nutq tili:</span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl text-[11px] font-mono">
            {[
              { id: 'auto', label: '🌐 Avto' },
              { id: 'uz', label: '🇺🇿 UZ' },
              { id: 'ru', label: '🇷🇺 RU' },
              { id: 'en', label: '🇬🇧 EN' },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={recording}
                onClick={() => setSelectedLang(l.id as SttLanguage)}
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  selectedLang === l.id
                    ? 'bg-purple-600 text-white font-bold shadow'
                    : 'text-zinc-400 hover:text-white disabled:opacity-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Audio Filters Indicator */}
        <div className="grid grid-cols-3 gap-2 text-[10.5px] font-mono">
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-emerald-400">
            <ShieldCheck size={12} />
            <span className="truncate">Shovqin kesish</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sky-400">
            <Activity size={12} />
            <span className="truncate">Gain Boost</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-purple-400">
            <Headphones size={12} />
            <span className="truncate">Echo yo‘qotish</span>
          </div>
        </div>

        {/* Waveform Canvas & Timer Centerpiece */}
        <div className="flex flex-col items-center justify-center py-6 bg-black/50 rounded-2xl border border-white/[0.06] space-y-3 relative overflow-hidden">
          {/* Pause Banner */}
          {isPaused && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11.5px] font-bold animate-pulse">
              <Pause size={12} />
              <span>PAUZA: Yozib olish to‘xtatildi</span>
            </div>
          )}

          <div className={`font-mono text-[36px] font-black tracking-wider transition ${isPaused ? 'text-amber-300' : 'text-white'}`}>
            {formatTimer(seconds)}
          </div>

          {/* Live Waveform Canvas */}
          <canvas ref={canvasRef} width={380} height={40} className="w-[380px] h-[40px] opacity-90" />

          {/* Volume Meter */}
          {recording && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <span>Signal kuchi:</span>
              <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${isPaused ? 0 : micLevel}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live speech captions preview */}
        {recording && liveText && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-2.5 text-[12px] text-zinc-200 max-h-16 overflow-y-auto font-sans leading-relaxed">
            <span className="text-purple-400 font-mono text-[10px] mr-1.5 font-bold uppercase tracking-wider">Jonli:</span>
            "{liveText}"
          </div>
        )}

        {/* Live Agenda / Notes during recording */}
        <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-zinc-200">
              <BookOpen size={14} className="text-purple-400" />
              <span>Jonli Qaydlar & Kun Tartibi (Live Agenda)</span>
            </div>
            <span className="text-[10px] text-purple-300/80 font-mono">
              AI konspektda hisobga olinadi
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-tight">
            Audio yozilayotgan paytda muhim eslatmalar va kun tartibini yozib boring; yozuv tugagach, AI ushbu qaydlarni ham inobatga oladi.
          </p>
          <textarea
            value={liveAgenda}
            onChange={(e) => setLiveAgenda(e.target.value)}
            rows={recording ? 3 : 2}
            placeholder="• Kun tartibi 1: Yangi loyiha arxitekturasi...&#10;• Muhim eslatma: API kalitlari yangilandi...&#10;• Sardor frontendga mas'ul..."
            className="w-full rounded-xl border border-white/10 bg-black/60 p-2.5 text-[12px] text-zinc-200 placeholder-zinc-500 focus:border-purple-500 focus:outline-none resize-y transition"
          />
        </div>

        {/* Status / Loading indicator */}
        {(transcribing || analyzingAi) && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-[12.5px] text-purple-200 animate-pulse">
            <Loader2 size={16} className="animate-spin text-purple-400" />
            <span>
              {transcribing ? 'Rubai STT nutqni transkripsiya qilmoqda…' : `AI ${getMeetingTemplate(selectedTemplate).label} bo‘yicha tahlil qilmoqda…`}
            </span>
          </div>
        )}

        {/* Permission Denied Guide */}
        {micError === 'PERMISSION_DENIED' ? (
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-[#1a1815] to-black/60 p-4 space-y-3 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertCircle size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="text-[13px] font-bold text-amber-200">
                  Ovoz yozishga ruxsat berilmagan
                </h4>
                <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                  Tizim sozlamalaridan CogniDev ilovasi uchun Mikrofon va Ekran ovozi yozishga ruxsat bering.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-black/60 border border-white/5 p-3 text-[11px] text-zinc-300 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openMicSettings()}
                  className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <span>⚙️ Tizim sozlamalarini ochish</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setMicError(null);
                    await resetMicPermission();
                    setTimeout(() => startRecording(), 400);
                  }}
                  className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <span>🔄 Ruxsatni tiklash</span>
                </button>
              </div>
            </div>
          </div>
        ) : micError ? (
          <p className="text-red-400 text-xs px-2">{micError}</p>
        ) : null}

        {/* Controls */}
        <div className="space-y-2.5">
          {!recording ? (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 py-3.5 text-[14px] font-bold text-white shadow-xl shadow-rose-500/20 hover:brightness-110 active:scale-98 transition"
            >
              <Mic size={17} />
              <span>Yozishni Boshlash</span>
            </button>
          ) : (
            <div className="space-y-2">
              {/* Top Row: Pause/Resume + Discard */}
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={handleResumeRecording}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 py-2.5 text-[12.5px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm"
                  >
                    <Play size={14} className="fill-current" />
                    <span>Davom ettirish</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseRecording}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 py-2.5 text-[12.5px] font-bold text-amber-300 hover:bg-amber-500/30 transition shadow-sm"
                  >
                    <Pause size={14} />
                    <span>Pauza</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDiscardRecording}
                  className="flex items-center justify-center gap-1.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-[12.5px] font-semibold text-rose-400 hover:bg-rose-500/20 transition"
                  title="Yozuvni bekor qilib o‘chirish"
                >
                  <Trash2 size={14} />
                  <span>Bekor qilish</span>
                </button>
              </div>

              {/* Bottom Row: Save Audio Only vs AI Analysis */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleStopAndSave('audio_only')}
                  disabled={transcribing || analyzingAi}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[12px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
                >
                  <FileAudio size={14} />
                  <span>Faqat Audio Saqlash</span>
                </button>

                <button
                  onClick={() => handleStopAndSave('analyze')}
                  disabled={transcribing || analyzingAi}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-purple-500/20 hover:brightness-110 transition disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  <span>AI Tahlil & Saqlash</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: Dedicated AI & Audio Settings (Gemini 2.0 Flash)
// ─────────────────────────────────────────────────────────────
function MeetingSettingsModal({ onClose }: { open?: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<MeetingAiConfig>(getMeetingAiConfig());
  const [testedStatus, setTestedStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    saveMeetingAiConfig(config);
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestedStatus('Tekshirilmoqda…');
    try {
      if (config.useDedicatedKey && config.apiKey) {
        if (config.provider === 'gemini') {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model || 'gemini-2.0-flash')}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with OK' }] }] }),
            }
          );
          if (res.ok) setTestedStatus('✓ Ulanish muvaffaqiyatli! Gemini 2.0 Flash tayyor.');
          else setTestedStatus('✗ API kalit xato yoki kvota tugagan');
        } else {
          setTestedStatus('✓ API sozlamalari kiritildi');
        }
      } else {
        setTestedStatus('✓ Standart tizim provayderi ulanishi tayyor');
      }
    } catch (err: any) {
      setTestedStatus(`✗ Xatolik: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-[500px] overflow-hidden rounded-3xl border border-white/10 bg-[#141520] shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-purple-400" />
            <h2 className="text-[15px] font-bold text-white">Uchrashuvlar uchun Dedicated AI</h2>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Notice on Token Saving */}
        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-[12px] text-purple-200 leading-relaxed">
          💡 <strong>Nima uchun alohida API?</strong> Uchrashuvlar transkripti ko‘p minglab so‘zdan iborat bo‘ladi. Asosiy DeepSeek yoki OpenAI kodlash profilingizdagi kvotani tugatib qo‘ymaslik uchun, bu yerda <strong>Gemini 2.0 Flash</strong> kabi bepul yoki alohida katta kvotali API kalitini kiritishingiz mumkin.
        </div>

        {/* Toggle Dedicated Key */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer">
          <span className="text-[13px] font-medium text-white">Uchrashuvlar uchun alohida API ishlatish</span>
          <input
            type="checkbox"
            checked={config.useDedicatedKey}
            onChange={(e) => setConfig({ ...config, useDedicatedKey: e.target.checked })}
            className="h-4 w-4 rounded accent-purple-600"
          />
        </label>

        {config.useDedicatedKey && (
          <div className="space-y-3.5 border-t border-white/[0.06] pt-3 animate-in fade-in">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                AI Provayder
              </label>
              <select
                value={config.provider}
                onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12.5px] text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="gemini">Google Gemini (Tavsiya etiladi - Katta 1M Token kvota)</option>
                <option value="openai">OpenAI (ChatGPT / gpt-4o-mini)</option>
                <option value="groq">Groq (Llama 3.3 70B - Juda tez)</option>
                <option value="deepseek">DeepSeek (deepseek-chat)</option>
                <option value="ollama">Local Ollama (100% Oflayn va Bepul)</option>
              </select>
            </div>

            {config.provider !== 'ollama' && (
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Dedicated API Kalit ({config.provider})
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy... yoki sk-..."
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12.5px] text-white focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                Model Nomi
              </label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12.5px] text-white focus:border-purple-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* Audio DSP Toggles */}
        <div className="border-t border-white/[0.06] pt-3 space-y-2">
          <span className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
            Audio Shovqin & Masofa Filtrlari
          </span>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoGainControl}
                onChange={(e) => setConfig({ ...config, autoGainControl: e.target.checked })}
                className="h-3.5 w-3.5 rounded accent-purple-600"
              />
              <span className="text-zinc-200">Zal Ovozini Kuchaytirish</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] cursor-pointer">
              <input
                type="checkbox"
                checked={config.noiseSuppression}
                onChange={(e) => setConfig({ ...config, noiseSuppression: e.target.checked })}
                className="h-3.5 w-3.5 rounded accent-purple-600"
              />
              <span className="text-zinc-200">Shovqinni Filtrlash</span>
            </label>
          </div>
        </div>

        {testedStatus && (
          <div className={`p-2.5 rounded-xl text-[11.5px] font-mono ${
            testedStatus.startsWith('✓') ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}>
            {testedStatus}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-3.5 py-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 text-[12px] font-medium transition disabled:opacity-50"
          >
            {isTesting ? 'Tekshirilmoqda…' : 'Ulanishni Sinash'}
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 text-[12.5px] font-bold shadow-lg shadow-purple-600/20 transition"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// ── High-Performance Isolated Meeting Audio Player ─────────────────────────
interface MeetingAudioPlayerProps {
  meeting: MeetingItem;
  onDownload: () => void;
  seekTime?: { time: number; nonce: number } | null;
  onTimeUpdate?: (currentTime: number) => void;
}

const MeetingAudioPlayer = React.memo(function MeetingAudioPlayer({
  meeting,
  onDownload,
  seekTime,
  onTimeUpdate,
}: MeetingAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, [meeting.id]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Handle external seek request (Click-to-Seek from transcript)
  useEffect(() => {
    if (!seekTime) return;
    const targetSec = seekTime.time;

    const performSeek = async () => {
      if (!audioRef.current) {
        let playUrl = meeting.audio_url;
        if (!playUrl || playUrl.startsWith('blob:null')) {
          playUrl = (await resolveMeetingAudioUrl(meeting)) ?? undefined;
        }
        if (!playUrl) return;

        const audio = new Audio(playUrl);
        audio.playbackRate = speed;
        audio.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          onTimeUpdate?.(0);
        };
        audio.ontimeupdate = () => {
          setCurrentTime(audio.currentTime);
          onTimeUpdate?.(audio.currentTime);
        };
        audioRef.current = audio;
      }

      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, targetSec);
        setCurrentTime(targetSec);
        audioRef.current.playbackRate = speed;
        audioRef.current.play().catch((err) => console.warn('Audio play error:', err));
        setIsPlaying(true);
        onTimeUpdate?.(targetSec);
      }
    };

    performSeek();
  }, [seekTime]);

  const handleTogglePlay = async () => {
    if (!audioRef.current) {
      let playUrl = meeting.audio_url;
      if (!playUrl || playUrl.startsWith('blob:null')) {
        playUrl = (await resolveMeetingAudioUrl(meeting)) ?? undefined;
      }
      if (!playUrl) return;

      const audio = new Audio(playUrl);
      audio.playbackRate = speed;
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onTimeUpdate?.(0);
      };
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        onTimeUpdate?.(audio.currentTime);
      };
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = speed;
      audioRef.current.play().catch((err) => console.warn('Audio play error:', err));
      setIsPlaying(true);
    }
  };

  const handleChangeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !meeting.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * meeting.duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    onTimeUpdate?.(targetTime);
  };

  const handleDownloadClick = async () => {
    let playUrl = meeting.audio_url;
    if (!playUrl || playUrl.startsWith('blob:null')) {
      playUrl = (await resolveMeetingAudioUrl(meeting)) ?? undefined;
    }
    if (playUrl) {
      downloadAudioFile(playUrl, meeting.title);
      onDownload();
    }
  };

  const progressPct = meeting.duration ? Math.min(100, (currentTime / meeting.duration) * 100) : 0;

  return (
    <div className="mt-3.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center gap-3">
      <button
        onClick={handleTogglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition shadow-md shrink-0"
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mb-1">
          <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
          <span>{Math.floor((meeting.duration || 0) / 60)}:{((meeting.duration || 0) % 60).toString().padStart(2, '0')}</span>
        </div>
        <div
          onClick={handleSeek}
          className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
        >
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg text-[10.5px] font-mono shrink-0">
        {[1, 1.25, 1.5, 2].map((sp) => (
          <button
            key={sp}
            onClick={() => handleChangeSpeed(sp)}
            className={`px-1.5 py-0.5 rounded ${
              speed === sp ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {sp}x
          </button>
        ))}
        <button
          onClick={handleDownloadClick}
          title="Audioni yuklab olish (.wav)"
          className="p-1 rounded text-zinc-400 hover:text-emerald-300 hover:bg-white/10 transition ml-0.5"
        >
          <Download size={12} />
        </button>
      </div>
    </div>
  );
});

// ── High-Performance Optimized Transcript Viewer (Chunking + Windowing + Editing + Seek + Diarization) ──
interface OptimizedTranscriptViewerProps {
  transcript: string;
  duration?: number;
  currentAudioTime?: number;
  onSeekToTime?: (timeSeconds: number) => void;
  onCopyAll: () => void;
  onSaveTranscript?: (newTranscript: string) => void;
  onDiarizeTranscript?: () => void;
  isDiarizing?: boolean;
  onRenameSpeaker?: (oldName: string, newName: string) => void;
}

// Speaker avatar color theme helper
const getSpeakerTheme = (name: string) => {
  const themes = [
    { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-300', dot: 'bg-purple-400' },
    { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-300', dot: 'bg-sky-400' },
    { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400' },
    { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-300', dot: 'bg-rose-400' },
    { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-300', dot: 'bg-indigo-400' },
    { bg: 'bg-teal-500/15', border: 'border-teal-500/30', text: 'text-teal-300', dot: 'bg-teal-400' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return themes[Math.abs(hash) % themes.length];
};

// Paragraph parser for Speaker and Timestamp
const parseParagraphContent = (
  text: string,
  idx: number,
  total: number,
  duration?: number
) => {
  let speaker: string | null = null;
  let timestampSec: number | null = null;
  let body = text;

  // Format 1: [Speaker] (MM:SS): text  OR  [Speaker]: text
  const matchBracket = text.match(/^\[([^\]]+)\](?:\s*\(([0-9]{1,2}:[0-9]{2})\))?:\s*(.*)$/s);
  if (matchBracket) {
    speaker = matchBracket[1].trim();
    if (matchBracket[2]) {
      const [m, s] = matchBracket[2].split(':').map(Number);
      timestampSec = m * 60 + s;
    }
    body = matchBracket[3] || '';
  } else {
    // Format 2: [MM:SS] Speaker: text
    const matchTimeFirst = text.match(/^\[([0-9]{1,2}:[0-9]{2})\]\s*([^:]+):\s*(.*)$/s);
    if (matchTimeFirst) {
      const [m, s] = matchTimeFirst[1].split(':').map(Number);
      timestampSec = m * 60 + s;
      speaker = matchTimeFirst[2].trim();
      body = matchTimeFirst[3] || '';
    } else {
      // Format 3: Speaker: text (e.g. Farhod: Salom)
      const matchPlain = text.match(/^([A-ZА-ЯЁ][A-Za-zА-Яа-яЁё0-9_\-\s]{1,20}):\s+(.*)$/s);
      if (matchPlain && !matchPlain[1].toLowerCase().startsWith('http') && !matchPlain[1].toLowerCase().startsWith('note')) {
        speaker = matchPlain[1].trim();
        body = matchPlain[2] || '';
      }
    }
  }

  // Fallback estimated timestamp based on position if no timestamp was encoded
  if (timestampSec === null && duration && duration > 0 && total > 0) {
    timestampSec = Math.floor((idx / total) * duration);
  }

  return { speaker, timestampSec, body: body.trim() || text };
};

const OptimizedTranscriptViewer = React.memo(function OptimizedTranscriptViewer({
  transcript,
  duration,
  currentAudioTime,
  onSeekToTime,
  onCopyAll,
  onSaveTranscript,
  onDiarizeTranscript,
  isDiarizing,
  onRenameSpeaker,
}: OptimizedTranscriptViewerProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'raw' | 'edit'>('cards');
  const [transcriptDraft, setTranscriptDraft] = useState(transcript);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [renamingSpeaker, setRenamingSpeaker] = useState<{ oldName: string; draft: string } | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setTranscriptDraft(transcript);
  }, [transcript]);

  // Compute stats
  const stats = useMemo(() => {
    const trimmed = transcript.trim();
    if (!trimmed) return { words: 0, chars: 0, readTimeMinutes: 0 };
    const words = trimmed.split(/\s+/).length;
    const chars = trimmed.length;
    const readTimeMinutes = Math.max(1, Math.round(words / 180));
    return { words, chars, readTimeMinutes };
  }, [transcript]);

  // Split transcript into logical readable paragraphs
  const rawParagraphs = useMemo(() => {
    if (!transcript) return [];
    const rawBlocks = transcript.split(/\n\s*\n/).flatMap((b) => b.split('\n'));
    const result: string[] = [];
    for (const b of rawBlocks) {
      const trimmed = b.trim();
      if (!trimmed) continue;
      if (trimmed.length > 500) {
        const sentences = trimmed.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
        if (sentences && sentences.length > 1) {
          let chunk = '';
          for (const s of sentences) {
            chunk += s;
            if (chunk.length > 250) {
              result.push(chunk.trim());
              chunk = '';
            }
          }
          if (chunk.trim()) result.push(chunk.trim());
        } else {
          result.push(trimmed);
        }
      } else {
        result.push(trimmed);
      }
    }
    return result;
  }, [transcript]);

  // Filtered by search
  const filteredParagraphs = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return rawParagraphs;
    return rawParagraphs.filter((p) => p.toLowerCase().includes(q));
  }, [rawParagraphs, deferredSearch]);

  const displayedParagraphs = useMemo(() => {
    return filteredParagraphs.slice(0, visibleLimit);
  }, [filteredParagraphs, visibleLimit]);

  const hasMore = filteredParagraphs.length > visibleLimit;

  // Highlight matches
  const renderHighlighted = (text: string) => {
    const q = deferredSearch.trim();
    if (!q) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-purple-500/40 text-purple-100 rounded px-1 py-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Transkript ichidan qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 py-1.5 text-[12px] text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none w-56 transition"
            />
          </div>
          {search.trim() && (
            <span className="text-[11px] font-mono text-purple-300">
              {filteredParagraphs.length} ta mos keldi
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          {/* Diarize with AI Button */}
          {onDiarizeTranscript && (
            <button
              type="button"
              onClick={onDiarizeTranscript}
              disabled={isDiarizing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600/25 to-indigo-600/25 border border-purple-500/40 text-purple-200 hover:text-white hover:bg-purple-600/40 text-[11px] font-semibold transition disabled:opacity-50 shadow-sm"
              title="AI yordamida nutqni spikerlar ([Farhod]:, [Sardor]:) bo‘yicha ajratish"
            >
              {isDiarizing ? (
                <Loader2 size={12} className="animate-spin text-purple-400" />
              ) : (
                <Users size={12} className="text-purple-400" />
              )}
              <span>{isDiarizing ? 'Spikerlar ajratilmoqda…' : 'Spikerlarga ajratish'}</span>
            </button>
          )}

          <span className="font-mono bg-white/5 border border-white/10 rounded-lg px-2 py-1">
            {stats.words.toLocaleString()} so‘z · ~{stats.readTimeMinutes} daq o‘qish
          </span>

          <div className="flex items-center rounded-lg border border-white/10 bg-black/30 p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-0.5 rounded text-[11px] transition ${
                viewMode === 'cards' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Abzaslar
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-0.5 rounded text-[11px] transition ${
                viewMode === 'raw' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Asl Matn
            </button>
            <button
              onClick={() => {
                setTranscriptDraft(transcript);
                setViewMode('edit');
              }}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] transition ${
                viewMode === 'edit' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
              title="Transkriptdagi xatolarni to‘g‘rilash"
            >
              <Edit3 size={11} />
              <span>Tahrirlash</span>
            </button>
          </div>

          <button
            onClick={onCopyAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-zinc-300 hover:text-white text-[11px] border border-white/10 transition"
          >
            <Copy size={12} /> Barchasini olish
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'edit' ? (
        <div className="space-y-3">
          <textarea
            value={transcriptDraft}
            onChange={(e) => setTranscriptDraft(e.target.value)}
            rows={14}
            className="w-full rounded-2xl border border-purple-500/40 bg-black/60 p-4 font-mono text-[13px] text-zinc-200 leading-relaxed focus:outline-none focus:border-purple-400 resize-y"
            placeholder="Transkript matnini to‘g‘rilang..."
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setTranscriptDraft(transcript);
                setViewMode('cards');
              }}
              className="px-3.5 py-1.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-[12px] transition"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveTranscript?.(transcriptDraft);
                setViewMode('cards');
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 text-white text-[12px] font-semibold hover:bg-purple-500 transition shadow-md"
            >
              <Check size={13} /> Transkriptni Saqlash
            </button>
          </div>
        </div>
      ) : viewMode === 'raw' ? (
        <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-5 font-mono text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap selection:bg-purple-500/30 max-h-[600px] overflow-y-auto">
          {transcript}
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedParagraphs.map((paragraph, idx) => {
            const parsed = parseParagraphContent(paragraph, idx, filteredParagraphs.length, duration);
            const isActiveTime =
              currentAudioTime !== undefined &&
              parsed.timestampSec !== null &&
              Math.abs(currentAudioTime - parsed.timestampSec) <= 4;
            const speakerTheme = parsed.speaker ? getSpeakerTheme(parsed.speaker) : null;

            return (
              <div
                key={idx}
                className={`group relative rounded-xl border p-3.5 text-[13px] leading-relaxed transition ${
                  isActiveTime
                    ? 'border-purple-500/60 bg-gradient-to-r from-purple-950/35 via-indigo-950/20 to-transparent shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.035] text-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    {/* Top Meta Bar: Click-to-Seek Time Button & Speaker Pill */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Click-to-Seek Button */}
                      {parsed.timestampSec !== null && (
                        <button
                          type="button"
                          onClick={() => onSeekToTime?.(parsed.timestampSec!)}
                          title={`Audioda ushbu joyga sakrash (${Math.floor(parsed.timestampSec / 60)}:${(parsed.timestampSec % 60).toString().padStart(2, '0')})`}
                          className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-lg border transition ${
                            isActiveTime
                              ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-sm animate-pulse'
                              : 'bg-white/5 hover:bg-purple-600/30 text-zinc-400 hover:text-purple-200 border-white/5 hover:border-purple-500/30'
                          }`}
                        >
                          <Play size={8} className="fill-current text-purple-400" />
                          <span>
                            {Math.floor(parsed.timestampSec / 60)}:{(parsed.timestampSec % 60).toString().padStart(2, '0')}
                          </span>
                        </button>
                      )}

                      {/* Speaker Badge with 1-click rename */}
                      {parsed.speaker && speakerTheme && (
                        renamingSpeaker?.oldName === parsed.speaker ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              value={renamingSpeaker.draft}
                              onChange={(e) => setRenamingSpeaker({ ...renamingSpeaker, draft: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (renamingSpeaker.draft.trim()) {
                                    onRenameSpeaker?.(renamingSpeaker.oldName, renamingSpeaker.draft.trim());
                                  }
                                  setRenamingSpeaker(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingSpeaker(null);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-black border border-purple-400 text-white text-[11px] font-semibold w-28 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (renamingSpeaker.draft.trim()) {
                                  onRenameSpeaker?.(renamingSpeaker.oldName, renamingSpeaker.draft.trim());
                                }
                                setRenamingSpeaker(null);
                              }}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingSpeaker(null)}
                              className="p-1 text-zinc-500 hover:text-zinc-300"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${speakerTheme.bg} ${speakerTheme.border} ${speakerTheme.text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${speakerTheme.dot}`} />
                            <span>{parsed.speaker}</span>
                            {onRenameSpeaker && (
                              <button
                                type="button"
                                onClick={() => setRenamingSpeaker({ oldName: parsed.speaker!, draft: parsed.speaker! })}
                                title={`"${parsed.speaker}" ismini barcha joyda o‘zgartirish`}
                                className="opacity-60 hover:opacity-100 hover:text-white transition ml-0.5"
                              >
                                <Edit3 size={9} />
                              </button>
                            )}
                          </span>
                        )
                      )}
                    </div>

                    {/* Paragraph Content */}
                    <div
                      onClick={() => {
                        if (parsed.timestampSec !== null) onSeekToTime?.(parsed.timestampSec);
                      }}
                      className="font-sans whitespace-pre-wrap cursor-pointer"
                    >
                      {renderHighlighted(parsed.body)}
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => navigator.clipboard.writeText(paragraph)}
                      title="Ushbu abzasdan nusxa olish"
                      className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition"
                    >
                      <Copy size={11} />
                    </button>
                    <span className="font-mono text-[10px] text-zinc-600 select-none">
                      #{idx + 1}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-2 flex items-center justify-between text-[11.5px] text-zinc-400 border-t border-white/[0.06]">
              <span>
                Ko‘rsatilmoqda: {displayedParagraphs.length} / {filteredParagraphs.length} ta abzas
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVisibleLimit((v) => v + 50)}
                  className="px-3 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-[11px] font-medium transition"
                >
                  +50 ta ko‘rsatish
                </button>
                <button
                  onClick={() => setVisibleLimit(filteredParagraphs.length)}
                  className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white text-[11px] transition"
                >
                  Barchasini ko‘rsatish
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// MODAL: Meeting Stats & Insights Dashboard (📊 Uchrashuvlar Analitikasi)
// ─────────────────────────────────────────────────────────────
interface MeetingStatsModalProps {
  meetings: MeetingItem[];
  spaces: { id: string; name: string; icon?: string }[];
  onClose: () => void;
}

function MeetingStatsModal({ meetings, spaces: _spaces, onClose }: MeetingStatsModalProps) {
  const stats = useMemo(() => {
    const totalMeetings = meetings.length;
    const activeMeetings = meetings.filter((m) => !m.tags?.includes('archived')).length;
    const archivedMeetings = meetings.filter((m) => m.tags?.includes('archived')).length;

    const totalDurationSecs = meetings.reduce((acc, m) => acc + (m.duration || 0), 0);
    const totalHours = Math.floor(totalDurationSecs / 3600);
    const totalMins = Math.floor((totalDurationSecs % 3600) / 60);

    const allActions = meetings.flatMap((m) => m.action_items || []);
    const totalActions = allActions.length;
    const completedActions = allActions.filter((a) => a.completed).length;
    const pendingActions = totalActions - completedActions;
    const completionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
    const syncedToTasks = allActions.filter((a) => a.added_to_tasks).length;

    const allDecisions = meetings.flatMap((m) => m.decisions || []);

    // Weekly stats (last 7 days)
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weeklyMeetings = meetings.filter((m) => new Date(m.date).getTime() >= sevenDaysAgo);
    const weeklyAudioSecs = weeklyMeetings.reduce((acc, m) => acc + (m.duration || 0), 0);
    const weeklyHours = Math.floor(weeklyAudioSecs / 3600);
    const weeklyMins = Math.floor((weeklyAudioSecs % 3600) / 60);

    // Assignee stats
    const assigneeMap = new Map<string, { total: number; completed: number }>();
    allActions.forEach((act) => {
      const name = act.assignee?.trim() || 'Jamoa';
      const existing = assigneeMap.get(name) || { total: 0, completed: 0 };
      existing.total += 1;
      if (act.completed) existing.completed += 1;
      assigneeMap.set(name, existing);
    });
    const topAssignees = Array.from(assigneeMap.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        completed: data.completed,
        rate: Math.round((data.completed / data.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    // Template Breakdown
    const templateCounts = MEETING_TEMPLATES.map((tmpl) => {
      const count = meetings.filter((m) => m.tags?.includes(tmpl.id)).length;
      return {
        ...tmpl,
        count,
        pct: totalMeetings > 0 ? Math.round((count / totalMeetings) * 100) : 0,
      };
    });

    return {
      totalMeetings,
      activeMeetings,
      archivedMeetings,
      totalDurationSecs,
      totalHours,
      totalMins,
      totalActions,
      completedActions,
      pendingActions,
      completionRate,
      syncedToTasks,
      totalDecisions: allDecisions.length,
      weeklyMeetingsCount: weeklyMeetings.length,
      weeklyHours,
      weeklyMins,
      topAssignees,
      templateCounts,
    };
  }, [meetings]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#12131d] shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-white tracking-wide">
                Uchrashuvlar Analitikasi & Hisobotlar
              </h2>
              <p className="text-[11.5px] text-zinc-400">
                Statistika, audio soatlari va vazifalar bajarilish samaradorligi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X size={17} />
          </button>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Meetings */}
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4 space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              Jami Uchrashuvlar
            </span>
            <div className="text-2xl font-black text-white">{stats.totalMeetings}</div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="text-emerald-400">{stats.activeMeetings} faol</span>
              <span>·</span>
              <span className="text-amber-400">{stats.archivedMeetings} arxivda</span>
            </div>
          </div>

          {/* Audio Hours */}
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4 space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              Umumiy Audio
            </span>
            <div className="text-2xl font-black text-purple-300">
              {stats.totalHours} <span className="text-sm font-normal text-zinc-400">soat</span> {stats.totalMins} <span className="text-sm font-normal text-zinc-400">daq</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              O‘rtacha: {stats.totalMeetings > 0 ? Math.round(stats.totalDurationSecs / stats.totalMeetings / 60) : 0} daqiqa/uchrashuv
            </div>
          </div>

          {/* Action Items Completion */}
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4 space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              Vazifalar Bajarilishi
            </span>
            <div className="text-2xl font-black text-emerald-400">
              {stats.completionRate}%
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
            <div className="text-[10.5px] text-zinc-400">
              {stats.completedActions} / {stats.totalActions} ta bajarildi
            </div>
          </div>

          {/* Weekly Report */}
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4 space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              Haftalik Hisobot
            </span>
            <div className="text-2xl font-black text-sky-300">
              {stats.weeklyMeetingsCount} <span className="text-sm font-normal text-zinc-400">uchrashuv</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              {stats.weeklyHours > 0 ? `${stats.weeklyHours} soat ` : ''}{stats.weeklyMins} daqiqa so‘nggi 7 kunda
            </div>
          </div>
        </div>

        {/* Middle Section: Template Breakdown & Top Assignees */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Templates Breakdown */}
          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-3">
            <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" />
              <span>Shablonlar Bo‘yicha Taqsimot</span>
            </h3>
            <div className="space-y-2 pt-1">
              {stats.templateCounts.map((tmpl) => (
                <div key={tmpl.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span>{tmpl.icon}</span>
                      <span>{tmpl.label}</span>
                    </span>
                    <span className="font-mono text-zinc-400">
                      {tmpl.count} ta ({tmpl.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${tmpl.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Assignees & Task Completion */}
          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-3">
            <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
              <Users size={14} className="text-indigo-400" />
              <span>Mas'ul Shaxslar & Vazifalar Bajarilishi</span>
            </h3>
            <div className="space-y-2 pt-1">
              {stats.topAssignees.length === 0 ? (
                <p className="text-[11.5px] text-zinc-500 py-4 text-center">
                  Hozircha mas'ullarga biriktirilgan vazifalar yo‘q
                </p>
              ) : (
                stats.topAssignees.map((assignee) => (
                  <div
                    key={assignee.name}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                        {assignee.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium text-zinc-200">{assignee.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-zinc-400">
                        {assignee.completed}/{assignee.total}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${
                          assignee.rate === 100
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : assignee.rate > 50
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {assignee.rate}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span>💡 Qarorlar: <strong className="text-white font-mono">{stats.totalDecisions} ta</strong></span>
            <span>·</span>
            <span>Todo tizimiga ulangan: <strong className="text-white font-mono">{stats.syncedToTasks} ta</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[12px] font-semibold transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
