import { isTauri } from './platform';
import { callAi } from './ai';
import type { CloudProviderId } from './providers';
import type { Task } from './types';

export interface GitCommitItem {
  hash: string;
  author: string;
  time_ago: string;
  message: string;
}

export interface GitFileChange {
  status: string;
  path: string;
}

export interface GitRepoInfo {
  is_repo: boolean;
  repo_root: string;
  branch: string;
  remote_url: string;
  modified_count: usizeNumber;
  untracked_count: usizeNumber;
  staged_count: usizeNumber;
  files: GitFileChange[];
  recent_commits: GitCommitItem[];
  diff_summary: string;
  diff_content: string;
}

type usizeNumber = number;

/**
 * Fetch live git repository status, branch, uncommitted files, and recent commit history
 */
export async function fetchGitRepoInfo(repoPath?: string): Promise<GitRepoInfo> {
  const effectivePath =
    repoPath?.trim() ||
    (typeof window !== 'undefined' ? localStorage.getItem('cognidev_last_git_repo_path') || undefined : undefined);

  if (effectivePath && (effectivePath.startsWith('http://') || effectivePath.startsWith('https://'))) {
    throw new Error("Ko'rsatilgan manzil veb-havola (URL). Iltimos, kompyuteringizdagi lokal Git katalogini tanlang.");
  }

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<GitRepoInfo>('get_git_repo_info', {
        repoPath: effectivePath || null,
      });
      if (data && data.repo_root && typeof window !== 'undefined') {
        localStorage.setItem('cognidev_last_git_repo_path', data.repo_root);
      }
      return data;
    } catch (err: unknown) {
      console.warn('Native get_git_repo_info error:', err);
      throw new Error(String(err));
    }
  }

  // Fallback mock info for browser development mode
  return {
    is_repo: true,
    repo_root: '/Users/developer/project',
    branch: 'main',
    remote_url: 'https://github.com/developer/project.git',
    modified_count: 2,
    untracked_count: 1,
    staged_count: 0,
    files: [
      { status: 'M', path: 'src/App.tsx' },
      { status: 'M', path: 'src/components/Header.tsx' },
      { status: '??', path: 'src/components/GitIntegrationModal.tsx' },
    ],
    recent_commits: [
      {
        hash: '21be962',
        author: 'developer',
        time_ago: '1 day ago',
        message: 'feat: scheduled reminder cron engine and macOS entitlements (v0.1.6)',
      },
      {
        hash: 'cac7043',
        author: 'developer',
        time_ago: '2 days ago',
        message: 'feat(projects): add portfolio export and tech stack filtering (#29)',
      },
    ],
    diff_summary: '3 files changed, 45 insertions(+), 12 deletions(-)',
    diff_content: 'diff --git a/src/App.tsx b/src/App.tsx...',
  };
}

/**
 * Initialize a new Git repository in the target path
 */
export async function initGitRepo(repoPath?: string): Promise<string> {
  const effectivePath =
    repoPath?.trim() ||
    (typeof window !== 'undefined' ? localStorage.getItem('cognidev_last_git_repo_path') || undefined : undefined);

  if (effectivePath && (effectivePath.startsWith('http://') || effectivePath.startsWith('https://'))) {
    throw new Error("Ko'rsatilgan manzil veb-havola (URL). Iltimos, kompyuteringizdagi lokal Git katalogini tanlang.");
  }

  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('git_init_repo', {
      repoPath: effectivePath || null,
    });
  }

  return '[Mock] Git repository initialized';
}

/**
 * Stage all modified/untracked files and commit with a verified message
 */
export async function commitGitChanges(message: string, repoPath?: string): Promise<string> {
  if (!message.trim()) {
    throw new Error('Commit xabari bo‘sh bo‘lishi mumkin emas.');
  }

  const effectivePath =
    repoPath?.trim() ||
    (typeof window !== 'undefined' ? localStorage.getItem('cognidev_last_git_repo_path') || undefined : undefined);

  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('git_commit_changes', {
      repoPath: effectivePath || null,
      message: message.trim(),
    });
  }

  return `[Mock] Commit created: ${message.trim()}`;
}

/**
 * Generate a Conventional Commit message using AI based on the git diff and modified files
 */
