use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create synapselog schema",
            sql: include_str!("./migrations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add second assignee columns for avatar stacks",
            sql: include_str!("./migrations2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create team_groups table and link tasks to groups",
            sql: include_str!("./migrations3.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add tags column for real tag system",
            sql: include_str!("./migrations4.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create notes, roadmaps, learning_logs and project_ideas tables",
            sql: include_str!("./migrations5.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add fts5 global search virtual table and triggers",
            sql: include_str!("./migrations6.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_count_and_order() {
        let migrations = get_migrations();
        assert_eq!(migrations.len(), 6);
        for (idx, m) in migrations.iter().enumerate() {
            assert_eq!(m.version as usize, idx + 1);
            assert!(!m.sql.trim().is_empty());
        }
    }
}
