import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './vault';

export interface SttStatus {
  binaryOk: boolean;
  modelOk: boolean;
  binPath: string;
  modelPath: string;
  ready: boolean;
}

/** Check whether the local rubaiSTT pipeline (whisper-cli + ggml model) is available. */
export async function rubaiStatus(): Promise<SttStatus | null> {
  if (!isTauri) return null;
  try {
    const s = await invoke<{ binary_ok: boolean; model_ok: boolean; bin_path: string; model_path: string }>('stt_status');
    return {
      binaryOk: s.binary_ok,
      modelOk: s.model_ok,
      binPath: s.bin_path,
      modelPath: s.model_path,
      ready: s.binary_ok && s.model_ok,
    };
  } catch {
    return null;
  }
}

/** Pick a MediaRecorder mime the current webview supports (Safari needs mp4). */
export function pickAudioMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return '';
}

/** Decode any recorded blob and resample to 16kHz mono PCM WAV (whisper input). */
export async function blobToWav16k(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(buf);
    const targetSr = 16000;
    const frames = Math.max(1, Math.ceil(decoded.duration * targetSr));
    const offline = new OfflineAudioContext(1, frames, targetSr);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return encodeWav16(rendered.getChannelData(0), targetSr);
  } finally {
    ctx.close().catch(() => {});
  }
}

function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const out = new Uint8Array(44 + n * 2);
  const view = new DataView(out.buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return out;
}

export type SttLanguage = 'auto' | 'uz' | 'ru' | 'en';

export interface DetailedTranscriptionResult {
  text: string;
  detectedLang: string;
  source: 'whisper-local' | 'web-speech' | 'offline-fallback';
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * High-accuracy multi-language transcription:
 * 1. Native local whisper.cpp with auto-detect or specific language (uz, ru, en)
 * 2. Web Speech API live fallback if native binary not available
 */
export async function transcribeAudioDetailed(
  wav: Uint8Array,
  lang: SttLanguage = 'auto',
  liveSpeechFallback = ''
): Promise<DetailedTranscriptionResult> {
  // 1. Try native whisper-cli via Tauri
  if (isTauri) {
    try {
      const res = await invoke<{ text: string; detected_lang: string }>('transcribe_audio_detailed', {
        audioB64: toBase64(wav),
        lang,
      });
      if (res?.text && res.text.trim().length > 0) {
        return {
          text: res.text.trim(),
          detectedLang: res.detected_lang || (lang === 'auto' ? 'uz' : lang),
          source: 'whisper-local',
        };
      }
    } catch (tauriErr) {
      console.warn('[STT] transcribe_audio_detailed failed, checking fallback:', tauriErr);
    }
  }

  // 2. Fallback to live speech recognition transcript captured during recording
  if (liveSpeechFallback && liveSpeechFallback.trim().length > 0) {
    return {
      text: liveSpeechFallback.trim(),
      detectedLang: lang === 'auto' ? 'uz' : lang,
      source: 'web-speech',
    };
  }

  // 3. Fallback message if completely silent or offline without binaries
  return {
    text: '',
    detectedLang: lang === 'auto' ? 'uz' : lang,
    source: 'offline-fallback',
  };
}

/** Full pipeline: WAV bytes → local rubaiSTT model → text (backward compatible). */
export async function transcribeRubai(wav: Uint8Array, lang: SttLanguage | string = 'uz'): Promise<string> {
  const res = await transcribeAudioDetailed(wav, (lang as SttLanguage) || 'uz');
  return res.text;
}

/**
 * Export and download audio file to local computer (.wav or .m4a).
 */
export function downloadAudioFile(blobOrUrl: Blob | string, baseName: string): void {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const safeName = baseName
    .replace(/[^a-zA-Z0-9_\u0400-\u04FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'audio_yozuv';

  const filename = safeName.endsWith('.wav') || safeName.endsWith('.m4a') ? safeName : `${safeName}.wav`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}

/**
 * Creates live Web Speech Recognition listener (Webkit/Blink) as an instant offline/streaming speech layer.
 */
export function createLiveSpeechRecognizer(
  lang: SttLanguage = 'auto',
  onPartial?: (text: string) => void
): { start: () => void; stop: () => string; getTranscript: () => string } {
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    let t = '';
    return {
      start: () => {},
      stop: () => t,
      getTranscript: () => t,
    };
  }

  try {
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;

    const langMap: Record<string, string> = {
      uz: 'uz-UZ',
      ru: 'ru-RU',
      en: 'en-US',
      auto: 'uz-UZ',
    };
    recognition.lang = langMap[lang] || 'uz-UZ';

    let finalTranscript = '';
    let isRunning = false;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const combined = (finalTranscript + interim).trim();
      onPartial?.(combined);
    };

    recognition.onerror = (e: any) => {
      console.warn('[LiveSpeechRecognizer] error:', e);
    };

    return {
      start: () => {
        try {
          if (!isRunning) {
            finalTranscript = '';
            recognition.start();
            isRunning = true;
          }
        } catch {
          /* ignore */
        }
      },
      stop: () => {
        try {
          if (isRunning) {
            recognition.stop();
            isRunning = false;
          }
        } catch {
          /* ignore */
        }
        return finalTranscript.trim();
      },
      getTranscript: () => finalTranscript.trim(),
    };
  } catch {
    let t = '';
    return {
      start: () => {},
      stop: () => t,
      getTranscript: () => t,
    };
  }
}

/** Safely request microphone stream with fallback for WebKit / Safari compatibility */
export async function requestMicrophoneStream(constraints?: MediaTrackConstraints): Promise<MediaStream> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Qurilmangizda ovoz yozib olish (getUserMedia) qo‘llab-quvvatlanmaydi.');
  }

  // Attempt 1: Requested constraints with echoCancellation & noiseSuppression (no explicit sampleRate constraint, which breaks Safari/WebKit)
  try {
    const audioOptions: MediaTrackConstraints = constraints ?? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    return await navigator.mediaDevices.getUserMedia({ audio: audioOptions });
  } catch (err: any) {
    console.warn('[requestMicrophoneStream] specific constraints failed, attempting fallback to { audio: true }', err);
    // Attempt 2: Minimal fallback without audio options
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

/** Open macOS / Windows system microphone security settings */
export async function openMicSettings(): Promise<void> {
  if (isTauri) {
    try {
      await invoke('open_mic_settings');
      return;
    } catch (e) {
      console.warn('open_mic_settings failed:', e);
    }
  }
}

/** Reset macOS TCC microphone permission approval so the prompt will reappear */
export async function resetMicPermission(): Promise<string | null> {
  if (isTauri) {
    try {
      return await invoke<string>('reset_mic_permission');
    } catch (e: any) {
      console.warn('reset_mic_permission failed:', e);
      return null;
    }
  }
  return null;
}

