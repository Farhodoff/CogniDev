import { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, Save, X, Copy } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { insertTask } from '../lib/db';
import { nextTaskId } from '../lib/store';
import { formatVoiceWithOllama } from '../lib/voice';
import type { Task } from '../lib/types';

type Mode = 'task' | 'append';

export default function VoiceRecorderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedTaskId, addTask, updateNote, dbMode, setHud } = useSynapse();
  const [mode, setMode] = useState<Mode>('task');
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

  useEffect(() => {
    if (!open) { cleanup(); return; }
    setTranscript(''); setFinalTranscript(''); setError(null); setSeconds(0);
    return () => cleanup();
  }, [open]);

  function cleanup() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null; chunksRef.current = [];
    timerRef.current = null; silenceTimerRef.current = null; recognitionRef.current = null;
    setRecording(false);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      startSpeechRecognition();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied');
    }
  }

  function stopRecording() {
    if (!recording) return;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {}; }
    setRecording(false);
  }

  function startSpeechRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Web Speech API not supported in this browser'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recognitionRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
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
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error', e.error);
    };
    rec.start();
  }

  const displayText = finalTranscript + (transcript ? ` <span className="text-zinc-500 italic">${transcript}</span>` : '');

  async function onSave() {
    if (!finalTranscript.trim() && !transcript.trim()) { setError('Nothing transcribed yet'); return; }
    setProcessing(true);
    const fullText = (finalTranscript + transcript).trim();
    try {
      let structured = fullText;
      if (mode === 'task') {
        structured = await formatVoiceWithOllama(fullText).catch(() => fullText);
      }
      if (mode === 'append' && selectedTaskId) {
        const note = (useSynapse.getState().notes[selectedTaskId] ?? '') + '\n\n---\n### Voice Memo\n' + structured;
        updateNote(selectedTaskId, note);
        if (dbMode === 'sqlite') {
          const { upsertResolution } = await import('../lib/db');
          await upsertResolution(selectedTaskId, note, JSON.stringify(useSynapse.getState().checklists[selectedTaskId] ?? []));
        }
        setHud('Voice memo appended to note');
      } else {
        const title = structured.split('\n')[0].slice(0, 80) || 'Voice memo';
        const now = new Date().toISOString();
        const id = nextTaskId(useSynapse.getState().tasks);
        const t: Task = {
          id, workspace_id: useSynapse.getState().activeWorkspaceId,
          title, status: 'active', priority: 'Normal',
          git_branch: null, pr_url: null, ai_source: 'Voice Memo',
          assignee_name: 'Farhod', assignee_avatar: 'F',
          assignee_name2: null, assignee_avatar2: null,
          created_at: now, updated_at: now,
        };
        if (dbMode === 'sqlite') await insertTask(t);
        addTask(t);
        const note = `# ${title}\n\n## Voice Memo\n${structured}`;
        const { upsertResolution } = await import('../lib/db');
        if (dbMode === 'sqlite') await upsertResolution(id, note, '[]');
        await useSynapse.getState().selectTask(id);
        setHud(`${id} created from voice memo`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
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
          <h2 className="text-[14px] font-bold text-white">Voice Note</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
            <button onClick={() => setMode('task')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'task' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400 hover:text-white'}`}>Save as New Task</button>
            <button onClick={() => setMode('append')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'append' ? 'bg-sky-500/20 text-sky-200' : 'text-zinc-400 hover:text-white'}`}>Append to Active Note</button>
          </div>

          <div className="relative rounded-xl border border-white/[0.07] bg-black/40 p-4 min-h-[140px]">
            <div className="mb-2 flex items-center gap-2 font-mono text-[12px] text-zinc-400">
              {recording && <span className="flex items-center gap-1 text-red-400 animate-pulse">● <span>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span> Recording…</span>}
              {!recording && finalTranscript && <span className="text-emerald-400">✓ Transcribed</span>}
              {!recording && !finalTranscript && <span className="text-zinc-600">Click Mic to start</span>}
            </div>
            <div className="font-mono text-[13px] leading-relaxed text-zinc-200 min-h-[80px] whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: displayText }} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={processing}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                recording
                  ? 'bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:brightness-110'
              }`}
            >
              {recording ? (
                <>
                  <span className="h-3 w-3 rounded-full bg-red-400 animate-pulse" />
                  Stop & Transcribe
                </>
              ) : (
                <>
                  <Mic size={14} />
                  {finalTranscript ? 'Record Again' : 'Start Recording'}
                </>
              )}
            </button>
            <div className="flex gap-2">
              {finalTranscript && (
                <button onClick={() => navigator.clipboard.writeText(finalTranscript).then(() => setHud('Copied'))} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">
                  <Copy size={13} className="inline-block mr-1" /> Copy
                </button>
              )}
              <button onClick={onSave} disabled={processing || !(finalTranscript || transcript)} className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} className="inline-block mr-1" />} {mode === 'task' ? 'Create Task' : 'Append to Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}