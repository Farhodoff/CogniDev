-- Create team groups table and link tasks to groups
CREATE TABLE IF NOT EXISTS team_groups (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#38bdf8',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

ALTER TABLE tasks ADD COLUMN group_id TEXT;
