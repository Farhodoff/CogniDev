import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Loader2, Save, X, Copy } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { insertTask } from '../lib/db';
import { nextTaskId } from '../lib/store';
import { formatVoiceWithOllama } from '../lib/voice';
import { SOURCE_LABELS } from '../lib/providers';
import { blobToWav16k, pickAudioMime, rubaiStatus, transcribeRubai, type SttStatus } from '../lib/stt';
import type { Task } from '../lib/types';

type Mode = 'task' | 'append';
type Engine = 'web' | 'rubai';

export default function VoiceRecorderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedTaskId, addTask, updateNote, dbMode, setHud } = useSynapse();
  const [mode, setMode] = useState<Mode>('task');
  const [engine, setEngine] = useState<Engine>('rubai');
  const [stt, setStt] = useState<SttStatus | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
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
      rubaiStatus().then(setStt).catch(() => setStt(null));
    }
    return () => {
      cleanup();
    };
  }, [open, cleanup]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } });
      const mime = pickAudioMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      if (engine === 'web') startSpeechRecognition();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mikrofondan foydalanishga ruxsat berilmadi');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    if (mediaRecorderRef.current?.state === 'recording') {
      await new Promise<void>((resolve) => {
        const mr = mediaRecorderRef.current!;
        mr.onstop = () => resolve();
        mr.stop();
        // Fallback: never hang if onstop misfires.
        setTimeout(() => resolve(), 1500);
      });
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {}; }
    setRecording(false);
    if (engine === 'rubai') await transcribeWithRubai();
  }

  async function transcribeWithRubai() {
    if (!chunksRef.current.length) { setError('Audio yozilmadi'); return; }
    setTranscribing(true);
    setError(null);
    try {
      const blob = new Blob(chunksRef.current, { type: pickAudioMime() || 'audio/webm' });
      const wav = await blobToWav16k(blob);
      const text = await transcribeRubai(wav, 'uz');
      if (!text) {
        setError('Transkripsiya bo‘sh qaytdi — qayta urinib ko‘ring');
      } else {
        setFinalTranscript((prev) => (prev ? prev + ' ' : '') + text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RubaiSTT xatosi');
    } finally {
      setTranscribing(false);
    }
  }

  function startSpeechRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Brauzer ovozli kiritishni qo‘llamaydi'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
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
        setFinalTranscript((prev) => prev + final);
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

  const displayText = finalTranscript + (transcript ? ` <span className="text-zinc-500 italic">${transcript}</span>` : '');

  async function onSave() {
    if (!finalTranscript.trim() && !transcript.trim()) { setError('Hech qanday ovoz yoki matn yozib olinmadi'); return; }
    setProcessing(true);
    const fullText = (finalTranscript + transcript).trim();
    try {
      let structured = fullText;
      let formattedBy = '';
      if (mode === 'task') {
        const r = await formatVoiceWithOllama(fullText).catch(() => null);
        if (r) {
          structured = r.text;
          formattedBy = r.source === 'fallback' ? '' : ` · ${SOURCE_LABELS[r.source]}${r.model ? ` ${r.model}` : ''}`;
        }
      }
      if (mode === 'append' && selectedTaskId) {
        const note = (useSynapse.getState().notes[selectedTaskId] ?? '') + "\n\n---\n### Ovozli qayd\n" + structured;
        updateNote(selectedTaskId, note);
        if (dbMode === 'sqlite') {
          const { upsertResolution } = await import('../lib/db');
          await upsertResolution(selectedTaskId, note, JSON.stringify(useSynapse.getState().checklists[selectedTaskId] ?? []));
        }
        setHud("Ovozli qayd vazifa matniga qo'shildi");
      } else {
        const title = structured.split('\n')[0].slice(0, 80) || 'Ovozli qayd';
        const now = new Date().toISOString();
        const id = nextTaskId(useSynapse.getState().tasks);
        const profile = useSynapse.getState().userProfile;
        const t: Task = {
          id, workspace_id: useSynapse.getState().activeWorkspaceId,
          title, status: 'active', priority: 'Normal',
          git_branch: null, pr_url: null, ai_source: 'Ovozli qayd',
          assignee_name: profile.full_name || 'Muhandis',
          assignee_avatar: profile.avatar_initials || 'CD',
          assignee_name2: null, assignee_avatar2: null,
          tags: ['ovozli-qayd'],
          created_at: now, updated_at: now,
        };
        if (dbMode === 'sqlite') await insertTask(t);
        addTask(t);
        const note = `# ${title}\n\n## Ovozli qayd matni\n${structured}`;
        const { upsertResolution } = await import('../lib/db');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
          <Mic size={15} className="text-emerald-300" />
          <h2 className="text-[14px] font-bold text-white">Ovozli eslatma</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
            <button onClick={() => setEngine('rubai')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${engine === 'rubai' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400 hover:text-white'}`}>
              RubaiSTT · O‘zbekcha
            </button>
            <button onClick={() => setEngine('web')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${engine === 'web' ? 'bg-sky-500/20 text-sky-200' : 'text-zinc-400 hover:text-white'}`}>
              Web Speech · English
            </button>
            <span title={stt?.ready ? `Model: ${stt.modelPath}` : 'Lokal model topilmadi'} className={`h-2 w-2 shrink-0 rounded-full ${stt?.ready ? 'bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]' : 'bg-zinc-600'}`} />
          </div>
          {engine === 'rubai' && !stt?.ready && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
              Lokal rubaiSTT topilmadi (whisper-cli yoki ggml-rubaistt.bin). Web Speech rejimiga o‘ting yoki modelni `~/rubai-stt/models/` ga joylashtiring.
            </p>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
            <button onClick={() => setMode('task')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'task' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400 hover:text-white'}`}>Yangi vazifa</button>
            <button onClick={() => setMode('append')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'append' ? 'bg-sky-500/20 text-sky-200' : 'text-zinc-400 hover:text-white'}`}>Qaydga qo'shish</button>
          </div>

          <div className="relative rounded-xl border border-white/[0.07] bg-black/40 p-4 min-h-[140px]">
            <div className="mb-2 flex items-center gap-2 font-mono text-[12px] text-zinc-400">
              {recording && <span className="flex items-center gap-1 text-red-400 animate-pulse">● <span>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span> Yozilmoqda…</span>}
              {transcribing && <span className="flex items-center gap-1.5 text-emerald-300"><Loader2 size={12} className="animate-spin" /> RubaiSTT transkripsiya qilmoqda…</span>}
              {!recording && !transcribing && finalTranscript && <span className="text-emerald-400">✓ Tayyor</span>}
              {!recording && !transcribing && !finalTranscript && <span className="text-zinc-600">Boshlash uchun tugmani bosing</span>}
            </div>
            <div className="font-mono text-[13px] leading-relaxed text-zinc-200 min-h-[80px] whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: displayText }} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={processing || transcribing}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                recording
                  ? 'bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:brightness-110'
              }`}
            >
              {recording ? (
                <>
                  <span className="h-3 w-3 rounded-full bg-red-400 animate-pulse" />
                  To'xtatish
                </>
              ) : (
                <>
                  <Mic size={14} />
                  {finalTranscript ? 'Qayta yozish' : 'Ovoz yozish'}
                </>
              )}
            </button>
            <div className="flex gap-2">
              {finalTranscript && (
                <button onClick={() => navigator.clipboard.writeText(finalTranscript).then(() => setHud('Nusxalandi'))} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">
                  <Copy size={13} className="inline-block mr-1" /> Nusxa olish
                </button>
              )}
              <button onClick={onSave} disabled={processing || !(finalTranscript || transcript)} className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} className="inline-block mr-1" />} {mode === 'task' ? 'Vazifa yaratish' : "Qaydga qo'shish"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}