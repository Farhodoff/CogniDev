-- Migration 6: SQLite FTS5 Full-Text Search across Tasks and Notes

CREATE VIRTUAL TABLE IF NOT EXISTS global_search USING fts5(
    item_id UNINDEXED,
    item_type UNINDEXED,
    title,
    content,
    tokenize = 'unicode61'
);

-- Backfill existing tasks and notes
INSERT INTO global_search (item_id, item_type, title, content)
SELECT id, 'task', title, coalesce(git_branch, '') || ' ' || coalesce(pr_url, '')
FROM tasks
WHERE id NOT IN (SELECT item_id FROM global_search WHERE item_type = 'task');

INSERT INTO global_search (item_id, item_type, title, content)
SELECT id, 'note', title, coalesce(content, '')
FROM notes
WHERE id NOT IN (SELECT item_id FROM global_search WHERE item_type = 'note');

-- Trigger for tasks
CREATE TRIGGER IF NOT EXISTS trg_tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO global_search (item_id, item_type, title, content)
    VALUES (new.id, 'task', new.title, coalesce(new.git_branch, '') || ' ' || coalesce(new.pr_url, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_ad AFTER DELETE ON tasks BEGIN
    DELETE FROM global_search WHERE item_id = old.id AND item_type = 'task';
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_au AFTER UPDATE ON tasks BEGIN
    DELETE FROM global_search WHERE item_id = old.id AND item_type = 'task';
    INSERT INTO global_search (item_id, item_type, title, content)
    VALUES (new.id, 'task', new.title, coalesce(new.git_branch, '') || ' ' || coalesce(new.pr_url, ''));
END;

-- Trigger for notes
CREATE TRIGGER IF NOT EXISTS trg_notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO global_search (item_id, item_type, title, content)
    VALUES (new.id, 'note', new.title, coalesce(new.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_ad AFTER DELETE ON notes BEGIN
    DELETE FROM global_search WHERE item_id = old.id AND item_type = 'note';
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_au AFTER UPDATE ON notes BEGIN
    DELETE FROM global_search WHERE item_id = old.id AND item_type = 'note';
    INSERT INTO global_search (item_id, item_type, title, content)
    VALUES (new.id, 'note', new.title, coalesce(new.content, ''));
END;

