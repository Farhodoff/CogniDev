/** O‘chirish + arxivlash + reload integratsiya testlari. */
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

import { useSynapse, filteredTasks, loadStoredTasks } from '../lib/store';
import { seedTestWorkspace } from './seed-helper';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  seedTestWorkspace();
});

describe('store — o‘chirish', () => {
  it('deleteTask state, localStorage va SQLite dan tozalaydi', async () => {
    useSynapse.setState({ dbMode: 'sqlite' });
    await useSynapse.getState().quickCapture('O‘chiriladigan vazifa');
    const id = useSynapse.getState().tasks.find((t) => t.title === 'O‘chiriladigan vazifa')!.id;
    dbMocks.deleteTaskFromDb.mockClear();
    await useSynapse.getState().deleteTask(id);
    const state = useSynapse.getState();
    expect(state.tasks.find((t) => t.id === id)).toBeUndefined();
    expect(loadStoredTasks().find((t) => t.id === id)).toBeUndefined();
    expect(dbMocks.deleteTaskFromDb).toHaveBeenCalledWith(id);
  });
});

describe('store — arxivlash', () => {
  it('completed vazifa TaskStream arxiv bo‘limiga ajratiladi', async () => {
    await useSynapse.getState().quickCapture('Faol vazifa');
    await useSynapse.getState().quickCapture('Yakunlanadigan vazifa');
    const id1 = useSynapse.getState().tasks.find((t) => t.title === 'Faol vazifa')!.id;
    const id2 = useSynapse.getState().tasks.find((t) => t.title === 'Yakunlanadigan vazifa')!.id;
    useSynapse.getState().updateTaskStatus(id2, 'completed');
    const state = useSynapse.getState();
    const visible = filteredTasks(state.tasks, null, '', 'ws-personal', 'newest', null, null, undefined);
    const activeVisible = visible.filter((t) => t.status !== 'completed');
    const completedVisible = visible.filter((t) => t.status === 'completed');
    expect(activeVisible.map((t) => t.id)).toContain(id1);
    expect(completedVisible.map((t) => t.id)).toContain(id2);
    expect(loadStoredTasks().find((t) => t.id === id2)?.status).toBe('completed');
  });
});

describe('store — reload', () => {
  it('yangi sessiyada localStorage dan tiklanadi', async () => {
    await useSynapse.getState().quickCapture('Reload vazifasi');
    const id = useSynapse.getState().tasks.find((t) => t.title === 'Reload vazifasi')!.id;
    const persisted = loadStoredTasks();
    useSynapse.setState({ tasks: [], notes: {}, checklists: {} });
    useSynapse.setState({ tasks: persisted });
    expect(useSynapse.getState().tasks.find((t) => t.id === id)?.title).toBe('Reload vazifasi');
  });
});
