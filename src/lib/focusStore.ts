import { create } from 'zustand';
import { focusAudio, type AmbientType } from './focusAudio';
import {
  sendDesktopNotification,
  scheduleSystemNotification,
  cancelSystemNotification,
} from './notifications';

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
  targetEndTime: number | null;
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
  syncWithTargetTime: () => void;
  setAmbientSound: (ambient: AmbientType) => void;
  setVolume: (vol: number) => void;
  toggleSound: () => void;
  setShowModal: (show: boolean) => void;
  linkTask: (taskId?: string, taskTitle?: string) => void;
}

const STORAGE_KEY = 'cognidev.focus.v1';
const ACTIVE_TIMER_KEY = 'cognidev.focus_active.v2';

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

interface PersistedActiveTimer {
  mode: FocusMode;
  status: FocusStatus;
  targetEndTime: number | null;
  timeRemaining: number;
  totalDuration: number;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
}

const DEFAULT_FOCUS_SECS = 25 * 60;
const DEFAULT_SHORT_BREAK_SECS = 5 * 60;
const DEFAULT_LONG_BREAK_SECS = 15 * 60;

function loadActiveTimerState(): Partial<FocusState> {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return {};
    const data: PersistedActiveTimer = JSON.parse(raw);
    if (data.status === 'running' && data.targetEndTime) {
      const remainingSecs = Math.round((data.targetEndTime - Date.now()) / 1000);
      if (remainingSecs <= 0) {
        // Expired while app was closed or away
        return {
          mode: data.mode === 'focus' ? 'short_break' : 'focus',
          status: 'idle',
          timeRemaining: data.mode === 'focus' ? DEFAULT_SHORT_BREAK_SECS : DEFAULT_FOCUS_SECS,
          totalDuration: data.mode === 'focus' ? DEFAULT_SHORT_BREAK_SECS : DEFAULT_FOCUS_SECS,
          targetEndTime: null,
          linkedTaskId: data.linkedTaskId,
          linkedTaskTitle: data.linkedTaskTitle,
        };
      } else {
        return {
          mode: data.mode,
          status: 'running',
          timeRemaining: remainingSecs,
          totalDuration: data.totalDuration || DEFAULT_FOCUS_SECS,
          targetEndTime: data.targetEndTime,
          linkedTaskId: data.linkedTaskId,
          linkedTaskTitle: data.linkedTaskTitle,
        };
      }
    } else if (data.status === 'paused') {
      return {
        mode: data.mode,
        status: 'paused',
        timeRemaining: data.timeRemaining,
        totalDuration: data.totalDuration,
        targetEndTime: null,
        linkedTaskId: data.linkedTaskId,
        linkedTaskTitle: data.linkedTaskTitle,
      };
    }
  } catch {}
  return {};
}

function saveActiveTimerState(state: {
  mode: FocusMode;
  status: FocusStatus;
  targetEndTime: number | null;
  timeRemaining: number;
  totalDuration: number;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
}) {
  try {
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(state));
  } catch {}
}

const initialPersisted = loadPersistedState();
const initialActive = loadActiveTimerState();

