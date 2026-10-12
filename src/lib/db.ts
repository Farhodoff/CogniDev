import Database from '@tauri-apps/plugin-sql';
import type { PromptEntry, Retrospective, Task, TaskResolution, Workspace, TeamGroup } from './types';
import {
  DEFAULT_CHECKLISTS,
  DEFAULT_GROUPS,
  DEFAULT_NOTES,
  DEFAULT_PERSONAL_WORKSPACE,
  DEFAULT_PROMPTS,
  DEFAULT_TASKS,
} from './seed';

const DB_URL = 'sqlite:synapse.db';

let dbPromise: Promise<Database> | null = null;

/** Lazily open (or reuse) the SQLite connection. In browser dev mode this throws — callers fall back to memory mode. */
export async function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_URL);
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
`;

/** Mirrors the Rust-side migrations:
 *  creates schema and ensures v2 and v3 columns exist. */
export async function migrate(): Promise<void> {
  const db = await getDb();
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt);
  }
  for (const col of ['assignee_name2 TEXT', 'assignee_avatar2 TEXT', 'group_id TEXT']) {
    try {
      await db.execute(`ALTER TABLE tasks ADD COLUMN ${col}`);
    } catch {
      /* column already exists on upgraded DBs */
    }
  }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

/** Ensure default personal workspace and initial engineering data exist. */
export async function ensureDefaultWorkspace(): Promise<void> {
  const db = await getDb();
  const count = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM workspaces');
  if ((count[0]?.c ?? 0) === 0) {
    await db.execute(
      'INSERT INTO workspaces (id, name, type) VALUES ($1,$2,$3)',
      [DEFAULT_PERSONAL_WORKSPACE.id, DEFAULT_PERSONAL_WORKSPACE.name, DEFAULT_PERSONAL_WORKSPACE.type],
    );
  }

  // Ensure default groups exist
  const grpCount = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM team_groups');
  if ((grpCount[0]?.c ?? 0) === 0) {
    for (const g of DEFAULT_GROUPS) {
      await insertGroup(g).catch(() => {});
    }
  }

  // If tasks count is 0 or only has broken tasks, seed sample engineering tasks
  const taskCount = await db.select<{ c: number }[]>("SELECT COUNT(*) as c FROM tasks WHERE title != '?'");
  if ((taskCount[0]?.c ?? 0) === 0) {
    await db.execute("DELETE FROM tasks WHERE title = '?' OR id = 'DEV-1'").catch(() => {});
    for (const t of DEFAULT_TASKS) {
      await insertTask(t).catch(() => {});
      const note = DEFAULT_NOTES[t.id] ?? '';
      const chk = JSON.stringify(DEFAULT_CHECKLISTS[t.id] ?? []);
      await upsertResolution(t.id, note, chk).catch(() => {});
    }
    for (const p of DEFAULT_PROMPTS) {
      await insertPrompt(p).catch(() => {});
    }
  }
}

/** Purge legacy mock/seed records if present from previous dev runs. */
export async function purgeMockDataIfPresent(): Promise<void> {
  const db = await getDb();
  const mockTasks = await db.select<{ id: string }[]>(
    "SELECT id FROM tasks WHERE id IN ('DEV-104', 'DEV-108', 'DEV-112', 'DEV-99', 'DEV-121', 'DEV-117', 'DEV-122', 'DEV-115')",
  );
  if (mockTasks.length > 0) {
    await db.execute(
      "DELETE FROM prompt_vault WHERE task_id IN ('DEV-104', 'DEV-108', 'DEV-112', 'DEV-99', 'DEV-121', 'DEV-117', 'DEV-122', 'DEV-115') OR id LIKE 'pv-%'",
    );
    await db.execute(
      "DELETE FROM task_resolutions WHERE task_id IN ('DEV-104', 'DEV-108', 'DEV-112', 'DEV-99', 'DEV-121', 'DEV-117', 'DEV-122', 'DEV-115')",
    );
    await db.execute(
      "DELETE FROM tasks WHERE id IN ('DEV-104', 'DEV-108', 'DEV-112', 'DEV-99', 'DEV-121', 'DEV-117', 'DEV-122', 'DEV-115')",
    );
    await db.execute("DELETE FROM workspaces WHERE id = 'ws-team'");
  }
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
  if (workspaceId) {
    return db.select<Task[]>('SELECT * FROM tasks WHERE workspace_id = $1 ORDER BY updated_at DESC', [workspaceId]);
  }
  return db.select<Task[]>('SELECT * FROM tasks ORDER BY updated_at DESC');
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
    `INSERT INTO tasks (id, workspace_id, group_id, title, status, priority, git_branch, pr_url, ai_source, assignee_name, assignee_avatar, assignee_name2, assignee_avatar2)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
    ],
  );
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
      "SELECT COUNT(*) as c FROM tasks WHERE LOWER(title) LIKE '%bug%' OR LOWER(title) LIKE '%fix%' OR LOWER(COALESCE(git_branch, '')) LIKE '%bug%' OR LOWER(COALESCE(git_branch, '')) LIKE '%fix%'",
    ),
    db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM tasks WHERE status = 'blocker' OR priority IN ('P0 Blocker', 'Critical')",
    ),
    db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM tasks WHERE LOWER(title) LIKE '%arch%' OR LOWER(title) LIKE '%refactor%' OR LOWER(title) LIKE '%design%' OR LOWER(COALESCE(git_branch, '')) LIKE '%arch%'",
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
