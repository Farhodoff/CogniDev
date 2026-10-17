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

export interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  title: string;
  email: string;
  github: string;
  avatar_color: string;
  avatar_initials: string;
  bio: string;
  role: string;
  updated_at: string;
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
  space_id?: string | null;
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
  /** Optional deadline / reminder time, e.g. "10:00" or ISO timestamp */
  due_time?: string | null;
  /** Whether a notification / reminder is enabled for this task */
  reminder_enabled?: boolean;
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

export type MainView =
  | 'dashboard'
  | 'stream'
  | 'notes'
  | 'roadmap'
  | 'ideas'
  | 'retro'
  | 'calendar'
  | 'goals'
  | 'inbox'
  | 'habits'
  | 'projects'
  | 'space'
  | 'meetings';

export interface MeetingActionItem {
  id: string;
  text: string;
  assignee?: string;
  priority?: TaskPriority;
  due_date?: string;
  added_to_tasks?: boolean;
  task_id?: string;
  completed?: boolean;
}

export interface MeetingItem {
  id: string;
  title: string;
  date: string;
  duration: number; // in seconds
  audio_url?: string;
  transcript: string;
  language: string;
  mode: 'audio_only' | 'analyzed';
  summary?: string;
  decisions?: string[];
  action_items?: MeetingActionItem[];
  key_takeaways?: string[];
  tags: string[];
  space_id?: string | null;
  project_id?: string | null;
  note_id?: string | null;
  calendar_block_id?: string | null;
  ai_provider?: string;
  ai_model?: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingAiConfig {
  useDedicatedKey: boolean;
  provider: 'gemini' | 'openai' | 'groq' | 'deepseek' | 'claude' | 'openrouter' | 'llama' | 'muse' | 'ollama';
  apiKey: string;
  model: string;
  sttEngine: 'rubai' | 'web';
  noiseSuppression: boolean;
  autoGainControl: boolean;
  echoCancellation: boolean;
}

export interface HabitItem {
  id: string;
  title: string;
  description?: string;
  category: 'code' | 'study' | 'health' | 'productivity' | 'life';
  color: string;
  icon: string;
  target_days_per_week: number;
  streak: number;
  best_streak: number;
  /** ISO date keys "YYYY-MM-DD" mapped to boolean */
  history: Record<string, boolean>;
  created_at: string;
}

export interface GoalItem {
  id: string;
  title: string;
  progress: number;
  category: string;
  target_date?: string;
}

export interface ActiveProject {
  id: string;
  title: string;
  subtitle: string;
  progress: number;
  icon?: string;
  color?: string;
  github_url?: string;
  category?: string;
  status?: 'active' | 'in_progress' | 'completed' | 'on_hold';
  tags?: string[];
  created_at?: string;
}

export interface SpaceItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ScheduleBlock {
  id: string;
  time_range: string;
  title: string;
  category: 'work' | 'study' | 'personal' | 'health';
  tag: string;
  color: string;
  done: boolean;
  meeting_id?: string | null;
  date?: string;
}

export interface AiDrawerMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

export interface NoteDoc {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  icon: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface RoadmapTopic {
  id: string;
  title: string;
  done: boolean;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  duration?: string;
  priority?: string;
  topics: RoadmapTopic[];
}

export interface RoadmapItem {
  id: string;
  title: string;
  stack: string;
  description: string;
  milestones: RoadmapMilestone[];
  created_at: string;
  updated_at: string;
}

export interface LearningLog {
  id: string;
  roadmap_id: string;
  date: string;
  learned: string;
  solved_problem?: string;
  next_goal?: string;
  ai_feedback?: string;
  created_at: string;
}

export interface ProjectIdeaTask {
  id: string;
  title: string;
  priority: TaskPriority;
  done: boolean;
}

export interface ProjectIdea {
  id: string;
  workspace_id: string;
  title: string;
  stack: string;
  status: 'idea' | 'planning' | 'in_progress' | 'completed';
  description: string;
  tasks: ProjectIdeaTask[];
  created_at: string;
  updated_at: string;
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

export type ReminderStatus = 'pending' | 'triggered' | 'dismissed';
export type ReminderSourceType = 'task' | 'schedule' | 'voice' | 'custom' | 'calendar';

export interface ScheduledReminder {
  id: string;
  title: string;
  description: string;
  source_type: ReminderSourceType;
  source_id?: string | null;
  target_time: string; // ISO datetime string: "2026-10-15T10:00:00"
  time_string: string; // e.g. "10:00" or "Bugun, 10:00"
  cron_expression?: string | null; // e.g. "daily" or cron syntax
  status: ReminderStatus;
  sound_enabled?: boolean;
  created_at: string;
  triggered_at?: string | null;
}

export interface VoiceIntentResult {
  intent: 'reminder' | 'task' | 'note';
  title: string;
  description: string;
  timeString?: string;
  targetTime?: string; // ISO datetime
  isRecurring?: boolean;
  cronExpression?: string;
  priority?: TaskPriority;
  reasoning: string;
}


