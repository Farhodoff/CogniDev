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
  UserProfile,
  MainView,
  NoteDoc,
  RoadmapItem,
  RoadmapMilestone,
  RoadmapTopic,
  LearningLog,
  ProjectIdea,
  ScheduleBlock,
  AiDrawerMessage,
  GoalItem,
  ActiveProject,
  SpaceItem,
} from './types';
import {
  DEFAULT_CHECKLISTS,
  DEFAULT_GROUPS,
  DEFAULT_NOTES,
  DEFAULT_PERSONAL_WORKSPACE,
  DEFAULT_PROMPTS,
  DEFAULT_TASKS,
  DEFAULT_ROADMAPS,
  DEFAULT_NOTION_NOTES,
  DEFAULT_PROJECT_IDEAS,
  DEFAULT_SCHEDULE_BLOCKS,
  DEFAULT_SPACES,
  DEFAULT_GOALS,
  DEFAULT_ACTIVE_PROJECTS,
} from './seed';
import {
  deleteTaskFromDb,
  ensureDefaultWorkspace,
  fetchPrompts,
  fetchResolution,
  fetchTasks,
  fetchWorkspaces,
  fetchUserProfile,
  upsertUserProfile,
  DEFAULT_USER_PROFILE,
  insertPrompt,
  insertTask,
  insertWorkspace,
  migrate,
  purgeMockDataIfPresent,
  saveRetrospective,
  uid,
  updateTaskMeta,
  updateTaskTags,
  upsertResolution,
  fetchGroups,
  insertGroup,
  deleteGroupFromDb,
  updateTaskGroup,
  fetchNotes,
  upsertNote,
  deleteNoteFromDb,
  fetchRoadmaps,
  upsertRoadmap,
  deleteRoadmapFromDb,
  fetchLearningLogs,
  insertLearningLog,
  fetchProjectIdeas,
  upsertProjectIdea,
  deleteProjectIdeaFromDb,
  type VaultDump,
} from './db';
import { parseRoadmapMarkdown } from './roadmapParser';
import { analyzeBlockers, generateStandup, generateWeeklyCoachReview, callAi, type ParsedAiIngestion } from './ai';
import { isTauri } from './vault';
import type { AiSource } from './providers';

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

