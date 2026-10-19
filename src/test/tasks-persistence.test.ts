/**
 * Tasks persistence — unit testlar (localStorage qatlami + sof helperlar).
 *
 * Qamrov (PR #33 dagi ikki qatlamli persistence):
 * - loadStoredTasks / saveStoredTasks round-trip + buzilgan JSON fallback
 * - load/save notes, checklists, roadmaps, project-ideas
 * - nextTaskId (DEV-/TASK- ketma-ketligi)
 * - normalizeTag / parseTagsInput
 * - filteredTasks: completed arxiv tartibi (active yuqorida — UI da pastda ko'rsatiladi)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredTasks,
  saveStoredTasks,
  loadStoredNotes,
  saveStoredNotes,
  loadStoredChecklists,
  saveStoredChecklists,
  loadStoredRoadmaps,
  saveStoredRoadmaps,
  loadStoredProjectIdeas,
  saveStoredProjectIdeas,
  nextTaskId,
  normalizeTag,
  parseTagsInput,
  filteredTasks,
} from '../lib/store';
import { DEFAULT_TASKS } from '../lib/seed';
import type { Task } from '../lib/types';

function makeTask(over: Partial<Task> & { id: string }): Task {
  return {
    workspace_id: 'ws-personal',
    title: `Task ${over.id}`,
    status: 'active',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: null,
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('tasks localStorage persistence', () => {
  it('bo‘sh omborda DEFAULT_TASKS ga fallback qiladi', () => {
    expect(loadStoredTasks()).toEqual(DEFAULT_TASKS);
  });

  it('save → load round-trip vazifalarni yo‘qotmasdan saqlaydi', () => {
    const tasks = [makeTask({ id: 'DEV-1', title: 'Login sahifa' }), makeTask({ id: 'DEV-2', status: 'completed' })];
    saveStoredTasks(tasks);
    expect(loadStoredTasks()).toEqual(tasks);
    expect(JSON.parse(localStorage.getItem('cognidev_tasks_v2')!)).toHaveLength(2);
  });

  it('buzilgan JSON da fallback qaytaradi va crash qilmaydi', () => {
    localStorage.setItem('cognidev_tasks_v2', '{not-json');
    expect(loadStoredTasks()).toEqual(DEFAULT_TASKS);
  });

  it('massiv bo‘lmagan JSON da fallback qaytaradi', () => {
    localStorage.setItem('cognidev_tasks_v2', JSON.stringify({ foo: 1 }));
    expect(loadStoredTasks()).toEqual(DEFAULT_TASKS);
  });

  it('notes round-trip: vazifa eslatmalari saqlanadi', () => {
    saveStoredNotes({ 'DEV-1': '# Yechim\nTest' });
    expect(loadStoredNotes()['DEV-1']).toContain('Yechim');
  });

  it('checklists round-trip: checklist elementlari saqlanadi', () => {
    saveStoredChecklists({ 'DEV-1': [{ id: 'chk-1', text: 'Test yozish', done: false }] });
    const loaded = loadStoredChecklists();
    expect(loaded['DEV-1']).toHaveLength(1);
    expect(loaded['DEV-1'][0].text).toBe('Test yozish');
  });

  it('roadmaps va project-ideas round-trip saqlanadi', () => {
    saveStoredRoadmaps([]);
    saveStoredProjectIdeas([]);
    expect(loadStoredRoadmaps()).toEqual([]);
    expect(loadStoredProjectIdeas()).toEqual([]);
  });
});

describe('nextTaskId', () => {
  it('bo‘sh ro‘yxatda DEV-1 dan boshlaydi', () => {
    expect(nextTaskId([])).toBe('DEV-1');
  });

  it('DEV- va TASK- prefiksli maksimal raqamdan keyin keladi', () => {
    const tasks = [makeTask({ id: 'DEV-2' }), makeTask({ id: 'TASK-9' }), makeTask({ id: 'DEV-5' })];
    expect(nextTaskId(tasks)).toBe('DEV-10');
  });

  it('raqam bo‘lmagan id larni e’tiborsiz qoldiradi', () => {
    const tasks = [makeTask({ id: 'gh-task-1' }), makeTask({ id: 'DEV-3' })];
    expect(nextTaskId(tasks)).toBe('DEV-4');
  });
});

describe('normalizeTag / parseTagsInput', () => {
  it('taglarni normallashtiradi (# olib tashlash, kichik harf, probel → -)', () => {
    expect(normalizeTag('#BugFix')).toBe('bugfix');
    expect(normalizeTag('  UI Kit ')).toBe('ui-kit');
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('a'.repeat(25))).toBeNull();
    expect(normalizeTag('hello world!')).toBeNull();
  });

  it('erkin matndan unikal teglar ajratadi (max 8)', () => {
    const tags = parseTagsInput('bugfix, #arch ui\ndocs;bugfix');
    expect(tags).toEqual(['bugfix', 'arch', 'ui', 'docs']);
  });
});

describe('filteredTasks — completed arxiv tartibi', () => {
  const ws = 'ws-personal';
  // filteredTasks saralashni created_at bo‘yicha qiladi (newest);
  // TaskStream UI qatlami completed larni pastki "Arxiv" bo‘limiga ajratadi.
  const tasks: Task[] = [
    makeTask({ id: 'DEV-1', status: 'completed', workspace_id: ws, title: 'Birinchi', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }),
    makeTask({ id: 'DEV-2', status: 'active', workspace_id: ws, title: 'Ikkinchi', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }),
    makeTask({ id: 'DEV-3', status: 'in_review', workspace_id: ws, title: 'Uchinchi', created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z' }),
    makeTask({ id: 'DEV-4', status: 'completed', workspace_id: ws, title: 'Tortinchi', created_at: '2026-01-04T00:00:00Z', updated_at: '2026-01-04T00:00:00Z' }),
  ];

  it('TaskStream arxiv mantig‘i: completed lar alohida ajratiladi', () => {
    const out = filteredTasks(tasks, null, '', ws, 'newest', null, null, undefined);
    expect(out).toHaveLength(4);
    // UI dagi kabi ajratish:
    const activeVisible = out.filter((t) => t.status !== 'completed');
    const completedVisible = out.filter((t) => t.status === 'completed');
    expect(activeVisible.map((t) => t.id).sort()).toEqual(['DEV-2', 'DEV-3']);
    expect(completedVisible.map((t) => t.id).sort()).toEqual(['DEV-1', 'DEV-4']);
  });

  it("'solved' filtri faqat completed qaytaradi", () => {
    const out = filteredTasks(tasks, 'solved', '', ws, 'newest', null, null, undefined);
    expect(out.map((t) => t.id).sort()).toEqual(['DEV-1', 'DEV-4']);
  });

  it('qidiruv completed arxiv ichida ham ishlaydi', () => {
    const out = filteredTasks(
      [makeTask({ id: 'DEV-9', status: 'completed', title: 'Maxsus arxiv vazifasi', workspace_id: ws })],
      'solved',
      'arxiv',
      ws,
      'newest',
      null,
      null,
      undefined,
    );
    expect(out).toHaveLength(1);
  });
});
