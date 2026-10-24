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
  ScheduledReminder,
  HabitItem,
  MeetingItem,
  DevLinkItem,
  AiMemoryItem,
  TelegramBotConfig,
  FlashcardItem,
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
  DEFAULT_HABITS,
  DEFAULT_DEV_LINKS,
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
  fetchReminders,
  upsertReminder,
  deleteReminderFromDb,
  fetchMeetings,
  upsertMeeting,
  deleteMeetingFromDb,
  fetchScheduleBlocks,
  upsertScheduleBlock,
  deleteScheduleBlockFromDb,
  fetchMemories,
  fetchChatMessages,
  insertChatMessage,
  clearChatMessagesInDb,
  fetchTelegramSettings,
  upsertTelegramSettings,
  type VaultDump,
} from './db';
import { deleteMeetingAudio } from './audioDb';
import { parseRoadmapMarkdown } from './roadmapParser';
import { analyzeBlockers, generateStandup, generateWeeklyCoachReview, callAi, type ParsedAiIngestion } from './ai';
import { isTauri } from './vault';
import type { AiSource, CloudProviderId } from './providers';
import { playNotificationSound, sendDesktopNotification, speakVoiceReminder } from './notifications';
import { syncHermesMemoriesToDb, formatMemoriesForPrompt } from './hermesMemory';
import { telegramBotManager, sendTelegramMessage, type TelegramBotStatus } from './telegramBot';
import { isSlashCommand, executeSlashCommand } from './slashCommands';
import {
  generateDailyMissedTasksReport,
  speakDailyReportVoice,
  dispatchDailyReportToTelegram,
  type DailyReportSummary,
} from './dailyReport';
import { scanRoadmapsForDate, buildFocusTasksFromRoadmapGoals } from './roadmapDailyScanner';
import {
  checkAndTriggerDailyRoutines,
  executeDailyRoutineStage,
  type DailyRoutineStage,
} from './dailyRoutineSchedule';
import {
  calculateNextReview,
  generateFlashcardsWithAi,
} from './spacedRepetition';

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

