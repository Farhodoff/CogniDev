-- Workspaces (Personal Vault vs Team Projects)
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('personal', 'team')) DEFAULT 'personal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Engineering Tasks / Stream Items
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT CHECK(status IN ('backlog', 'active', 'in_review', 'completed', 'blocker')) DEFAULT 'active',
    priority TEXT CHECK(priority IN ('P0 Blocker', 'Critical', 'High Priority', 'Normal')) DEFAULT 'Normal',
    git_branch TEXT,
    pr_url TEXT,
    ai_source TEXT,
    assignee_name TEXT,
    assignee_avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Task Resolution, Markdown Notes & Checklist
CREATE TABLE IF NOT EXISTS task_resolutions (
    task_id TEXT PRIMARY KEY,
    markdown_note TEXT,
    checklist_json TEXT,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- AI Prompt Vault & Raw AI Conversations
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

-- Daily Standups & Retrospectives
CREATE TABLE IF NOT EXISTS retrospectives (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT CHECK(type IN ('standup', 'weekly_retro')),
    content TEXT NOT NULL,
    blockers_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
