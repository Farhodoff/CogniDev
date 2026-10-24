import { create } from 'zustand';
import { focusAudio, type AmbientType } from './focusAudio';
import { sendDesktopNotification } from './notifications';

export type { AmbientType } from './focusAudio';
export type FocusMode = 'focus' | 'short_break' | 'long_break';
export type FocusStatus = 'idle' | 'running' | 'paused';

interface FocusSessionRecord {
  id: string;
  completedAt: string;
  durationMinutes: number;
  taskTitle?: string;
}

interface FocusState {
  mode: FocusMode;
  status: FocusStatus;
  timeRemaining: number;
  totalDuration: number;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
  completedPomodorosToday: number;
  totalDeepWorkMinutesToday: number;
  ambientSound: AmbientType;
  volume: number;
  soundEnabled: boolean;
  showModal: boolean;
  history: FocusSessionRecord[];

  // Actions
  startFocus: (durationMins?: number, taskId?: string, taskTitle?: string) => void;
  startBreak: (isLong?: boolean) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  skipStep: () => void;
  tick: () => void;
  setAmbientSound: (ambient: AmbientType) => void;
  setVolume: (vol: number) => void;
  toggleSound: () => void;
  setShowModal: (show: boolean) => void;
  linkTask: (taskId?: string, taskTitle?: string) => void;
}

const STORAGE_KEY = 'cognidev.focus.v1';

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadPersistedState(): {
  completedPomodorosToday: number;
  totalDeepWorkMinutesToday: number;
  history: FocusSessionRecord[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === getTodayString()) {
        return {
          completedPomodorosToday: data.completedPomodorosToday || 0,
          totalDeepWorkMinutesToday: data.totalDeepWorkMinutesToday || 0,
          history: data.history || [],
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    completedPomodorosToday: 0,
    totalDeepWorkMinutesToday: 0,
    history: [],
  };
}

function savePersistedState(completed: number, minutes: number, history: FocusSessionRecord[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        date: getTodayString(),
        completedPomodorosToday: completed,
        totalDeepWorkMinutesToday: minutes,
        history,
      })
    );
  } catch {
    /* ignore */
  }
}

const initialPersisted = loadPersistedState();
const DEFAULT_FOCUS_SECS = 25 * 60;
const DEFAULT_SHORT_BREAK_SECS = 5 * 60;
const DEFAULT_LONG_BREAK_SECS = 15 * 60;

export const useFocusStore = create<FocusState>((set, get) => ({
  mode: 'focus',
  status: 'idle',
  timeRemaining: DEFAULT_FOCUS_SECS,
  totalDuration: DEFAULT_FOCUS_SECS,
  linkedTaskId: undefined,
  linkedTaskTitle: undefined,
  completedPomodorosToday: initialPersisted.completedPomodorosToday,
  totalDeepWorkMinutesToday: initialPersisted.totalDeepWorkMinutesToday,
  ambientSound: 'cyberpunk',
  volume: 0.6,
  soundEnabled: true,
  showModal: false,
  history: initialPersisted.history,

  startFocus: (durationMins = 25, taskId, taskTitle) => {
    const secs = durationMins * 60;
    const { soundEnabled, ambientSound, volume } = get();

    focusAudio.setVolume(volume);
    if (soundEnabled) {
      focusAudio.playStartBell();
    }
    if (ambientSound !== 'none') {
      focusAudio.startAmbient(ambientSound);
    }

    set({
      mode: 'focus',
      status: 'running',
      timeRemaining: secs,
      totalDuration: secs,
      linkedTaskId: taskId || get().linkedTaskId,
      linkedTaskTitle: taskTitle || get().linkedTaskTitle,
    });
  },

  startBreak: (isLong = false) => {
    const secs = isLong ? DEFAULT_LONG_BREAK_SECS : DEFAULT_SHORT_BREAK_SECS;
    focusAudio.stopAmbient();

    set({
      mode: isLong ? 'long_break' : 'short_break',
      status: 'running',
      timeRemaining: secs,
      totalDuration: secs,
    });
  },

  pauseTimer: () => {
    focusAudio.stopAmbient();
    set({ status: 'paused' });
  },

  resumeTimer: () => {
    const { ambientSound, mode, volume } = get();
    focusAudio.setVolume(volume);
    if (mode === 'focus' && ambientSound !== 'none') {
      focusAudio.startAmbient(ambientSound);
    }
    set({ status: 'running' });
  },

  resetTimer: () => {
    focusAudio.stopAmbient();
    const isFocus = get().mode === 'focus';
    const secs = isFocus ? DEFAULT_FOCUS_SECS : DEFAULT_SHORT_BREAK_SECS;
    set({
      status: 'idle',
      timeRemaining: secs,
      totalDuration: secs,
    });
  },

  skipStep: () => {
    const { mode } = get();
    if (mode === 'focus') {
      get().startBreak(false);
    } else {
      get().startFocus(25);
    }
  },

  tick: () => {
    const { status, timeRemaining, mode, linkedTaskTitle, totalDuration, soundEnabled } = get();
    if (status !== 'running') return;

    if (timeRemaining > 1) {
      set({ timeRemaining: timeRemaining - 1 });
      return;
    }

    // Timer completed!
    focusAudio.stopAmbient();
    if (soundEnabled) {
      focusAudio.playCompletionBell();
    }

    if (mode === 'focus') {
      const durationMins = Math.round(totalDuration / 60);
      const newCompleted = get().completedPomodorosToday + 1;
      const newMinutes = get().totalDeepWorkMinutesToday + durationMins;

      const record: FocusSessionRecord = {
        id: `f-${Date.now()}`,
        completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationMinutes: durationMins,
        taskTitle: linkedTaskTitle,
      };

      const newHistory = [record, ...get().history.slice(0, 19)];
      savePersistedState(newCompleted, newMinutes, newHistory);

      sendDesktopNotification(
        '🍅 Deep Work Sprint Yakunlandi!',
        `${durationMins} minutlik chuqur fokus muvaffaqiyatli yakunlandi! Endi 5 minut dam oling.`
      );

      set({
        status: 'idle',
        completedPomodorosToday: newCompleted,
        totalDeepWorkMinutesToday: newMinutes,
        history: newHistory,
      });

      // Suggest short or long break
      const isLong = newCompleted % 4 === 0;
      get().startBreak(isLong);
    } else {
      // Break completed
      sendDesktopNotification(
        '☕️ Tanaffus Yakunlandi',
        'Dam olib bo‘ldingiz! Keyingi 25 minutlik fokus sprintiga tayyormisiz?'
      );

      set({
        status: 'idle',
        mode: 'focus',
        timeRemaining: DEFAULT_FOCUS_SECS,
        totalDuration: DEFAULT_FOCUS_SECS,
      });
    }
  },

  setAmbientSound: (ambient: AmbientType) => {
    set({ ambientSound: ambient });
    focusAudio.setVolume(get().volume);
    if (get().status === 'running' && get().mode === 'focus') {
      if (ambient === 'none') {
        focusAudio.stopAmbient();
      } else {
        focusAudio.startAmbient(ambient);
      }
    } else {
      focusAudio.stopAmbient();
    }
  },

  setVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    set({ volume: clamped });
    focusAudio.setVolume(clamped);
  },

  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },

  setShowModal: (show: boolean) => {
    set({ showModal: show });
  },

  linkTask: (taskId?: string, taskTitle?: string) => {
    set({ linkedTaskId: taskId, linkedTaskTitle: taskTitle });
  },
}));