/** Normalize a raw tag: lowercase, no '#', no spaces, max 24 chars. Empty → null. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
  if (!t || t.length > 24) return null;
  if (!/^[a-z0-9/_-]+$/i.test(t)) return null;
  return t;
}

/** Parse free-form input ("bugfix, #arch ui") into unique normalized tags (max 8). */
export function parseTagsInput(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,;\n]+/)) {
    for (const sub of part.trim().split(/\s+/)) {
      const t = normalizeTag(sub);
      if (t && !out.includes(t) && out.length < 8) out.push(t);
    }
  }
  return out;
}

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
  mainView: MainView;
  setMainView: (v: MainView) => void;

  workspaces: Workspace[];
  activeWorkspaceId: string;
  groups: TeamGroup[];
  activeGroupId: string | null;
  tasks: Task[];
  selectedTaskId: string | null;
  editorTab: EditorTab;
  quickFilter: QuickFilter;
  activeTag: string | null;
  sortOrder: SortOrder;
  search: string;
  notes: Record<string, string>;
  checklists: Record<string, ChecklistItem[]>;
  prompts: PromptEntry[];
  standup: string | null;
  standupSource: AiSource | null;
  hudMessage: string | null;
  showStandupModal: boolean;
  showTaskModal: boolean;
  showChatModal: boolean;
  showProvidersModal: boolean;
  weeklyCoach: WeeklyCoachInsight | null;
  showWeeklyCoachModal: boolean;

  // Notion Notes
  notesDocs: NoteDoc[];
  selectedNoteId: string | null;
  selectNote: (id: string | null) => void;
  createNote: (title?: string) => Promise<string>;
  updateNoteDoc: (id: string, patch: Partial<NoteDoc>) => Promise<void>;
  deleteNoteDoc: (id: string) => Promise<void>;

  // Roadmaps & Learning
  roadmaps: RoadmapItem[];
  selectedRoadmapId: string | null;
  selectRoadmap: (id: string | null) => void;
  toggleTopicDone: (roadmapId: string, milestoneId: string, topicId: string) => Promise<void>;
  learningLogs: LearningLog[];
  addLearningLog: (roadmapId: string, learned: string, solvedProblem: string, nextGoal: string, aiFeedback?: string) => Promise<void>;
  createRoadmap: (title: string, stack: string, description: string) => Promise<string>;
  importRoadmapFromMarkdown: (title: string, stack: string, markdown: string) => Promise<string>;
  addMilestoneToRoadmap: (roadmapId: string, title: string, duration?: string, priority?: string) => Promise<void>;
  addTopicToMilestone: (roadmapId: string, milestoneId: string, title: string) => Promise<void>;
  deleteTopicFromMilestone: (roadmapId: string, milestoneId: string, topicId: string) => Promise<void>;
  deleteMilestoneFromRoadmap: (roadmapId: string, milestoneId: string) => Promise<void>;
  deleteRoadmap: (roadmapId: string) => Promise<void>;

  // Project Ideas
  projectIdeas: ProjectIdea[];
  selectedIdeaId: string | null;
  selectIdea: (id: string | null) => void;
  createIdea: (title: string, stack: string, description: string) => Promise<string>;
  updateIdea: (id: string, patch: Partial<ProjectIdea>) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  exportIdeaTasksToStream: (ideaId: string) => Promise<number>;

  // Dashboard & Schedule & AI Assistant Drawer
  isAiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  toggleAiDrawer: () => void;
  scheduleBlocks: ScheduleBlock[];
  toggleScheduleBlockDone: (id: string) => void;
  addScheduleBlock: (block: Omit<ScheduleBlock, 'id'>) => void;
  deleteScheduleBlock: (id: string) => void;
  aiDrawerMessages: AiDrawerMessage[];
  isAiDrawerThinking: boolean;
  sendAiDrawerMessage: (prompt: string) => Promise<void>;
  clearAiDrawerMessages: () => void;
  todayAiSummary: string;
  isGeneratingTodayAiSummary: boolean;
  generateTodayAiSummary: () => Promise<void>;

  // Spaces
  spaces: SpaceItem[];
  activeSpaceId: string | null;
  selectSpace: (id: string | null) => void;

  // Goals
  goals: GoalItem[];
  updateGoalProgress: (id: string, progress: number) => void;
  addGoal: (goal: Omit<GoalItem, 'id'>) => void;

  // Active Projects
  activeProjects: ActiveProject[];
  updateProjectProgress: (id: string, progress: number) => void;

  userProfile: UserProfile;
  showProfileModal: boolean;
  setProfileModal: (open: boolean) => void;
  showGuideModal: boolean;
  setGuideModal: (open: boolean) => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;

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
  setActiveTag: (tag: string | null) => void;
  addTag: (taskId: string, tag: string) => void;
  removeTag: (taskId: string, tag: string) => void;
  setSortOrder: (s: SortOrder) => void;
  setSearch: (s: string) => void;
  toggleCheck: (taskId: string, itemId: string) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  removeChecklistItem: (taskId: string, itemId: string) => void;
  updateNote: (taskId: string, md: string) => void;
  setStandup: (content: string | null, source: AiSource | null) => void;
  setHud: (msg: string | null) => void;
  setStandupModal: (open: boolean) => void;
  setTaskModal: (open: boolean) => void;
  setChatModal: (open: boolean) => void;
  setProvidersModal: (open: boolean) => void;
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
  ready: true, // App starts instantly with 0ms delay!
  dbMode: 'memory',
  mainView: 'dashboard',
  setMainView: (v) => set({ mainView: v }),

  workspaces: [DEFAULT_PERSONAL_WORKSPACE],
  activeWorkspaceId: DEFAULT_PERSONAL_WORKSPACE.id,
  groups: DEFAULT_GROUPS,
  activeGroupId: null,
  tasks: DEFAULT_TASKS,
  selectedTaskId: null,
  editorTab: 'note',
  quickFilter: null,
  activeTag: null,
  sortOrder: 'newest',
  search: '',
  notes: DEFAULT_NOTES,
  checklists: DEFAULT_CHECKLISTS,
  prompts: DEFAULT_PROMPTS,
  standup: null,
  standupSource: null,
  hudMessage: null,
  showStandupModal: false,
  showTaskModal: false,
  showChatModal: false,
  showProvidersModal: false,
  weeklyCoach: null,
  showWeeklyCoachModal: false,

  // Notion Notes initial
  notesDocs: DEFAULT_NOTION_NOTES,
  selectedNoteId: DEFAULT_NOTION_NOTES[0]?.id ?? null,
  selectNote: (id) => set({ selectedNoteId: id }),

  createNote: async (title = 'Yangi Qayd') => {
    const id = uid('note');
    const newDoc: NoteDoc = {
      id,
      workspace_id: get().activeWorkspaceId,
      title,
      content: `# ${title}\n\nQayd matnini shu yerdan boshlang...`,
      icon: '📝',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newDoc, ...get().notesDocs];
    set({ notesDocs: updated, selectedNoteId: id });
    if (get().dbMode === 'sqlite') {
      await upsertNote(newDoc).catch(() => {});
    }
    return id;
  },

  updateNoteDoc: async (id, patch) => {
    const docs = get().notesDocs.map((d) => (d.id === id ? { ...d, ...patch, updated_at: new Date().toISOString() } : d));
    set({ notesDocs: docs });
    const target = docs.find((d) => d.id === id);
    if (target && get().dbMode === 'sqlite') {
      await upsertNote(target).catch(() => {});
    }
  },

  deleteNoteDoc: async (id) => {
    const docs = get().notesDocs.filter((d) => d.id !== id);
    const sel = get().selectedNoteId === id ? docs[0]?.id ?? null : get().selectedNoteId;
    set({ notesDocs: docs, selectedNoteId: sel });
    if (get().dbMode === 'sqlite') {
      await deleteNoteFromDb(id).catch(() => {});
    }
    get().setHud("Qayd o'chirildi");
  },

  // Roadmaps initial
  roadmaps: DEFAULT_ROADMAPS,
  selectedRoadmapId: DEFAULT_ROADMAPS[0]?.id ?? null,
  selectRoadmap: (id) => set({ selectedRoadmapId: id }),

  toggleTopicDone: async (roadmapId, milestoneId, topicId) => {
    const roadmaps = get().roadmaps.map((r) => {
      if (r.id !== roadmapId) return r;
      const milestones = r.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        const topics = m.topics.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t));
        return { ...m, topics };
      });
      return { ...r, milestones, updated_at: new Date().toISOString() };
    });
    set({ roadmaps });
    const target = roadmaps.find((r) => r.id === roadmapId);
    if (target && get().dbMode === 'sqlite') {
      await upsertRoadmap(target).catch(() => {});
    }
  },

  learningLogs: [],
  addLearningLog: async (roadmapId, learned, solvedProblem, nextGoal, aiFeedback = '') => {
    const log: LearningLog = {
      id: uid('log'),
      roadmap_id: roadmapId,
      date: new Date().toISOString().split('T')[0],
      learned,
      solved_problem: solvedProblem,
      next_goal: nextGoal,
      ai_feedback: aiFeedback,
      created_at: new Date().toISOString(),
    };
    const updated = [log, ...get().learningLogs];
    set({ learningLogs: updated });
    if (get().dbMode === 'sqlite') {
      await insertLearningLog(log).catch(() => {});
    }
    get().setHud("Kunlik o'rganish jurnali saqlandi ✓");
  },

  createRoadmap: async (title, stack, description) => {
    const id = uid('rd');
    const newRd: RoadmapItem = {
      id,
      title,
      stack,
      description,
      milestones: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [...get().roadmaps, newRd];
    set({ roadmaps: updated, selectedRoadmapId: id });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(newRd).catch(() => {});
    }
    return id;
  },

  importRoadmapFromMarkdown: async (title, stack, markdown) => {
    const parsed = parseRoadmapMarkdown(markdown, title);
    const id = uid('rd');
    const newRd: RoadmapItem = {
      id,
      title: parsed.title || title || 'Mening Yo‘l Xaritam',
      stack: parsed.stack || stack || 'Backend / Software Engineering',
      description: parsed.description || 'Markdown fayldan yuklangan o‘rganish yo‘l xaritasi',
      milestones: parsed.milestones,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newRd, ...get().roadmaps];
    set({ roadmaps: updated, selectedRoadmapId: id });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(newRd).catch(() => {});
    }
    const topicCount = parsed.milestones.reduce((acc, m) => acc + m.topics.length, 0);
    get().setHud(`Yo‘l xaritasi yuklandi: ${parsed.milestones.length} ta bosqich, ${topicCount} ta mavzu ✓`);
    return id;
  },

  addMilestoneToRoadmap: async (roadmapId, title, duration = '2–4 hafta', priority = 'Yuqori') => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const newMilestone: RoadmapMilestone = {
      id: 'm-' + uid('ms'),
      title,
      duration,
      priority,
      topics: [],
    };
    const updatedMilestones = [...rd.milestones, newMilestone];
    const updatedRd: RoadmapItem = { ...rd, milestones: updatedMilestones, updated_at: new Date().toISOString() };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud(`Yangi bosqich qo‘shildi: "${title}" ✓`);
  },

  addTopicToMilestone: async (roadmapId, milestoneId, title) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const newTopic: RoadmapTopic = {
      id: 't-' + uid('top'),
      title,
      done: false,
    };
    const updatedMilestones = rd.milestones.map((m) =>
      m.id === milestoneId ? { ...m, topics: [...m.topics, newTopic] } : m
    );
    const updatedRd: RoadmapItem = { ...rd, milestones: updatedMilestones, updated_at: new Date().toISOString() };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud(`Yangi mavzu qo‘shildi: "${title}" ✓`);
  },

  deleteTopicFromMilestone: async (roadmapId, milestoneId, topicId) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const updatedMilestones = rd.milestones.map((m) =>
      m.id === milestoneId ? { ...m, topics: m.topics.filter((t) => t.id !== topicId) } : m
    );
    const updatedRd: RoadmapItem = { ...rd, milestones: updatedMilestones, updated_at: new Date().toISOString() };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
  },

  deleteMilestoneFromRoadmap: async (roadmapId, milestoneId) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const updatedMilestones = rd.milestones.filter((m) => m.id !== milestoneId);
    const updatedRd: RoadmapItem = { ...rd, milestones: updatedMilestones, updated_at: new Date().toISOString() };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud("Bosqich o‘chirildi");
  },

  deleteRoadmap: async (roadmapId) => {
    const remaining = get().roadmaps.filter((r) => r.id !== roadmapId);
    const sel = get().selectedRoadmapId === roadmapId ? remaining[0]?.id ?? null : get().selectedRoadmapId;
    set({ roadmaps: remaining, selectedRoadmapId: sel });
    if (get().dbMode === 'sqlite') {
      await deleteRoadmapFromDb(roadmapId).catch(() => {});
    }
    get().setHud("Yo‘l xaritasi o‘chirildi");
  },

  // Project Ideas initial
  projectIdeas: DEFAULT_PROJECT_IDEAS,
  selectedIdeaId: DEFAULT_PROJECT_IDEAS[0]?.id ?? null,
  selectIdea: (id) => set({ selectedIdeaId: id }),

  createIdea: async (title, stack, description) => {
    const id = uid('idea');
    const newIdea: ProjectIdea = {
      id,
      workspace_id: get().activeWorkspaceId,
      title,
      stack,
      status: 'idea',
      description,
      tasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newIdea, ...get().projectIdeas];
    set({ projectIdeas: updated, selectedIdeaId: id });
    if (get().dbMode === 'sqlite') {
      await upsertProjectIdea(newIdea).catch(() => {});
    }
    return id;
  },

  updateIdea: async (id, patch) => {
    const ideas = get().projectIdeas.map((i) => (i.id === id ? { ...i, ...patch, updated_at: new Date().toISOString() } : i));
    set({ projectIdeas: ideas });
    const target = ideas.find((i) => i.id === id);
    if (target && get().dbMode === 'sqlite') {
      await upsertProjectIdea(target).catch(() => {});
    }
  },

  deleteIdea: async (id) => {
    const ideas = get().projectIdeas.filter((i) => i.id !== id);
    const sel = get().selectedIdeaId === id ? ideas[0]?.id ?? null : get().selectedIdeaId;
    set({ projectIdeas: ideas, selectedIdeaId: sel });
    if (get().dbMode === 'sqlite') {
      await deleteProjectIdeaFromDb(id).catch(() => {});
    }
    get().setHud("G'oya o'chirildi");
  },

  exportIdeaTasksToStream: async (ideaId) => {
    const idea = get().projectIdeas.find((i) => i.id === ideaId);
    if (!idea || !idea.tasks.length) return 0;
    let added = 0;
    const cleanStack = idea.stack.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);

    for (const t of idea.tasks) {
      const taskId = nextTaskId(get().tasks);
      const newTask: Task = {
        id: taskId,
        workspace_id: get().activeWorkspaceId,
        group_id: null,
        title: `${idea.title}: ${t.title}`,
        status: 'active',
        priority: t.priority,
        git_branch: null,
        pr_url: null,
        ai_source: 'AI Planner',
        assignee_name: get().userProfile.full_name,
        assignee_avatar: get().userProfile.avatar_color,
        assignee_name2: null,
        assignee_avatar2: null,
        tags: [cleanStack, 'loyiha-goya'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      get().addTask(newTask);
      added++;
    }
    get().setHud(`${added} ta vazifa Vazifalar Oqimiga (Stream) qo'shildi! 🚀`);
    return added;
  },

  // Dashboard & Schedule & AI Assistant Drawer
  isAiDrawerOpen: false,
  setAiDrawerOpen: (open) => set({ isAiDrawerOpen: open }),
  toggleAiDrawer: () => set((state) => ({ isAiDrawerOpen: !state.isAiDrawerOpen })),

  scheduleBlocks: (() => {
    try {
      const s = localStorage.getItem('cognidev_schedule_blocks');
      return s ? JSON.parse(s) : DEFAULT_SCHEDULE_BLOCKS;
    } catch {
      return DEFAULT_SCHEDULE_BLOCKS;
    }
  })(),

  toggleScheduleBlockDone: (id) =>
    set((state) => {
      const next = state.scheduleBlocks.map((b) => (b.id === id ? { ...b, done: !b.done } : b));
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(next));
      } catch {}
      return { scheduleBlocks: next };
    }),

  addScheduleBlock: (block) =>
    set((state) => {
      const next = [...state.scheduleBlocks, { ...block, id: 'sch-' + Date.now() }];
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(next));
      } catch {}
      return { scheduleBlocks: next };
    }),

  deleteScheduleBlock: (id) =>
    set((state) => {
      const next = state.scheduleBlocks.filter((b) => b.id !== id);
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(next));
      } catch {}
      return { scheduleBlocks: next };
    }),

  // Spaces state
  spaces: (() => {
    try {
      const s = localStorage.getItem('cognidev_spaces');
      return s ? JSON.parse(s) : DEFAULT_SPACES;
    } catch {
      return DEFAULT_SPACES;
    }
  })(),
  activeSpaceId: null,
  selectSpace: (id) => set({ activeSpaceId: id }),

  // Goals state
  goals: (() => {
    try {
      const s = localStorage.getItem('cognidev_goals');
      return s ? JSON.parse(s) : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  })(),
  updateGoalProgress: (id, progress) =>
    set((state) => {
      const next = state.goals.map((g) => (g.id === id ? { ...g, progress: Math.min(100, Math.max(0, progress)) } : g));
      try {
        localStorage.setItem('cognidev_goals', JSON.stringify(next));
      } catch {}
      return { goals: next };
    }),
  addGoal: (goal) =>
    set((state) => {
      const next = [...state.goals, { ...goal, id: uid('goal') }];
      try {
        localStorage.setItem('cognidev_goals', JSON.stringify(next));
      } catch {}
      return { goals: next };
    }),

  // Active Projects state
  activeProjects: (() => {
    try {
      const s = localStorage.getItem('cognidev_active_projects');
      return s ? JSON.parse(s) : DEFAULT_ACTIVE_PROJECTS;
    } catch {
      return DEFAULT_ACTIVE_PROJECTS;
    }
  })(),
  updateProjectProgress: (id, progress) =>
    set((state) => {
      const next = state.activeProjects.map((p) => (p.id === id ? { ...p, progress: Math.min(100, Math.max(0, progress)) } : p));
      try {
        localStorage.setItem('cognidev_active_projects', JSON.stringify(next));
      } catch {}
      return { activeProjects: next };
    }),

  aiDrawerMessages: (() => {
    try {
      const s = localStorage.getItem('cognidev_drawer_messages');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Salom, Farhod! 👏 Men sizning shaxsiy AI yordamchingizman.\n\nSizning vazifalaringiz, loyihalaringiz va o'rganish yo'l xaritangizni tahlil qilib, maksimal samaradorlikka erishishingizga yordam beraman. Quyidagi tezkor tugmalardan birini tanlashingiz yoki o'z savolingizni yozishingiz mumkin!",
        timestamp: 'Hozir',
      },
    ];
  })(),
  isAiDrawerThinking: false,

  sendAiDrawerMessage: async (promptText) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const { tasks, roadmaps, projectIdeas, aiDrawerMessages } = get();

    const userMsg: AiDrawerMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...aiDrawerMessages, userMsg];
    set({ aiDrawerMessages: updated, isAiDrawerThinking: true });

    try {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      const blockers = tasks.filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker');
      const activeTasks = tasks.filter((t) => t.status === 'active');

      const systemPrompt = `Siz CogniDev ilovasidagi Farhodning shaxsiy macOS AI yordamchisisiz.
Farhod — o'rganayotgan va loyihalar yaratayotgan iqtidorli Backend / Software Engineer (Python, PostgreSQL, Go, Rust, React, Docker).
Joriy holat:
- Jami vazifalar: ${tasks.length} (Bajarilgan: ${completedTasks.length}, Faol: ${activeTasks.length}, To'siqlar: ${blockers.length})
- Eng so'nggi vazifalar: ${tasks.slice(0, 5).map((t) => t.title).join('; ')}
- Faol loyihalar: ${projectIdeas.map((p) => p.title).join('; ')}
- Yo'l xaritasi: ${roadmaps.map((r) => r.title).join('; ')}

Foydalanuvchiga o'zbek tilida juda aniq, do'stona, muhandislik darajasida professional va ixcham javob bering. Kod kerak bo'lsa chiroyli markdown kod bloki bilan ko'rsating.`;

      const res = await callAi(trimmed, systemPrompt);
      const botMsg: AiDrawerMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model || res.source,
      };

      const finalMessages = [...updated, botMsg];
      set({ aiDrawerMessages: finalMessages, isAiDrawerThinking: false });
      try {
        localStorage.setItem('cognidev_drawer_messages', JSON.stringify(finalMessages.slice(-20)));
      } catch {}
    } catch (err: any) {
      const errorMsg: AiDrawerMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Kechirasiz, so'rovni bajarishda xatolik yuz berdi: ${err?.message || 'Tarmoq xatosi'}. Sozlamalardan API kalitingizni tekshiring.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'xatolik',
      };
      const finalMessages = [...updated, errorMsg];
      set({ aiDrawerMessages: finalMessages, isAiDrawerThinking: false });
    }
  },

  clearAiDrawerMessages: () => {
    try {
      localStorage.removeItem('cognidev_drawer_messages');
    } catch {}
    set({
      aiDrawerMessages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: "Salom, Farhod! 👏 Tarix tozalandi. Bugun qanday muhandislik masalasida yordam bera olaman?",
          timestamp: 'Hozir',
        },
      ],
    });
  },

  todayAiSummary: (() => {
    try {
      return (
        localStorage.getItem('cognidev_today_ai_summary') ||
        "Bugun siz Zoovita loyihasi bo'yicha backend serverini muvaffaqiyatli ishga tushirdingiz va PostgreSQL indekslari bo'yicha yangi bilimlarni amalda qo'lladingiz. Hozir 3 ta muhim vazifa qolgan. Davom eting! 💪"
      );
    } catch {
      return "Bugungi backend rejalaringizni davom ettiring!";
    }
  })(),
  isGeneratingTodayAiSummary: false,

  generateTodayAiSummary: async () => {
    const { tasks, roadmaps, projectIdeas, notesDocs } = get();
    set({ isGeneratingTodayAiSummary: true });
    try {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      const blockers = tasks.filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker');
      const activeTasks = tasks.filter((t) => t.status === 'active');

      const contextPrompt = `Dasturchi holati tahlili:
- Jami vazifalar: ${tasks.length} ta (Bajarilgan: ${completedTasks.length}, Faol: ${activeTasks.length}, To'siqlar: ${blockers.length})
- Eng so'nggi bajarilgan ishlar: ${completedTasks.slice(0, 3).map((t) => t.title).join(', ') || "Hali tasklar boshlanmagan"}
- To'siq/Muammolar: ${blockers.map((b) => b.title).join(', ') || "To'siqlar yo'q"}
- Faol loyihalar: ${projectIdeas.map((p) => `${p.title} (${p.status})`).join(', ')}
- Yo‘l xaritalari: ${roadmaps.map((r) => r.title).join('; ')}
- Qaydlar: ${notesDocs.length} ta Notion qayd mavjud.

Iltimos, Farhod (Junior Backend / Software Engineer) uchun bugungi kungi qisqa, professional va ruhlantiruvchi muhandislik xulosasini 2-3 jumlada o'zbek tilida yozib bering. Nimaga erishilgani va keyingi diqqat markazini qisqa ayting.`;

      const res = await callAi(contextPrompt, "Siz Farhodning shaxsiy macOS dev-cockpit AI yordamchisisiz. Qisqa, aniq va texnik ruhda javob bering.");
      const cleanText = res.text.trim();
      set({ todayAiSummary: cleanText, isGeneratingTodayAiSummary: false });
      try {
        localStorage.setItem('cognidev_today_ai_summary', cleanText);
      } catch {}
    } catch {
      set({
        todayAiSummary: "Bugun siz rejalashtirilgan backend vazifalaringizni faol davom ettirmoqdasiz. To'siqlarni bartaraf etishga diqqat qarating va o'rganish oqimini davom ettiring!",
        isGeneratingTodayAiSummary: false,
      });
    }
  },

  userProfile: DEFAULT_USER_PROFILE,
  showProfileModal: false,
  setProfileModal: (open) => set({ showProfileModal: open }),
  showGuideModal: false,
  setGuideModal: (open) => set({ showGuideModal: open }),

  updateProfile: async (patch) => {
    const current = get().userProfile;
    const initials = patch.full_name
      ? patch.full_name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join('') || 'U'
      : current.avatar_initials;
    const updated: UserProfile = {
      ...current,
      ...patch,
      avatar_initials: initials,
      updated_at: new Date().toISOString(),
    };
    set({ userProfile: updated });
    if (get().dbMode === 'sqlite') {
      await upsertUserProfile(updated).catch(() => {});
    }
    get().setHud("Profil muvaffaqiyatli saqlandi");
  },

  init: async () => {
    if (!isTauri) {
      set({ ready: true, dbMode: 'memory' });
      return;
    }
    try {
      // Fast background hydration with 2s timeout guard
      await Promise.race([
        (async () => {
          await migrate().catch((e) => console.warn('SQLite migration warning:', e));
          await purgeMockDataIfPresent().catch(() => {});
          await ensureDefaultWorkspace().catch(() => {});
          await get().refresh().catch(() => {});
          set({ dbMode: 'sqlite' });
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SQLite init timed out')), 2000),
        ),
      ]);
    } catch (e) {
      console.warn('SQLite background init fallback to memory mode:', e);
      set({ dbMode: 'memory' });
    } finally {
      set({ ready: true });
    }
  },

  refresh: async () => {
    const [ws, rawTasks, grps, profile, rawNotes, rawRoadmaps, rawLogs, rawIdeas] = await Promise.all([
      fetchWorkspaces().catch(() => []),
      fetchTasks().catch(() => []),
      fetchGroups().catch(() => []),
      fetchUserProfile().catch(() => DEFAULT_USER_PROFILE),
      fetchNotes(get().activeWorkspaceId).catch(() => []),
      fetchRoadmaps().catch(() => []),
      fetchLearningLogs().catch(() => []),
      fetchProjectIdeas(get().activeWorkspaceId).catch(() => []),
    ]);

    // Seed initial tasks if empty in SQLite
    let tasks = rawTasks;
    if (tasks.length === 0 && DEFAULT_TASKS.length > 0) {
      tasks = DEFAULT_TASKS;
      for (const t of DEFAULT_TASKS) {
        insertTask(t).catch(() => {});
      }
      for (const [taskId, noteMd] of Object.entries(DEFAULT_NOTES)) {
        upsertResolution(taskId, noteMd, JSON.stringify(DEFAULT_CHECKLISTS[taskId] ?? [])).catch(() => {});
      }
    }

    const activeWs = ws.find((w) => w.id === get().activeWorkspaceId) ?? ws[0] ?? DEFAULT_PERSONAL_WORKSPACE;
    const currentSelected = get().selectedTaskId;
    const sel = tasks.find((t) => t.id === currentSelected) ?? tasks[0] ?? null;

    // Seed initial notes if empty in SQLite
    let notesDocs = rawNotes;
    if (notesDocs.length === 0 && DEFAULT_NOTION_NOTES.length > 0) {
      notesDocs = DEFAULT_NOTION_NOTES;
      for (const n of DEFAULT_NOTION_NOTES) {
        upsertNote(n).catch(() => {});
      }
    }

    // Seed initial roadmaps if empty in SQLite
    let roadmaps = rawRoadmaps;
    if (roadmaps.length === 0 && DEFAULT_ROADMAPS.length > 0) {
      roadmaps = DEFAULT_ROADMAPS;
      for (const r of DEFAULT_ROADMAPS) {
        upsertRoadmap(r).catch(() => {});
      }
    }

    // Seed initial project ideas if empty in SQLite
    let projectIdeas = rawIdeas;
    if (projectIdeas.length === 0 && DEFAULT_PROJECT_IDEAS.length > 0) {
      projectIdeas = DEFAULT_PROJECT_IDEAS;
      for (const i of DEFAULT_PROJECT_IDEAS) {
        upsertProjectIdea(i).catch(() => {});
      }
    }

    set({
      workspaces: ws.length ? ws : [DEFAULT_PERSONAL_WORKSPACE],
      activeWorkspaceId: activeWs.id,
      groups: grps,
      tasks,
      selectedTaskId: sel?.id ?? null,
      userProfile: profile ?? DEFAULT_USER_PROFILE,
      notesDocs,
      selectedNoteId: get().selectedNoteId ?? notesDocs[0]?.id ?? null,
      roadmaps,
      selectedRoadmapId: get().selectedRoadmapId ?? roadmaps[0]?.id ?? null,
      learningLogs: rawLogs,
      projectIdeas,
      selectedIdeaId: get().selectedIdeaId ?? projectIdeas[0]?.id ?? null,
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
      tasks: d.tasks.map((t) => ({ ...t, tags: Array.isArray(t.tags) ? t.tags : [] })),
      notes,
      checklists,
      prompts: d.prompts.filter((p) => p.task_id === sel?.id),
      selectedTaskId: sel?.id ?? null,
      activeTag: null,
    });
  },

  setWorkspace: async (id) => {
    set({ activeWorkspaceId: id, quickFilter: null, activeTag: null, search: '' });
    const { dbMode } = get();
    if (dbMode === 'sqlite') {
      try {
        const [tasks, notesDocs, projectIdeas] = await Promise.all([
          fetchTasks(id).catch(() => []),
          fetchNotes(id).catch(() => []),
          fetchProjectIdeas(id).catch(() => []),
        ]);
        const first = tasks[0];
        set({
          tasks,
          selectedTaskId: first?.id ?? null,
          notesDocs: notesDocs.length ? notesDocs : get().notesDocs,
          selectedNoteId: notesDocs[0]?.id ?? get().selectedNoteId,
          projectIdeas: projectIdeas.length ? projectIdeas : get().projectIdeas,
          selectedIdeaId: projectIdeas[0]?.id ?? get().selectedIdeaId,
        });
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
  setActiveTag: (activeTag) => set({ activeTag }),

  addTag: (taskId, raw) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    const cur = get().tasks.find((t) => t.id === taskId)?.tags ?? [];
    if (cur.includes(tag)) return;
    const next = [...cur, tag];
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, tags: next } : t)),
    }));
    if (get().dbMode === 'sqlite') {
      updateTaskTags(taskId, next).catch(() => {});
    }
  },

  removeTag: (taskId, tag) => {
    const cur = get().tasks.find((t) => t.id === taskId)?.tags ?? [];
    if (!cur.includes(tag)) return;
    const next = cur.filter((t) => t !== tag);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, tags: next } : t)),
    }));
    if (get().dbMode === 'sqlite') {
      updateTaskTags(taskId, next).catch(() => {});
    }
  },
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

  setStandup: (standup, standupSource) => set({ standup, standupSource }),
  setHud: (hudMessage) => set({ hudMessage }),
  setStandupModal: (showStandupModal) => set({ showStandupModal }),
  setTaskModal: (showTaskModal) => set({ showTaskModal }),
  setChatModal: (showChatModal) => set({ showChatModal }),
  setProvidersModal: (showProvidersModal) => set({ showProvidersModal }),
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
    const { tasks, activeWorkspaceId, dbMode, userProfile } = get();
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
      assignee_name: userProfile.full_name || 'Muhandis',
      assignee_avatar: userProfile.avatar_initials || 'M',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: [],
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
    const { tasks, activeWorkspaceId, dbMode, notes, userProfile } = get();
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
        assignee_name: userProfile.full_name || 'Muhandis',
        assignee_avatar: userProfile.avatar_initials || 'M',
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ingestData.tags.map((t) => normalizeTag(t)).filter((t): t is string => !!t),
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
    if (get().dbMode === 'sqlite') {
      insertTask(t).catch((e) => console.warn('Failed to insert task to SQLite:', e));
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
  activeTag?: string | null,
): Task[] {
  let out = tasks.filter((t) => t.workspace_id === workspaceId);
  if (activeGroupId) {
    out = out.filter((t) => t.group_id === activeGroupId);
  }
  if (activeTag) {
    out = out.filter((t) => (t.tags ?? []).includes(activeTag));
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
