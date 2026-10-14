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

export const DEFAULT_ACTIVE_PROJECTS: ActiveProject[] = [
  {
    id: 'proj-cognidev',
    title: 'CogniDev Desktop',
    subtitle: 'Tauri v2 + React 19 + Rust Dev Cockpit with AI Mentorship',
    progress: 85,
    category: 'Desktop App',
    color: '#3b82f6',
    status: 'active',
    github_url: 'https://github.com/Farhodoff/CogniDev',
    tags: ['Tauri', 'React', 'Rust', 'TypeScript'],
  },
  {
    id: 'proj-nihongo',
    title: 'Nihongo Talk',
    subtitle: 'Japanese Interactive Conversational & Shadowing App',
    progress: 65,
    category: 'Fullstack Web',
    color: '#ec4899',
    status: 'in_progress',
    github_url: 'https://github.com/Farhodoff/nihongo-talk',
    tags: ['Next.js', 'TypeScript', 'WebAudio'],
  },
  {
    id: 'proj-portfolio',
    title: 'Portfolio & Tech Blog',
    subtitle: 'Modern software engineer portfolio with live project showcases',
    progress: 90,
    category: 'Frontend & Portfolio',
    color: '#10b981',
    status: 'active',
    github_url: 'https://github.com/Farhodoff/portfolioo',
    tags: ['React', 'Vite', 'TailwindCSS'],
  },
  {
    id: 'proj-tunnel',
    title: 'Cloud Tunnel CLI',
    subtitle: 'Secure reverse proxy and local port forwarding tunnel service',
    progress: 40,
    category: 'Systems & Networking',
    color: '#8b5cf6',
    status: 'in_progress',
    github_url: 'https://github.com/Farhodoff/tunnel',
    tags: ['Go', 'Networking', 'CLI', 'Docker'],
  },
];

export const DEFAULT_TASKS: Task[] = [];

export const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [];

export const DEFAULT_NOTION_NOTES: NoteDoc[] = [];

export const DEFAULT_ROADMAPS: RoadmapItem[] = [];

export const DEFAULT_PROJECT_IDEAS: ProjectIdea[] = [];

export const DEFAULT_NOTES: Record<string, string> = {};

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {};

export const DEFAULT_PROMPTS: PromptEntry[] = [];
