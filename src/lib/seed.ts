import type { ChecklistItem, PromptEntry, Task, TeamGroup, Workspace } from './types';

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
