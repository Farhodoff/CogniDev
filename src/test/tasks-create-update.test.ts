/** Yaratish + yangilash integratsiya testlari (dual-layer write-through). */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  insertTask: vi.fn(async () => {}),
  updateTaskTags: vi.fn(async () => {}),
  updateTaskMeta: vi.fn(async () => {}),
  deleteTaskFromDb: vi.fn(async () => {}),
  upsertResolution: vi.fn(async () => {}),
  fetchTasks: vi.fn(async () => [] as unknown[]),
  fetchPrompts: vi.fn(async () => [] as unknown[]),
  fetchResolution: vi.fn(async () => null as unknown),
  fetchWorkspaces: vi.fn(async () => [] as unknown[]),
  fetchUserProfile: vi.fn(async () => null as unknown),
  fetchGroups: vi.fn(async () => [] as unknown[]),
  fetchNotes: vi.fn(async () => [] as unknown[]),
  fetchRoadmaps: vi.fn(async () => [] as unknown[]),
  fetchLearningLogs: vi.fn(async () => [] as unknown[]),
  fetchProjectIdeas: vi.fn(async () => [] as unknown[]),
  fetchReminders: vi.fn(async () => [] as unknown[]),
  fetchMeetings: vi.fn(async () => [] as unknown[]),
  fetchScheduleBlocks: vi.fn(async () => [] as unknown[]),
  migrate: vi.fn(async () => {}),
  ensureDefaultWorkspace: vi.fn(async () => {}),
  purgeMockDataIfPresent: vi.fn(async () => {}),
}));

vi.mock('../lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ...dbMocks,
    uid: (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 9)}`,
  };
});
vi.mock('../lib/audioDb', () => ({ deleteMeetingAudio: vi.fn(async () => {}) }));

import { makeStoreTask } from './helpers';

import { useSynapse, loadStoredTasks } from '../lib/store';
import { seedTestWorkspace } from './seed-helper';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  seedTestWorkspace();
});

describe('store — yaratish', () => {
  it('quickCapture state + localStorage + SQLite ga yozadi', async () => {
    useSynapse.setState({ dbMode: 'sqlite' });
    await useSynapse.getState().quickCapture('Login sahifani testlash');
    const state = useSynapse.getState();
    const created = state.tasks.find((t) => t.title === 'Login sahifani testlash');
    expect(created).toBeDefined();
    expect(created!.id).toMatch(/^DEV-\d+$/);
    expect(state.notes[created!.id]).toContain('Login');
    expect(loadStoredTasks().find((t) => t.id === created!.id)?.title).toBe('Login sahifani testlash');
    expect(dbMocks.insertTask).toHaveBeenCalledTimes(1);
    expect(dbMocks.upsertResolution).toHaveBeenCalledTimes(1);
  });

  it('addTask bir xil id da dublikat yaratmaydi (GitHub sync)', () => {
    const { addTask } = useSynapse.getState();
    const base = makeStoreTask({ id: 'DEV-1', title: '[CogniDev] Testlar', status: 'backlog' });
    addTask(base);
    addTask({ ...base, title: 'Yangilangan sarlavha' });
    const tasks = useSynapse.getState().tasks.filter((t) => t.id === 'DEV-1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Yangilangan sarlavha');
    expect(loadStoredTasks().filter((t) => t.id === 'DEV-1')).toHaveLength(1);
  });
});

describe('store — yangilash', () => {
  it('updateTaskStatus + updateTaskPriority ikkala qatlamga yoziladi', async () => {
    useSynapse.setState({ dbMode: 'sqlite' });
    await useSynapse.getState().quickCapture('Eski sarlavha');
    const id = useSynapse.getState().tasks.find((t) => t.title === 'Eski sarlavha')!.id;
    dbMocks.updateTaskMeta.mockClear();

    useSynapse.getState().updateTaskStatus(id, 'in_review');
    useSynapse.getState().updateTaskPriority(id, 'High Priority');

    const updated = useSynapse.getState().tasks.find((t) => t.id === id)!;
    expect(updated.status).toBe('in_review');
    expect(updated.priority).toBe('High Priority');
    expect(loadStoredTasks().find((t) => t.id === id)?.status).toBe('in_review');
    expect(dbMocks.updateTaskMeta).toHaveBeenCalledWith(id, 'in_review', 'Normal');
    expect(dbMocks.updateTaskMeta).toHaveBeenCalledWith(id, 'in_review', 'High Priority');
  });

  it('addTag/removeTag teglarni state + localStorage + SQLite da sinxronlaydi', () => {
    useSynapse.setState({ dbMode: 'sqlite' });
    useSynapse.getState().addTask(makeStoreTask({ id: 'DEV-7', title: 'Teg test' }));
    useSynapse.getState().addTag('DEV-7', 'backend');
    expect(useSynapse.getState().tasks.find((t) => t.id === 'DEV-7')?.tags).toContain('backend');
    expect(loadStoredTasks().find((t) => t.id === 'DEV-7')?.tags).toContain('backend');
    expect(dbMocks.updateTaskTags).toHaveBeenCalledWith('DEV-7', ['backend']);
    useSynapse.getState().removeTag('DEV-7', 'backend');
    expect(useSynapse.getState().tasks.find((t) => t.id === 'DEV-7')?.tags).toEqual([]);
  });
});
