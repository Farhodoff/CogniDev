export type WorkspaceType = 'personal' | 'team';
export type TaskStatus = 'backlog' | 'active' | 'in_review' | 'completed' | 'blocker';
export type TaskPriority = 'P0 Blocker' | 'Critical' | 'High Priority' | 'Normal';
export type RetroType = 'standup' | 'weekly_retro';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  created_at: string;
}

export interface TeamGroup {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  icon?: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  group_id?: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  git_branch: string | null;
  pr_url: string | null;
  ai_source: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  assignee_name2: string | null;
  assignee_avatar2: string | null;
  /** Normalized tags without '#' prefix, e.g. ['bugfix', 'arch'] */
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskResolution {
  task_id: string;
  markdown_note: string | null;
  checklist_json: string | null;
}

export interface PromptEntry {
  id: string;
  task_id: string;
  prompt_hash: string | null;
  raw_prompt: string;
  ai_response: string | null;
  model_name: string | null;
  created_at: string;
}

export interface Retrospective {
  id: string;
  date: string;
  type: RetroType;
  content: string;
  blockers_summary: string | null;
  created_at: string;
}

export type EditorTab = 'note' | 'thread';
export type QuickFilter = 'mine' | 'high' | 'claude' | 'gemini' | 'solved' | 'knowledge' | null;
export type NavView = 'stream' | 'solved' | 'knowledge' | 'vault';

export interface WeeklyCoachInsight {
  completedCount: number;
  deferredCount: number;
  blockersCount: number;
  bottlenecks: string[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
  aiPowered?: boolean;
  aiSource?: string;
  aiModel?: string;
}
