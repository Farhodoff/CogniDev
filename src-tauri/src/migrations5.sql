-- Notion-style Engineering Notes & Documentation
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

-- Tech Roadmaps (Backend, Stacks, Languages)
CREATE TABLE IF NOT EXISTS roadmaps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    stack TEXT NOT NULL,
    description TEXT DEFAULT '',
    stages_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Learning Logs (Checks & What was learned)
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

-- Project Ideas Incubator
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
