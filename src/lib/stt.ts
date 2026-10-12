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

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Full pipeline: WAV bytes → local rubaiSTT model → Uzbek text. */
export async function transcribeRubai(wav: Uint8Array, lang = 'uz'): Promise<string> {
  const text = await invoke<string>('transcribe_audio', { audioB64: toBase64(wav), lang });
  return (text || '').trim();
}