export const useFocusStore = create<FocusState>((set, get) => ({
  mode: initialActive.mode || 'focus',
  status: initialActive.status || 'idle',
  timeRemaining: initialActive.timeRemaining !== undefined ? initialActive.timeRemaining : DEFAULT_FOCUS_SECS,
  totalDuration: initialActive.totalDuration || DEFAULT_FOCUS_SECS,
  targetEndTime: initialActive.targetEndTime || null,
  linkedTaskId: initialActive.linkedTaskId,
  linkedTaskTitle: initialActive.linkedTaskTitle,
  completedPomodorosToday: initialPersisted.completedPomodorosToday,
  totalDeepWorkMinutesToday: initialPersisted.totalDeepWorkMinutesToday,
  ambientSound: 'cyberpunk',
  volume: 0.6,
  soundEnabled: true,
  showModal: false,
  history: initialPersisted.history,

  startFocus: (durationMins = 25, taskId, taskTitle) => {
    const secs = durationMins * 60;
    const targetEndTime = Date.now() + secs * 1000;
    const { soundEnabled, ambientSound, volume } = get();

    focusAudio.setVolume(volume);
    if (soundEnabled) {
      focusAudio.playStartBell();
    }
    if (ambientSound !== 'none') {
      focusAudio.startAmbient(ambientSound);
    }

    const tId = taskId || get().linkedTaskId;
    const tTitle = taskTitle || get().linkedTaskTitle;

    set({
      mode: 'focus',
      status: 'running',
      timeRemaining: secs,
      totalDuration: secs,
      targetEndTime,
      linkedTaskId: tId,
      linkedTaskTitle: tTitle,
    });

    saveActiveTimerState({
      mode: 'focus',
      status: 'running',
      targetEndTime,
      timeRemaining: secs,
      totalDuration: secs,
      linkedTaskId: tId,
      linkedTaskTitle: tTitle,
    });

    // Schedule background notification in native Rust
    scheduleSystemNotification(
      'pomodoro',
      targetEndTime / 1000,
      '🍅 Deep Work Sprint Yakunlandi!',
      `${durationMins} minutlik chuqur fokus yakunlandi! Endi 5 minut dam oling.`
    );
  },

  startBreak: (isLong = false) => {
    const secs = isLong ? DEFAULT_LONG_BREAK_SECS : DEFAULT_SHORT_BREAK_SECS;
    const targetEndTime = Date.now() + secs * 1000;
    focusAudio.stopAmbient();

    set({
      mode: isLong ? 'long_break' : 'short_break',
      status: 'running',
      timeRemaining: secs,
      totalDuration: secs,
      targetEndTime,
    });

    saveActiveTimerState({
      mode: isLong ? 'long_break' : 'short_break',
      status: 'running',
      targetEndTime,
      timeRemaining: secs,
      totalDuration: secs,
    });

    scheduleSystemNotification(
      'pomodoro',
      targetEndTime / 1000,
      '☕️ Tanaffus Yakunlandi',
      'Dam olib bo‘ldingiz! Keyingi 25 minutlik fokus sprintiga tayyormisiz?'
    );
  },

  pauseTimer: () => {
    focusAudio.stopAmbient();
    cancelSystemNotification('pomodoro');
    const { timeRemaining, mode, totalDuration, linkedTaskId, linkedTaskTitle } = get();
    set({ status: 'paused', targetEndTime: null });
    saveActiveTimerState({
      mode,
      status: 'paused',
      targetEndTime: null,
      timeRemaining,
      totalDuration,
      linkedTaskId,
      linkedTaskTitle,
    });
  },

  resumeTimer: () => {
    const { ambientSound, mode, volume, timeRemaining, totalDuration, linkedTaskId, linkedTaskTitle } = get();
    focusAudio.setVolume(volume);
    if (mode === 'focus' && ambientSound !== 'none') {
      focusAudio.startAmbient(ambientSound);
    }
    const targetEndTime = Date.now() + timeRemaining * 1000;
    set({ status: 'running', targetEndTime });
    saveActiveTimerState({
      mode,
      status: 'running',
      targetEndTime,
      timeRemaining,
      totalDuration,
      linkedTaskId,
      linkedTaskTitle,
    });

    scheduleSystemNotification(
      'pomodoro',
      targetEndTime / 1000,
      mode === 'focus' ? '🍅 Deep Work Sprint Yakunlandi!' : '☕️ Tanaffus Yakunlandi',
      mode === 'focus'
        ? `${Math.round(totalDuration / 60)} minutlik chuqur fokus yakunlandi! Endi 5 minut dam oling.`
        : 'Dam olib bo‘ldingiz! Yangi sprintga tayyormisiz?'
    );
  },

  resetTimer: () => {
    focusAudio.stopAmbient();
    cancelSystemNotification('pomodoro');
    const isFocus = get().mode === 'focus';
    const secs = isFocus ? DEFAULT_FOCUS_SECS : DEFAULT_SHORT_BREAK_SECS;
    set({
      status: 'idle',
      timeRemaining: secs,
      totalDuration: secs,
      targetEndTime: null,
    });
    saveActiveTimerState({
      mode: isFocus ? 'focus' : 'short_break',
      status: 'idle',
      targetEndTime: null,
      timeRemaining: secs,
      totalDuration: secs,
    });
  },

  skipStep: () => {
    const { mode } = get();
    cancelSystemNotification('pomodoro');
    if (mode === 'focus') {
      get().startBreak(false);
    } else {
      get().startFocus(25);
    }
  },

  syncWithTargetTime: () => {
    const { status, targetEndTime } = get();
    if (status !== 'running' || !targetEndTime) return;
    const remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
    set({ timeRemaining: remaining });
    if (remaining <= 0) {
      get().tick();
    }
  },

  tick: () => {
    const { status, targetEndTime, mode, linkedTaskTitle, totalDuration, soundEnabled } = get();
    if (status !== 'running') return;

    let remaining: number;
    if (targetEndTime) {
      remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
    } else {
      remaining = Math.max(0, get().timeRemaining - 1);
    }

    if (remaining > 0) {
      set({ timeRemaining: remaining });
      return;
    }

    // Timer completed!
    cancelSystemNotification('pomodoro');
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
        targetEndTime: null,
        completedPomodorosToday: newCompleted,
        totalDeepWorkMinutesToday: newMinutes,
        history: newHistory,
      });

      saveActiveTimerState({
        mode: 'short_break',
        status: 'idle',
        targetEndTime: null,
        timeRemaining: DEFAULT_SHORT_BREAK_SECS,
        totalDuration: DEFAULT_SHORT_BREAK_SECS,
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
        targetEndTime: null,
        timeRemaining: DEFAULT_FOCUS_SECS,
        totalDuration: DEFAULT_FOCUS_SECS,
      });

      saveActiveTimerState({
        mode: 'focus',
        status: 'idle',
        targetEndTime: null,
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