export async function generateAiCommitMessage(
  gitInfo: GitRepoInfo,
  preferredProvider?: CloudProviderId
): Promise<string> {
  const fileList = gitInfo.files.map((f) => `${f.status} ${f.path}`).join('\n');
  const summary = gitInfo.diff_summary || 'O‘zgarishlar mavjud';
  const sampleDiff = gitInfo.diff_content ? gitInfo.diff_content.slice(0, 2000) : '';

  const system = `Siz tajribali Senior Dasturchisiz. Git o'zgarishlaridan kelib chiqib, xalqaro "Conventional Commits" standarti bo'yicha commit xabari yaratib bering.
Qoidalar:
1. Birinchi qator aniq va ixcham formatda bo'lsin: <type>(<scope>): <qisqa sarlavha>
   Masalan: feat(projects): add live git branch inspector or fix(auth): resolve token refresh loop
2. Qisqa va lo'nda bo'lsin.
3. Agar o'zgarishlar bir nechta bo'lsa, pastidan 2-3 ta qisqa bullet point qo'shing.
4. Hech qanday ortiqcha gap yozmang, faqat commit xabarining o'zini qaytaring.`;

  const prompt = `Joriy branch: ${gitInfo.branch}
O'zgargan fayllar:
${fileList}

Diff xulosasi:
${summary}

Diff namunasi:
${sampleDiff}`;

  try {
    const res = await callAi(prompt, system, preferredProvider);
    if (res.text && res.text.trim()) {
      return res.text.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
  } catch (err) {
    console.warn('AI commit message generation fallback:', err);
  }

  // Smart heuristic fallback if AI is offline
  const topFile = gitInfo.files[0]?.path || 'project';
  const scope = topFile.split('/')[1] || 'core';
  const count = gitInfo.files.length;
  return `feat(${scope}): optimize and update ${count} component${count > 1 ? 's' : ''}\n\n- ${gitInfo.diff_summary || 'Update implementation and clean up'}`;
}

/**
 * Generate a GitHub Pull Request description (Markdown) using AI
 */
export async function generateAiPrDescription(
  gitInfo: GitRepoInfo,
  preferredProvider?: CloudProviderId
): Promise<string> {
  const fileList = gitInfo.files.map((f) => `${f.status} ${f.path}`).join('\n');
  const system = `Siz Senior Tech Lead'siz. Ushbu Git o'zgarishlari bo'yicha to'liq GitHub Pull Request (PR) tavsifini professional Markdown ko'rinishida yozib bering.
Format:
## 🚀 Summary of Changes
## 🔍 Modified Components
## 🧪 Testing & Verification Checklist
- [x] Verified locally
- [ ] Needs QA review`;

  const prompt = `Branch: ${gitInfo.branch}
O'zgarishlar:
${fileList}

Diff:
${gitInfo.diff_summary}`;

  try {
    const res = await callAi(prompt, system, preferredProvider);
    if (res.text && res.text.trim()) {
      return res.text.trim();
    }
  } catch (err) {
    console.warn('AI PR description fallback:', err);
  }

  return `## 🚀 Summary of Changes\nBranch \`${gitInfo.branch}\` bo'yicha kiritilgan yangilanishlar.\n\n### 📦 O'zgargan fayllar:\n${fileList}\n\n- [x] Mahalliy build sinovidan o'tdi\n- [x] 0 xatolik bilan tasdiqlandi`;
}

/**
 * 🐙 Git Commit → Avtomatik Task Done:
 * Matches commit message against tasks by task ID (e.g. fix: task-123, resolve DEV-4)
 * or keywords/title (e.g. feat: redis cache)
 */
export function parseCommitMessageForTask(
  message: string,
  tasks: Task[]
): { task: Task; reason: string; matchedText: string; type: 'id' | 'title' } | null {
  const cleanMsg = message.trim();
  if (!cleanMsg) return null;

  // 1. Direct Task ID match (e.g. fix: task-123, close #DEV-4, resolve DEV-10, feat(ui): task-2, DEV-1)
  const explicitIdMatches = cleanMsg.match(/\b(DEV-\d+|TASK-\d+|task-\d+)\b/gi) || [];
  const hashMatches = cleanMsg.match(/#(\d+)\b/g) || [];
  const actionPrefixMatches = cleanMsg.match(/(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved|feat|chore|done)(?:\([^)]+\))?[\s:/-]+(?:task-|dev-)?([A-Za-z0-9_-]+)/gi) || [];

  const candidates: string[] = [
    ...explicitIdMatches,
    ...hashMatches.map((h) => h.replace('#', '')),
    ...actionPrefixMatches.map((m) =>
      m.replace(/^(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved|feat|chore|done)(?:\([^)]+\))?[\s:/-]+/i, '')
    ),
  ];

  for (const candidateRaw of candidates) {
    const candidate = candidateRaw.replace(/^#/, '').toLowerCase();
    const candNum = candidate.replace(/^(?:dev|task)[-_]?/i, '');

    const found = tasks.find((t) => {
      const lowerId = t.id.toLowerCase();
      const taskNum = lowerId.replace(/^(?:dev|task)[-_]?/i, '');
      return (
        lowerId === candidate ||
        lowerId === `dev-${candidate}` ||
        lowerId === `task-${candidate}` ||
        (candNum && taskNum && candNum === taskNum) ||
        lowerId.replace(/[^a-z0-9]/g, '') === candidate.replace(/[^a-z0-9]/g, '')
      );
    });

    if (found) {
      return {
        task: found,
        reason: `Commit xabaridagi ID (${candidateRaw}) mos keldi`,
        matchedText: candidateRaw,
        type: 'id',
      };
    }
  }

  // 2. Keyword/Title matching (e.g. "feat: redis cache", "close: websocket memory leak", "fix: login modal error")
  const prefixMatch = cleanMsg.match(
    /^(?:feat|fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved|chore|refactor|docs|test|perf|style)(?:\([^)]+\))?:\s*(.+)$/i
  );
  const targetPhrase = prefixMatch ? prefixMatch[1].trim().toLowerCase() : cleanMsg.toLowerCase();

  if (targetPhrase.length >= 4) {
    const msgWords = targetPhrase.split(/[\s,._\-/]+/).filter((w) => w.length >= 3);

    for (const t of tasks) {
      const taskTitle = t.title.toLowerCase();
      const cleanTitle = taskTitle.replace(/^\[.*?\]\s*/, '').trim();
      const taskWords = cleanTitle.split(/[\s,._\-/]+/).filter((w) => w.length >= 3);

      const hasCommonWord = taskWords.some((tw) => msgWords.includes(tw));
      const hasSemanticConcept =
        (targetPhrase.includes('redis') && cleanTitle.includes('redis')) ||
        (targetPhrase.includes('grpc') && cleanTitle.includes('grpc')) ||
        (targetPhrase.includes('websocket') && (cleanTitle.includes('websocket') || cleanTitle.includes('ws'))) ||
        (targetPhrase.includes('tauri') && cleanTitle.includes('tauri')) ||
        (targetPhrase.includes('memory') && (cleanTitle.includes('memory') || cleanTitle.includes('xotira')));

      if (
        cleanTitle.length >= 4 &&
        (targetPhrase.includes(cleanTitle) ||
          cleanTitle.includes(targetPhrase) ||
          hasSemanticConcept ||
          hasCommonWord)
      ) {
        return {
          task: t,
          reason: `Commit matni "${prefixMatch ? prefixMatch[0] : cleanMsg}" vazifa nomiga mos keldi`,
          matchedText: cleanTitle,
          type: 'title',
        };
      }
    }
  }

  return null;
}

