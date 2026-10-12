import { create } from 'zustand';
import type {
  ChecklistItem,
  EditorTab,
  PromptEntry,
  QuickFilter,
  Task,
  Workspace,
  WeeklyCoachInsight,
  TeamGroup,
  GitCommit,
  GitRepoInfo,
} from './types';
import { DEFAULT_PERSONAL_WORKSPACE } from './seed';
import {
  deleteTaskFromDb,
  ensureDefaultWorkspace,
  fetchPrompts,
  fetchResolution,
  fetchTasks,
  fetchWorkspaces,
  insertPrompt,
  insertTask,
  insertWorkspace,
  migrate,
  purgeMockDataIfPresent,
  saveRetrospective,
  uid,
  updateTaskMeta,
  upsertResolution,
  fetchGroups,
  insertGroup,
  deleteGroupFromDb,
  updateTaskGroup,
  type VaultDump,
} from './db';
import { analyzeBlockers, generateStandup, generateWeeklyCoachReview, type ParsedAiIngestion } from './ai';
import { fetchRecentCommits, fetchGitStatus } from './git';

export type SortOrder = 'newest' | 'oldest' | 'priority' | 'title';

/** Next sequential ID: DEV-1, DEV-2, etc. (starts at 1 when empty). */
export function nextTaskId(tasks: Task[]): string {
  let max = 0;
  for (const t of tasks) {
    const m = /^(?:DEV|TASK)-(\d+)$/.exec(t.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DEV-${max + 1}`;
}

const noteTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/** Fire-and-forget write-through of a task's note + checklist. */
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
  gitCommits: GitCommit[];
  gitStatus: GitRepoInfo | null;
  showSpotlight: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  restoreAll: (d: VaultDump) => void;
  setWorkspace: (id: string) => Promise<void>;
  setActiveGroup: (id: string | null) => void;
  createGroup: (name: string, color?: string, icon?: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignTaskToGroup: (taskId: string, groupId: string | null) => Promise<void>;
  syncGitCommits: () => Promise<void>;
  convertCommitToTask: (commit: GitCommit) => Promise<void>;
  setSpotlight: (open: boolean) => void;
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
  gitCommits: [],
  gitStatus: null,
  showSpotlight: false,

  init: async () => {
    try {
      await migrate();
      await purgeMockDataIfPresent();
      await ensureDefaultWorkspace();
      await get().refresh();
      set({ ready: true, dbMode: 'sqlite' });
    } catch {
      // Browser dev without Tauri — memory mode with clean state.
      set({ ready: true, dbMode: 'memory' });
    }
  },

  refresh: async () => {
    const [ws, tasks, grps] = await Promise.all([
      fetchWorkspaces().catch(() => []),
      fetchTasks().catch(() => []),
      fetchGroups().catch(() => []),
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
    set({ activeWorkspaceId: id, quickFilter: null, search: '' });
    const { dbMode } = get();
    if (dbMode === 'sqlite') {
      try {
        const tasks = await fetchTasks(id);
        const first = tasks[0];
        set({ tasks, selectedTaskId: first?.id ?? null });
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
      } catch { /* fallback */ }
    }
    set((s) => ({ prompts: s.prompts.filter((p) => p.task_id === id) }));
  },

  setTab: (editorTab) => set({ editorTab }),
  setFilter: (quickFilter) => set({ quickFilter }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setSearch: (search) => set({ search }),

  toggleCheck: (taskId, itemId) => {
    set((s) => ({
      checklists: {
        ...s.checklists,
        [taskId]: (s.checklists[taskId] ?? []).map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
      },
    }));
    persistResolution(taskId);
  },

  addChecklistItem: (taskId, text) => {
    const item: ChecklistItem = {
      id: uid('chk'),
      text: text.trim(),
      done: false,
    };
    set((s) => ({
      checklists: {
        ...s.checklists,
        [taskId]: [...(s.checklists[taskId] ?? []), item],
      },
    }));
    persistResolution(taskId);
  },

  removeChecklistItem: (taskId, itemId) => {
    set((s) => ({
      checklists: {
        ...s.checklists,
        [taskId]: (s.checklists[taskId] ?? []).filter((c) => c.id !== itemId),
      },
    }));
    persistResolution(taskId);
  },

  updateNote: (taskId, md) => {
    set((s) => ({ notes: { ...s.notes, [taskId]: md } }));
    clearTimeout(noteTimers[taskId]);
    noteTimers[taskId] = setTimeout(() => persistResolution(taskId), 800);
  },

  flagBlocker: (id) => {
    const stamp = new Date().toISOString();
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'blocker', priority: 'P0 Blocker', updated_at: stamp } : t)),
      hudMessage: `${id} P0 to'siq deb belgilandi`,
    }));
    if (get().dbMode === 'sqlite') {
      updateTaskMeta(id, 'blocker', 'P0 Blocker').catch(() => {});
    }
  },

  setStandup: (standup, standupSource) => set({ standup, standupSource }),
  setHud: (hudMessage) => set({ hudMessage }),
  setStandupModal: (showStandupModal) => set({ showStandupModal }),
  setTaskModal: (showTaskModal) => set({ showTaskModal }),
  setChatModal: (showChatModal) => set({ showChatModal }),
  setWeeklyCoachModal: (showWeeklyCoachModal) => set({ showWeeklyCoachModal }),

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
    const trimmed = text.trim();
    if (!trimmed) return;
    const { tasks, activeWorkspaceId, dbMode } = get();
    const id = nextTaskId(tasks);
    const now = new Date().toISOString();
    const newTask: Task = {
      id,
      workspace_id: activeWorkspaceId,
      title: trimmed,
      status: 'active',
      priority: 'Normal',
      git_branch: null,
      pr_url: null,
      ai_source: 'AI Synced',
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      created_at: now,
      updated_at: now,
    };

    const initialNote = `# ${trimmed}\n\n### Problem Solved & Kontekst\n\n\`\`\`typescript\n// Yechim kodi yoki arxitektura namunasi\n\`\`\`\n\n### Key Learnings (O'rganilgan bilimlar)\n- Bugun nimalar tushunildi:\n- Keyingi qadamlar:\n`;

    if (dbMode === 'sqlite') {
      try {
        await insertTask(newTask);
        await upsertResolution(id, initialNote, JSON.stringify([
          { id: uid('chk'), text: "Muammoni aniqlash va o'rganish", done: false },
          { id: uid('chk'), text: "Yechim kodini tekshirish", done: false },
        ]));
      } catch {
        /* fallback */
      }
    }

    set((s) => ({
      tasks: [newTask, ...s.tasks],
      selectedTaskId: id,
      notes: { ...s.notes, [id]: initialNote },
      checklists: {
        ...s.checklists,
        [id]: [
          { id: uid('chk'), text: "Muammoni aniqlash va o'rganish", done: false },
          { id: uid('chk'), text: "Yechim kodini tekshirish", done: false },
        ],
      },
      hudMessage: `Yangi vazifa qayd etildi: ${id}`,
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

      const richNote = `# ${ingestData.title}\n\n> 🤖 **AI Manbasi:** ${ingestData.detectedModel} · **Teglar:** ${ingestData.tags.join(' ')}\n\n### Problem Solved & Yechim Kodi\n${ingestData.solutionSnippet || '```typescript\n// Yechim kodi tahlil qilindi\n```'}\n\n### Key Learnings (O'rganilgan Bilimlar)\n${ingestData.keyLearnings.map((k) => `- ${k}`).join('\n')}\n\n### Asl AI Savol / Prompt\n\`\`\`text\n${ingestData.rawPrompt}\n\`\`\`\n`;

      const checklistItems: ChecklistItem[] = ingestData.keyLearnings.map((k) => ({
        id: uid('chk'),
        text: k,
        done: true,
      }));

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
          await upsertResolution(id, richNote, JSON.stringify(checklistItems));
          await insertPrompt(promptEntry);
        } catch {
          /* fallback */
        }
      }

      set((s) => ({
        tasks: [newTask, ...s.tasks],
        selectedTaskId: id,
        notes: { ...s.notes, [id]: richNote },
        checklists: { ...s.checklists, [id]: checklistItems },
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
          await upsertResolution(id, updatedNote, JSON.stringify(get().checklists[id] ?? []));
          await insertPrompt(promptEntry);
        } catch {
          /* fallback */
        }
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
    set((s) => ({ tasks: [t, ...s.tasks], selectedTaskId: t.id, prompts: [] }));
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

  setActiveGroup: (id) => set({ activeGroupId: id }),

  createGroup: async (name, color = '#38bdf8', icon = 'folder') => {
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

  deleteGroup: async (id) => {
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

  assignTaskToGroup: async (taskId, groupId) => {
    const { dbMode } = get();
    if (dbMode === 'sqlite') {
      await updateTaskGroup(taskId, groupId).catch(() => {});
    }
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, group_id: groupId } : t)),
      hudMessage: "Vazifa guruhi yangilandi",
    }));
  },

  syncGitCommits: async () => {
    set({ hudMessage: 'Git commits tekshirilmoqda...' });
    try {
      const [commits, status] = await Promise.all([
        fetchRecentCommits(8),
        fetchGitStatus(),
      ]);
      set({
        gitCommits: commits,
        gitStatus: status,
        hudMessage: commits.length ? `${commits.length} ta Git commit yuklandi` : 'Git commitlar topilmadi',
      });
    } catch {
      set({ hudMessage: 'Git maʼlumotlarini olishda xatolik' });
    }
  },

  convertCommitToTask: async (commit) => {
    const { tasks, activeWorkspaceId, activeGroupId, gitStatus, dbMode } = get();
    const id = nextTaskId(tasks);
    const newTask: Task = {
      id,
      workspace_id: activeWorkspaceId,
      group_id: activeGroupId,
      title: commit.message,
      status: 'completed',
      priority: 'Normal',
      git_branch: gitStatus?.branch ?? null,
      pr_url: null,
      ai_source: 'Git Sync',
      assignee_name: commit.author || 'Farhod',
      assignee_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      assignee_name2: null,
      assignee_avatar2: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (dbMode === 'sqlite') {
      await insertTask(newTask).catch(() => {});
    }

    const note = `## Git Commit: ${commit.hash}\n- **Muallif:** ${commit.author}\n- **Vaqti:** ${commit.relative_time}\n\n### Vazifa Ta'rifi\n${commit.message}\n\n*Ushbu yechim Git commitdan avtomatik sinxronlashtirildi.*`;

    set((s) => ({
      tasks: [newTask, ...s.tasks],
      selectedTaskId: newTask.id,
      notes: { ...s.notes, [newTask.id]: note },
      hudMessage: `Commit ${commit.hash} vazifa sifatida qo'shildi: ${newTask.id}`,
    }));

    if (dbMode === 'sqlite') {
      upsertResolution(newTask.id, note, '[]').catch(() => {});
    }
  },

  setSpotlight: (open) => set({ showSpotlight: open }),

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
  if (f === 'solved') out = out.filter((t) => t.status === 'completed' || t.title.toLowerCase().includes('fix') || t.title.toLowerCase().includes('solved'));
  if (f === 'knowledge') out = out.filter((t) => t.title.toLowerCase().includes('learn') || t.title.toLowerCase().includes('arch') || t.title.toLowerCase().includes('o\'rgan'));

  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter((t) => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q));
  }

  // Sorting
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
    // newest
    return Date.parse(b.created_at || b.updated_at) - Date.parse(a.created_at || a.updated_at);
  });

  return out;
}