export function loadStoredTasks(): Task[] {
  try {
    const s = localStorage.getItem('cognidev_tasks_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_TASKS;
}

export function saveStoredTasks(tasks: Task[]) {
  try {
    localStorage.setItem('cognidev_tasks_v2', JSON.stringify(tasks));
  } catch (e) {
    console.warn('Failed to save tasks to localStorage:', e);
  }
}

export function loadStoredNotesDocs(): NoteDoc[] {
  try {
    const s = localStorage.getItem('cognidev_notion_notes_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_NOTION_NOTES;
}

export function saveStoredNotesDocs(notesDocs: NoteDoc[]) {
  try {
    localStorage.setItem('cognidev_notion_notes_v2', JSON.stringify(notesDocs));
  } catch {}
}

export function loadStoredRoadmaps(): RoadmapItem[] {
  try {
    const s = localStorage.getItem('cognidev_roadmaps_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_ROADMAPS;
}

export function saveStoredRoadmaps(roadmaps: RoadmapItem[]) {
  try {
    localStorage.setItem('cognidev_roadmaps_v2', JSON.stringify(roadmaps));
  } catch {}
}

export function loadStoredProjectIdeas(): ProjectIdea[] {
  try {
    const s = localStorage.getItem('cognidev_project_ideas_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_PROJECT_IDEAS;
}

export function saveStoredProjectIdeas(projectIdeas: ProjectIdea[]) {
  try {
    localStorage.setItem('cognidev_project_ideas_v2', JSON.stringify(projectIdeas));
  } catch {}
}

export function loadStoredNotes(): Record<string, string> {
  try {
    const s = localStorage.getItem('cognidev_task_notes_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return DEFAULT_NOTES;
}

export function saveStoredNotes(notes: Record<string, string>) {
  try {
    localStorage.setItem('cognidev_task_notes_v2', JSON.stringify(notes));
  } catch {}
}

export function loadStoredFlashcards(): FlashcardItem[] {
  try {
    const s = localStorage.getItem('cognidev_flashcards_v1');
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStoredFlashcards(flashcards: FlashcardItem[]) {
  try {
    localStorage.setItem('cognidev_flashcards_v1', JSON.stringify(flashcards));
  } catch {}
}

export function loadStoredChecklists(): Record<string, ChecklistItem[]> {
  try {
    const s = localStorage.getItem('cognidev_task_checklists_v2');
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return DEFAULT_CHECKLISTS;
}

export function saveStoredChecklists(checklists: Record<string, ChecklistItem[]>) {
  try {
    localStorage.setItem('cognidev_task_checklists_v2', JSON.stringify(checklists));
  } catch {}
}

/** Fire-and-forget write-through of a task's note + checklist with dual persistence. */
function persistResolution(taskId: string) {
  const { dbMode, notes, checklists } = useSynapse.getState();
  saveStoredNotes(notes);
  saveStoredChecklists(checklists);
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
  showGitHubModal: boolean;
  setGitHubModal: (open: boolean) => void;
  gitHubTargetRepoUrl: string | null;
  setGitHubTargetRepoUrl: (url: string | null) => void;
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
  updateRoadmap: (roadmapId: string, updates: Partial<Pick<RoadmapItem, 'title' | 'stack' | 'description'>>) => Promise<void>;
  updateMilestone: (roadmapId: string, milestoneId: string, updates: Partial<Pick<RoadmapMilestone, 'title' | 'duration' | 'priority'>>) => Promise<void>;
  updateTopic: (roadmapId: string, milestoneId: string, topicId: string, updates: Partial<Pick<RoadmapTopic, 'title' | 'done'>>) => Promise<void>;
  updateRoadmapMarkdown: (roadmapId: string, markdown: string) => Promise<void>;
  batchReplaceYearInRoadmaps: (fromYear?: string, toYear?: string) => Promise<number>;
  syncDailyRoadmapFocus: (targetDate?: Date) => Promise<number>;
  triggerDailyRoutineTest: (stage: DailyRoutineStage) => Promise<void>;

  // Spaced Repetition & Flashcards
  flashcards: FlashcardItem[];
  addFlashcards: (cards: Omit<FlashcardItem, 'id' | 'created_at'>[]) => Promise<void>;
  reviewFlashcard: (cardId: string, rating: 1 | 2 | 3) => Promise<void>;
  deleteFlashcard: (cardId: string) => Promise<void>;
  generateFlashcardsForTopicAction: (
    roadmapId: string,
    topicId: string,
    topicTitle: string,
    roadmapTitle?: string,
    stack?: string,
    provider?: CloudProviderId
  ) => Promise<number>;

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

  // Hermes Memories & Telegram Integration
  memories: AiMemoryItem[];
  telegramConfig: TelegramBotConfig;
  telegramStatus: TelegramBotStatus;
  telegramBotName: string | null;
  showTelegramModal: boolean;
  setTelegramModal: (open: boolean) => void;
  updateTelegramConfig: (patch: Partial<TelegramBotConfig>) => Promise<void>;
  startTelegramBot: () => Promise<void>;
  stopTelegramBot: () => void;
  syncHermesMemoriesAction: () => Promise<void>;

  // Daily Missed Tasks AI Report & Voice
  generateDailyReportAction: () => Promise<DailyReportSummary>;
  speakDailyReportAction: (summaryText: string) => Promise<boolean>;
  dispatchDailyReportToTelegramAction: (reportText?: string) => Promise<number>;

  // Spaces
  spaces: SpaceItem[];
  activeSpaceId: string | null;
  selectSpace: (id: string | null) => void;
  addSpace: (space: Omit<SpaceItem, 'id'>) => void;
  updateSpace: (id: string, patch: Partial<Omit<SpaceItem, 'id'>>) => void;
  deleteSpace: (id: string) => void;

  // Links & Developer Bookmarks
  links: DevLinkItem[];
  addLink: (link: Omit<DevLinkItem, 'id' | 'created_at'>) => void;
  updateLink: (id: string, patch: Partial<DevLinkItem>) => void;
  deleteLink: (id: string) => void;
  togglePinLink: (id: string) => void;

  // Habit Tracker
  habits: HabitItem[];
  toggleHabitDay: (habitId: string, dateKey?: string) => void;
  addHabit: (habit: Omit<HabitItem, 'id' | 'streak' | 'best_streak' | 'history' | 'created_at'>) => void;
  updateHabit: (id: string, patch: Partial<HabitItem>) => void;
  deleteHabit: (id: string) => void;

  // Meetings & Audio Intelligence
  meetings: MeetingItem[];
  selectedMeetingId: string | null;
  setSelectedMeetingId: (id: string | null) => void;
  addMeeting: (meeting: MeetingItem) => void;
  updateMeeting: (id: string, patch: Partial<MeetingItem>) => void;
  deleteMeeting: (id: string) => void;
  toggleMeetingActionDone: (meetingId: string, actionId: string) => void;

  // Goals
  goals: GoalItem[];
  updateGoalProgress: (id: string, progress: number) => void;
  addGoal: (goal: Omit<GoalItem, 'id'>) => void;
  deleteGoal: (id: string) => void;

  // Active Projects
  activeProjects: ActiveProject[];
  updateProjectProgress: (id: string, progress: number) => void;
  addActiveProject: (proj: Omit<ActiveProject, 'id'>) => void;
  updateActiveProject: (id: string, updates: Partial<ActiveProject>) => void;
  deleteActiveProject: (id: string) => void;

  // Reminders & Notifications
  reminders: ScheduledReminder[];
  activeAlertReminder: ScheduledReminder | null;
  soundEnabled: boolean;
  toggleSoundEnabled: () => void;
  addReminder: (rem: Omit<ScheduledReminder, 'id' | 'created_at' | 'status'>) => Promise<string>;
  updateReminder: (id: string, patch: Partial<ScheduledReminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  dismissAlertReminder: () => void;
  snoozeReminder: (id: string, minutes?: number) => Promise<void>;
  testNotification: () => Promise<void>;

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

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

function ensureSchedulerStarted(
  getState: () => SynapseState,
  setState: (patch: Partial<SynapseState> | ((state: SynapseState) => Partial<SynapseState>)) => void,
) {
  if (schedulerIntervalId) return;

  schedulerIntervalId = setInterval(() => {
    const { reminders, soundEnabled, dbMode } = getState();
    const now = Date.now();

    for (const r of reminders) {
      if (r.status !== 'pending') continue;
      const targetMs = new Date(r.target_time).getTime();

      if (!isNaN(targetMs) && targetMs <= now) {
        // Play audio chime
        if (soundEnabled && r.sound_enabled) {
          playNotificationSound();
        }

        // Spoken voice reminder out loud via macOS say or Web Speech API
        speakVoiceReminder(`Eslatma: ${r.title}. ${r.description || ''}`).catch(() => {});

        // Send OS native desktop notification
        sendDesktopNotification(
          `⏰ ${r.title}`,
          r.description ? `${r.time_string}: ${r.description}` : `Rejalashtirilgan vaqt: ${r.time_string}`,
        );

        // Send instant Telegram notification to user's phone if bot is active!
        const { telegramConfig } = getState();
        if (telegramConfig?.is_active && telegramConfig.bot_token && telegramConfig.allowed_user_ids) {
          const userIds = telegramConfig.allowed_user_ids.split(',').map((u) => u.trim()).filter(Boolean);
          for (const uid of userIds) {
            sendTelegramMessage(
              telegramConfig.bot_token,
              uid,
              `⏰ *Eslatma (CogniDev):*\n\n📌 *${r.title}*\n⏱ *Vaqti:* ${r.time_string}\n${r.description ? `📝 ${r.description}` : ''}`
            ).catch(() => {});
          }
        }

        // Mark as triggered and display interactive in-app alert banner
        const triggeredRem: ScheduledReminder = {
          ...r,
          status: 'triggered',
          triggered_at: new Date().toISOString(),
        };

        const updated = getState().reminders.map((rem) =>
          rem.id === r.id ? triggeredRem : rem,
        );

        // If recurring (e.g. daily cron): advance target_time by 24h
        if (r.cron_expression) {
          const nextDay = new Date(targetMs + 24 * 3600 * 1000).toISOString();
          const recurringRem: ScheduledReminder = {
            ...r,
            id: uid('rem'),
            target_time: nextDay,
            status: 'pending',
            created_at: new Date().toISOString(),
          };
          updated.push(recurringRem);
          if (dbMode === 'sqlite') {
            upsertReminder(recurringRem).catch(() => {});
          }
        }

        setState({
          reminders: updated,
          activeAlertReminder: triggeredRem,
        });

        try {
          localStorage.setItem('cognidev_reminders', JSON.stringify(updated));
        } catch {}

        if (dbMode === 'sqlite') {
          upsertReminder(triggeredRem).catch(() => {});
        }
        break;
      }
    }

    // 3-Stage Daily Routine voice reminder check (10:00, 14:00, 22:00)
    try {
      const currentState = getState();
      checkAndTriggerDailyRoutines({
        tasks: currentState.tasks,
        roadmaps: currentState.roadmaps,
        scheduleBlocks: currentState.scheduleBlocks,
        flashcards: currentState.flashcards,
        telegramConfig: currentState.telegramConfig,
        soundEnabled: currentState.soundEnabled,
        userName: currentState.userProfile?.full_name || 'Muhandis',
        onAlertBanner: (bannerTitle, bannerBody, stage) => {
          setState({
            activeAlertReminder: {
              id: `routine-${stage}-${Date.now()}`,
              source_type: 'custom',
              title: bannerTitle,
              description: bannerBody,
              target_time: new Date().toISOString(),
              time_string: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
              status: 'triggered',
              sound_enabled: true,
              created_at: new Date().toISOString(),
            },
          });
        },
        onSetHud: (msg) => currentState.setHud(msg),
      });
    } catch (routineErr) {
      console.warn('[Scheduler] daily routine tick error:', routineErr);
    }
  }, 4000);
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
  tasks: loadStoredTasks(),
  selectedTaskId: null,
  editorTab: 'note',
  quickFilter: null,
  activeTag: null,
  sortOrder: 'newest',
  search: '',
  notes: loadStoredNotes(),
  checklists: loadStoredChecklists(),
  prompts: DEFAULT_PROMPTS,
  standup: null,
  standupSource: null,
  hudMessage: null,
  showStandupModal: false,
  showTaskModal: false,
  showChatModal: false,
  showProvidersModal: false,
  showGitHubModal: false,
  gitHubTargetRepoUrl: null,
  weeklyCoach: null,
  showWeeklyCoachModal: false,
  memories: [],
  telegramConfig: { bot_token: '', allowed_user_ids: '', is_active: false, last_update_id: 0 },
  telegramStatus: 'stopped',
  telegramBotName: null,
  showTelegramModal: false,
  setTelegramModal: (open) => set({ showTelegramModal: open }),

  // Notion Notes initial
  notesDocs: loadStoredNotesDocs(),
  selectedNoteId: loadStoredNotesDocs()[0]?.id ?? null,
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
    saveStoredNotesDocs(updated);
    set({ notesDocs: updated, selectedNoteId: id });
    if (get().dbMode === 'sqlite') {
      await upsertNote(newDoc).catch(() => {});
    }
    return id;
  },

  updateNoteDoc: async (id, patch) => {
    const docs = get().notesDocs.map((d) => (d.id === id ? { ...d, ...patch, updated_at: new Date().toISOString() } : d));
    saveStoredNotesDocs(docs);
    set({ notesDocs: docs });
    const target = docs.find((d) => d.id === id);
    if (target && get().dbMode === 'sqlite') {
      await upsertNote(target).catch(() => {});
    }
  },

  deleteNoteDoc: async (id) => {
    const docs = get().notesDocs.filter((d) => d.id !== id);
    const sel = get().selectedNoteId === id ? docs[0]?.id ?? null : get().selectedNoteId;
    saveStoredNotesDocs(docs);
    set({ notesDocs: docs, selectedNoteId: sel });
    if (get().dbMode === 'sqlite') {
      await deleteNoteFromDb(id).catch(() => {});
    }
    get().setHud("Qayd o'chirildi");
  },

  // Roadmaps initial
  roadmaps: loadStoredRoadmaps(),
  selectedRoadmapId: loadStoredRoadmaps()[0]?.id ?? null,
  selectRoadmap: (id) => set({ selectedRoadmapId: id }),

  toggleTopicDone: async (roadmapId, milestoneId, topicId) => {
    let nextDone = false;
    const roadmaps = get().roadmaps.map((r) => {
      if (r.id !== roadmapId) return r;
      const milestones = r.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        const topics = m.topics.map((t) => {
          if (t.id === topicId) {
            nextDone = !t.done;
            return { ...t, done: nextDone };
          }
          return t;
        });
        return { ...m, topics };
      });
      return { ...r, milestones, updated_at: new Date().toISOString() };
    });
    saveStoredRoadmaps(roadmaps);

    // Bidirectional sync: sync with any matching task in tasks list
    const updatedTasks = get().tasks.map((task) => {
      if (
        task.ai_source === `roadmap_topic:${topicId}` ||
        task.id === `task-roadmap-${topicId.replace(/^t-/, '')}`
      ) {
        return {
          ...task,
          status: (nextDone ? 'completed' : 'active') as Task['status'],
          updated_at: new Date().toISOString(),
        };
      }
      return task;
    });
    saveStoredTasks(updatedTasks);

    set({ roadmaps, tasks: updatedTasks });
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
    saveStoredRoadmaps(updated);
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
    saveStoredRoadmaps(remaining);
    set({ roadmaps: remaining, selectedRoadmapId: sel });
    if (get().dbMode === 'sqlite') {
      await deleteRoadmapFromDb(roadmapId).catch(() => {});
    }
    get().setHud("Yo‘l xaritasi o‘chirildi");
  },

  updateRoadmap: async (roadmapId, updates) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const updatedRd: RoadmapItem = {
      ...rd,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    saveStoredRoadmaps(all);
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud("Yo‘l xaritasi yangilandi ✓");
  },

  updateMilestone: async (roadmapId, milestoneId, updates) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const updatedMilestones = rd.milestones.map((m) =>
      m.id === milestoneId ? { ...m, ...updates } : m
    );
    const updatedRd: RoadmapItem = { ...rd, milestones: updatedMilestones, updated_at: new Date().toISOString() };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    saveStoredRoadmaps(all);
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud("Yo‘l xaritasi bosqichi yangilandi ✓");
  },

  updateTopic: async (roadmapId, milestoneId, topicId, updates) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const updatedMilestones = rd.milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      const topics = m.topics.map((t) => (t.id === topicId ? { ...t, ...updates } : t));
      return { ...m, topics };
    });
    const updatedRd: RoadmapItem = { ...rd, milestones: updatedMilestones, updated_at: new Date().toISOString() };
    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    saveStoredRoadmaps(all);
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud("Mavzu muvaffaqiyatli tahrirlandi ✓");
  },

  updateRoadmapMarkdown: async (roadmapId, markdown) => {
    const rd = get().roadmaps.find((r) => r.id === roadmapId);
    if (!rd) return;
    const parsed = parseRoadmapMarkdown(markdown, rd.title);

    // Preserve existing done states for matching topic titles
    const oldDoneMap = new Map<string, boolean>();
    for (const m of rd.milestones) {
      for (const t of m.topics) {
        oldDoneMap.set(t.title.trim().toLowerCase(), t.done);
      }
    }

    const mergedMilestones = parsed.milestones.map((m) => ({
      ...m,
      topics: m.topics.map((t) => ({
        ...t,
        done: oldDoneMap.get(t.title.trim().toLowerCase()) ?? t.done,
      })),
    }));

    const updatedRd: RoadmapItem = {
      ...rd,
      title: parsed.title,
      stack: parsed.stack,
      description: parsed.description,
      milestones: mergedMilestones,
      updated_at: new Date().toISOString(),
    };

    const all = get().roadmaps.map((r) => (r.id === roadmapId ? updatedRd : r));
    saveStoredRoadmaps(all);
    set({ roadmaps: all });
    if (get().dbMode === 'sqlite') {
      await upsertRoadmap(updatedRd).catch(() => {});
    }
    get().setHud("Markdown o‘zgarishlari saqlandi va yo‘l xaritasi yangilandi ✓");
  },

  batchReplaceYearInRoadmaps: async (fromYear = '2027', toYear = '2026') => {
    let changedCount = 0;
    const replaceText = (text: string) => {
      if (!text || !text.includes(fromYear)) return text;
      changedCount++;
      return text.replaceAll(fromYear, toYear);
    };

    const updatedRoadmaps = get().roadmaps.map((r) => {
      const newTitle = replaceText(r.title);
      const newDesc = replaceText(r.description);
      const newStack = replaceText(r.stack);
      const newMilestones = r.milestones.map((m) => {
        const mTitle = replaceText(m.title);
        const mDuration = replaceText(m.duration || '');
        const mTopics = m.topics.map((t) => ({
          ...t,
          title: replaceText(t.title),
        }));
        return { ...m, title: mTitle, duration: mDuration, topics: mTopics };
      });
      return {
        ...r,
        title: newTitle,
        description: newDesc,
        stack: newStack,
        milestones: newMilestones,
        updated_at: new Date().toISOString(),
      };
    });

    saveStoredRoadmaps(updatedRoadmaps);
    set({ roadmaps: updatedRoadmaps });
    if (get().dbMode === 'sqlite') {
      for (const r of updatedRoadmaps) {
        await upsertRoadmap(r).catch(() => {});
      }
    }
    get().setHud(`Barcha yo‘l xaritalarida ${changedCount} ta joyda "${fromYear}" → "${toYear}" ga almashtirildi ✓`);
    return changedCount;
  },

  syncDailyRoadmapFocus: async (targetDate = new Date()) => {
    const { roadmaps, tasks, activeWorkspaceId, userProfile } = get();
    const goals = scanRoadmapsForDate(roadmaps, targetDate, { includeNextPendingIfNoDate: true, maxPerRoadmap: 2 });
    if (goals.length === 0) {
      get().setHud("Yo‘l xaritalarida bugungi kun uchun vazifalar topilmadi");
      return 0;
    }

    const { tasksToAdd, tasksToUpdate } = buildFocusTasksFromRoadmapGoals(
      goals,
      tasks,
      activeWorkspaceId || 'personal',
      userProfile?.full_name || 'Men',
      userProfile?.avatar_initials || 'ME'
    );

    let nextTasks = [...tasks];
    for (const add of tasksToAdd) {
      nextTasks = [add, ...nextTasks];
      if (get().dbMode === 'sqlite') {
        insertTask(add).catch(() => {});
      }
    }
    for (const upd of tasksToUpdate) {
      nextTasks = nextTasks.map((t) => (t.id === upd.id ? upd : t));
      if (get().dbMode === 'sqlite') {
        updateTaskMeta(upd.id, upd.status, upd.priority).catch(() => {});
      }
    }

    saveStoredTasks(nextTasks);
    set({ tasks: nextTasks });
    get().setHud(`AI: Bugungi fokusga ${tasksToAdd.length} ta yo‘l xaritasi vazifasi qo‘shildi/yangilandi ✓`);
    return tasksToAdd.length;
  },

  triggerDailyRoutineTest: async (stage) => {
    const state = get();
    await executeDailyRoutineStage(
      stage,
      {
        tasks: state.tasks,
        roadmaps: state.roadmaps,
        scheduleBlocks: state.scheduleBlocks,
        flashcards: state.flashcards,
        telegramConfig: state.telegramConfig,
        soundEnabled: state.soundEnabled,
        userName: state.userProfile?.full_name || 'Muhandis',
        onAlertBanner: (bannerTitle, bannerBody, stageName) => {
          set({
            activeAlertReminder: {
              id: `routine-${stageName}-${Date.now()}`,
              source_type: 'custom',
              title: bannerTitle,
              description: bannerBody,
              target_time: new Date().toISOString(),
              time_string: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
              status: 'triggered',
              sound_enabled: true,
              created_at: new Date().toISOString(),
            },
          });
        },
        onSetHud: (msg) => state.setHud(msg),
      },
      true // isManualTest = true
    );
  },

  // Spaced Repetition Flashcards initial
  flashcards: loadStoredFlashcards(),

  addFlashcards: async (cards) => {
    const newItems: FlashcardItem[] = cards.map((c) => ({
      ...c,
      id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    }));
    const updated = [...get().flashcards, ...newItems];
    saveStoredFlashcards(updated);
    set({ flashcards: updated });
    get().setHud(`${newItems.length} ta flashcard qo‘shildi ✓`);
  },

  reviewFlashcard: async (cardId, rating) => {
    const card = get().flashcards.find((c) => c.id === cardId);
    if (!card) return;
    const result = calculateNextReview(card, rating);
    const updated = get().flashcards.map((c) => {
      if (c.id === cardId) {
        return {
          ...c,
          ...result,
          last_reviewed_at: new Date().toISOString(),
        };
      }
      return c;
    });
    saveStoredFlashcards(updated);
    set({ flashcards: updated });
    const ratingLabels: Record<1 | 2 | 3, string> = {
      1: '🔴 Qiyin (1 kun)',
      2: `🟡 Yaxshi (${result.interval_days} kun)`,
      3: `🟢 Oson (${result.interval_days} kun)`,
    };
    get().setHud(`Takrorlandi: ${ratingLabels[rating]} ✓ Keyingi sana: ${result.next_review_date}`);
  },

  deleteFlashcard: async (cardId) => {
    const remaining = get().flashcards.filter((c) => c.id !== cardId);
    saveStoredFlashcards(remaining);
    set({ flashcards: remaining });
    get().setHud('Flashcard muvaffaqiyatli o‘chirildi');
  },

  generateFlashcardsForTopicAction: async (
    roadmapId,
    topicId,
    topicTitle,
    roadmapTitle = 'Dasturchi Yo‘l Xaritasi',
    stack = 'Backend',
    provider
  ) => {
    get().setHud(`AI: "${topicTitle}" mavzusi uchun flashcardlar yaratilmoqda...`);
    try {
      const drafts = await generateFlashcardsWithAi(topicTitle, roadmapTitle, stack, provider);
      const todayStr = new Date().toISOString().split('T')[0];
      const itemsToAdd: Omit<FlashcardItem, 'id' | 'created_at'>[] = drafts.map((d) => ({
        roadmap_id: roadmapId,
        topic_id: topicId,
        topic_title: d.topic_title || topicTitle,
        question: d.question,
        answer: d.answer,
        explanation: d.explanation,
        code_snippet: d.code_snippet,
        interval_days: 1,
        repetition_count: 0,
        ease_factor: 2.5,
        next_review_date: todayStr,
      }));
      await get().addFlashcards(itemsToAdd);
      get().setHud(`AI: "${topicTitle}" bo‘yicha ${itemsToAdd.length} ta flashcard tayyor bo‘ldi ✓`);
      return itemsToAdd.length;
    } catch (err) {
      console.error(err);
      get().setHud('Flashcard yaratishda xatolik yuz berdi');
      return 0;
    }
  },

  // Project Ideas initial
  projectIdeas: loadStoredProjectIdeas(),
  selectedIdeaId: loadStoredProjectIdeas()[0]?.id ?? null,
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
    saveStoredProjectIdeas(updated);
    set({ projectIdeas: updated, selectedIdeaId: id });
    if (get().dbMode === 'sqlite') {
      await upsertProjectIdea(newIdea).catch(() => {});
    }
    return id;
  },

  updateIdea: async (id, patch) => {
    const ideas = get().projectIdeas.map((i) => (i.id === id ? { ...i, ...patch, updated_at: new Date().toISOString() } : i));
    saveStoredProjectIdeas(ideas);
    set({ projectIdeas: ideas });
    const target = ideas.find((i) => i.id === id);
    if (target && get().dbMode === 'sqlite') {
      await upsertProjectIdea(target).catch(() => {});
    }
  },

  deleteIdea: async (id) => {
    const ideas = get().projectIdeas.filter((i) => i.id !== id);
    const sel = get().selectedIdeaId === id ? ideas[0]?.id ?? null : get().selectedIdeaId;
    saveStoredProjectIdeas(ideas);
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
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.filter((x: any) => !/^b-[1-6]$/.test(x.id));
        }
      }
      return DEFAULT_SCHEDULE_BLOCKS;
    } catch {
      return DEFAULT_SCHEDULE_BLOCKS;
    }
  })(),

  toggleScheduleBlockDone: (id) => {
    let targetBlock: ScheduleBlock | undefined;
    set((state) => {
      const next = state.scheduleBlocks.map((b) => {
        if (b.id === id) {
          targetBlock = { ...b, done: !b.done };
          return targetBlock;
        }
        return b;
      });
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(next));
      } catch {}
      return { scheduleBlocks: next };
    });
    if (get().dbMode === 'sqlite' && targetBlock) {
      upsertScheduleBlock(targetBlock).catch(() => {});
    }
  },

  addScheduleBlock: (block) => {
    const newBlock = { ...block, id: 'sch-' + Date.now() };
    set((state) => {
      const next = [...state.scheduleBlocks, newBlock];
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(next));
      } catch {}
      return { scheduleBlocks: next };
    });
    if (get().dbMode === 'sqlite') {
      upsertScheduleBlock(newBlock).catch(() => {});
    }
  },

  deleteScheduleBlock: (id) => {
    set((state) => {
      const next = state.scheduleBlocks.filter((b) => b.id !== id);
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(next));
      } catch {}
      return { scheduleBlocks: next };
    });
    if (get().dbMode === 'sqlite') {
      deleteScheduleBlockFromDb(id).catch(() => {});
    }
  },

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
  selectSpace: (id) => {
    if (id) {
      set({ activeSpaceId: id, mainView: 'space' });
    } else {
      set((state) => ({
        activeSpaceId: null,
        mainView: state.mainView === 'space' ? 'dashboard' : state.mainView,
      }));
    }
  },
  addSpace: (space) =>
    set((state) => {
      const newSpace: SpaceItem = { ...space, id: 'sp-' + Date.now() };
      const next = [...state.spaces, newSpace];
      try {
        localStorage.setItem('cognidev_spaces', JSON.stringify(next));
      } catch {}
      return { spaces: next };
    }),
  updateSpace: (id, patch) =>
    set((state) => {
      const next = state.spaces.map((s) => (s.id === id ? { ...s, ...patch } : s));
      try {
        localStorage.setItem('cognidev_spaces', JSON.stringify(next));
      } catch {}
      return { spaces: next };
    }),
  deleteSpace: (id) =>
    set((state) => {
      const next = state.spaces.filter((s) => s.id !== id);
      try {
        localStorage.setItem('cognidev_spaces', JSON.stringify(next));
      } catch {}
      const nextActive = state.activeSpaceId === id ? null : state.activeSpaceId;
      const nextView = state.activeSpaceId === id ? 'dashboard' : state.mainView;
      return { spaces: next, activeSpaceId: nextActive, mainView: nextView };
    }),

  // Links & Developer Bookmarks State
  links: (() => {
    try {
      const s = localStorage.getItem('cognidev_dev_links');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
      return DEFAULT_DEV_LINKS;
    } catch {
      return DEFAULT_DEV_LINKS;
    }
  })(),
  addLink: (link) =>
    set((state) => {
      const newLink: DevLinkItem = {
        ...link,
        id: 'link-' + Date.now(),
        created_at: new Date().toISOString(),
      };
      const updated = [newLink, ...state.links];
      try {
        localStorage.setItem('cognidev_dev_links', JSON.stringify(updated));
      } catch {}
      return { links: updated };
    }),
  updateLink: (id, patch) =>
    set((state) => {
      const updated = state.links.map((l) => (l.id === id ? { ...l, ...patch } : l));
      try {
        localStorage.setItem('cognidev_dev_links', JSON.stringify(updated));
      } catch {}
      return { links: updated };
    }),
  deleteLink: (id) =>
    set((state) => {
      const updated = state.links.filter((l) => l.id !== id);
      try {
        localStorage.setItem('cognidev_dev_links', JSON.stringify(updated));
      } catch {}
      return { links: updated };
    }),
  togglePinLink: (id) =>
    set((state) => {
      const updated = state.links.map((l) => (l.id === id ? { ...l, pinned: !l.pinned } : l));
      try {
        localStorage.setItem('cognidev_dev_links', JSON.stringify(updated));
      } catch {}
      return { links: updated };
    }),

  // Habit Tracker State
  habits: (() => {
    try {
      const s = localStorage.getItem('cognidev_habits');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
      return DEFAULT_HABITS;
    } catch {
      return DEFAULT_HABITS;
    }
  })(),
  toggleHabitDay: (habitId, dateKey) => {
    const targetDate = dateKey || new Date().toISOString().split('T')[0];
    set((state) => {
      const nextHabits = state.habits.map((h) => {
        if (h.id !== habitId) return h;
        const nextHist = { ...h.history };
        const isDone = !nextHist[targetDate];
        if (isDone) {
          nextHist[targetDate] = true;
        } else {
          delete nextHist[targetDate];
        }

        // calculate consecutive streak backwards from today
        let streak = 0;
        const d = new Date();
        while (true) {
          const key = d.toISOString().split('T')[0];
          if (nextHist[key]) {
            streak++;
            d.setDate(d.getDate() - 1);
          } else {
            break;
          }
        }
        const best = Math.max(h.best_streak || 0, streak);
        return {
          ...h,
          history: nextHist,
          streak,
          best_streak: best,
        };
      });

      try {
        localStorage.setItem('cognidev_habits', JSON.stringify(nextHabits));
      } catch {}
      return { habits: nextHabits };
    });
  },
  addHabit: (habitData) => {
    set((state) => {
      const newHabit: HabitItem = {
        ...habitData,
        id: 'h-' + Date.now(),
        streak: 0,
        best_streak: 0,
        history: {},
        created_at: new Date().toISOString(),
      };
      const next = [newHabit, ...state.habits];
      try {
        localStorage.setItem('cognidev_habits', JSON.stringify(next));
      } catch {}
      return { habits: next };
    });
  },
  updateHabit: (id, patch) => {
    set((state) => {
      const next = state.habits.map((h) => (h.id === id ? { ...h, ...patch } : h));
      try {
        localStorage.setItem('cognidev_habits', JSON.stringify(next));
      } catch {}
      return { habits: next };
    });
  },
  deleteHabit: (id) => {
    set((state) => {
      const next = state.habits.filter((h) => h.id !== id);
      try {
        localStorage.setItem('cognidev_habits', JSON.stringify(next));
      } catch {}
      return { habits: next };
    });
  },

  // Meetings state
  meetings: (() => {
    try {
      const s = localStorage.getItem('cognidev_meetings');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.filter((m: any) => m.id !== 'meet-1' && m.id !== 'meet-2');
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),
  selectedMeetingId: null,
  setSelectedMeetingId: (id) => set({ selectedMeetingId: id }),
  addMeeting: (meeting) => {
    set((state) => {
      const next = [meeting, ...state.meetings];
      try {
        localStorage.setItem('cognidev_meetings', JSON.stringify(next));
      } catch {}
      return { meetings: next, selectedMeetingId: meeting.id };
    });
    if (get().dbMode === 'sqlite') {
      upsertMeeting(meeting).catch((err) => console.warn('SQLite upsertMeeting error:', err));
    }
  },
  updateMeeting: (id, patch) => {
    let updated: MeetingItem | undefined;
    set((state) => {
      const next = state.meetings.map((m) => {
        if (m.id === id) {
          updated = { ...m, ...patch };
          return updated;
        }
        return m;
      });
      try {
        localStorage.setItem('cognidev_meetings', JSON.stringify(next));
      } catch {}
      return { meetings: next };
    });
    if (get().dbMode === 'sqlite' && updated) {
      upsertMeeting(updated).catch((err) => console.warn('SQLite upsertMeeting error:', err));
    }
  },
  deleteMeeting: (id) => {
    const existing = get().meetings.find((m) => m.id === id);
    if (existing?.audio_path) {
      deleteMeetingAudio(existing.audio_path).catch(() => {});
    }
    if (get().dbMode === 'sqlite') {
      deleteMeetingFromDb(id).catch((err) => console.warn('SQLite deleteMeeting error:', err));
    }
    set((state) => {
      const next = state.meetings.filter((m) => m.id !== id);
      try {
        localStorage.setItem('cognidev_meetings', JSON.stringify(next));
      } catch {}
      return {
        meetings: next,
        selectedMeetingId: state.selectedMeetingId === id ? (next[0]?.id ?? null) : state.selectedMeetingId,
        hudMessage: "Uchrashuv o'chirildi",
      };
    });
  },
  toggleMeetingActionDone: (meetingId, actionId) => {
    let changedMeeting: MeetingItem | undefined;
    set((state) => {
      let linkedTaskId: string | undefined;
      let nextDone = false;

      const updatedMeetings = state.meetings.map((m) => {
        if (m.id !== meetingId || !m.action_items) return m;
        const updated = {
          ...m,
          action_items: m.action_items.map((a) => {
            if (a.id === actionId) {
              nextDone = !a.completed;
              linkedTaskId = a.task_id;
              return { ...a, completed: nextDone };
            }
            return a;
          }),
          updated_at: new Date().toISOString(),
        };
        changedMeeting = updated;
        return updated;
      });

      try {
        localStorage.setItem('cognidev_meetings', JSON.stringify(updatedMeetings));
      } catch {}

      // Cross-workspace sync: update Task on Tasks board if linked
      let updatedTasks = state.tasks;
      if (linkedTaskId) {
        const newStatus = nextDone ? 'completed' : 'active';
        updatedTasks = state.tasks.map((t) =>
          t.id === linkedTaskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
        );
      }

      return {
        meetings: updatedMeetings,
        tasks: updatedTasks,
        hudMessage: `Topshiriq holati: ${nextDone ? 'Bajarildi ✓' : 'Faol'}`,
      };
    });

    if (get().dbMode === 'sqlite' && changedMeeting) {
      upsertMeeting(changedMeeting).catch((err) => console.warn('SQLite upsertMeeting error:', err));
    }
  },

  // Goals state
  goals: (() => {
    try {
      const s = localStorage.getItem('cognidev_goals');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.filter((x: any) => !/^g-[1-3]$/.test(x.id));
        }
      }
      return DEFAULT_GOALS;
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
  deleteGoal: (id) =>
    set((state) => {
      const next = state.goals.filter((g) => g.id !== id);
      try {
        localStorage.setItem('cognidev_goals', JSON.stringify(next));
      } catch {}
      return { goals: next };
    }),

  // Active Projects state
  activeProjects: (() => {
    try {
      const s = localStorage.getItem('cognidev_active_projects');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((x: any) => !/^p-[1-4]$/.test(x.id));
        }
      }
      return DEFAULT_ACTIVE_PROJECTS;
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
  addActiveProject: (proj) =>
    set((state) => {
      const next = [...state.activeProjects, { ...proj, id: 'proj-' + Date.now() }];
      try {
        localStorage.setItem('cognidev_active_projects', JSON.stringify(next));
      } catch {}
      return { activeProjects: next };
    }),
  updateActiveProject: (id, updates) =>
    set((state) => {
      const next = state.activeProjects.map((p) => (p.id === id ? { ...p, ...updates } : p));
      try {
        localStorage.setItem('cognidev_active_projects', JSON.stringify(next));
      } catch {}
      return { activeProjects: next };
    }),
  deleteActiveProject: (id) =>
    set((state) => {
      const next = state.activeProjects.filter((p) => p.id !== id);
      try {
        localStorage.setItem('cognidev_active_projects', JSON.stringify(next));
      } catch {}
      return { activeProjects: next };
    }),

  // Reminders & Notifications
  reminders: (() => {
    try {
      const s = localStorage.getItem('cognidev_reminders');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  })(),
  activeAlertReminder: null,
  soundEnabled: true,
  toggleSoundEnabled: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

  addReminder: async (rem) => {
    const id = uid('rem');
    const newRem: ScheduledReminder = {
      ...rem,
      id,
      status: 'pending',
      sound_enabled: rem.sound_enabled ?? true,
      created_at: new Date().toISOString(),
    };
    const next = [...get().reminders, newRem].sort(
      (a, b) => new Date(a.target_time).getTime() - new Date(b.target_time).getTime(),
    );
    set({ reminders: next });
    try {
      localStorage.setItem('cognidev_reminders', JSON.stringify(next));
    } catch {}
    if (get().dbMode === 'sqlite') {
      await upsertReminder(newRem).catch(() => {});
    }
    get().setHud(`⏰ Bildirishnoma o‘rnatildi: ${newRem.time_string} ✓`);
    return id;
  },

  updateReminder: async (id, patch) => {
    const next = get().reminders.map((r) => (r.id === id ? { ...r, ...patch } : r));
    set({ reminders: next });
    try {
      localStorage.setItem('cognidev_reminders', JSON.stringify(next));
    } catch {}
    if (get().dbMode === 'sqlite') {
      const target = next.find((r) => r.id === id);
      if (target) await upsertReminder(target).catch(() => {});
    }
  },

  deleteReminder: async (id) => {
    const next = get().reminders.filter((r) => r.id !== id);
    set({ reminders: next });
    try {
      localStorage.setItem('cognidev_reminders', JSON.stringify(next));
    } catch {}
    if (get().dbMode === 'sqlite') {
      await deleteReminderFromDb(id).catch(() => {});
    }
    get().setHud("Eslatma o‘chirildi ✓");
  },

  dismissAlertReminder: () => set({ activeAlertReminder: null }),

  snoozeReminder: async (id, minutes = 10) => {
    const rem = get().reminders.find((r) => r.id === id);
    if (!rem) {
      set({ activeAlertReminder: null });
      return;
    }
    const newTarget = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const newTimeString = `+${minutes} daqiqa (${new Date(newTarget).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
    })})`;

    await get().updateReminder(id, {
      target_time: newTarget,
      time_string: newTimeString,
      status: 'pending',
    });
    set({ activeAlertReminder: null });
    get().setHud(`Eslatma ${minutes} daqiqaga kechiktirildi ✓`);
  },

  testNotification: async () => {
    if (get().soundEnabled) {
      playNotificationSound();
    }
    await sendDesktopNotification(
      "CogniDev Bildirishnomasi",
      "Ovozli va ish stoli bildirishnomalari muvaffaqiyatli ishlamoqda! 🚀",
    );
    get().setHud("Test bildirishnoma yuborildi 🔔");
  },

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
        content: "Salom! 👏 Men sizning shaxsiy AI yordamchingizman.\n\nSizning vazifalaringiz, loyihalaringiz va o'rganish yo'l xaritangizni tahlil qilib, maksimal samaradorlikka erishishingizga yordam beraman. Quyidagi tezkor tugmalardan birini tanlashingiz yoki o'z savolingizni yozishingiz mumkin!",
        timestamp: 'Hozir',
      },
    ];
  })(),
  isAiDrawerThinking: false,

  sendAiDrawerMessage: async (promptText) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const { tasks, roadmaps, projectIdeas, aiDrawerMessages, memories } = get();

    if (isSlashCommand(trimmed)) {
      const userMsg: AiDrawerMessage = {
        id: 'msg-' + Date.now(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'ui',
      };
      insertChatMessage(userMsg).catch(() => {});

      const { userProfile } = get();
      const currentUserName = userProfile?.full_name || 'Dasturchi';
      const reply = await executeSlashCommand(trimmed, {
        tasks,
        scheduleBlocks: get().scheduleBlocks,
        memories,
        messagesCount: aiDrawerMessages.length,
        roadmapsCount: roadmaps.length,
        projectIdeasCount: projectIdeas.length,
        currentUserName,
        onClearHistory: () => get().clearAiDrawerMessages(),
      });

      const botMsg: AiDrawerMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'buyruq',
        source: 'ui',
      };
      insertChatMessage(botMsg).catch(() => {});
      const finalMessages = [...aiDrawerMessages, userMsg, botMsg];
      set({ aiDrawerMessages: finalMessages, isAiDrawerThinking: false });
      return;
    }

    const userMsg: AiDrawerMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'ui',
    };

    const updated = [...aiDrawerMessages, userMsg];
    set({ aiDrawerMessages: updated, isAiDrawerThinking: true });
    insertChatMessage(userMsg).catch(() => {});

    try {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      const blockers = tasks.filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker');
      const activeTasks = tasks.filter((t) => t.status === 'active');

      const { userProfile } = get();
      const currentUserName = userProfile?.full_name || 'Dasturchi';
      const currentUserTitle = userProfile?.title || 'Software Engineer';
      const currentDate = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
      const memoriesContext = formatMemoriesForPrompt(memories);

      const systemPrompt = `Siz CogniDev ilovasida ${currentUserName}ning shaxsiy, aqlli va professional AI yordamchisisiz.
Foydalanuvchi: ${currentUserName} (${currentUserTitle}).
Bugungi sana: ${currentDate}.

${memoriesContext}

Haqiqiy ma'lumotlar:
- Faol vazifalar (${activeTasks.length}): ${activeTasks.slice(0, 8).map((t) => t.title).join('; ') || "Hozircha yo'q"}
- Bajarilgan vazifalar (${completedTasks.length}): ${completedTasks.slice(0, 5).map((t) => t.title).join('; ') || "Hozircha yo'q"}
- To'siqlar (${blockers.length}): ${blockers.map((t) => t.title).join('; ') || "To'siqlar yo'q"}
- Loyihalar: ${projectIdeas.map((p) => p.title).join('; ') || "Hozircha yo'q"}
- Yo'l xaritasi: ${roadmaps.map((r) => r.title).join('; ') || "Hozircha yo'q"}

MUHIM QOIDALAR:
1. Siz foydalanuvchining Hermes orqali o'rganilgan shaxsiy xususiyatlari, maqsadlari va qiziqishlarini to'liq bilasiz. Maslahat berayotganda uning texnologik steki (Go, Java/Spring Boot, Vue, React, TS, Clean Code, FSD) va Nova Renessans amaliyotiga yo'naltirilganligini inobatga oling.
2. Javobingiz QISQA, LAKONIK, SAMIMIY VA ANIQ bo'lsin (uzog'i 2-4 ta gap yoki oddiy punktlar).
3. Foydalanuvchi so'ragan savolga toza, adabiy va tabiiy o'zbek tilida to'g'ridan-to'g'ri javob bering.
4. Ortiqcha tinish belgilari, sun'iy ASCII jadvallar (|---|---|), panjara belgilari (##, ###) va keraksiz yulduzchalar (**) ishlatmang. Toza va chiroyli o'qiladigan formatda javob qaytaring.`;

      const res = await callAi(trimmed, systemPrompt);
      const botMsg: AiDrawerMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model || res.source,
        source: 'ui',
      };

      const finalMessages = [...updated, botMsg];
      set({ aiDrawerMessages: finalMessages, isAiDrawerThinking: false });
      insertChatMessage(botMsg).catch(() => {});
      try {
        localStorage.setItem('cognidev_drawer_messages', JSON.stringify(finalMessages.slice(-30)));
      } catch {}
    } catch (err: unknown) {
      const errorMsg: AiDrawerMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Kechirasiz, so'rovni bajarishda xatolik yuz berdi: ${err instanceof Error ? err.message : 'Tarmoq xatosi'}. Sozlamalardan API kalitingizni tekshiring.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'xatolik',
        source: 'ui',
      };
      const finalMessages = [...updated, errorMsg];
      set({ aiDrawerMessages: finalMessages, isAiDrawerThinking: false });
      insertChatMessage(errorMsg).catch(() => {});
    }
  },

  clearAiDrawerMessages: () => {
    try {
      localStorage.removeItem('cognidev_drawer_messages');
    } catch {}
    clearChatMessagesInDb().catch(() => {});
    const currentUserName = get().userProfile?.full_name || 'Dasturchi';
    set({
      aiDrawerMessages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: `Salom, ${currentUserName}! 👏 Tarix tozalandi. Bugun qanday muhandislik masalasida yordam bera olaman?`,
          timestamp: 'Hozir',
        },
      ],
    });
  },

  startTelegramBot: async () => {
    const { telegramConfig } = get();
    if (!telegramConfig.bot_token?.trim()) return;

    telegramBotManager.subscribeStatus((status, botName) => {
      set({ telegramStatus: status, telegramBotName: botName ?? null });
    });

    await telegramBotManager.start(
      telegramConfig,
      async (incomingText, _fromId, _chatId, fromName) => {
        const { tasks, roadmaps, projectIdeas, memories, userProfile } = get();

        const userMsg: AiDrawerMessage = {
          id: 'tg-user-' + Date.now(),
          role: 'user',
          content: incomingText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'telegram',
        };

        set((state) => ({
          aiDrawerMessages: [...state.aiDrawerMessages, userMsg],
        }));
        insertChatMessage(userMsg).catch(() => {});

        if (isSlashCommand(incomingText)) {
          const reply = await executeSlashCommand(incomingText, {
            tasks,
            scheduleBlocks: get().scheduleBlocks,
            memories,
            messagesCount: get().aiDrawerMessages.length,
            roadmapsCount: roadmaps.length,
            projectIdeasCount: projectIdeas.length,
            currentUserName: fromName || userProfile?.full_name || 'Farhod',
            onClearHistory: () => get().clearAiDrawerMessages(),
          });

          const botMsg: AiDrawerMessage = {
            id: 'tg-bot-' + Date.now(),
            role: 'assistant',
            content: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: 'buyruq',
            source: 'telegram',
          };

          set((state) => ({
            aiDrawerMessages: [...state.aiDrawerMessages, botMsg],
          }));
          insertChatMessage(botMsg).catch(() => {});
          return reply;
        }

        const completedTasks = tasks.filter((t) => t.status === 'completed');
        const blockers = tasks.filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker');
        const activeTasks = tasks.filter((t) => t.status === 'active');

        const currentUserName = fromName || userProfile?.full_name || 'Farhod';
        const currentDate = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
        const memoriesContext = formatMemoriesForPrompt(memories);

        const systemPrompt = `Siz CogniDev ilovasining Telegram AI yordamchisisiz.
Foydalanuvchi: ${currentUserName}.
Bugungi sana: ${currentDate}.
Muloqot kanali: Telegram Bot.

${memoriesContext}

Hozirgi CogniDev ma'lumotlari:
- Faol vazifalar (${activeTasks.length}): ${activeTasks.slice(0, 8).map((t) => t.title).join('; ') || "Yo'q"}
- Bajarilgan vazifalar: ${completedTasks.slice(0, 5).map((t) => t.title).join('; ') || "Yo'q"}
- To'siqlar: ${blockers.map((t) => t.title).join('; ') || "Yo'q"}
- Loyihalar: ${projectIdeas.map((p) => p.title).join('; ') || "Yo'q"}
- Yo'l xaritasi: ${roadmaps.map((r) => r.title).join('; ') || "Yo'q"}

MUHIM QOIDALAR:
1. Foydalanuvchi sizga Telegram'dan yozmoqda.
2. Javobingiz Telegram formati uchun ixcham, samimiy va lo‘nda bo‘lsin.
3. Foydalanuvchining Hermes orqali o‘rganilgan xotiralariga (texnologiyalari, maqsadlari) to‘liq mos yondashing.`;

        const res = await callAi(incomingText, systemPrompt);
        const replyText = res.text;

        const botMsg: AiDrawerMessage = {
          id: 'tg-bot-' + Date.now(),
          role: 'assistant',
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: res.model || res.source,
          source: 'telegram',
        };

        set((state) => ({
          aiDrawerMessages: [...state.aiDrawerMessages, botMsg],
        }));
        insertChatMessage(botMsg).catch(() => {});

        return replyText;
      },
      (newOffset) => {
        upsertTelegramSettings({ ...get().telegramConfig, last_update_id: newOffset }).catch(() => {});
      },
    );
  },

  stopTelegramBot: () => {
    telegramBotManager.stop();
    set({ telegramStatus: 'stopped' });
  },

  updateTelegramConfig: async (patch) => {
    const updated = { ...get().telegramConfig, ...patch };
    set({ telegramConfig: updated });
    await upsertTelegramSettings(updated);
  },

  syncHermesMemoriesAction: async () => {
    const synced = await syncHermesMemoriesToDb();
    set({ memories: synced });
  },

  generateDailyReportAction: async () => {
    const { tasks, scheduleBlocks, userProfile } = get();
    return generateDailyMissedTasksReport(tasks, scheduleBlocks, userProfile?.full_name || 'Farhod');
  },

  speakDailyReportAction: async (summaryText: string) => {
    return speakDailyReportVoice(summaryText);
  },

  dispatchDailyReportToTelegramAction: async (reportText?: string) => {
    const { telegramConfig, tasks, scheduleBlocks, userProfile } = get();
    if (!telegramConfig.bot_token || !telegramConfig.allowed_user_ids) return 0;
    let textToSend = reportText;
    if (!textToSend) {
      const summary = await generateDailyMissedTasksReport(
        tasks,
        scheduleBlocks,
        userProfile?.full_name || 'Farhod'
      );
      textToSend = summary.reportMarkdown;
    }
    return dispatchDailyReportToTelegram(
      telegramConfig.bot_token,
      telegramConfig.allowed_user_ids,
      textToSend
    );
  },

  todayAiSummary: (() => {
    try {
      return (
        localStorage.getItem('cognidev_today_ai_summary') ||
        "Bugun siz loyihalaringiz va vazifalaringiz bo'yicha muhim rejalarni bajardingiz. Hozir faol vazifalarni davom ettiring va diqqatni jamlang! 💪"
      );
    } catch {
      return "Bugungi rejalaringizni davom ettiring!";
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

      const currentUserName = get().userProfile?.full_name || 'Dasturchi';
      const currentUserTitle = get().userProfile?.title || 'Software Engineer';
      const contextPrompt = `Dasturchi holati tahlili:
- Jami vazifalar: ${tasks.length} ta (Bajarilgan: ${completedTasks.length}, Faol: ${activeTasks.length}, To'siqlar: ${blockers.length})
- Eng so'nggi bajarilgan ishlar: ${completedTasks.slice(0, 3).map((t) => t.title).join(', ') || "Hali tasklar boshlanmagan"}
- To'siq/Muammolar: ${blockers.map((b) => b.title).join(', ') || "To'siqlar yo'q"}
- Faol loyihalar: ${projectIdeas.map((p) => `${p.title} (${p.status})`).join(', ')}
- Yo‘l xaritalari: ${roadmaps.map((r) => r.title).join('; ')}
- Qaydlar: ${notesDocs.length} ta Notion qayd mavjud.

Iltimos, ${currentUserName} (${currentUserTitle}) uchun bugungi kungi qisqa, professional va ruhlantiruvchi muhandislik xulosasini 2-3 jumlada o'zbek tilida yozib bering. Nimaga erishilgani va keyingi diqqat markazini qisqa ayting.`;

      const res = await callAi(contextPrompt, `Siz ${currentUserName}ning shaxsiy dev-cockpit AI yordamchisisiz. Qisqa, aniq va texnik ruhda javob bering.`);
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
    ensureSchedulerStarted(get, set);
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
      ensureSchedulerStarted(get, set);
    }
  },

  refresh: async () => {
    const [
      ws,
      rawTasks,
      grps,
      profile,
      rawNotes,
      rawRoadmaps,
      rawLogs,
      rawIdeas,
      rawReminders,
      rawMeetings,
      rawBlocks,
      rawMemories,
      rawChatMessages,
      rawTgSettings,
    ] = await Promise.all([
      fetchWorkspaces().catch(() => []),
      fetchTasks().catch(() => []),
      fetchGroups().catch(() => []),
      fetchUserProfile().catch(() => DEFAULT_USER_PROFILE),
      fetchNotes(get().activeWorkspaceId).catch(() => []),
      fetchRoadmaps().catch(() => []),
      fetchLearningLogs().catch(() => []),
      fetchProjectIdeas(get().activeWorkspaceId).catch(() => []),
      fetchReminders().catch(() => []),
      fetchMeetings().catch(() => []),
      fetchScheduleBlocks().catch(() => []),
      fetchMemories().catch(() => []),
      fetchChatMessages(100).catch(() => []),
      fetchTelegramSettings().catch(() => ({ bot_token: '', allowed_user_ids: '', is_active: false, last_update_id: 0 })),
    ]);

    // Hermes memories: if SQLite is empty, auto-sync and seed
    let memories = rawMemories;
    if (memories.length === 0) {
      memories = await syncHermesMemoriesToDb().catch(() => []);
    }

    // Tasks: Dual-layer persistence
    let tasks = rawTasks;
    const memoryOrStoredTasks = get().tasks.length > 0 ? get().tasks : loadStoredTasks();
    if (tasks.length === 0 && memoryOrStoredTasks.length > 0) {
      tasks = memoryOrStoredTasks;
      for (const t of tasks) {
        insertTask(t).catch(() => {});
      }
    } else if (tasks.length > 0) {
      const map = new Map<string, Task>();
      for (const t of tasks) map.set(t.id, t);
      for (const t of memoryOrStoredTasks) {
        if (!map.has(t.id)) {
          map.set(t.id, t);
          insertTask(t).catch(() => {});
        }
      }
      tasks = Array.from(map.values());
      saveStoredTasks(tasks);
    }

    const activeWs = ws.find((w) => w.id === get().activeWorkspaceId) ?? ws[0] ?? DEFAULT_PERSONAL_WORKSPACE;
    const currentSelected = get().selectedTaskId;
    const sel = tasks.find((t) => t.id === currentSelected) ?? tasks[0] ?? null;

    // Notes: Dual-layer persistence
    let notesDocs = rawNotes;
    const memoryOrStoredNotes = get().notesDocs.length > 0 ? get().notesDocs : loadStoredNotesDocs();
    if (notesDocs.length === 0 && memoryOrStoredNotes.length > 0) {
      notesDocs = memoryOrStoredNotes;
      for (const n of notesDocs) {
        upsertNote(n).catch(() => {});
      }
    } else if (notesDocs.length > 0) {
      const map = new Map<string, NoteDoc>();
      for (const n of notesDocs) map.set(n.id, n);
      for (const n of memoryOrStoredNotes) {
        if (!map.has(n.id)) {
          map.set(n.id, n);
          upsertNote(n).catch(() => {});
        }
      }
      notesDocs = Array.from(map.values());
      saveStoredNotesDocs(notesDocs);
    }

    // Roadmaps: Dual-layer persistence
    let roadmaps = rawRoadmaps;
    const memoryOrStoredRoadmaps = get().roadmaps.length > 0 ? get().roadmaps : loadStoredRoadmaps();
    if (roadmaps.length === 0 && memoryOrStoredRoadmaps.length > 0) {
      roadmaps = memoryOrStoredRoadmaps;
      for (const r of roadmaps) {
        upsertRoadmap(r).catch(() => {});
      }
    } else if (roadmaps.length > 0) {
      const map = new Map<string, RoadmapItem>();
      for (const r of roadmaps) map.set(r.id, r);
      for (const r of memoryOrStoredRoadmaps) {
        if (!map.has(r.id)) {
          map.set(r.id, r);
          upsertRoadmap(r).catch(() => {});
        }
      }
      roadmaps = Array.from(map.values());
      saveStoredRoadmaps(roadmaps);
    }

    // Project Ideas: Dual-layer persistence
    let projectIdeas = rawIdeas;
    const memoryOrStoredIdeas = get().projectIdeas.length > 0 ? get().projectIdeas : loadStoredProjectIdeas();
    if (projectIdeas.length === 0 && memoryOrStoredIdeas.length > 0) {
      projectIdeas = memoryOrStoredIdeas;
      for (const i of projectIdeas) {
        upsertProjectIdea(i).catch(() => {});
      }
    } else if (projectIdeas.length > 0) {
      const map = new Map<string, ProjectIdea>();
      for (const i of projectIdeas) map.set(i.id, i);
      for (const i of memoryOrStoredIdeas) {
        if (!map.has(i.id)) {
          map.set(i.id, i);
          upsertProjectIdea(i).catch(() => {});
        }
      }
      projectIdeas = Array.from(map.values());
      saveStoredProjectIdeas(projectIdeas);
    }

    // Meetings: if SQLite has meetings, use them; if empty but in memory/localStorage, save them to SQLite
    let meetings = rawMeetings;
    if (meetings.length === 0 && get().meetings.length > 0) {
      meetings = get().meetings;
      for (const m of meetings) {
        upsertMeeting(m).catch(() => {});
      }
    } else if (meetings.length > 0) {
      try {
        localStorage.setItem('cognidev_meetings', JSON.stringify(meetings));
      } catch {}
    }

    // Schedule blocks: if SQLite has blocks, use them; if empty but in memory, save them
    let scheduleBlocks = rawBlocks;
    if (scheduleBlocks.length === 0 && get().scheduleBlocks.length > 0) {
      scheduleBlocks = get().scheduleBlocks;
      for (const b of scheduleBlocks) {
        upsertScheduleBlock(b).catch(() => {});
      }
    } else if (scheduleBlocks.length > 0) {
      try {
        localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(scheduleBlocks));
      } catch {}
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
      reminders: rawReminders.length ? rawReminders : get().reminders,
      meetings,
      selectedMeetingId: get().selectedMeetingId ?? meetings[0]?.id ?? null,
      scheduleBlocks: scheduleBlocks.length ? scheduleBlocks : get().scheduleBlocks,
      memories,
      aiDrawerMessages: rawChatMessages.length > 0 ? rawChatMessages : get().aiDrawerMessages,
      telegramConfig: rawTgSettings,
    });

    if (rawTgSettings.is_active && rawTgSettings.bot_token?.trim()) {
      get().startTelegramBot().catch(() => {});
    }

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

    // Handle v2 extended backup data
    const meetings = d.meetings ?? get().meetings;
    const scheduleBlocks = d.scheduleBlocks ?? get().scheduleBlocks;
    const notesDocs = d.notesDocs ?? get().notesDocs;
    const goals = d.goals ?? get().goals;
    const habits = d.habits ?? get().habits;
    const roadmaps = d.roadmaps ?? get().roadmaps;
    const projectIdeas = d.projectIdeas ?? get().projectIdeas;
    const learningLogs = d.learningLogs ?? get().learningLogs;
    const reminders = d.scheduledReminders ?? get().reminders;
    const userProfile = d.userProfile ?? get().userProfile;
    const groups = d.teamGroups ?? (d as any).groups ?? get().groups;

    try {
      saveStoredTasks(d.tasks);
      saveStoredNotes(notes);
      saveStoredChecklists(checklists);
      if (d.notesDocs) saveStoredNotesDocs(d.notesDocs);
      if (d.roadmaps) saveStoredRoadmaps(d.roadmaps);
      if (d.projectIdeas) saveStoredProjectIdeas(d.projectIdeas);
      if (d.meetings) localStorage.setItem('cognidev_meetings', JSON.stringify(d.meetings));
      if (d.scheduleBlocks) localStorage.setItem('cognidev_schedule_blocks', JSON.stringify(d.scheduleBlocks));
      if (d.goals) localStorage.setItem('cognidev_goals', JSON.stringify(d.goals));
      if (d.habits) localStorage.setItem('cognidev_habits', JSON.stringify(d.habits));
    } catch {}

    set({
      workspaces: d.workspaces.length ? d.workspaces : [DEFAULT_PERSONAL_WORKSPACE],
      tasks: d.tasks.map((t) => ({ ...t, tags: Array.isArray(t.tags) ? t.tags : [] })),
      notes,
      checklists,
      prompts: d.prompts.filter((p) => p.task_id === sel?.id),
      selectedTaskId: sel?.id ?? null,
      activeTag: null,
      groups,
      userProfile,
      notesDocs,
      roadmaps,
      projectIdeas,
      learningLogs,
      reminders,
      meetings,
      selectedMeetingId: meetings[0]?.id ?? null,
      scheduleBlocks,
      goals,
      habits,
      hudMessage: "Barcha ma'lumotlar zaxiradan muvaffaqiyatli tiklandi ✓",
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
  setGitHubModal: (showGitHubModal) => set({ showGitHubModal }),
  setGitHubTargetRepoUrl: (gitHubTargetRepoUrl) => set({ gitHubTargetRepoUrl }),
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
    const { tasks, activeWorkspaceId, dbMode, userProfile, notes, checklists } = get();
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
    const newChecklist = [
      { id: uid('chk'), text: "Muammoni aniqlash va o'rganish", done: false },
      { id: uid('chk'), text: "Yechim kodini tekshirish", done: false },
    ];

    if (dbMode === 'sqlite') {
      try {
        await insertTask(newTask);
        await upsertResolution(id, initialNote, JSON.stringify(newChecklist));
      } catch {
        /* fallback */
      }
    }

    const updatedTasks = [newTask, ...tasks];
    const updatedNotes = { ...notes, [id]: initialNote };
    const updatedChecklists = { ...checklists, [id]: newChecklist };
    saveStoredTasks(updatedTasks);
    saveStoredNotes(updatedNotes);
    saveStoredChecklists(updatedChecklists);

    set({
      tasks: updatedTasks,
      selectedTaskId: id,
      notes: updatedNotes,
      checklists: updatedChecklists,
      hudMessage: `Yangi vazifa qayd etildi: ${id}`,
    });
  },

  ingestAiConversation: async (ingestData, mode, targetTaskId) => {
    const { tasks, activeWorkspaceId, dbMode, notes, checklists, userProfile } = get();
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

      const updatedTasks = [newTask, ...tasks];
      const updatedNotes = { ...notes, [id]: richNote };
      const updatedChecklists = { ...checklists, [id]: checklistItems };
      saveStoredTasks(updatedTasks);
      saveStoredNotes(updatedNotes);
      saveStoredChecklists(updatedChecklists);

      set({
        tasks: updatedTasks,
        selectedTaskId: id,
        notes: updatedNotes,
        checklists: updatedChecklists,
        prompts: [promptEntry],
        hudMessage: `AI yechimi muvaffaqiyatli import qilindi: ${id}`,
      });

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

      const updatedNotes = { ...notes, [id]: updatedNote };
      saveStoredNotes(updatedNotes);

      set((s) => ({
        notes: updatedNotes,
        prompts: [...s.prompts, promptEntry],
        selectedTaskId: id,
        hudMessage: `AI suhbati ${id} ga biriktirildi`,
      }));

      return id;
    }
  },

  addTask: (t) => {
    const remaining = get().tasks.filter((x) => x.id !== t.id);
    const updated = [t, ...remaining];
    saveStoredTasks(updated);
    set({ tasks: updated, selectedTaskId: t.id, prompts: [] });
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
    saveStoredTasks(remaining);
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
    const isDone = status === 'completed' || (status as string) === 'done';
    const updatedTasks = get().tasks.map((t) => (t.id === id ? { ...t, status, updated_at: stamp } : t));
    const updatedMeetings = get().meetings.map((m) => {
      if (!m.action_items?.some((a) => a.task_id === id)) return m;
      return {
        ...m,
        action_items: m.action_items.map((a) =>
          a.task_id === id ? { ...a, completed: isDone } : a
        ),
        updated_at: stamp,
      };
    });

    try {
      localStorage.setItem('cognidev_meetings', JSON.stringify(updatedMeetings));
    } catch {}
    saveStoredTasks(updatedTasks);

    // Bidirectional sync: If task originated from a roadmap topic, update that topic in roadmaps
    const targetTask = updatedTasks.find((task) => task.id === id);
    let updatedRoadmaps = get().roadmaps;
    if (targetTask?.ai_source?.startsWith('roadmap_topic:')) {
      const topicId = targetTask.ai_source.replace('roadmap_topic:', '');
      updatedRoadmaps = get().roadmaps.map((r) => {
        let changed = false;
        const milestones = r.milestones.map((m) => {
          if (!m.topics.some((top) => top.id === topicId)) return m;
          changed = true;
          return {
            ...m,
            topics: m.topics.map((top) => (top.id === topicId ? { ...top, done: isDone } : top)),
          };
        });
        return changed ? { ...r, milestones, updated_at: stamp } : r;
      });
      saveStoredRoadmaps(updatedRoadmaps);
      if (get().dbMode === 'sqlite') {
        const changedRd = updatedRoadmaps.find((r) =>
          r.milestones.some((m) => m.topics.some((top) => top.id === topicId))
        );
        if (changedRd) upsertRoadmap(changedRd).catch(() => {});
      }
    }

    set({
      tasks: updatedTasks,
      meetings: updatedMeetings,
      roadmaps: updatedRoadmaps,
      hudMessage: `${id} holati o'zgartirildi: ${status}`,
    });

    const t = updatedTasks.find((task) => task.id === id);
    if (get().dbMode === 'sqlite' && t) {
      updateTaskMeta(id, status, t.priority).catch(() => {});
    }
  },

  updateTaskPriority: (id, priority) => {
    const stamp = new Date().toISOString();
    const updatedTasks = get().tasks.map((t) => (t.id === id ? { ...t, priority, updated_at: stamp } : t));
    saveStoredTasks(updatedTasks);
    set({
      tasks: updatedTasks,
      hudMessage: `${id} muhimlik darajasi o'zgartirildi`,
    });
    const t = updatedTasks.find((task) => task.id === id);
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
  userName?: string,
): Task[] {
  let out = tasks.filter(
    (t) =>
      t.workspace_id === workspaceId ||
      (!t.workspace_id && workspaceId === DEFAULT_PERSONAL_WORKSPACE.id) ||
      (t.workspace_id === 'default' && workspaceId === DEFAULT_PERSONAL_WORKSPACE.id),
  );
  if (activeGroupId) {
    out = out.filter((t) => t.group_id === activeGroupId);
  }
  if (activeTag) {
    out = out.filter((t) => (t.tags ?? []).includes(activeTag));
  }
  if (f === 'mine') {
    const target = (userName || '').trim().toLowerCase();
    out = out.filter((t) => {
      const a = (t.assignee_name || '').trim().toLowerCase();
      if (!a) return false;
      if (target && a === target) return true;
      return a === 'men' || a === 'o\'zim' || a === 'me';
    });
  }
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
