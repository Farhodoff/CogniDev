import { create } from 'zustand';
import type { ChecklistItem, EditorTab, PromptEntry, QuickFilter, Task, Workspace, WeeklyCoachInsight, TeamGroup } from './types';
import { DEFAULT_PERSONAL_WORKSPACE } from './seed';
import {
  deleteGroupFromDb, deleteTaskFromDb, ensureDefaultWorkspace, fetchGroups, fetchPrompts, fetchResolution, fetchTasks, fetchWorkspaces,
  insertGroup, insertPrompt, insertTask, insertWorkspace, migrate, purgeMockDataIfPresent, saveRetrospective, uid, updateTaskGroup, updateTaskMeta, upsertResolution,
  type VaultDump,
} from './db';
import { analyzeBlockers, generateStandup, generateWeeklyCoachReview, type ParsedAiIngestion } from './ai';

export type SortOrder = 'newest' | 'oldest' | 'priority' | 'title';

export function nextTaskId(tasks: Task[]): string {
  let max = 0;
  for (const t of tasks) {
    const m = /^(?:DEV|TASK)-(\d+)$/.exec(t.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DEV-${max + 1}`;
}

const noteTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function persistResolution(taskId: string) {
  const { dbMode, notes, checklists } = useSynapse.getState();
  if (dbMode !== 'sqlite') return;
  const md = notes[taskId] ?? '';
  const cl = JSON.stringify(checklists[taskId] ?? []);
  upsertResolution(taskId, md, cl).catch(() => {});
}

interface SynapseState {
  ready: boolean;
  dbMode: 'sqlite' | 'memory';
  workspaces: Workspace[];
  activeWorkspaceId: string;
  groups: TeamGroup[];
  activeGroupId: string | null;
  tasks: Task[];
  selectedTaskId: string | null;
  editorTab: EditorTab;
  quickFilter: QuickFilter;
  sortOrder: SortOrder;
  search: string;
  notes: Record<string, string>;
  checklists: Record<string, ChecklistItem[]>;
  prompts: PromptEntry[];
  standup: string | null;
  standupSource: 'ollama' | 'fallback' | null;
  hudMessage: string | null;
  showStandupModal: boolean;
  showTaskModal: boolean;
  showChatModal: boolean;
  weeklyCoach: WeeklyCoachInsight | null;
  showWeeklyCoachModal: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  restoreAll: (d: VaultDump) => void;
  setWorkspace: (id: string) => Promise<void>;
  setActiveGroup: (id: string | null) => void;
  createGroup: (name: string, color?: string, icon?: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignTaskToGroup: (taskId: string, groupId: string | null) => Promise<void>;
  selectTask: (id: string) => Promise<void>;
  setTab: (t: EditorTab) => void;
  setFilter: (f: QuickFilter) => void;
  setSortOrder: (s: SortOrder) => void;
  setSearch: (s: string) => void;
  toggleCheck: (taskId: string, itemId: string) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  removeChecklistItem: (taskId: string, itemId: string) => void;
  updateNote: (taskId: string, md: string) => void;
  flagBlocker: (id: string) => void;
  setStandup: (content: string | null, source: 'ollama' | 'fallback' | null) => void;
  setHud: (msg: string | null) => void;
  setStandupModal: (open: boolean) => void;
  setTaskModal: (open: boolean) => void;
  setChatModal: (open: boolean) => void;
  setWeeklyCoachModal: (open: boolean) => void;
  triggerWeeklyCoach: () => Promise<void>;
  quickCapture: (text: string) => Promise<void>;
  ingestAiConversation: (
    ingestData: ParsedAiIngestion,
    mode: 'new_task' | 'attach_task',
    targetTaskId?: string,
  ) => Promise<string>;
  addTask: (t: Task) => void;
  deleteTask: (id: string) => Promise<void>;
  updateTaskStatus: (id: string, status: Task['status']) => void;
  updateTaskPriority: (id: string, priority: Task['priority']) => void;
  createWorkspace: (name: string, type: 'personal' | 'team') => Promise<void>;
  addPrompt: (p: PromptEntry) => void;
  triggerStandup: () => Promise<void>;
}

export const useSynapse = create<SynapseState>((set, get) => ({
  ready: false,
  dbMode: 'memory',
  workspaces: [DEFAULT_PERSONAL_WORKSPACE],
  activeWorkspaceId: DEFAULT_PERSONAL_WORKSPACE.id,
  groups: [],
  activeGroupId: null,
  tasks: [],
  selectedTaskId: null,
  editorTab: 'note',
  quickFilter: null,
  sortOrder: 'newest',
  search: '',
  notes: {},
  checklists: {},
  prompts: [],
  standup: null,
  standupSource: null,
  hudMessage: null,
  showStandupModal: false,
  showTaskModal: false,
  showChatModal: false,
  weeklyCoach: null,
  showWeeklyCoachModal: false,

  init: async () => {
    try {
      await migrate();
      await purgeMockDataIfPresent();
      await ensureDefaultWorkspace();
      await get().refresh();
      set({ ready: true, dbMode: 'sqlite' });
    } catch {
      set({ ready: true, dbMode: 'memory' });
    }
  },

  refresh: async () => {
    const [ws, tasks, grps] = await Promise.all([
      fetchWorkspaces().catch(() => []),
      fetchTasks().catch(() => []),
      fetchGroups(get().activeWorkspaceId).catch(() => []),
    ]);
    const activeWs = ws.find((w) => w.id === get().activeWorkspaceId) ?? ws[0] ?? DEFAULT_PERSONAL_WORKSPACE;
    const currentSelected = get().selectedTaskId;
    const sel = tasks.find((t) => t.id === currentSelected) ?? tasks[0] ?? null;
    set({
      workspaces: ws.length ? ws : [DEFAULT_PERSONAL_WORKSPACE],
      activeWorkspaceId: activeWs.id,
      groups: grps,
      tasks,
      selectedTaskId: sel?.id ?? null,
    });
    if (sel) {
      await get().selectTask(sel.id);
    } else {
      set({ prompts: [] });
    }
  },

  restoreAll: (d) => {
    const notes: Record<string, string> = {};
    const checklists: Record<string, ChecklistItem[]> = {};
    for (const r of d.resolutions) {
      if (r.markdown_note) notes[r.task_id] = r.markdown_note;
      if (r.checklist_json) {
        try { checklists[r.task_id] = JSON.parse(r.checklist_json); } catch { /* keep */ }
      }
    }
    const sel = d.tasks[0] ?? null;
    set({
      workspaces: d.workspaces.length ? d.workspaces : [DEFAULT_PERSONAL_WORKSPACE],
      tasks: d.tasks,
      notes,
      checklists,
      prompts: d.prompts.filter((p) => p.task_id === sel?.id),
      selectedTaskId: sel?.id ?? null,
    });
  },

  setWorkspace: async (id) => {
    set({ activeWorkspaceId: id, activeGroupId: null, quickFilter: null, search: '' });
    const { dbMode } = get();
    if (dbMode === 'sqlite') {
      try {
        const [tasks, grps] = await Promise.all([fetchTasks(id), fetchGroups(id)]);
        const first = tasks[0];
        set({ tasks, groups: grps, selectedTaskId: first?.id ?? null });
        if (first) {
          await get().selectTask(first.id);
        } else {
          set({ prompts: [] });
        }
        return;
      } catch { /* fall through */ }
    }
    const tasks = get().tasks.filter((t) => t.workspace_id === id);
    const first = tasks[0];
    set({ tasks, selectedTaskId: first?.id ?? null });
    if (first) {
      set((s) => ({ prompts: s.prompts.filter((p) => p.task_id === first.id) }));
    } else {
      set({ prompts: [] });
    }
  },

  selectTask: async (id) => {
    set({ selectedTaskId: id });
    const { dbMode, notes, checklists } = get();
    if (dbMode === 'sqlite') {
      try {
        const [res, pr] = await Promise.all([fetchResolution(id), fetchPrompts(id)]);
        set({
          notes: res?.markdown_note !== undefined && res?.markdown_note !== null
            ? { ...notes, [id]: res.markdown_note }
            : notes,
          checklists: res?.checklist_json
            ? { ...checklists, [id]: JSON.parse(res.checklist_json) }
            : checklists,
          prompts: pr,
        });
        return;
      } catch { /* keep memory */ }
    }
  },

  setTab: (t) => set({ editorTab: t }),
  setFilter: (f) => set({ quickFilter: f }),
  setSortOrder: (s) => set({ sortOrder: s }),
  setSearch: (s) => set({ search: s }),

  toggleCheck: (taskId, itemId) => {
    const list = get().checklists[taskId] ?? [];
    const next = list.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
    set((s) => ({ checklists: { ...s.checklists, [taskId]: next } }));
    persistResolution(taskId);
  },

  addChecklistItem: (taskId, text) => {
    const list = get().checklists[taskId] ?? [];
    const item: ChecklistItem = { id: uid('chk'), text: text.trim(), done: false };
    set((s) => ({ checklists: { ...s.checklists, [taskId]: [...list, item] } }));
    persistResolution(taskId);
  },

  removeChecklistItem: (taskId, itemId) => {
    const list = get().checklists[taskId] ?? [];
    set((s) => ({ checklists: { ...s.checklists, [taskId]: list.filter((it) => it.id !== itemId) } }));
    persistResolution(taskId);
  },

  updateNote: (taskId, md) => {
    set((s) => ({ notes: { ...s.notes, [taskId]: md } }));
    clearTimeout(noteTimers[taskId]);
    noteTimers[taskId] = setTimeout(() => persistResolution(taskId), 800);
  },

  flagBlocker: (id) => {
    const { tasks, dbMode } = get();
    const t = tasks.find((item) => item.id === id);
    if (!t) return;
    const nextStatus = t.status === 'blocker' ? 'active' : 'blocker';
    const nextPriority = nextStatus === 'blocker' ? 'P0 Blocker' : 'Normal';
    set((s) => ({
      tasks: s.tasks.map((item) =>
        item.id === id ? { ...item, status: nextStatus, priority: nextPriority } : item,
      ),
      hudMessage: nextStatus === 'blocker' ? `${id} P0 blocker deb belgilandi` : `${id} faol holatga qaytarildi`,
    }));
    if (dbMode === 'sqlite') {
      updateTaskMeta(id, nextStatus, nextPriority).catch(() => {});
    }
  },

  setStandup: (content, source) => set({ standup: content, standupSource: source }),
  setHud: (msg) => set({ hudMessage: msg }),
  setStandupModal: (open) => set({ showStandupModal: open }),
  setTaskModal: (open) => set({ showTaskModal: open }),
  setChatModal: (open) => set({ showChatModal: open }),
  setWeeklyCoachModal: (open) => set({ showWeeklyCoachModal: open }),

  triggerWeeklyCoach: async () => {
    const { tasks, notes } = get();
    set({ hudMessage: "AI Haftalik tahlil va fidbek tuzilmoqda..." });
    try {
      const insight = await generateWeeklyCoachReview(tasks, notes);
      set({
        weeklyCoach: insight,
        showWeeklyCoachModal: true,
        hudMessage: `AI Haftalik tahlil tayyor: ${insight.completedCount} ta bajarilgan, ${insight.deferredCount} ta qoldirilgan`,
      });
    } catch {
      set({ hudMessage: "Haftalik tahlil tuzishda xatolik yuz berdi" });
    }
  },


  quickCapture: async (text: string) => {
    const { tasks, activeWorkspaceId, dbMode } = get();
    const id = nextTaskId(tasks);
    const newTask: Task = {
      id,
      workspace_id: activeWorkspaceId,
      title: text.trim(),
      status: 'active',
      priority: 'Normal',
      git_branch: null,
      pr_url: null,
      ai_source: 'Quick Capture',
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (dbMode === 'sqlite') {
      await insertTask(newTask).catch(() => {});
    }
    set((s) => ({
      tasks: [newTask, ...s.tasks],
      selectedTaskId: newTask.id,
      hudMessage: `Yangi tezkor vazifa qo'shildi: ${newTask.id}`,
    }));
  },

  ingestAiConversation: async (ingestData, mode, targetTaskId) => {
    const { tasks, activeWorkspaceId, dbMode, notes } = get();
    const now = new Date().toISOString();
    const shortPromptHash = '#' + Math.random().toString(16).slice(2, 7);

    if (mode === 'new_task') {
      const id = nextTaskId(tasks);
      const newTask: Task = {
        id,
        workspace_id: activeWorkspaceId,
        title: ingestData.title,
        status: 'completed',
        priority: 'Normal',
        git_branch: null,
        pr_url: null,
        ai_source: ingestData.detectedModel,
        assignee_name: 'Farhod',
        assignee_avatar: 'F',
        assignee_name2: null,
        assignee_avatar2: null,
        created_at: now,
        updated_at: now,
      };

      const richNote = `# ${ingestData.title}\n\n` +
        `> **AI Modeli:** ${ingestData.detectedModel}\n` +
        `> **Sana:** ${new Date().toLocaleDateString('uz-UZ')}\n\n` +
        `## Muammo & Kontekst\n${ingestData.problemSummary}\n\n` +
        (ingestData.solutionSnippet ? `## Yechim Kodi\n${ingestData.solutionSnippet}\n\n` : '') +
        `## Asosiy Bilimlar & Xulosalar\n` +
        ingestData.keyLearnings.map((k) => `- ${k}`).join('\n') +
        '\n';

      const promptEntry: PromptEntry = {
        id: uid('pv'),
        task_id: id,
        prompt_hash: shortPromptHash,
        raw_prompt: ingestData.rawPrompt,
        ai_response: ingestData.solutionSnippet || ingestData.problemSummary,
        model_name: ingestData.detectedModel,
        created_at: now,
      };

      if (dbMode === 'sqlite') {
        try {
          await insertTask(newTask);
          await upsertResolution(id, richNote, '[]');
          await insertPrompt(promptEntry);
        } catch {}
      }

      set((s) => ({
        tasks: [newTask, ...s.tasks],
        selectedTaskId: id,
        notes: { ...s.notes, [id]: richNote },
        prompts: [promptEntry],
        hudMessage: `AI yechimi muvaffaqiyatli import qilindi: ${id}`,
      }));

      return id;
    } else {
      const id = targetTaskId ?? get().selectedTaskId ?? tasks[0]?.id;
      if (!id) return '';

      const appendBlock = `\n\n---\n## 🤖 AI Yechimi (${ingestData.detectedModel})\n\n${ingestData.solutionSnippet}\n\n**O'rganilgan bilimlar:**\n${ingestData.keyLearnings.map((k) => `- ${k}`).join('\n')}\n`;
      const currentNote = notes[id] ?? '';
      const updatedNote = currentNote + appendBlock;

      const promptEntry: PromptEntry = {
        id: uid('pv'),
        task_id: id,
        prompt_hash: shortPromptHash,
        raw_prompt: ingestData.rawPrompt,
        ai_response: ingestData.solutionSnippet || ingestData.problemSummary,
        model_name: ingestData.detectedModel,
        created_at: now,
      };

      if (dbMode === 'sqlite') {
        try {
          await upsertResolution(id, updatedNote, '[]');
          await insertPrompt(promptEntry);
        } catch {}
      }

      set((s) => ({
        notes: { ...s.notes, [id]: updatedNote },
        prompts: [...s.prompts, promptEntry],
        selectedTaskId: id,
        hudMessage: `AI suhbati ${id} ga biriktirildi`,
      }));

      return id;
    }
  },
  addTask: (t) => {
    set((s) => ({
      tasks: [t, ...s.tasks],
      selectedTaskId: t.id,
      hudMessage: `Yangi vazifa qo'shildi: ${t.id}`,
    }));
    if (get().dbMode === 'sqlite') {
      insertTask(t).catch(() => {});
    }
  },

  deleteTask: async (id) => {
    const { dbMode, selectedTaskId, tasks } = get();
    if (dbMode === 'sqlite') {
      await deleteTaskFromDb(id).catch(() => {});
    }
    const remaining = tasks.filter((t) => t.id !== id);
    const newSelected = selectedTaskId === id ? (remaining[0]?.id ?? null) : selectedTaskId;
    set({
      tasks: remaining,
      selectedTaskId: newSelected,
      hudMessage: `${id} vazifasi o'chirildi`,
    });
    if (newSelected) {
      await get().selectTask(newSelected);
    }
  },

  updateTaskStatus: (id, status) => {
    const stamp = new Date().toISOString();
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updated_at: stamp } : t)),
      hudMessage: `${id} holati o'zgartirildi: ${status}`,
    }));
    const t = get().tasks.find((task) => task.id === id);
    if (get().dbMode === 'sqlite' && t) {
      updateTaskMeta(id, status, t.priority).catch(() => {});
    }
  },

  updateTaskPriority: (id, priority) => {
    const stamp = new Date().toISOString();
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, priority, updated_at: stamp } : t)),
      hudMessage: `${id} muhimlik darajasi o'zgartirildi`,
    }));
    const t = get().tasks.find((task) => task.id === id);
    if (get().dbMode === 'sqlite' && t) {
      updateTaskMeta(id, t.status, priority).catch(() => {});
    }
  },

  createWorkspace: async (name, type) => {
    const w: Workspace = {
      id: uid('ws'),
      name: name.trim(),
      type,
      created_at: new Date().toISOString(),
    };
    if (get().dbMode === 'sqlite') {
      await insertWorkspace(w).catch(() => {});
    }
    set((s) => ({
      workspaces: [...s.workspaces, w],
      activeWorkspaceId: w.id,
      hudMessage: `Yangi ombor yaratildi: ${w.name}`,
    }));
    await get().setWorkspace(w.id);
  },

  addPrompt: (p) => set((s) => ({ prompts: [...s.prompts, p] })),

  setActiveGroup: (id: string | null) => set({ activeGroupId: id }),

  createGroup: async (name: string, color = '#38bdf8', icon = 'folder') => {
    const { activeWorkspaceId, dbMode } = get();
    const g: TeamGroup = {
      id: uid('grp'),
      workspace_id: activeWorkspaceId,
      name: name.trim(),
      color,
      icon,
      created_at: new Date().toISOString(),
    };
    if (dbMode === 'sqlite') {
      await insertGroup(g).catch(() => {});
    }
    set((s) => ({
      groups: [...s.groups, g],
      activeGroupId: g.id,
      hudMessage: `Yangi guruh yaratildi: ${g.name}`,
    }));
  },

  deleteGroup: async (id: string) => {
    const { dbMode, activeGroupId } = get();
    if (dbMode === 'sqlite') {
      await deleteGroupFromDb(id).catch(() => {});
    }
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      tasks: s.tasks.map((t) => (t.group_id === id ? { ...t, group_id: null } : t)),
      activeGroupId: activeGroupId === id ? null : activeGroupId,
      hudMessage: "Guruh o'chirildi",
    }));
  },

  assignTaskToGroup: async (taskId: string, groupId: string | null) => {
    const { dbMode } = get();
    if (dbMode === 'sqlite') {
      await updateTaskGroup(taskId, groupId).catch(() => {});
    }
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, group_id: groupId } : t)),
      hudMessage: "Vazifa guruhi yangilandi",
    }));
  },


  triggerStandup: async () => {
    const { tasks, dbMode } = get();
    set({ hudMessage: 'Standup tuzilmoqda (Ollama / AI)...' });
    try {
      const r = await generateStandup(tasks);
      set({
        standup: r.content,
        standupSource: r.source,
        showStandupModal: true,
        hudMessage: r.source === 'ollama' ? `Standup ${r.model} orqali tuzildi` : 'Standup tayyorlandi',
      });
      if (dbMode === 'sqlite') {
        saveRetrospective(new Date().toISOString().slice(0, 10), 'standup', r.content, analyzeBlockers(tasks)).catch(() => {});
      }
    } catch {
      set({ hudMessage: 'Standup generatsiya qilishda xatolik yuz berdi' });
    }
  },
}));

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  'P0 Blocker': 0,
  'Critical': 1,
  'High Priority': 2,
  'Normal': 3,
};

export function filteredTasks(
  tasks: Task[],
  f: QuickFilter,
  search: string,
  workspaceId: string,
  sortOrder: SortOrder = 'newest',
  activeGroupId?: string | null,
): Task[] {
  let out = tasks.filter((t) => t.workspace_id === workspaceId);
  if (activeGroupId) {
    out = out.filter((t) => t.group_id === activeGroupId);
  }
  if (f === 'mine') out = out.filter((t) => t.assignee_name === 'Farhod');
  if (f === 'high') out = out.filter((t) => t.priority === 'P0 Blocker' || t.priority === 'Critical');
  if (f === 'claude') out = out.filter((t) => (t.ai_source ?? '').toLowerCase().includes('claude'));
  if (f === 'gemini') out = out.filter((t) => (t.ai_source ?? '').toLowerCase().includes('gemini'));

  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter((t) => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q));
  }

  out = [...out].sort((a, b) => {
    if (sortOrder === 'priority') {
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    }
    if (sortOrder === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortOrder === 'oldest') {
      return Date.parse(a.created_at) - Date.parse(b.created_at);
    }
    return Date.parse(b.created_at || b.updated_at) - Date.parse(a.created_at || a.updated_at);
  });

  return out;
}
