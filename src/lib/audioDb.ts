import { isTauri } from './vault';
import { invoke } from '@tauri-apps/api/core';
import type { MeetingItem } from './types';

const IDB_NAME = 'cognidev_audio_db';
const IDB_STORE = 'audio_blobs';
const IDB_VERSION = 1;

let idbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDb(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported'));
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

/** Convert a Blob to base64 string */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Persists an audio recording/upload permanently:
 * - In Tauri: Saves as .wav / audio file in ~/.cognidev/recordings/
 * - In Browser: Saves in IndexedDB (bypassing the 5MB localStorage limit)
 */
export async function persistMeetingAudio(
  meetingId: string,
  blob: Blob,
  extension: string = 'wav'
): Promise<{ audio_path?: string; audio_url?: string }> {
  if (isTauri) {
    try {
      const b64 = await blobToBase64(blob);
      const filePath = await invoke<string>('save_meeting_audio', {
        meetingId,
        audioB64: b64,
        extension,
      });
      const tempUrl = URL.createObjectURL(blob);
      return { audio_path: filePath, audio_url: tempUrl };
    } catch (err) {
      console.warn('Tauri audio file saqlashda xatolik, IndexedDB ga fallback qilamiz:', err);
    }
  }

  // IndexedDB fallback
  try {
    const db = await getIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(blob, meetingId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const tempUrl = URL.createObjectURL(blob);
    return { audio_url: tempUrl };
  } catch (err) {
    console.error('IndexedDB audio saqlashda xatolik:', err);
    return { audio_url: URL.createObjectURL(blob) };
  }
}

/**
 * Resolves a playable Audio URL for a meeting item:
 * - If audio_url is already active, returns it.
 * - If audio_path is saved on local disk, reads from Tauri.
 * - If saved in IndexedDB, retrieves the Blob and creates Object URL.
 */
export async function resolveMeetingAudioUrl(meeting: MeetingItem): Promise<string | null> {
  if (meeting.audio_url && !meeting.audio_url.startsWith('blob:null')) {
    // Check if playable or still valid
    return meeting.audio_url;
  }

  if (isTauri && meeting.audio_path) {
    try {
      const dataUrl = await invoke<string>('read_meeting_audio', {
        filePath: meeting.audio_path,
      });
      return dataUrl;
    } catch (err) {
      console.warn('Tauri diskdan audioni o‘qishda xatolik:', err);
    }
  }

  // Check IndexedDB
  try {
    const db = await getIndexedDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(meeting.id);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    if (blob) {
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('IndexedDB dan audio olishda xatolik:', err);
  }

  return null;
}

/**
 * Deletes an audio file from local disk or IndexedDB when meeting is removed.
 */
export async function deleteMeetingAudio(meetingOrId: MeetingItem | string, audioPath?: string): Promise<void> {
  const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId.id;
  const filePath = typeof meetingOrId === 'string' ? audioPath : meetingOrId.audio_path;

  if (isTauri && filePath) {
    try {
      await invoke('delete_meeting_audio', { filePath });
    } catch (err) {
      console.warn('Tauri audioni o‘chirishda xatolik:', err);
    }
  }

  try {
    const db = await getIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(meetingId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}