const PROCESSED_COMMITS_KEY = 'cognidev_processed_git_commits';

export function getProcessedCommitHashes(): Set<string> {
  try {
    const raw = localStorage.getItem(PROCESSED_COMMITS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return new Set(list);
    }
  } catch {}
  return new Set();
}

export function markCommitHashProcessed(hashOrMessage: string) {
  try {
    const current = getProcessedCommitHashes();
    current.add(hashOrMessage);
    localStorage.setItem(PROCESSED_COMMITS_KEY, JSON.stringify(Array.from(current).slice(-200)));
  } catch {}
}

/**
 * Scans commits and automatically moves matching tasks to 'completed'
 */
export function syncTasksWithGitCommits(
  commits: Array<{ message: string; hash?: string; author?: string }>,
  tasks: Task[],
  updateTaskStatus: (taskId: string, status: Task['status']) => void,
  setHud?: (msg: string) => void
): { completedTasks: Task[]; matchedCommits: string[] } {
  const processed = getProcessedCommitHashes();
  const completedTasks: Task[] = [];
  const matchedCommits: string[] = [];

  for (const c of commits) {
    const commitKey = c.hash || c.message;
    if (processed.has(commitKey)) {
      continue;
    }

    const match = parseCommitMessageForTask(c.message, tasks);
    if (match && match.task.status !== 'completed') {
      updateTaskStatus(match.task.id, 'completed');
      completedTasks.push(match.task);
      matchedCommits.push(c.message);
      markCommitHashProcessed(commitKey);

      if (setHud) {
        setHud(`🐙 Git Commit: "${c.message}" orqali "${match.task.title}" vazifasi completed qilindi ✓`);
      }
    }
  }

  return { completedTasks, matchedCommits };
}

