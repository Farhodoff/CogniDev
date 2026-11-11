# 🦀 CogniDev Tauri v2 Architecture & Permission Model

## Core Principles
1. **Security & Capabilities:**
   - Tauri v2 adopts granular ACL capability files (`src-tauri/capabilities/default.json`).
   - Only explicitly allowed IPC commands can be invoked from the frontend webview.

2. **Domain Separation in Rust:**
   - `src-tauri/src/db.rs`: SQLite persistence, migrations, and FTS5 search.
   - `src-tauri/src/git.rs`: Local repository inspection and git commands.
   - `src-tauri/src/system.rs`: Desktop notifications, external URL openers.
   - `src-tauri/src/tray.rs`: macOS status bar icon and global hotkey listener.
