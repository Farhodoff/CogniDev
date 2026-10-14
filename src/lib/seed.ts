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
} from './types';

/** Default initial workspace for a clean production setup. */
export const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'ws-personal',
  name: 'Personal Dev Hub',
  type: 'personal',
  created_at: new Date().toISOString(),
};

export const DEFAULT_GROUPS: TeamGroup[] = [];

export const DEFAULT_TASKS: Task[] = [];

export const DEFAULT_NOTES: Record<string, string> = {};

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {};

export const DEFAULT_PROMPTS: PromptEntry[] = [];

export const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [];

export const DEFAULT_ROADMAPS: RoadmapItem[] = [];

export const DEFAULT_NOTION_NOTES: NoteDoc[] = [];

export const DEFAULT_PROJECT_IDEAS: ProjectIdea[] = [];
