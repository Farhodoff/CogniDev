/**
 * Context-Switching Detection & Cognitive Load Tracker
 * Tracks task & workspace jumps within a rolling 60-minute window.
 * Triggers smart AI advice when frequent switching (thrashing) impairs deep work.
 */

export interface ContextSwitchEvent {
  id: string;
  type: 'task' | 'workspace';
  entityId: string;
  title: string;
  timestamp: number;
}

export interface ContextSwitchReport {
  totalSwitches: number;
  uniqueEntities: number;
  isHighThrashing: boolean;
  estimatedLostFocusMinutes: number;
  switchHistory: ContextSwitchEvent[];
  advice: string;
  recommendedTaskId?: string;
  recommendedTaskTitle?: string;
}

const STORAGE_KEY = 'cognidev.context_switches.v1';
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const THRASHING_SWITCH_THRESHOLD = 5; // 5 switches
const THRASHING_ENTITY_THRESHOLD = 4; // 4 distinct entities

class ContextSwitchManager {
  private events: ContextSwitchEvent[] = [];

  constructor() {
    this.loadEvents();
  }

  private loadEvents(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ContextSwitchEvent[] = JSON.parse(raw);
        const cutoff = Date.now() - DEFAULT_WINDOW_MS;
        this.events = parsed.filter((e) => e.timestamp >= cutoff);
      }
    } catch {
      this.events = [];
    }
  }

  private saveEvents(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      /* ignore */
    }
  }

  /**
   * Record a new task or workspace context switch
   */
  recordSwitch(
    type: 'task' | 'workspace',
    entityId: string,
    title: string = entityId
  ): ContextSwitchReport {
    const now = Date.now();
    const cutoff = now - DEFAULT_WINDOW_MS;

    // Prune old events outside 60-minute window
    this.events = this.events.filter((e) => e.timestamp >= cutoff);

    // De-duplicate if last event was the same entity within 30 seconds
    const last = this.events[this.events.length - 1];
    if (last && last.type === type && last.entityId === entityId && now - last.timestamp < 30_000) {
      return this.getReport();
    }

    const event: ContextSwitchEvent = {
      id: `switch-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      entityId,
      title,
      timestamp: now,
    };

    this.events.push(event);
    this.saveEvents();

    return this.getReport();
  }

  /**
   * Get the current context switching report for the rolling window
   */
  getReport(windowMs: number = DEFAULT_WINDOW_MS): ContextSwitchReport {
    const now = Date.now();
    const cutoff = now - windowMs;
    const activeEvents = this.events.filter((e) => e.timestamp >= cutoff);

    const totalSwitches = activeEvents.length;
    const uniqueEntitySet = new Set(activeEvents.map((e) => `${e.type}:${e.entityId}`));
    const uniqueEntities = uniqueEntitySet.size;

    // High thrashing: either >= 5 total switches or >= 4 different entities in 1 hour
    const isHighThrashing =
      totalSwitches >= THRASHING_SWITCH_THRESHOLD ||
      uniqueEntities >= THRASHING_ENTITY_THRESHOLD;

    // Gloria Mark's cognitive research: ~15 to 23 minutes required to regain deep flow state
    const estimatedLostFocusMinutes = Math.min(
      90,
      Math.max(0, Math.round((totalSwitches - 1) * 8))
    );

    let advice = '';
    if (isHighThrashing) {
      advice = `⚠️ Diqqat: So‘nggi 1 soatda ${totalSwitches} marta kontekst almashdingiz (${uniqueEntities} xil vazifa/loyiha). Miya har bir sakrashda diqqatni qayta to‘plash uchun 15-20 daqiqa yo‘qotadi. Tavsiya: Barcha chalg‘ituvchi oynalarni yopib, bitta asosiy fokus vazifaga 25 daqiqalik Deep Work sprintini boshlang.`;
    } else if (totalSwitches >= 3) {
      advice = `Diqqat: So‘nggi paytlarda ${totalSwitches} ta vazifaga o‘tdingiz. Asosiy ustuvor vazifani yakunlashga harakat qiling.`;
    } else {
      advice = `Kontekst barqaror. Chuqur diqqat (Deep Work) oqimidasiz.`;
    }

    return {
      totalSwitches,
      uniqueEntities,
      isHighThrashing,
      estimatedLostFocusMinutes,
      switchHistory: activeEvents.slice(-6), // last 6 for UI breadcrumbs
      advice,
    };
  }

  clear(): void {
    this.events = [];
    this.saveEvents();
  }
}

export const contextSwitchTracker = new ContextSwitchManager();
