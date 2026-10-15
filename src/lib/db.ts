import Database from '@tauri-apps/plugin-sql';
import type {
  PromptEntry,
  Retrospective,
  Task,
  TaskResolution,
  Workspace,
  TeamGroup,
  UserProfile,
  NoteDoc,
  RoadmapItem,
  LearningLog,
  ProjectIdea,
  ScheduledReminder,
} from './types';
import { isTauri } from './vault';
import {
  DEFAULT_PERSONAL_WORKSPACE,
} from './seed';

const DB_URL = 'sqlite:synapse.db';

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'current',
  full_name: 'Farhod',
  username: 'farhodoff',
  title: 'Senior Software Engineer',
  email: 'farhod@cognidev.local',
  github: 'Farhodoff',
  avatar_color: '#0284c7',
  avatar_initials: 'F',
  bio: 'Building local-first engineering command center and AI workflows.',
  role: 'Muhandis (Admin)',
  updated_at: new Date().toISOString(),
};

let dbPromise: Promise<Database> | null = null;

/** Lazily open (or reuse) the SQLite connection with timeout guard. */
export async function getDb(): Promise<Database> {
  if (!isTauri) {
    throw new Error('Not running in Tauri desktop environment');
  }
  if (!dbPromise) {
    dbPromise = Promise.race([
      Database.load(DB_URL),
      new Promise<Database>((_, reject) =>
        setTimeout(() => reject(new Error('SQLite Database.load timed out')), 2500),
      ),
    ]);
  }
  return dbPromise;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('personal', 'team')) DEFAULT 'personal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS team_groups (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#38bdf8',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY DEFAULT 'current',
    full_name TEXT NOT NULL DEFAULT 'Farhod',
    username TEXT NOT NULL DEFAULT 'farhodoff',
    title TEXT NOT NULL DEFAULT 'Senior Software Engineer',
    email TEXT DEFAULT 'farhod@cognidev.local',
    github TEXT DEFAULT 'Farhodoff',
    avatar_color TEXT DEFAULT '#0284c7',
    avatar_initials TEXT DEFAULT 'F',
    bio TEXT DEFAULT 'Building local-first engineering command center and AI workflows.',
    role TEXT DEFAULT 'Muhandis (Admin)',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    group_id TEXT,
    title TEXT NOT NULL,
    status TEXT CHECK(status IN ('backlog', 'active', 'in_review', 'completed', 'blocker')) DEFAULT 'active',
    priority TEXT CHECK(priority IN ('P0 Blocker', 'Critical', 'High Priority', 'Normal')) DEFAULT 'Normal',
    git_branch TEXT,
    pr_url TEXT,
    ai_source TEXT,
    assignee_name TEXT,
    assignee_avatar TEXT,
    assignee_name2 TEXT,
    assignee_avatar2 TEXT,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS task_resolutions (
    task_id TEXT PRIMARY KEY,
    markdown_note TEXT,
    checklist_json TEXT,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS prompt_vault (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    prompt_hash TEXT,
    raw_prompt TEXT NOT NULL,
    ai_response TEXT,
    model_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS retrospectives (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT CHECK(type IN ('standup', 'weekly_retro')),
    content TEXT NOT NULL,
    blockers_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-personal',
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    icon TEXT DEFAULT '📝',
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS roadmaps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    stack TEXT NOT NULL,
    description TEXT DEFAULT '',
    stages_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS learning_logs (
    id TEXT PRIMARY KEY,
    roadmap_id TEXT NOT NULL,
    date TEXT NOT NULL,
    learned TEXT NOT NULL,
    solved_problem TEXT DEFAULT '',
    next_goal TEXT DEFAULT '',
    ai_feedback TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS project_ideas (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-personal',
    title TEXT NOT NULL,
    stack TEXT NOT NULL,
    status TEXT CHECK(status IN ('idea', 'planning', 'in_progress', 'completed')) DEFAULT 'idea',
    description TEXT DEFAULT '',
    tasks_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    source_type TEXT DEFAULT 'voice',
    source_id TEXT,
    target_time TEXT NOT NULL,
    time_string TEXT NOT NULL,
    cron_expression TEXT,
    status TEXT DEFAULT 'pending',
    sound_enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    triggered_at DATETIME
);
`;

/** Mirrors the Rust-side migrations:
 *  creates schema and ensures v2, v3 and v4 columns exist. */
export async function migrate(): Promise<void> {
  const db = await getDb();
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt);
  }
  for (const col of [
    'assignee_name2 TEXT',
    'assignee_avatar2 TEXT',
    'group_id TEXT',
    "tags TEXT DEFAULT '[]'",
    'due_time TEXT',
    'reminder_enabled INTEGER DEFAULT 0',
  ]) {
    try {
      await db.execute(`ALTER TABLE tasks ADD COLUMN ${col}`);
    } catch {
      /* column already exists on upgraded DBs */
    }
  }
}

/** Parse the tags JSON column; tolerant to missing/legacy values. */
export function parseTagJson(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((t): t is string => typeof t === 'string');
  } catch {
    /* fall through */
  }
  return [];
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

/** Ensure the personal workspace row exists. No demo/mock data is ever seeded —
 *  from here on only the user's own saved data is shown. */
export async function ensureDefaultWorkspace(): Promise<void> {
  const db = await getDb();
  const count = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM workspaces');
  if ((count[0]?.c ?? 0) === 0) {
    await db.execute(
      'INSERT INTO workspaces (id, name, type) VALUES ($1,$2,$3)',
      [DEFAULT_PERSONAL_WORKSPACE.id, DEFAULT_PERSONAL_WORKSPACE.name, DEFAULT_PERSONAL_WORKSPACE.type],
    );
  }
}

/** One-time cleanup of legacy mock/seed records from previous dev runs.
 *  Only touches known seed IDs — user-created tasks are never affected. */
export async function purgeMockDataIfPresent(): Promise<void> {
  const db = await getDb();
  const legacyTasks = [
    'DEV-104', 'DEV-108', 'DEV-112', 'DEV-99', 'DEV-121', 'DEV-117', 'DEV-122', 'DEV-115',
    'TSK-101', 'TSK-102', 'TSK-103', 'task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6',
  ];
  const legacyNotes = ['n-1', 'n-2', 'n-3', 'n-4', 'n-5'];
  const legacyPrompts = ['pv-101', 'pv-102', 'pv-103'];
  const inList = (ids: string[]) => ids.map((id) => `'${id}'`).join(',');

  await db.execute(`DELETE FROM tasks WHERE id IN (${inList(legacyTasks)})`).catch(() => {});
  await db.execute(`DELETE FROM prompt_vault WHERE id IN (${inList(legacyPrompts)}) OR task_id IN (${inList(legacyTasks)})`).catch(() => {});
  await db.execute(`DELETE FROM task_resolutions WHERE task_id IN (${inList(legacyTasks)})`).catch(() => {});
  await db.execute(`DELETE FROM notion_notes WHERE id IN (${inList(legacyNotes)})`).catch(() => {});
  await db.execute("DELETE FROM workspaces WHERE id = 'ws-team'").catch(() => {});
}

/** Complete reset to pristine state. */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM prompt_vault');
  await db.execute('DELETE FROM task_resolutions');
  await db.execute('DELETE FROM retrospectives');
  await db.execute('DELETE FROM tasks');
  await db.execute('DELETE FROM workspaces');
  await ensureDefaultWorkspace();
}

// ── Queries ──────────────────────────────────────────────

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const db = await getDb();
  return db.select<Workspace[]>('SELECT * FROM workspaces ORDER BY created_at ASC');
}

export async function insertWorkspace(w: Workspace): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT INTO workspaces (id, name, type, created_at) VALUES ($1,$2,$3,$4)', [w.id, w.name, w.type, w.created_at]);
}

export async function deleteWorkspaceFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM tasks WHERE workspace_id = $1', [id]);
  await db.execute('DELETE FROM workspaces WHERE id = $1', [id]);
}

export async function fetchTasks(workspaceId?: string): Promise<Task[]> {
  const db = await getDb();
  type Row = Omit<Task, 'tags'> & { tags: unknown };
  const rows = workspaceId
    ? await db.select<Row[]>('SELECT * FROM tasks WHERE workspace_id = $1 ORDER BY updated_at DESC', [workspaceId])
    : await db.select<Row[]>('SELECT * FROM tasks ORDER BY updated_at DESC');
  return rows.map((r) => ({ ...r, tags: parseTagJson(r.tags) }));
}

export async function fetchResolution(taskId: string): Promise<TaskResolution | null> {
  const db = await getDb();
  const rows = await db.select<TaskResolution[]>('SELECT * FROM task_resolutions WHERE task_id = $1', [taskId]);
  return rows[0] ?? null;
}

export async function fetchPrompts(taskId: string): Promise<PromptEntry[]> {
  const db = await getDb();
  return db.select<PromptEntry[]>('SELECT * FROM prompt_vault WHERE task_id = $1 ORDER BY created_at ASC', [taskId]);
}

export async function insertTask(t: Omit<Task, 'created_at' | 'updated_at'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO tasks (id, workspace_id, group_id, title, status, priority, git_branch, pr_url, ai_source, assignee_name, assignee_avatar, assignee_name2, assignee_avatar2, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      t.id,
      t.workspace_id,
      t.group_id ?? null,
      t.title,
      t.status,
      t.priority,
      t.git_branch,
      t.pr_url,
      t.ai_source,
      t.assignee_name,
      t.assignee_avatar,
      t.assignee_name2 ?? null,
      t.assignee_avatar2 ?? null,
      JSON.stringify(t.tags ?? []),
    ],
  );
}

export async function updateTaskTags(id: string, tags: string[]): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET tags = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(tags), id]);
}

export async function updateTaskMeta(id: string, status: Task['status'], priority: Task['priority']): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET status = $1, priority = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [status, priority, id]);
}

export async function updateTaskGroup(id: string, groupId: string | null): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET group_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [groupId, id]);
}

export async function fetchGroups(workspaceId?: string): Promise<TeamGroup[]> {
  const db = await getDb();
  if (workspaceId) {
    return db.select<TeamGroup[]>('SELECT * FROM team_groups WHERE workspace_id = $1 ORDER BY created_at ASC', [workspaceId]);
  }
  return db.select<TeamGroup[]>('SELECT * FROM team_groups ORDER BY created_at ASC');
}

export async function insertGroup(g: TeamGroup): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT INTO team_groups (id, workspace_id, name, color, icon, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [
    g.id,
    g.workspace_id,
    g.name,
    g.color,
    g.icon ?? 'folder',
    g.created_at,
  ]);
}

export async function deleteGroupFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET group_id = NULL WHERE group_id = $1', [id]);
  await db.execute('DELETE FROM team_groups WHERE id = $1', [id]);
}

export async function deleteTaskFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM prompt_vault WHERE task_id = $1', [id]);
  await db.execute('DELETE FROM task_resolutions WHERE task_id = $1', [id]);
  await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
}

export async function fetchAllPrompts(): Promise<PromptEntry[]> {
  const db = await getDb();
  return db.select<PromptEntry[]>('SELECT * FROM prompt_vault ORDER BY created_at ASC');
}

export interface TagCounts {
  promptLibrary: number;
  bugFix: number;
  blocker: number;
  architecture: number;
}

export async function fetchTagCounts(): Promise<TagCounts> {
  const db = await getDb();
  const [promptsRes, bugRes, blockerRes, archRes] = await Promise.all([
    db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM prompt_vault'),
    db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM tasks WHERE LOWER(title) LIKE '%bug%' OR LOWER(title) LIKE '%fix%'",
    ),
    db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM tasks WHERE status = 'blocker' OR priority IN ('P0 Blocker', 'Critical')",
    ),
    db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM tasks WHERE LOWER(title) LIKE '%arch%' OR LOWER(title) LIKE '%refactor%' OR LOWER(title) LIKE '%design%'",
    ),
  ]);
  return {
    promptLibrary: promptsRes[0]?.c ?? 0,
    bugFix: bugRes[0]?.c ?? 0,
    blocker: blockerRes[0]?.c ?? 0,
    architecture: archRes[0]?.c ?? 0,
  };
}

// ── Vault export / import ────────────────────────────────

export interface VaultDump {
  version: 1;
  exportedAt: string;
  workspaces: Workspace[];
  tasks: Task[];
  resolutions: TaskResolution[];
  prompts: PromptEntry[];
  retrospectives: Retrospective[];
}

export async function dumpDatabase(): Promise<VaultDump> {
  const db = await getDb();
  const [workspaces, tasks, resolutions, prompts, retrospectives] = await Promise.all([
    db.select<Workspace[]>('SELECT * FROM workspaces'),
    db.select<Task[]>('SELECT * FROM tasks'),
    db.select<TaskResolution[]>('SELECT * FROM task_resolutions'),
    db.select<PromptEntry[]>('SELECT * FROM prompt_vault'),
    db.select<Retrospective[]>('SELECT * FROM retrospectives'),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), workspaces, tasks, resolutions, prompts, retrospectives };
}

export async function restoreDatabase(d: VaultDump): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM prompt_vault');
  await db.execute('DELETE FROM task_resolutions');
  await db.execute('DELETE FROM retrospectives');
  await db.execute('DELETE FROM tasks');
  await db.execute('DELETE FROM workspaces');
  for (const w of d.workspaces) {
    await db.execute('INSERT INTO workspaces (id, name, type, created_at) VALUES ($1,$2,$3,$4)', [w.id, w.name, w.type, w.created_at]);
  }
  for (const t of d.tasks) {
    await insertTask(t);
  }
  for (const r of d.resolutions) {
    await db.execute('INSERT INTO task_resolutions (task_id, markdown_note, checklist_json) VALUES ($1,$2,$3)', [r.task_id, r.markdown_note, r.checklist_json]);
  }
  for (const p of d.prompts) {
    await insertPrompt(p);
  }
  for (const r of d.retrospectives ?? []) {
    await db.execute('INSERT INTO retrospectives (id, date, type, content, blockers_summary, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [
      r.id, r.date, r.type, r.content, r.blockers_summary, r.created_at,
    ]);
  }
}

export async function upsertResolution(taskId: string, markdown: string, checklistJson: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO task_resolutions (task_id, markdown_note, checklist_json) VALUES ($1,$2,$3)
     ON CONFLICT(task_id) DO UPDATE SET markdown_note=excluded.markdown_note, checklist_json=excluded.checklist_json`,
    [taskId, markdown, checklistJson],
  );
}

export async function insertPrompt(p: Omit<PromptEntry, 'created_at'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO prompt_vault (id, task_id, prompt_hash, raw_prompt, ai_response, model_name) VALUES ($1,$2,$3,$4,$5,$6)',
    [p.id, p.task_id, p.prompt_hash, p.raw_prompt, p.ai_response, p.model_name],
  );
}

export async function saveRetrospective(date: string, type: 'standup' | 'weekly_retro', content: string, blockers: string): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT INTO retrospectives (id, date, type, content, blockers_summary) VALUES ($1,$2,$3,$4,$5)', [
    uid('retro'),
    date,
    type,
    content,
    blockers,
  ]);
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    const db = await getDb();
    const rows = await db.select<UserProfile[]>('SELECT * FROM user_profile WHERE id = $1', ['current']);
    if (rows && rows[0]) return rows[0];
    await upsertUserProfile(DEFAULT_USER_PROFILE);
    return DEFAULT_USER_PROFILE;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export async function upsertUserProfile(p: UserProfile): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO user_profile (id, full_name, username, title, email, github, avatar_color, avatar_initials, bio, role, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT(id) DO UPDATE SET
       full_name=excluded.full_name,
       username=excluded.username,
       title=excluded.title,
       email=excluded.email,
       github=excluded.github,
       avatar_color=excluded.avatar_color,
       avatar_initials=excluded.avatar_initials,
       bio=excluded.bio,
       role=excluded.role,
       updated_at=excluded.updated_at`,
    [
      'current',
      p.full_name,
      p.username,
      p.title,
      p.email,
      p.github,
      p.avatar_color,
      p.avatar_initials,
      p.bio,
      p.role,
      new Date().toISOString(),
    ],
  );
}

// ── Notion-style Engineering Notes ──────────────────────────────────────────

export async function fetchNotes(workspaceId: string): Promise<NoteDoc[]> {
  try {
    const db = await getDb();
    const rows = await db.select<Array<any>>(
      'SELECT * FROM notes WHERE workspace_id = $1 ORDER BY updated_at DESC',
      [workspaceId],
    );
    return (rows ?? []).map((r) => ({
      id: r.id,
      workspace_id: r.workspace_id,
      title: r.title,
      content: r.content,
      icon: r.icon || '📝',
      tags: parseTagJson(r.tags),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function upsertNote(note: NoteDoc): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO notes (id, workspace_id, title, content, icon, tags, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       content=excluded.content,
       icon=excluded.icon,
       tags=excluded.tags,
       updated_at=excluded.updated_at`,
    [
      note.id,
      note.workspace_id,
      note.title,
      note.content,
      note.icon,
      JSON.stringify(note.tags ?? []),
      note.created_at || new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
}

export async function deleteNoteFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM notes WHERE id = $1', [id]);
}

