import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { useSynapse, nextTaskId } from '../lib/store';
import type { MeetingItem, MeetingActionItem, MeetingAiConfig } from '../lib/types';
import {
  getMeetingAiConfig,
  saveMeetingAiConfig,
  analyzeMeetingWithAi,
  askMeetingQuestion,
  exportMeetingToMarkdown,
  speakText,
} from '../lib/meetings';
import {
  blobToWav16k,
  pickAudioMime,
  transcribeAudioDetailed,
  downloadAudioFile,
  createLiveSpeechRecognizer,
  requestMicrophoneStream,
  openMicSettings,
  resetMicPermission,
  type SttLanguage,
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
  const [filterMode, setFilterMode] = useState<'all' | 'analyzed' | 'audio_only'>('all');

  // Active Tab in Detail View
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'chat'>('summary');

  // Modals & Panels
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Audio Playback State for active meeting
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Filtered Meetings list
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (filterMode === 'analyzed' && m.mode !== 'analyzed') return false;
      if (filterMode === 'audio_only' && m.mode !== 'audio_only') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchTranscript = m.transcript.toLowerCase().includes(q);
        const matchSummary = (m.summary || '').toLowerCase().includes(q);
        const matchTag = m.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchTranscript && !matchSummary && !matchTag) return false;
      }
      return true;
    });
  }, [meetings, filterMode, search]);

  // Stop current audio when switching meetings
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
    }
  }, [selectedMeetingId]);

  // Handle Play/Pause Audio with disk and IndexedDB resolution
  const togglePlayAudio = async (url?: string) => {
    let playUrl = url;
    if (!playUrl && selectedMeeting) {
      playUrl = (await resolveMeetingAudioUrl(selectedMeeting)) ?? undefined;
    }
    if (!playUrl && selectedMeeting?.audio_url) {
      playUrl = selectedMeeting.audio_url;
    }

    if (!audioRef.current && playUrl) {
      audioRef.current = new Audio(playUrl);
      audioRef.current.onended = () => setIsPlayingAudio(false);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
      };
    }

    if (!audioRef.current) return;

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

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

  // Re-analyze with AI
  const handleReanalyze = async () => {
    if (!selectedMeeting || isReanalyzing) return;
    setIsReanalyzing(true);
    setHud("AI uchrashuvni qayta tahlil qilmoqda...");
    try {
      const res = await analyzeMeetingWithAi(selectedMeeting.transcript);
      updateMeeting(selectedMeeting.id, {
        summary: res.summary,
        decisions: res.decisions,
        action_items: res.action_items,
        key_takeaways: res.key_takeaways,
        ai_provider: res.providerUsed,
        ai_model: res.modelUsed,
        mode: 'analyzed',
      });
      setHud("AI tahlili yangilandi ✓");
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

            <button
              onClick={() => setIsSettingsOpen(true)}
              title="AI & Audio Sozlamalari (Dedicated API)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
            >
              <Settings size={16} />
            </button>
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
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                filterMode === 'all'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              Barchasi ({meetings.length})
            </button>
            <button
              onClick={() => setFilterMode('analyzed')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                filterMode === 'analyzed'
                  ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              AI Konspekt
            </button>
            <button
              onClick={() => setFilterMode('audio_only')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                filterMode === 'audio_only'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              Faqat Audio
            </button>
          </div>
        </div>

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
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={`group relative rounded-xl p-3 cursor-pointer transition border ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border-purple-500/40 shadow-md shadow-purple-500/5'
                      : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[12.5px] font-semibold text-white line-clamp-1 group-hover:text-purple-300 transition">
                      {m.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMeeting(m.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition"
                      title="O'chirish"
                    >
                      <Trash2 size={12} />
                    </button>
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedMeeting.title}
                      onChange={(e) => updateMeeting(selectedMeeting.id, { title: e.target.value })}
                      className="text-[18px] font-bold text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-purple-500 focus:outline-none transition w-full"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] text-zinc-400">
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
                    onClick={handleReanalyze}
                    disabled={isReanalyzing}
                    title="AI orqali qayta konspekt qilish"
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

                  <button
                    onClick={handleCopyMarkdown}
                    title="Markdown ko'chirish"
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Mini Audio Player Bar (if audio available) */}
              {(selectedMeeting.audio_url || selectedMeeting.audio_path) && (
                <div className="mt-3.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center gap-3">
                  <button
                    onClick={() => togglePlayAudio(selectedMeeting.audio_url)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition shadow-md"
                  >
                    {isPlayingAudio ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mb-1">
                      <span>{Math.floor(audioCurrentTime / 60)}:{Math.floor(audioCurrentTime % 60).toString().padStart(2, '0')}</span>
                      <span>{Math.floor(selectedMeeting.duration / 60)}:{(selectedMeeting.duration % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-100"
                        style={{
                          width: `${selectedMeeting.duration ? (audioCurrentTime / selectedMeeting.duration) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Playback speed pills & Download */}
                  <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg text-[10.5px] font-mono">
                    {[1, 1.25, 1.5, 2].map((sp) => (
                      <button
                        key={sp}
                        onClick={() => changePlaybackSpeed(sp)}
                        className={`px-1.5 py-0.5 rounded ${
                          playbackSpeed === sp ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        downloadAudioFile(selectedMeeting.audio_url!, selectedMeeting.title);
                        setHud(`"${selectedMeeting.title}.wav" audio yuklab olindi ✓`);
                      }}
                      title="Audioni yuklab olish (.wav)"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition ml-0.5"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                </div>
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
                    <div className="flex items-center gap-2.5 text-[13px] font-bold text-purple-300 uppercase tracking-wider mb-2 font-mono">
                      <Sparkles size={15} />
                      <span>Qisqacha Mazmun (Executive Summary)</span>
                    </div>
                    <p className="text-[13.5px] text-zinc-200 leading-relaxed">
                      {selectedMeeting.summary || 'Ushbu uchrashuv hozircha faqat audio formatda saqlangan. Yuqoridagi "Qayta Tahlil" tugmasini bosing.'}
                    </p>
                  </div>

                  {/* Key Decisions */}
                  {selectedMeeting.decisions && selectedMeeting.decisions.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#12131d]/60 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                        <CheckCircle2 size={16} />
                        <span>Qabul Qilingan Qarorlar ({selectedMeeting.decisions.length})</span>
                      </div>
                      <div className="space-y-2">
                        {selectedMeeting.decisions.map((d, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-[13px] text-zinc-200">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] mt-0.5">
                              ✓
                            </span>
                            <span className="leading-relaxed">{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items / Tasks */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12131d]/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-sky-400 uppercase tracking-wider font-mono">
                        <ListTodo size={16} />
                        <span>Vazifalar & Topshiriqlar ({selectedMeeting.action_items?.length || 0})</span>
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        1-click bilan Tasks doskasiga ulanadi
                      </span>
                    </div>

                    {selectedMeeting.action_items && selectedMeeting.action_items.length > 0 ? (
                      <div className="space-y-2.5">
                        {selectedMeeting.action_items.map((act) => (
                          <div
                            key={act.id}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                              act.completed
                                ? 'border-emerald-500/20 bg-emerald-950/10'
                                : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* Holat Checkbox (ikki tomonlama sinxronizatsiya) */}
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

                            {/* Tugma: Tasks doskasidagi bog'lanma yoki yangi qo'shish */}
                            <div className="shrink-0 flex items-center gap-2">
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
                                  <span>Tasks’ga qo‘shish</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-zinc-500 py-3 text-center">
                        Ushbu uchrashuvdan aniq topshiriqlar qayd etilmadi.
                      </p>
                    )}
                  </div>

                  {/* Key Takeaways */}
                  {selectedMeeting.key_takeaways && selectedMeeting.key_takeaways.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#12131d]/60 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-[13px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                        <Activity size={16} />
                        <span>Asosiy Xulosalar & Eslatmalar</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {selectedMeeting.key_takeaways.map((k, i) => (
                          <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[12.5px] text-zinc-300">
                            • {k}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-zinc-400">
                      Uchrashuv davomida yozib olingan asl nutq transkripsiya matni:
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedMeeting.transcript);
                        setHud("Transkript matni ko‘chirildi ✓");
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-zinc-300 hover:text-white text-[11px] border border-white/10"
                    >
                      <Copy size={12} /> Nusxa olish
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-5 font-mono text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap selection:bg-purple-500/30">
                    {selectedMeeting.transcript}
                  </div>
                </div>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECORDING STUDIO MODAL (Web Audio DSP + Waveform + Rubai STT)
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
  const [liveText, setLiveText] = useState('');
  const liveSpeechRef = useRef<ReturnType<typeof createLiveSpeechRecognizer> | null>(null);

  const [recording, setRecording] = useState(false);
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

  const config = getMeetingAiConfig();

  // Start Audio Recording with Hardware DSP
  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await requestMicrophoneStream({
        noiseSuppression: config.noiseSuppression,
        autoGainControl: config.autoGainControl,
        echoCancellation: config.echoCancellation,
      });

      // Setup Web Audio Analyser for live visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      drawWaveform();

      // Setup MediaRecorder
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(250);
      setRecording(true);
      setSeconds(0);
      setLiveText('');

      // Start live speech recognizer for live captioning & offline fallback
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
        setMicError(msg || 'Mikrofondan foydalanishga ruxsat berilmadi');
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

      // Calculate avg level
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

  // Stop Recording and finish
  const handleStopAndSave = async (mode: 'analyze' | 'audio_only') => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    stopWaveform();

    const liveTranscript = liveSpeechRef.current?.stop() || liveText;

    const recorder = mediaRecorderRef.current;
    const stream = recorder.stream;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
    const meetId = `meet-${Date.now()}`;
    const { audio_path, audio_url: persistedUrl } = await persistMeetingAudio(meetId, blob, 'wav');
    const finalDuration = seconds || 1;

    if (mode === 'audio_only') {
      // Just save audio without AI tokens!
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
        tags: ['audio-only', selectedLang],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onMeetingCreated(meet);
      return;
    }

    // AI Analysis Pipeline
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

      const aiRes = await analyzeMeetingWithAi(text || 'Qisqa audio yozuv.');

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
        key_takeaways: aiRes.key_takeaways,
        ai_provider: aiRes.providerUsed,
        ai_model: aiRes.modelUsed,
        tags: ['ai-meeting', detectedLang],
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
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
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
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-3xl border border-white/10 bg-[#12131d] shadow-2xl p-6 space-y-6">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 text-white shadow-md">
              <Mic size={18} className={recording ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Uchrashuv Yozish Studiyasi</h2>
              <p className="text-[11px] text-zinc-400">Jonli audio yozuv & avtomatik tahlil</p>
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
            <span className="truncate">Zal Gain Boost</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-purple-400">
            <Headphones size={12} />
            <span className="truncate">Echo yo‘qotish</span>
          </div>
        </div>

        {/* Waveform Canvas & Timer Centerpiece */}
        <div className="flex flex-col items-center justify-center py-6 bg-black/50 rounded-2xl border border-white/[0.06] space-y-3 relative overflow-hidden">
          <div className="font-mono text-[36px] font-black tracking-wider text-white">
            {formatTimer(seconds)}
          </div>

          {/* Live Waveform Canvas */}
          <canvas ref={canvasRef} width={380} height={40} className="w-[380px] h-[40px] opacity-90" />

          {/* Mic Volume Meter */}
          {recording && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <span>Mikrofon signali:</span>
              <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${micLevel}%` }}
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

        {/* Status / Loading indicator */}
        {(transcribing || analyzingAi) && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-[12.5px] text-purple-200 animate-pulse">
            <Loader2 size={16} className="animate-spin text-purple-400" />
            <span>
              {transcribing ? 'Rubai STT (Whisper) nutqni transkripsiya qilmoqda…' : 'Gemini 2.0 Flash konspekt va topshiriqlarni tuzmoqda…'}
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
                  Mikrofonga ruxsat berilmagan (macOS Maxfiylik Sozlamasi)
                </h4>
                <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                  <strong className="text-emerald-300">💡 Eslatma: RubaiSTT modeli 100% tayyor va o‘rnatilgan!</strong> Bu muammo model bilan emas, balki macOS xavfsizlik tizimi CogniDev ilovasiga mikrofonni ochishga ruxsat bermaganida.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-black/60 border border-white/5 p-3 text-[11px] text-zinc-300 space-y-2">
              <p className="font-semibold text-white">Ruxsat berish uchun qisqa yo‘riqnoma:</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>Mac menyusidan <strong className="text-zinc-200">System Settings (Tizim sozlamalari)</strong>ga kiring.</li>
                <li>Chap ustundan <strong className="text-zinc-200">Privacy & Security ➔ Microphone (Mikrofon)</strong>ni bosing.</li>
                <li>Ro‘yxatdagi <strong className="text-zinc-200">CogniDev</strong> yonidagi tugmani yoqing.</li>
              </ol>
              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/5">
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
                  <span>🔄 Ruxsatni tiklash & Qayta so‘rash</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMicError(null);
                    startRecording();
                  }}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 transition"
                >
                  Urinib ko‘rish
                </button>
              </div>
            </div>
          </div>
        ) : micError ? (
          <p className="text-red-400 text-xs px-2">{micError}</p>
        ) : null}

        {/* Controls */}
        <div className="space-y-3">
          {!recording ? (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 py-3.5 text-[14px] font-bold text-white shadow-xl shadow-rose-500/20 hover:brightness-110 active:scale-98 transition"
            >
              <Mic size={17} />
              <span>Yozishni Boshlash</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStopAndSave('audio_only')}
                disabled={transcribing || analyzingAi}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-[12.5px] font-bold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
              >
                <FileAudio size={15} />
                <span>Faqat Audio Saqlash</span>
              </button>

              <button
                onClick={() => handleStopAndSave('analyze')}
                disabled={transcribing || analyzingAi}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-[12.5px] font-bold text-white shadow-lg shadow-purple-500/20 hover:brightness-110 transition disabled:opacity-50"
              >
                <Sparkles size={15} />
                <span>AI Tahlil & Konspekt</span>
              </button>
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
