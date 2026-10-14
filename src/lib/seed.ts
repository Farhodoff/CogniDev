import type {
  ChecklistItem,
  PromptEntry,
  Task,
  TeamGroup,
  Workspace,
  RoadmapItem,
  NoteDoc,
  ProjectIdea,
  ScheduleBlock,
  GoalItem,
  ActiveProject,
  SpaceItem,
} from './types';

/** Default initial workspace for Farhod's MySpace Hub */
export const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'ws-personal',
  name: 'Personal Dev Hub',
  type: 'personal',
  created_at: new Date().toISOString(),
};

export const DEFAULT_GROUPS: TeamGroup[] = [];

export const DEFAULT_SPACES: SpaceItem[] = [
  { id: 'sp-personal', name: 'Personal', icon: 'User', color: '#ef4444' },
  { id: 'sp-uni', name: 'University (JDU)', icon: 'GraduationCap', color: '#3b82f6' },
  { id: 'sp-work', name: 'Work / Backend', icon: 'Briefcase', color: '#f59e0b' },
  { id: 'sp-japan', name: 'Japanese (JLPT)', icon: 'Languages', color: '#f43f5e' },
  { id: 'sp-ai', name: 'AI & ML', icon: 'Brain', color: '#8b5cf6' },
  { id: 'sp-health', name: 'Health & Sport', icon: 'Activity', color: '#10b981' },
  { id: 'sp-finance', name: 'Finance', icon: 'TrendingUp', color: '#eab308' },
  { id: 'sp-travel', name: 'Travel / Japan', icon: 'Plane', color: '#06b6d4' },
  { id: 'sp-archive', name: 'Archive', icon: 'Archive', color: '#71717a' },
];

export const DEFAULT_GOALS: GoalItem[] = [
  { id: 'g-1', title: 'JLPT N2 (April 2027)', progress: 60, category: 'Japanese', target_date: '2027-04' },
  { id: 'g-2', title: 'Go to Japan (Gain experience)', progress: 30, category: 'Career', target_date: '2027-09' },
  { id: 'g-3', title: 'Become a strong backend developer', progress: 70, category: 'Engineering', target_date: '2026-12' },
];

export const DEFAULT_ACTIVE_PROJECTS: ActiveProject[] = [
  {
    id: 'p-1',
    title: 'Nihongo Talk',
    subtitle: 'JLPT study platform + AI speaking coach',
    progress: 70,
    color: '#ef4444',
  },
  {
    id: 'p-2',
    title: 'Million - halal-mart',
    subtitle: 'Django + DRF backend (shopping app)',
    progress: 90,
    color: '#10b981',
  },
  {
    id: 'p-3',
    title: 'InglizchaOson Bot',
    subtitle: 'Telegram bot (English learning)',
    progress: 60,
    color: '#3b82f6',
  },
  {
    id: 'p-4',
    title: 'Personal Portfolio',
    subtitle: 'Website + Interactive Resume',
    progress: 45,
    color: '#8b5cf6',
  },
];

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-1',
    workspace_id: 'ws-personal',
    title: 'Django final exam preparation',
    status: 'completed',
    priority: 'High Priority',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['study', 'django'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-2',
    workspace_id: 'ws-personal',
    title: 'N2 Grammar (〜ものの、〜わけではない)',
    status: 'active',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['japanese', 'grammar'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-3',
    workspace_id: 'ws-personal',
    title: 'Nihongo Talk — Scheduler bug fix',
    status: 'active',
    priority: 'P0 Blocker',
    git_branch: 'fix/scheduler-cron',
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['work', 'backend', 'bugfix'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-4',
    workspace_id: 'ws-personal',
    title: 'Gym (Chest + Triceps)',
    status: 'active',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['health', 'sport'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-5',
    workspace_id: 'ws-personal',
    title: 'Read 1 chapter (Algorithms)',
    status: 'active',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['study', 'dsa'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-6',
    workspace_id: 'ws-personal',
    title: 'Plan tomorrow',
    status: 'active',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['personal'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { id: 'b-1', time_range: '09:00 - 11:00', title: 'Django final exam preparation', category: 'study', tag: 'Study', color: '#a855f7', done: true },
  { id: 'b-2', time_range: '11:00 - 12:00', title: 'N2 Grammar (〜ものの、〜わけではない)', category: 'study', tag: 'Japanese', color: '#f43f5e', done: false },
  { id: 'b-3', time_range: '13:00 - 15:00', title: 'Nihongo Talk — Scheduler bug fix', category: 'work', tag: 'Work', color: '#0ea5e9', done: false },
  { id: 'b-4', time_range: '16:00 - 17:30', title: 'Gym (Chest + Triceps)', category: 'health', tag: 'Health', color: '#22c55e', done: false },
  { id: 'b-5', time_range: '20:00 - 21:00', title: 'Read 1 chapter (Algorithms)', category: 'study', tag: 'Study', color: '#a855f7', done: false },
  { id: 'b-6', time_range: '21:30 - 22:00', title: 'Plan tomorrow', category: 'personal', tag: 'Personal', color: '#3b82f6', done: false },
];

export const DEFAULT_NOTION_NOTES: NoteDoc[] = [
  {
    id: 'n-1',
    workspace_id: 'ws-personal',
    title: 'Nihongo Talk — Scheduler muammosi',
    content: 'Bugun scheduler algoritmi tahlil qilindi. Muammo: daily cron timing va timezone farqi...',
    icon: '📝',
    tags: ['Work', 'Scheduler'],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'n-2',
    workspace_id: 'ws-personal',
    title: 'Django — Render deploy',
    content: 'Gunicorn error fixed, server successfully deployed on Render with persistent volume.',
    icon: '⚙️',
    tags: ['Backend', 'Deploy'],
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'n-3',
    workspace_id: 'ws-personal',
    title: 'New Idea — Language Center Platform',
    content: 'Ota-onalar uchun multi-language school app g‘oyasi. CRM + student attendance tracking.',
    icon: '💡',
    tags: ['Idea', 'Business'],
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'n-4',
    workspace_id: 'ws-personal',
    title: 'JLPT N2 — Grammar Notes',
    content: '〜ものの、〜わけではない、〜にしては、〜わりに. Asosiy farqlar va misol gaplar.',
    icon: '🇯🇵',
    tags: ['Japanese', 'JLPT'],
    created_at: new Date(Date.now() - 345600000).toISOString(),
    updated_at: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'n-5',
    workspace_id: 'ws-personal',
    title: 'MTS — XAU/USD analysis',
    content: 'Bugungi tahlil, important resistance level: 1930. Risk-to-reward ratio 1:3.',
    icon: '📈',
    tags: ['Finance', 'Trading'],
    created_at: new Date(Date.now() - 432000000).toISOString(),
    updated_at: new Date(Date.now() - 432000000).toISOString(),
  },
];

export const DEFAULT_ROADMAPS: RoadmapItem[] = [];

export const DEFAULT_PROJECT_IDEAS: ProjectIdea[] = [];

export const DEFAULT_NOTES: Record<string, string> = {};

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {};

export const DEFAULT_PROMPTS: PromptEntry[] = [];
