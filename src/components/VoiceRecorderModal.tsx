import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react';
import { Mic, Loader2, Save, X, Copy, Sparkles, Bell, Clock, FileText, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { useSynapse, nextTaskId } from '../lib/store';
import { insertTask, upsertResolution } from '../lib/db';
import { formatVoiceWithOllama } from '../lib/voice';
import { analyzeVoiceIntent } from '../lib/ai';
import { SOURCE_LABELS } from '../lib/providers';
import { blobToWav16k, pickAudioMime, rubaiStatus, transcribeRubai, requestMicrophoneStream, openMicSettings, resetMicPermission, type SttStatus } from '../lib/stt';
import { parseNaturalTimeToIso } from '../lib/notifications';
import type { Task, VoiceIntentResult } from '../lib/types';

type Mode = 'ai_smart' | 'task' | 'append';
type Engine = 'web' | 'rubai';

export default function VoiceRecorderModal({
  open,
  onClose,
  targetNoteDocId,
  onAppendText,
}: {
  open: boolean;
  onClose: () => void;
  targetNoteDocId?: string;
  onAppendText?: (text: string) => void;
}) {
  const {
    selectedTaskId,
    selectedNoteId,
    notesDocs,
    addTask,
    updateNote,
    updateNoteDoc,
    createNote,
    dbMode,
    setHud,
    mainView,
    addReminder,
  } = useSynapse();

  const [mode, setMode] = useState<Mode>(targetNoteDocId || mainView === 'notes' ? 'append' : 'ai_smart');
  const [engine, setEngine] = useState<Engine>('rubai');
  const [stt, setStt] = useState<SttStatus | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  // AI Intent Analysis state
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<VoiceIntentResult | null>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableTimeString, setEditableTimeString] = useState('');
  const [customTargetIso, setCustomTargetIso] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleAudioFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setTranscribing(true);
    setTranscript('Audio fayl o‘qilmoqda va matnga aylantirilmoqda...');
    try {
      const wav = await blobToWav16k(file);
      const text = await transcribeRubai(wav, 'uz');
      if (!text) {
        setError('Audio fayldan hech qanday so‘z aniqlanmadi');
        setTranscript('');
      } else {
        const full = (finalTranscript ? finalTranscript + ' ' : '') + text;
        setFinalTranscript(full);
        setTranscript('');
        triggerAiAnalysis(full);
      }
    } catch (err: any) {
      console.warn('[handleAudioFile] error:', err);
      setError(err instanceof Error ? err.message : 'Audio faylni transkripsiya qilishda xatolik yuz berdi');
      setTranscript('');
    } finally {
      setTranscribing(false);
      if (e.target) e.target.value = '';
    }
  }

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    timerRef.current = null;
    silenceTimerRef.current = null;
    recognitionRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => {
    if (open) {
      rubaiStatus()
        .then((s) => {
          setStt(s);
          if (s?.ready) {
            setEngine('rubai');
          } else {
            setEngine('web');
          }
        })
        .catch(() => {
          setStt(null);
          setEngine('web');
        });
      setAiAnalysis(null);
      setError(null);
    }
    return () => {
      cleanup();
    };
  }, [open, cleanup]);

  // Trigger AI intent analysis whenever a complete transcript is ready
  const triggerAiAnalysis = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;
    setIsAnalyzingAi(true);
    setError(null);
    try {
      const res = await analyzeVoiceIntent(textToAnalyze);
      setAiAnalysis(res);
      setEditableTitle(res.title);
      setEditableTimeString(res.timeString || 'Bugun, 10:00');
      if (res.targetTime) {
        setCustomTargetIso(res.targetTime);
      } else {
        const timeCalc = parseNaturalTimeToIso(res.timeString || '10:00');
        setCustomTargetIso(timeCalc.iso);
      }
    } catch (err: any) {
      console.warn('[triggerAiAnalysis] error:', err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  async function startRecording() {
    setError(null);
    setAiAnalysis(null);
    try {
      const stream = await requestMicrophoneStream();
      const mime = pickAudioMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      if (engine === 'web') startSpeechRecognition();
    } catch (e: any) {
      console.warn('[startRecording] getUserMedia error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      if (
        e?.name === 'NotAllowedError' ||
        e?.name === 'PermissionDeniedError' ||
        msg.toLowerCase().includes('not allowed') ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('denied')
      ) {
        setError('PERMISSION_DENIED');
      } else {
        setError(msg || 'Mikrofondan foydalanishga ruxsat berilmadi');
      }
    }
  }

  async function stopRecording() {
    if (!recording) return;
    if (mediaRecorderRef.current?.state === 'recording') {
      await new Promise<void>((resolve) => {
        const mr = mediaRecorderRef.current!;
        mr.onstop = () => resolve();
        mr.stop();
        setTimeout(() => resolve(), 1500);
      });
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setRecording(false);
    if (engine === 'rubai') {
      await transcribeWithRubai();
    } else if (engine === 'web' && finalTranscript.trim()) {
      triggerAiAnalysis(finalTranscript);
    }
  }

  async function transcribeWithRubai() {
    if (!chunksRef.current.length) {
      setError('Audio yozilmadi');
      return;
    }
    setTranscribing(true);
    setError(null);
    try {
      const blob = new Blob(chunksRef.current, { type: pickAudioMime() || 'audio/webm' });
      const wav = await blobToWav16k(blob);
      const text = await transcribeRubai(wav, 'uz');
      if (!text) {
        setError('Transkripsiya bo‘sh qaytdi — qayta urinib ko‘ring');
      } else {
        const full = (finalTranscript ? finalTranscript + ' ' : '') + text;
        setFinalTranscript(full);
        triggerAiAnalysis(full);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RubaiSTT xatosi');
    } finally {
      setTranscribing(false);
    }
  }

  function startSpeechRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Brauzer ovozli kiritishni qo‘llamaydi');
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'uz-UZ'; // primary Uzbek, falls back
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript + ' ';
        else interim += res[0].transcript;
      }
      if (final) {
        setFinalTranscript((prev) => {
          const updated = prev + final;
          triggerAiAnalysis(updated);
          return updated;
        });
        setTranscript('');
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      } else if (interim) {
        setTranscript(interim);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error', e.error);
    };
    rec.start();
  }

  const displayText =
    finalTranscript + (transcript ? ` <span className="text-zinc-500 italic">${transcript}</span>` : '');

  async function onSave() {
    const fullText = (finalTranscript + transcript).trim();
    if (!fullText) {
      setError('Hech qanday ovoz yoki matn yozib olinmadi');
      return;
    }
    setProcessing(true);

    try {
      // 1. AI SMART MODE (Auto-detect Reminder, Task or Note)
      if (mode === 'ai_smart' && aiAnalysis) {
        if (aiAnalysis.intent === 'reminder') {
          // Schedule Notification / Cron
          const title = editableTitle.trim() || aiAnalysis.title || 'Ovozli Bildirishnoma';
          const timeStr = editableTimeString.trim() || aiAnalysis.timeString || '10:00';
          const targetIso = customTargetIso || aiAnalysis.targetTime || new Date(Date.now() + 15 * 60 * 1000).toISOString();

          // Create Task in Stream
          const now = new Date().toISOString();
          const id = nextTaskId(useSynapse.getState().tasks);
          const profile = useSynapse.getState().userProfile;

          const t: Task = {
            id,
            workspace_id: useSynapse.getState().activeWorkspaceId,
            title,
            status: 'active',
            priority: aiAnalysis.priority || 'Normal',
            git_branch: null,
            pr_url: null,
            ai_source: 'AI Ovozli Eslatma',
            assignee_name: profile.full_name || 'Muhandis',
            assignee_avatar: profile.avatar_initials || 'CD',
            assignee_name2: null,
            assignee_avatar2: null,
            tags: ['eslatma', 'ovozli'],
            due_time: timeStr,
            reminder_enabled: true,
            created_at: now,
            updated_at: now,
          };

          if (dbMode === 'sqlite') await insertTask(t);
          addTask(t);

          const note = `# ⏰ ${title}\n\n**Eslatma vaqti:** ${timeStr}\n\n> 🎙️ **Ovozli yozuv matni:**\n> ${fullText}\n\n${aiAnalysis.description}`;
          if (dbMode === 'sqlite') await upsertResolution(id, note, '[]');
          await useSynapse.getState().selectTask(id);

          // Add scheduled reminder
          await addReminder({
            title,
            description: `Vazifa eslatmasi (${id}): ${title}`,
            source_type: 'voice',
            source_id: id,
            target_time: targetIso,
            time_string: timeStr,
            cron_expression: aiAnalysis.cronExpression || null,
            sound_enabled: true,
          });

          setHud(`⏰ "${title}" uchun ${timeStr} ga bildirishnoma va cron rejalashtirildi ✓`);
          onClose();
          return;
        }

        if (aiAnalysis.intent === 'task') {
          const title = editableTitle.trim() || aiAnalysis.title;
          const now = new Date().toISOString();
          const id = nextTaskId(useSynapse.getState().tasks);
          const profile = useSynapse.getState().userProfile;

          const t: Task = {
            id,
            workspace_id: useSynapse.getState().activeWorkspaceId,
            title,
            status: 'active',
            priority: aiAnalysis.priority || 'Normal',
            git_branch: null,
            pr_url: null,
            ai_source: 'AI Ovozli Tahlil',
            assignee_name: profile.full_name || 'Muhandis',
            assignee_avatar: profile.avatar_initials || 'CD',
            assignee_name2: null,
            assignee_avatar2: null,
            tags: ['ovozli-vazifa'],
            created_at: now,
            updated_at: now,
          };

          if (dbMode === 'sqlite') await insertTask(t);
          addTask(t);
          const note = `# ${title}\n\n> 🎙️ **Ovozli topshiriq:**\n> ${fullText}\n\n${aiAnalysis.description}`;
          if (dbMode === 'sqlite') await upsertResolution(id, note, '[]');
          await useSynapse.getState().selectTask(id);
          setHud(`📋 ${id} vazifasi yaratildi ✓`);
          onClose();
          return;
        }

        // Note intent
        const title = editableTitle.trim() || aiAnalysis.title || 'Ovozli Qayd';
        const newNoteId = await createNote(title);
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await updateNoteDoc(newNoteId, {
          content: `# ${title}\n\n> 🎙️ **Ovozli eslatma (${nowTime}):**\n\n${fullText}\n\n${aiAnalysis.description}`,
        });
        setHud(`📝 "${title}" nomli yangi qayd saqlandi ✓`);
        onClose();
        return;
      }

      // 2. STANDARD TASK OR APPEND MODE
      let structured = fullText;
      let formattedBy = '';
      if (mode === 'task') {
        const r = await formatVoiceWithOllama(fullText).catch(() => null);
        if (r) {
          structured = r.text;
          formattedBy = r.source === 'fallback' ? '' : ` · ${SOURCE_LABELS[r.source]}${r.model ? ` ${r.model}` : ''}`;
        }
      }

      if (onAppendText) {
        onAppendText(structured);
        setHud('Ovozli qayd matnga qo‘shildi ✓');
      } else if (mode === 'append') {
        const docId = targetNoteDocId || (mainView === 'notes' ? selectedNoteId : null);
        if (docId) {
          const doc = notesDocs.find((d) => d.id === docId);
          if (doc) {
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const block = `\n\n---\n> 🎙️ **Ovozli eslatma (${nowTime}):**\n> ${structured.replace(/\n/g, '\n> ')}\n`;
            await updateNoteDoc(doc.id, { content: doc.content + block });
            setHud(`"${doc.title}" hujjatiga ovozli eslatma qo‘shildi ✓`);
          } else {
            setError('Hujjat topilmadi');
            return;
          }
        } else if (selectedTaskId) {
          const note =
            (useSynapse.getState().notes[selectedTaskId] ?? '') +
            '\n\n---\n### 🎙️ Ovozli qayd\n' +
            structured;
          updateNote(selectedTaskId, note);
          if (dbMode === 'sqlite') {
            await upsertResolution(
              selectedTaskId,
              note,
              JSON.stringify(useSynapse.getState().checklists[selectedTaskId] ?? []),
            );
          }
          setHud("Ovozli qayd vazifa matniga qo'shildi");
        } else {
          const title = structured.split('\n')[0].slice(0, 50) || 'Ovozli Qayd';
          const newNoteId = await createNote(title);
          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await updateNoteDoc(newNoteId, {
            content: `# ${title}\n\n> 🎙️ **Ovozli eslatma (${nowTime}):**\n\n${structured}`,
          });
          setHud(`"${title}" nomli yangi qayd yaratildi ✓`);
        }
      } else {
        const title = structured.split('\n')[0].slice(0, 80) || 'Ovozli qayd';
        const now = new Date().toISOString();
        const id = nextTaskId(useSynapse.getState().tasks);
        const profile = useSynapse.getState().userProfile;
        const t: Task = {
          id,
          workspace_id: useSynapse.getState().activeWorkspaceId,
          title,
          status: 'active',
          priority: 'Normal',
          git_branch: null,
          pr_url: null,
          ai_source: 'Ovozli qayd',
          assignee_name: profile.full_name || 'Muhandis',
          assignee_avatar: profile.avatar_initials || 'CD',
          assignee_name2: null,
          assignee_avatar2: null,
          tags: ['ovozli-qayd'],
          created_at: now,
          updated_at: now,
        };
        if (dbMode === 'sqlite') await insertTask(t);
        addTask(t);
        const note = `# ${title}\n\n## Ovozli qayd matni\n${structured}`;
        if (dbMode === 'sqlite') await upsertResolution(id, note, '[]');
        await useSynapse.getState().selectTask(id);
        setHud(`${id} vazifasi ovozli qayd asosida yaratildi${formattedBy}`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlashda xatolik yuz berdi');
    } finally {
      setProcessing(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[580px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
            <Mic size={15} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
              Ovozli eslatma & Bildirishnoma
              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 font-mono text-[10px] text-amber-300 flex items-center gap-1">
                <Sparkles size={10} /> AI Auto-Cron
              </span>
            </h2>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Engine Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1.5">
            <button
              onClick={() => setEngine('rubai')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                engine === 'rubai' ? 'bg-emerald-500/20 text-emerald-200 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              RubaiSTT · O‘zbekcha
            </button>
            <button
              onClick={() => setEngine('web')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                engine === 'web' ? 'bg-sky-500/20 text-sky-200 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Web Speech · Tezkor
            </button>
            <span
              title={stt?.ready ? `Model: ${stt.modelPath}` : 'Lokal model topilmadi'}
              className={`h-2.5 w-2.5 shrink-0 rounded-full mr-1 ${
                stt?.ready ? 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.9)] animate-pulse' : 'bg-zinc-600'
              }`}
            />
          </div>

          {/* Model Status Indicator */}
          <div className="flex items-center justify-between px-1 text-[11px] font-mono">
            <span className="text-zinc-500">Ovozni aniqlash modeli:</span>
            {stt?.ready ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 shadow-sm">
                <CheckCircle2 size={12} className="text-emerald-400" />
                RubaiSTT (Lokal model yuklangan · 823MB)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                Model topilmadi ({stt?.modelPath || 'rubai-stt'})
              </span>
            )}
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1.5">
            <button
              onClick={() => setMode('ai_smart')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition ${
                mode === 'ai_smart'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles size={12} className="text-amber-400" />
              <span>AI Smart (Eslatma/Cron)</span>
            </button>
            <button
              onClick={() => setMode('task')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                mode === 'task'
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Vazifa
            </button>
            <button
              onClick={() => setMode('append')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                mode === 'append'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Qaydga qo‘shish
            </button>
          </div>

          {/* Recording & Transcript Box */}
          <div className="relative rounded-xl border border-white/[0.07] bg-black/40 p-4 min-h-[120px]">
            <div className="mb-2 flex items-center justify-between font-mono text-[11.5px] text-zinc-400">
              <div className="flex items-center gap-2">
                {recording && (
                  <span className="flex items-center gap-1.5 text-red-400 animate-pulse font-bold">
                    <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                    <span>
                      {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
                    </span>
                    Ovoz yozilmoqda…
                  </span>
                )}
                {transcribing && (
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Loader2 size={12} className="animate-spin" /> O‘zbekcha matnga o‘girilmoqda…
                  </span>
                )}
                {!recording && !transcribing && finalTranscript && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Yozuv tayyor
                  </span>
                )}
                {!recording && !transcribing && !finalTranscript && (
                  <span className="text-zinc-600">Mikrofon tugmasini bosing va gapiring</span>
                )}
              </div>

              {finalTranscript && (
                <button
                  type="button"
                  onClick={() => triggerAiAnalysis(finalTranscript)}
                  disabled={isAnalyzingAi}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
                >
                  <Sparkles size={11} /> AI qayta tahlil
                </button>
              )}
            </div>

            <div
              className="font-mono text-[13px] leading-relaxed text-zinc-200 min-h-[60px] whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: displayText }}
            />
          </div>

          {/* AI Intent Analysis Card */}
          {isAnalyzingAi && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300 font-mono text-[12px] animate-pulse">
              <Loader2 size={14} className="animate-spin" />
              <span>Sun‘iy intellekt xabarni tahlil qilmoqda (Eslatma/Cron, Vazifa yoki Qayd)...</span>
            </div>
          )}

          {aiAnalysis && !isAnalyzingAi && (
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 transition animate-in fade-in duration-200 ${
                aiAnalysis.intent === 'reminder'
                  ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-black/40 to-black/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : aiAnalysis.intent === 'task'
                  ? 'border-sky-500/30 bg-sky-500/10'
                  : 'border-emerald-500/30 bg-emerald-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiAnalysis.intent === 'reminder' && <Bell size={14} className="text-amber-400 animate-bounce" />}
                  {aiAnalysis.intent === 'task' && <Clock size={14} className="text-sky-400" />}
                  {aiAnalysis.intent === 'note' && <FileText size={14} className="text-emerald-400" />}
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                    {aiAnalysis.intent === 'reminder' && '⏰ AI: Bildirishnoma (Eslatma / Cron)'}
                    {aiAnalysis.intent === 'task' && '📋 AI: Dasturchi Vazifasi'}
                    {aiAnalysis.intent === 'note' && '📝 AI: Texnik Qayd / Fikr'}
                  </span>
                </div>

                {aiAnalysis.intent === 'reminder' && (
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-[10.5px] font-bold text-amber-300 border border-amber-500/30">
                    {editableTimeString}
                  </span>
                )}
              </div>

              {/* Editable title and time */}
              <div className="space-y-2 pt-1">
                <input
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  placeholder="Sarlavha..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-white focus:border-amber-400 focus:outline-none"
                />

                {aiAnalysis.intent === 'reminder' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 font-mono shrink-0">Eslatma vaqti:</span>
                    <input
                      value={editableTimeString}
                      onChange={(e) => {
                        setEditableTimeString(e.target.value);
                        const c = parseNaturalTimeToIso(e.target.value);
                        setCustomTargetIso(c.iso);
                      }}
                      placeholder="10:00, Ertaga 14:00, +15 daqiqa..."
                      className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-[12px] text-amber-300 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-zinc-400 italic">
                💡 {aiAnalysis.reasoning}
              </p>
            </div>
          )}

          {error === 'PERMISSION_DENIED' ? (
            <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-[#1a1815] to-black/60 p-4 space-y-3 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[13px] font-bold text-amber-200 flex items-center gap-2">
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
                  <li>Chap ustundan <strong className="text-zinc-200">Privacy & Security (Maxfiylik va Xavfsizlik) ➔ Microphone (Mikrofon)</strong>ni bosing.</li>
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
                      setError(null);
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
                      setError(null);
                      startRecording();
                    }}
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 transition"
                  >
                    Urinib ko‘rish
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/20 transition flex items-center gap-1.5"
                  >
                    <Upload size={13} className="text-blue-400" />
                    <span>Audio fayl tanlash (.wav, .mp3, .m4a)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : null}

          {/* Hidden Audio File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
            onChange={handleAudioFile}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={processing || transcribing}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition disabled:opacity-60 shadow-md ${
                  recording
                    ? 'bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:brightness-110'
                }`}
              >
                {recording ? (
                  <>
                    <span className="h-3 w-3 rounded-full bg-red-400 animate-pulse" />
                    To‘xtatish & Tahlil
                  </>
                ) : (
                  <>
                    <Mic size={14} />
                    {finalTranscript ? 'Qayta yozish' : 'Ovoz yozish'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing || transcribing || recording}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition"
                title="Tayyor audio faylni yuklash"
              >
                <Upload size={13} className="text-blue-400" />
                <span className="hidden sm:inline">Audio fayl yuklash</span>
              </button>
            </div>

            <div className="flex gap-2">
              {finalTranscript && (
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(finalTranscript).then(() => setHud('Nusxalandi'))
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
                >
                  <Copy size={12} className="inline-block mr-1" /> Nusxa
                </button>
              )}

              <button
                onClick={onSave}
                disabled={processing || !(finalTranscript || transcript)}
                className={`rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50 ${
                  mode === 'ai_smart' && aiAnalysis?.intent === 'reminder'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold'
                    : 'bg-gradient-to-r from-sky-500 to-blue-600'
                }`}
              >
                {processing ? (
                  <Loader2 size={13} className="animate-spin inline-block mr-1" />
                ) : mode === 'ai_smart' && aiAnalysis?.intent === 'reminder' ? (
                  <Bell size={13} className="inline-block mr-1" />
                ) : (
                  <Save size={13} className="inline-block mr-1" />
                )}
                {mode === 'ai_smart'
                  ? aiAnalysis?.intent === 'reminder'
                    ? '⏰ Cron & Eslatmani o‘rnatish'
                    : aiAnalysis?.intent === 'task'
                    ? '📋 Vazifani saqlash'
                    : '📝 Qaydni saqlash'
                  : mode === 'task'
                  ? 'Vazifa yaratish'
                  : 'Qaydga qo‘shish'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}