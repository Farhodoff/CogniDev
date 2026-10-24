import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findSimilarHistoricalErrors,
  diagnoseErrorWithRubberDuck,
} from '../lib/rubberDuck';
import { callAi } from '../lib/ai';
import type { Task, NoteDoc, LearningLog } from '../lib/types';

vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<any>('../lib/ai');
  return {
    ...actual,
    callAi: vi.fn(),
  };
});

describe('🦆 AI Rubber Duck Debugger & Error Explainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTasks: Task[] = [
    {
      id: 'task-cors-1',
      title: 'Fix Backend CORS issue on fastify server',
      status: 'completed',
      priority: 'High Priority',
      tags: ['cors', 'fastify', 'network'],
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T11:00:00Z',
      workspace_id: 'ws-1',
      group_id: null,
      space_id: null,
      git_branch: 'fix/cors',
      pr_url: null,
      ai_source: null,
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
    },
    {
      id: 'task-rust-2',
      title: 'Resolve Rust Tauri Borrow Checker lifetime mismatch',
      status: 'completed',
      priority: 'High Priority',
      tags: ['rust', 'borrow', 'tauri'],
      created_at: '2026-10-21T10:00:00Z',
      updated_at: '2026-10-21T11:00:00Z',
      workspace_id: 'ws-1',
      group_id: null,
      space_id: null,
      git_branch: 'fix/rust-borrow',
      pr_url: null,
      ai_source: null,
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
    },
  ];

  const mockNotes: NoteDoc[] = [
    {
      id: 'note-cors-guide',
      workspace_id: 'ws-1',
      title: 'CORS Policy Header Configuration Guide',
      content: 'Access-Control-Allow-Origin headerini fastify cors plugin orqali qo‘shish kerak.',
      icon: '📝',
      tags: ['cors', 'security', 'backend'],
      created_at: '2026-10-20T12:00:00Z',
      updated_at: '2026-10-20T12:00:00Z',
    },
  ];

  const mockLogs: LearningLog[] = [
    {
      id: 'log-1',
      roadmap_id: 'rm-1',
      date: '2026-10-22',
      learned: 'Rustda move qilingan obʼyektni qayta ishlatish uchun clone yoki Arc ishlatish',
      solved_problem: 'Borrow checker error: borrow of moved value hal qilindi',
      created_at: '2026-10-22T10:00:00Z',
    },
  ];

  describe('1. findSimilarHistoricalErrors (Second Brain Scanner)', () => {
    it('returns empty array when error message is empty or whitespace', () => {
      expect(findSimilarHistoricalErrors('', mockTasks, mockNotes, mockLogs)).toEqual([]);
      expect(findSimilarHistoricalErrors('   ', mockTasks, mockNotes, mockLogs)).toEqual([]);
    });

    it('finds related tasks when error text contains matching keywords', () => {
      const errorText = `Blocked by CORS policy: No Access-Control-Allow-Origin header is present`;
      const matches = findSimilarHistoricalErrors(errorText, mockTasks, mockNotes, mockLogs);

      expect(matches.length).toBeGreaterThan(0);
      const taskMatch = matches.find((m) => m.sourceType === 'task');
      expect(taskMatch).toBeDefined();
      expect(taskMatch?.title).toContain('CORS');
    });

    it('finds related notion notes and learning logs', () => {
      const rustError = `error[E0382]: borrow of moved value: config occurs because config does not implement Copy`;
      const matches = findSimilarHistoricalErrors(rustError, mockTasks, mockNotes, mockLogs);

      expect(matches.length).toBeGreaterThan(0);
      const logMatch = matches.find((m) => m.sourceType === 'learning_log');
      expect(logMatch).toBeDefined();
      expect(logMatch?.title).toContain('O‘rganish kundaligi');
    });

    it('ranks results with higher similarity score first', () => {
      const matches = findSimilarHistoricalErrors('cors fastify security header', mockTasks, mockNotes, mockLogs);
      expect(matches.length).toBeGreaterThan(1);
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].similarityScore).toBeGreaterThanOrEqual(matches[i + 1].similarityScore);
      }
    });
  });

  describe('2. diagnoseErrorWithRubberDuck (Diagnostic & Patch Engine)', () => {
    it('successfully parses AI structured JSON diagnostic response', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          errorType: 'NullPointer Dereference',
          summary: 'Obʼyekt mavjud bo‘lmagan paytda map funksiyasi chaqirilgan.',
          rootCause: 'Backenddan tasks massiv o‘rniga undefined kelgan.',
          recommendedFix: 'tasks parametriga default [] berish yoki optional chaining qo‘yish.',
          codePatch: {
            language: 'typescript',
            originalSnippet: 'tasks.map(...)',
            fixedSnippet: 'tasks?.map(...) ?? []',
            diffSummary: 'Optional chaining qo‘shildi',
          },
          preventiveAdvice: 'TypeScript strict null check yoqilsin.',
          tags: ['typescript', 'react', 'null-check'],
        }),
        source: 'gemini',
        model: 'gemini-2.5-flash',
      });

      const diag = await diagnoseErrorWithRubberDuck({
        errorMessage: `TypeError: Cannot read properties of undefined (reading 'map')`,
        codeSnippet: `tasks.map(t => t.id)`,
        techContext: 'TypeScript / React',
        mode: 'patch',
      });

      expect(diag.errorType).toBe('NullPointer Dereference');
      expect(diag.codePatch?.fixedSnippet).toBe('tasks?.map(...) ?? []');
      expect(diag.aiSource).toBe('gemini');
      expect(diag.aiModel).toBe('gemini-2.5-flash');
    });

    it('handles offline fallback gracefully for Null/Undefined Pointer errors when AI fails', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const diag = await diagnoseErrorWithRubberDuck({
        errorMessage: `TypeError: Cannot read properties of undefined (reading 'map')`,
        codeSnippet: `tasks.map(t => t.id)`,
        techContext: 'TypeScript / React',
        mode: 'patch',
        tasks: mockTasks,
        notesDocs: mockNotes,
        learningLogs: mockLogs,
      });

      expect(diag).toHaveProperty('errorType');
      expect(diag.errorType.toLowerCase()).toContain('null');
      expect(diag.rootCause).toBeTruthy();
      expect(diag.recommendedFix).toBeTruthy();
      expect(diag.codePatch).toBeDefined();
      expect(diag.codePatch?.fixedSnippet).toContain('tasks');
    });

    it('handles CORS error classification in offline fallback', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const diag = await diagnoseErrorWithRubberDuck({
        errorMessage: `Access to fetch blocked by CORS policy`,
        techContext: 'Web / REST API',
        mode: 'explain',
      });

      expect(diag.errorType.toLowerCase()).toContain('cors');
      expect(diag.preventiveAdvice).toBeTruthy();
    });

    it('handles Rust Borrow Checker classification in offline fallback', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const diag = await diagnoseErrorWithRubberDuck({
        errorMessage: `error[E0382]: borrow of moved value: config`,
        codeSnippet: `let a = config; let b = config;`,
        techContext: 'Rust / Tauri',
        mode: 'socratic',
      });

      expect(diag.errorType.toLowerCase()).toContain('rust');
      expect(diag.rootCause).toBeTruthy();
    });

    it('attaches historical matches to the diagnostic report', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const diag = await diagnoseErrorWithRubberDuck({
        errorMessage: `Access to fetch at /sync blocked by CORS policy`,
        tasks: mockTasks,
        notesDocs: mockNotes,
        learningLogs: mockLogs,
      });

      expect(diag.historicalMatches).toBeInstanceOf(Array);
      expect(diag.historicalMatches.length).toBeGreaterThan(0);
    });
  });
});
