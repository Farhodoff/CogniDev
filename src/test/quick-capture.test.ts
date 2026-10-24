import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractTop3FocusTasks,
  classifyQuickCaptureWithAi,
  initGlobalQuickCaptureListener,
  syncTrayFocusTasks,
} from '../lib/quickCapture';
import { callAi } from '../lib/ai';
import type { Task } from '../lib/types';

vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<any>('../lib/ai');
  return {
    ...actual,
    callAi: vi.fn(),
  };
});

describe('⚡️ macOS Menu Bar & Global Quick Capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. extractTop3FocusTasks (macOS Menu Bar Tray sync)', () => {
    it('prioritizes tasks explicitly tagged with focus', () => {
      const mockTasks: Task[] = [
        {
          id: 'DEV-1',
          title: 'Normal backlog vazifa',
          priority: 'Normal',
          status: 'active',
          tags: ['backlog'],
        },
        {
          id: 'DEV-2',
          title: 'Redis keshni sozlash',
          priority: 'High Priority',
          status: 'active',
          tags: ['backend', 'focus'],
        },
        {
          id: 'DEV-3',
          title: 'gRPC connection pool',
          priority: 'Critical',
          status: 'active',
          tags: ['focus'],
        },
        {
          id: 'DEV-4',
          title: 'Tauri tray icon integratsiyasi',
          priority: 'High Priority',
          status: 'active',
          tags: ['macos', 'focus'],
        },
      ] as unknown as Task[];

      const top3 = extractTop3FocusTasks(mockTasks);
      expect(top3.length).toBe(3);
      expect(top3).toContain('Redis keshni sozlash');
      expect(top3).toContain('gRPC connection pool');
      expect(top3).toContain('Tauri tray icon integratsiyasi');
      expect(top3).not.toContain('Normal backlog vazifa');
    });

    it('falls back to active and high-priority tasks if fewer than 3 are tagged with focus', () => {
      const mockTasks: Task[] = [
        {
          id: 'DEV-1',
          title: 'Yagona fokus vazifasi',
          priority: 'Normal',
          status: 'active',
          tags: ['focus'],
        },
        {
          id: 'DEV-2',
          title: 'P0 Blocker: Crash in auth',
          priority: 'P0 Blocker',
          status: 'active',
          tags: ['security'],
        },
        {
          id: 'DEV-3',
          title: 'Critical DB migration',
          priority: 'Critical',
          status: 'active',
          tags: ['database'],
        },
      ] as unknown as Task[];

      const top3 = extractTop3FocusTasks(mockTasks);
      expect(top3.length).toBe(3);
      expect(top3[0]).toBe('Yagona fokus vazifasi');
      expect(top3[1]).toBe('P0 Blocker: Crash in auth');
      expect(top3[2]).toBe('Critical DB migration');
    });

    it('excludes completed tasks from top 3 focus list', () => {
      const mockTasks: Task[] = [
        {
          id: 'DEV-1',
          title: 'Bajarilgan vazifa',
          priority: 'High Priority',
          status: 'completed',
          tags: ['focus'],
        },
        {
          id: 'DEV-2',
          title: 'Hali faol fokus',
          priority: 'High Priority',
          status: 'active',
          tags: ['focus'],
        },
      ] as unknown as Task[];

      const top3 = extractTop3FocusTasks(mockTasks);
      expect(top3).toEqual(['Hali faol fokus']);
    });
  });

  describe('2. classifyQuickCaptureWithAi (AI Auto-Classification & Heuristics)', () => {
    it('uses AI structured JSON when callAi resolves successfully', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          type: 'bug',
          title: 'WebSocket xotira oqishini bartaraf qilish',
          description: 'Uzoq ulanishlarda xotira tozalanishini ta\'minlash',
          priority: 'Critical',
          tags: ['bug', 'websocket', 'memory'],
          suggestedBranch: 'fix/websocket-leak',
        }),
        source: 'gemini',
        model: 'gemini-1.5-flash',
      });

      const res = await classifyQuickCaptureWithAi('fix memory leak on websocket', 'auto');
      expect(res.type).toBe('bug');
      expect(res.priority).toBe('Critical');
      expect(res.suggestedBranch).toBe('fix/websocket-leak');
      expect(res.title).toBe('WebSocket xotira oqishini bartaraf qilish');
      expect(callAi).toHaveBeenCalledTimes(1);
    });

    it('falls back to smart heuristics for bugs when AI is unavailable or offline', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const res = await classifyQuickCaptureWithAi('bug: auth token expiry crash', 'auto');
      expect(res.type).toBe('bug');
      expect(res.priority).toBe('Critical');
      expect(res.suggestedBranch).toContain('fix/');
      expect(res.tags).toContain('bug');
    });

    it('identifies ideas and formats concept branch when mode is idea', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const res = await classifyQuickCaptureWithAi("g'oya: AI ovozli agent", 'idea');
      expect(res.type).toBe('idea');
      expect(res.tags).toContain('idea');
    });
  });

  describe('3. Global Hotkey Listener (DOM & Keyboard events)', () => {
    it('triggers callback when Cmd + Shift + Space is pressed in window', () => {
      let captureOpened = false;
      const cleanup = initGlobalQuickCaptureListener(() => {
        captureOpened = true;
      });

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        metaKey: true,
        shiftKey: true,
      });

      window.dispatchEvent(event);
      expect(captureOpened).toBe(true);

      cleanup();
    });

    it('does not trigger on Space without Cmd/Shift', () => {
      let captureOpened = false;
      const cleanup = initGlobalQuickCaptureListener(() => {
        captureOpened = true;
      });

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        metaKey: false,
        shiftKey: false,
      });

      window.dispatchEvent(event);
      expect(captureOpened).toBe(false);

      cleanup();
    });
  });

  describe('4. syncTrayFocusTasks (Menu Bar Tray invoke)', () => {
    it('gracefully handles non-Tauri / browser environments without throwing', async () => {
      await expect(syncTrayFocusTasks(['Task 1', 'Task 2', 'Task 3'])).resolves.not.toThrow();
    });
  });
});