// ── Tech Roadmaps & Milestones ──────────────────────────────────────────────

export async function fetchRoadmaps(): Promise<RoadmapItem[]> {
  try {
    const db = await getDb();
    const rows = await db.select<Array<any>>('SELECT * FROM roadmaps ORDER BY created_at ASC');
    return (rows ?? []).map((r) => {
      let milestones = [];
      try {
        milestones = JSON.parse(r.stages_json);
      } catch {
        milestones = [];
      }
      return {
        id: r.id,
        title: r.title,
        stack: r.stack,
        description: r.description || '',
        milestones,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });
  } catch {
    return [];
  }
}

export async function upsertRoadmap(item: RoadmapItem): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO roadmaps (id, title, stack, description, stages_json, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       stack=excluded.stack,
       description=excluded.description,
       stages_json=excluded.stages_json,
       updated_at=excluded.updated_at`,
    [
      item.id,
      item.title,
      item.stack,
      item.description,
      JSON.stringify(item.milestones ?? []),
      item.created_at || new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
}

export async function deleteRoadmapFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM roadmaps WHERE id = $1', [id]);
}

// ── Daily Learning Logs ─────────────────────────────────────────────────────

export async function fetchLearningLogs(roadmapId?: string): Promise<LearningLog[]> {
  try {
    const db = await getDb();
    const query = roadmapId
      ? 'SELECT * FROM learning_logs WHERE roadmap_id = $1 ORDER BY created_at DESC LIMIT 50'
      : 'SELECT * FROM learning_logs ORDER BY created_at DESC LIMIT 50';
    const params = roadmapId ? [roadmapId] : [];
    const rows = await db.select<Array<any>>(query, params);
    return (rows ?? []).map((r) => ({
      id: r.id,
      roadmap_id: r.roadmap_id,
      date: r.date,
      learned: r.learned,
      solved_problem: r.solved_problem || '',
      next_goal: r.next_goal || '',
      ai_feedback: r.ai_feedback || '',
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function insertLearningLog(log: LearningLog): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO learning_logs (id, roadmap_id, date, learned, solved_problem, next_goal, ai_feedback, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      log.id,
      log.roadmap_id,
      log.date,
      log.learned,
      log.solved_problem || '',
      log.next_goal || '',
      log.ai_feedback || '',
      log.created_at || new Date().toISOString(),
    ],
  );
}

// ── Project Ideas Incubator ─────────────────────────────────────────────────

export async function fetchProjectIdeas(workspaceId: string): Promise<ProjectIdea[]> {
  try {
    const db = await getDb();
    const rows = await db.select<Array<any>>(
      'SELECT * FROM project_ideas WHERE workspace_id = $1 ORDER BY updated_at DESC',
      [workspaceId],
    );
    return (rows ?? []).map((r) => {
      let tasks = [];
      try {
        tasks = JSON.parse(r.tasks_json);
      } catch {
        tasks = [];
      }
      return {
        id: r.id,
        workspace_id: r.workspace_id,
        title: r.title,
        stack: r.stack,
        status: r.status,
        description: r.description || '',
        tasks,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });
  } catch {
    return [];
  }
}

export async function upsertProjectIdea(idea: ProjectIdea): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO project_ideas (id, workspace_id, title, stack, status, description, tasks_json, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       stack=excluded.stack,
       status=excluded.status,
       description=excluded.description,
       tasks_json=excluded.tasks_json,
       updated_at=excluded.updated_at`,
    [
      idea.id,
      idea.workspace_id,
      idea.title,
      idea.stack,
      idea.status,
      idea.description,
      JSON.stringify(idea.tasks ?? []),
      idea.created_at || new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
}

export async function deleteProjectIdeaFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM project_ideas WHERE id = $1', [id]);
}

export async function fetchReminders(): Promise<ScheduledReminder[]> {
  try {
    const db = await getDb();
    const rows = await db.select<Array<{
      id: string;
      title: string;
      description: string;
      source_type: string;
      source_id: string | null;
      target_time: string;
      time_string: string;
      cron_expression: string | null;
      status: string;
      sound_enabled: number;
      created_at: string;
      triggered_at: string | null;
    }>>('SELECT * FROM scheduled_reminders ORDER BY target_time ASC');

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      source_type: (r.source_type as any) || 'custom',
      source_id: r.source_id,
      target_time: r.target_time,
      time_string: r.time_string,
      cron_expression: r.cron_expression,
      status: (r.status as any) || 'pending',
      sound_enabled: r.sound_enabled === 1,
      created_at: r.created_at,
      triggered_at: r.triggered_at,
    }));
  } catch (err) {
    console.warn('[db.ts fetchReminders] error:', err);
    return [];
  }
}

export async function upsertReminder(r: ScheduledReminder): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO scheduled_reminders (id, title, description, source_type, source_id, target_time, time_string, cron_expression, status, sound_enabled, created_at, triggered_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       description=excluded.description,
       target_time=excluded.target_time,
       time_string=excluded.time_string,
       cron_expression=excluded.cron_expression,
       status=excluded.status,
       sound_enabled=excluded.sound_enabled,
       triggered_at=excluded.triggered_at`,
    [
      r.id,
      r.title,
      r.description || '',
      r.source_type,
      r.source_id ?? null,
      r.target_time,
      r.time_string,
      r.cron_expression ?? null,
      r.status,
      r.sound_enabled ? 1 : 0,
      r.created_at || new Date().toISOString(),
      r.triggered_at ?? null,
    ],
  );
}

export async function deleteReminderFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM scheduled_reminders WHERE id = $1', [id]);
}


