import { isTauri } from './platform';

/**
 * CogniDev Notification & Scheduler Engine
 * Handles audio chimes, native desktop notifications, voice speech synthesis, and time parsing.
 */

/**
 * Synthesizes a crisp, elegant dual-harmonic notification chime
 * using the Web Audio API. 100% offline, zero external audio assets required.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First harmonic: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second harmonic: B5 (987.77 Hz) - crisp chime overlay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.7);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (err) {
    console.warn('[NotificationSound] playback error:', err);
  }
}

/**
 * Sends a native desktop notification.
 * Works seamlessly in Tauri desktop environments and modern web browsers.
 */
export async function sendDesktopNotification(
  title: string,
  body: string,
  icon = '/icons/icon.png'
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    // If running in browser or Tauri WebView with window.Notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
        return true;
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, icon });
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[DesktopNotification] error:', err);
  }

  return false;
}

/**
 * Speaks an alert out loud using native OS speech synthesis (macOS `say`)
 * or Web Speech API fallback.
 */
export async function speakVoiceReminder(text: string): Promise<boolean> {
  const clean = text.replace(/[*_#`~]/g, '').trim();
  if (!clean) return false;

  // 1. Native macOS `say` or Windows PowerShell speech via Tauri
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('speak_text', { text: clean });
      return true;
    } catch (e) {
      console.warn('[speakVoiceReminder] Native speech failed, falling back:', e);
    }
  }

  // 2. Web Speech API fallback in browser/WebView
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(
        (v) =>
          v.lang.startsWith('uz') ||
          v.lang.startsWith('tr') ||
          v.lang.startsWith('ru') ||
          v.lang.startsWith('en')
      );
      if (match) utterance.voice = match;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[speakVoiceReminder] Web Speech synthesis error:', err);
    }
  }

  return false;
}

/**
 * Parses a natural language time expression (in Uzbek or standard formats)
 * into an exact ISO-8601 string.
 * Examples:
 * - "10:00" -> Today at 10:00 (or Tomorrow if 10:00 has already passed)
 * - "soat 10 da" -> 10:00
 * - "15 minutdan keyin" -> now + 15 mins
 * - "ertaga 14:30" -> Tomorrow at 14:30
 */
export function parseNaturalTimeToIso(rawTime: string, baseDate = new Date()): {
  iso: string;
  timeString: string;
  isRecurring: boolean;
} {
  const text = rawTime.trim().toLowerCase();
  const now = new Date(baseDate);

  // 1. Check relative minutes: "15 minut", "10 daqiqa"
  const minMatch = text.match(/(\d+)\s*(?:minut|daqiqa|daq)/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    const target = new Date(now.getTime() + mins * 60 * 1000);
    target.setSeconds(0, 0);
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    return {
      iso: target.toISOString(),
      timeString: `+${mins} daqiqa (${hh}:${mm})`,
      isRecurring: false,
    };
  }

  // 2. Check relative hours: "2 soatdan keyin"
  const hourMatch = text.match(/(\d+)\s*soat/);
  if (hourMatch && (text.includes('keyin') || text.includes('so‘ng') || text.includes('song'))) {
    const hours = parseInt(hourMatch[1], 10);
    const target = new Date(now.getTime() + hours * 3600 * 1000);
    target.setSeconds(0, 0);
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    return {
      iso: target.toISOString(),
      timeString: `+${hours} soat (${hh}:${mm})`,
      isRecurring: false,
    };
  }

  // 3. Check for specific time "10:00", "soat 10", "14:30"
  let hours = 10;
  let minutes = 0;

  const clockMatch = text.match(/(?:soat\s*)?(\d{1,2})(?::(\d{2}))?/);
  if (clockMatch) {
    hours = parseInt(clockMatch[1], 10);
    minutes = clockMatch[2] ? parseInt(clockMatch[2], 10) : 0;
  }

  // Check if evening/night mentioned: "kechki 8" -> 20:00
  if ((text.includes('kechki') || text.includes('kechqurun') || text.includes('pm')) && hours < 12) {
    hours += 12;
  }

  const isTomorrow = text.includes('ertaga') || text.includes('ertasi');
  const isRecurring = text.includes('har kuni') || text.includes('har kun') || text.includes('har dushanba');

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  // If time has already passed today and user didn't say "ertaga", bump to tomorrow
  if (!isTomorrow && target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  } else if (isTomorrow) {
    target.setDate(target.getDate() + 1);
  }

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const displayString = isTomorrow
    ? `Ertaga, ${timeStr}`
    : target.getDate() !== now.getDate()
    ? `Ertaga, ${timeStr}`
    : `Bugun, ${timeStr}`;

  return {
    iso: target.toISOString(),
    timeString: displayString,
    isRecurring,
  };
}

/**
 * Format an ISO target time into a user-friendly Uzbek string.
 */
export function formatFriendlyTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeStr = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Bugun, ${timeStr}`;
    if (isTomorrow) return `Ertaga, ${timeStr}`;

    return `${d.getDate()}-${d.toLocaleDateString('uz-UZ', { month: 'short' })}, ${timeStr}`;
  } catch {
    return isoString;
  }
}
