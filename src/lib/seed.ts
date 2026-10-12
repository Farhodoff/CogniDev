import type { ChecklistItem, PromptEntry, Task, TeamGroup, Workspace } from './types';

/** Default initial workspace for a clean production setup. */
export const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'ws-personal',
  name: 'Personal Dev Hub',
  type: 'personal',
  created_at: new Date().toISOString(),
};

export const DEFAULT_GROUPS: TeamGroup[] = [
  {
    id: 'grp-backend',
    workspace_id: 'ws-personal',
    name: 'Core Backend',
    color: '#38bdf8',
    icon: 'terminal',
    created_at: new Date().toISOString(),
  },
  {
    id: 'grp-ai',
    workspace_id: 'ws-personal',
    name: 'AI Engine Group',
    color: '#a855f7',
    icon: 'bot',
    created_at: new Date().toISOString(),
  },
  {
    id: 'grp-frontend',
    workspace_id: 'ws-personal',
    name: 'Frontend Platform',
    color: '#34d399',
    icon: 'layout',
    created_at: new Date().toISOString(),
  },
];

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'TSK-101',
    workspace_id: 'ws-personal',
    group_id: 'grp-backend',
    title: 'Check and fix SQLite WAL transaction lock concurrency',
    status: 'completed',
    priority: 'Critical',
    git_branch: 'feat/sqlite-wal',
    pr_url: 'PR #142 Merged',
    ai_source: 'Claude 3.5 Sonnet',
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['bugfix', 'database'],
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'TSK-102',
    workspace_id: 'ws-personal',
    group_id: 'grp-ai',
    title: 'Universal Multi-AI Ingest parser for Markdown code blocks',
    status: 'completed',
    priority: 'Normal',
    git_branch: 'feat/ai-ingest',
    pr_url: 'PR #1 Merged',
    ai_source: 'Gemini 1.5 Pro',
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['ai-synced', 'frontend'],
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'TSK-103',
    workspace_id: 'ws-personal',
    group_id: 'grp-frontend',
    title: 'macOS Spotlight HUD (⌘K) quick capture floating overlay',
    status: 'active',
    priority: 'High Priority',
    git_branch: 'feat/spotlight-hud',
    pr_url: 'PR #4 Merged',
    ai_source: 'ChatGPT (GPT-4o)',
    assignee_name: 'Farhod',
    assignee_avatar: 'F',
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['frontend', 'spotlight'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_NOTES: Record<string, string> = {
  'TSK-101': `# SQLite WAL Concurrency & Lock Fix

> **AI Modeli:** Claude 3.5 Sonnet
> **Holat:** Muammo yechildi va testlardan o'tdi

## Muammo Ta'rifi
Yuqori asinxron yuklamada SQLite "database is locked (code 5)" xatoligi yuz berayotgan edi. Buning sababi odatiy rollback journal rejimida bir vaqtning o'zida bir nechta yozish operatsiyalari lock hosil qilgani bo'ldi.

## Yechim Kodi (Rust)
\`\`\`rust
use r2d2_sqlite::SqliteConnectionManager;

// Configure SQLite connection pool with WAL mode and busy timeout
let manager = SqliteConnectionManager::file("synapse.db")
    .with_init(|conn| {
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
        ")
    });
\`\`\`

## Asosiy Bilimlar & Xulosalar
- WAL (Write-Ahead Logging) rejimi o'quvchi va yozuvchi jarayonlar bir-birini bloklamasligini ta'minlaydi.
- \`busy_timeout = 5000ms\` kutish vaqti lock xatoliklarini 99.8% ga kamaytiradi.
- Tauri asinxron buyruqlari Tokio \`spawn_blocking\` orqali UI threadidan ajratilishi lozim.`,

  'TSK-102': `# Universal Multi-AI Ingestion Parser

> **AI Modeli:** Gemini 1.5 Pro

## Muammo
Claude, Gemini, ChatGPT va Ollama'dan olingan turli formatdagi javoblarni avtomatik tarzda tahlil qilib, kod fragmentlari va bilim xulosalarini ajratib olish zarur edi.

## Yechim Kodi (TypeScript)
\`\`\`typescript
export function parseRawAiConversation(text: string): ParsedAiIngestion {
  const codeRegex = /\`\`\`(?:[a-z0-9_-]+)?\\n([\\s\\S]*?)\`\`\`/i;
  const match = text.match(codeRegex);
  return {
    title: extractTitle(text),
    solutionSnippet: match ? match[0] : '',
    keyLearnings: extractBullets(text),
    detectedModel: detectModelHeuristic(text),
  };
}
\`\`\`

## Asosiy Bilimlar
- LLM kod bloklari \`\`\`tag ... \`\`\` formatida keladi.
- Bullet pointlar orqali asosiy bilimlar regex bilan ajratiladi.`,

  'TSK-103': `# macOS Spotlight HUD Arxitekturasi

> **AI Modeli:** ChatGPT (GPT-4o)

## Maqsad
Dasturchi boshqa dasturlardan (VS Code, Chrome) chalg'imasdan turib, \`⌘K\` orqali istalgan soniyada vazifa yoki AI xulosasini tezkor saqlashi mumkin bo'lgan Spotlight oynasini yaratish.

## Yechim Kodi (React 19)
\`\`\`tsx
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setSpotlight(true);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, []);
\`\`\``,
};

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'TSK-101': [
    { id: 'chk-101-1', text: 'WAL rejimini faollashtirish (PRAGMA journal_mode = WAL)', done: true },
    { id: 'chk-101-2', text: 'busy_timeout parametrini 5000ms qilib sozlash', done: true },
    { id: 'chk-101-3', text: 'Stress testda parallel 50 ta tranzaksiyani tekshirish', done: true },
  ],
  'TSK-102': [
    { id: 'chk-102-1', text: 'Regex asosida ko\'p qatorli kod bloklarini ajratish', done: true },
    { id: 'chk-102-2', text: 'Model nomini avtomatik aniqlash (Claude, Gemini, ChatGPT)', done: true },
  ],
  'TSK-103': [
    { id: 'chk-103-1', text: '⌘K global keybinding listenerini qo\'shish', done: true },
    { id: 'chk-103-2', text: 'Git commitlarni tekshirish va vazifaga aylantirish integratsiyasi', done: false },
  ],
};

export const DEFAULT_PROMPTS: PromptEntry[] = [
  {
    id: 'pv-101',
    task_id: 'TSK-101',
    prompt_hash: '#e4f2a',
    raw_prompt: 'How do I prevent "database is locked" errors in SQLite with multiple concurrent Tauri Rust threads?',
    ai_response: 'Enable WAL mode and configure a busy timeout of at least 5000ms. Also set synchronous to NORMAL for improved write performance without losing crash safety.',
    model_name: 'Claude 3.5 Sonnet',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'pv-102',
    task_id: 'TSK-102',
    prompt_hash: '#b8c19',
    raw_prompt: 'Write a robust parser in TypeScript that extracts markdown code blocks, key learnings, and summary from chat logs.',
    ai_response: 'Here is a lightweight parser that handles code blocks, markdown headings, and bullet points safely without heavy external AST dependencies.',
    model_name: 'Gemini 1.5 Pro',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'pv-103',
    task_id: 'TSK-103',
    prompt_hash: '#7a31d',
    raw_prompt: 'Design a Raycast-like floating spotlight HUD for macOS Tauri desktop application.',
    ai_response: 'Use a centered modal with backdrop blur, keyboard navigation for search results, and 1-click capture actions.',
    model_name: 'ChatGPT (GPT-4o)',
    created_at: new Date().toISOString(),
  },
];