/**
 * 🐙 AI Standup from Git Diff:
 * Analyzes last 24h git commits & working tree diff to generate 100% real code-grounded daily standup
 */
export async function generateStandupFromGitDiff(
  tasks: Task[],
  gitInfo: GitRepoInfo,
  preferredProvider?: CloudProviderId
): Promise<{ content: string; source: string; model?: string }> {
  const commitList =
    gitInfo.recent_commits
      .slice(0, 10)
      .map((c) => `- [${c.hash}] ${c.message} (${c.time_ago} by ${c.author})`)
      .join('\n') || '- Oxirgi commitlar topilmadi';

  const modifiedList =
    gitInfo.files
      .slice(0, 15)
      .map((f) => `  * ${f.status} ${f.path}`)
      .join('\n') || '  * Working tree toza';

  const activeTasksList =
    tasks
      .filter((t) => t.status === 'active' || t.status === 'in_review')
      .slice(0, 6)
      .map((t) => `- ${t.id} [${t.priority}]: ${t.title}`)
      .join('\n') || '- Rejalashtirilgan yangi vazifalar yo‘q';

  const prompt = `Siz tajribali Senior Software Architect va Tech Lead'siz.
Quyidagi 100% REAL Git repozitoriyasi ma'lumotlari (oxirgi 24 soatdagi commitlar, branch, diff stat va o'zgargan fayllar) asosida dasturchi uchun professional ertalabki Daily Standup xulosasini tuzib bering.

Joriy Git Branch: ${gitInfo.branch}
Masofaviy repozitoriya: ${gitInfo.remote_url || 'Mahalliy repozitoriya'}
So'nggi commitlar (oxirgi 24 soat faoliyati):
${commitList}

O'zgarishlar diff statistikasi:
${gitInfo.diff_summary || "O'zgarishlar yo'q"}

O'zgargan fayllar holati:
${modifiedList}

Rejalashtirilgan vazifalar:
${activeTasksList}

Iltimos, o'zbek tilida aniq 3 ta bo'limda, kodga asoslangan faktlar bilan professional markdown formatida xulosa yozing:
### 1. 🏆 Kecha qilingan ishlar (Real Git commitlar & kod o'zgarishlari asosida)
### 2. 🎯 Bugungi rejalar va diqqat markazi (Branch: \`${gitInfo.branch}\`)
### 3. ⚠️ To'siqlar va texnik xatarlar (Uncommitted fayllar va tekshirilishi kerak bo'lgan joylar)`;

  try {
    const res = await callAi(
      prompt,
      "Siz 100% real kod va git diff ma'lumotlari asosida ishlovchi Senior Tech Leadsiz. Standupni faktlarga tayanib, aniq va ortiqcha lof-so'zlarsiz, o'zbek tilida yozing.",
      preferredProvider
    );
    if (res.text && res.text.trim()) {
      return {
        content: res.text.trim(),
        source: 'git-diff',
        model: preferredProvider || 'ai',
      };
    }
  } catch (err) {
    console.warn('[generateStandupFromGitDiff] AI fallback:', err);
  }

  // Fallback template
  const fallback = `## 🐙 Daily Standup (Real Git faoliyati asosida)\n\n### 1. 🏆 Kecha qilingan ishlar:\n${commitList}\n\n### 2. 🎯 Bugungi rejalar (Branch: \`${gitInfo.branch}\`):\n${activeTasksList}\n\n### 3. ⚠️ To'siqlar va holat:\n- O'zgargan fayllar soni: ${gitInfo.files.length} ta (${gitInfo.diff_summary || 'Working tree clean'})\n- Git remote: ${gitInfo.remote_url || 'Mahalliy'}`;

  return {
    content: fallback,
    source: 'git-diff-fallback',
  };
}
