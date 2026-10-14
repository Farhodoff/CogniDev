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

export const DEFAULT_GOALS: GoalItem[] = [];

export const DEFAULT_ACTIVE_PROJECTS: ActiveProject[] = [];

export const DEFAULT_TASKS: Task[] = [];

export const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [];

export const DEFAULT_NOTION_NOTES: NoteDoc[] = [];

export const DEFAULT_ROADMAPS: RoadmapItem[] = [];

export const DEFAULT_PROJECT_IDEAS: ProjectIdea[] = [];

export const DEFAULT_NOTES: Record<string, string> = {};

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {};

export const DEFAULT_PROMPTS: PromptEntry[] = [];
