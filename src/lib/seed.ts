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
  HabitItem,
} from './types';

/** Default initial workspace for CogniDev */
export const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'ws-personal',
  name: 'Personal Dev Hub',
  type: 'personal',
  created_at: new Date().toISOString(),
};

export const DEFAULT_GROUPS: TeamGroup[] = [];

export const DEFAULT_SPACES: SpaceItem[] = [
  { id: 'sp-personal', name: 'Personal', icon: 'User', color: '#ef4444' },
  { id: 'sp-uni', name: 'Education & Study', icon: 'GraduationCap', color: '#3b82f6' },
  { id: 'sp-work', name: 'Work / Backend', icon: 'Briefcase', color: '#f59e0b' },
  { id: 'sp-japan', name: 'Languages', icon: 'Languages', color: '#f43f5e' },
  { id: 'sp-ai', name: 'AI & ML', icon: 'Brain', color: '#8b5cf6' },
  { id: 'sp-health', name: 'Health & Sport', icon: 'Activity', color: '#10b981' },
  { id: 'sp-finance', name: 'Finance', icon: 'TrendingUp', color: '#eab308' },
  { id: 'sp-travel', name: 'Travel & Lifestyle', icon: 'Plane', color: '#06b6d4' },
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
    title: 'Language Learning App',
    subtitle: 'Interactive conversational shadowing and spaced-repetition platform',
    progress: 65,
    category: 'Fullstack Web',
    color: '#ec4899',
    status: 'in_progress',
    github_url: '',
    tags: ['Next.js', 'TypeScript', 'WebAudio'],
  },
  {
    id: 'proj-portfolio',
    title: 'Developer Portfolio',
    subtitle: 'Modern software engineer portfolio with live project showcases',
    progress: 90,
    category: 'Frontend & Portfolio',
    color: '#10b981',
    status: 'active',
    github_url: '',
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
    github_url: '',
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

export const DEFAULT_HABITS: HabitItem[] = [
  {
    id: 'h-deepwork',
    title: 'Deep Work & Kod Yozish (2 soat)',
    description: 'Chalg‘ituvchi omillarsiz arxitektura va kod ustida diqqatni jamlash',
    category: 'code',
    color: '#3b82f6',
    icon: 'Code',
    target_days_per_week: 6,
    streak: 5,
    best_streak: 14,
    history: {},
    created_at: new Date().toISOString(),
  },
  {
    id: 'h-docs',
    title: 'Texnik Kitob / Hujjat O‘qish (30 daqiqa)',
    description: 'Tizim dizayni, yangi til yoki dasturlash arxitekturasi tahlili',
    category: 'study',
    color: '#8b5cf6',
    icon: 'BookOpen',
    target_days_per_week: 5,
    streak: 4,
    best_streak: 10,
    history: {},
    created_at: new Date().toISOString(),
  },
  {
    id: 'h-sport',
    title: 'Sport & Jismoniy Mashq (45 daqiqa)',
    description: 'Sog‘lom tana va tetik aql uchun kardio yoki sport zali',
    category: 'health',
    color: '#10b981',
    icon: 'Activity',
    target_days_per_week: 4,
    streak: 3,
    best_streak: 8,
    history: {},
    created_at: new Date().toISOString(),
  },
  {
    id: 'h-plan',
    title: 'Kunlik Standup & Rejani Belash',
    description: 'Vazifalar, bloklar va maqsadlarni taqvimda ertalab belgilab olish',
    category: 'productivity',
    color: '#f59e0b',
    icon: 'CheckSquare',
    target_days_per_week: 7,
    streak: 7,
    best_streak: 21,
    history: {},
    created_at: new Date().toISOString(),
  },
  {
    id: 'h-lang',
    title: 'Chet Tili / Lug‘at Mashqi (20 daqiqa)',
    description: 'Xorijiy til lug‘ati, listening yoki speaking shadowing',
    category: 'study',
    color: '#ec4899',
    icon: 'Languages',
    target_days_per_week: 5,
    streak: 2,
    best_streak: 9,
    history: {},
    created_at: new Date().toISOString(),
  },
];
