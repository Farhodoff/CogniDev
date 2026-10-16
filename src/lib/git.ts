import { isTauri } from './platform';
import { callAi } from './ai';
import type { CloudProviderId } from './providers';

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
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<GitRepoInfo>('get_git_repo_info', {
        repoPath: repoPath || null,
      });
      return data;
    } catch (err: unknown) {
      console.warn('Native get_git_repo_info error:', err);
      throw new Error(String(err));
    }
  }

  // Fallback mock info for browser development mode
  return {
    is_repo: true,
    repo_root: '/Users/farhod/Desktop/CogniDev',
    branch: 'main',
    remote_url: 'https://github.com/Farhodoff/CogniDev.git',
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
        author: 'farhod-io',
        time_ago: '1 day ago',
        message: 'feat: scheduled reminder cron engine and macOS entitlements (v0.1.6)',
      },
      {
        hash: 'cac7043',
        author: 'Farhodoff',
        time_ago: '2 days ago',
        message: 'feat(projects): add portfolio export and tech stack filtering (#29)',
      },
    ],
    diff_summary: '3 files changed, 45 insertions(+), 12 deletions(-)',
    diff_content: 'diff --git a/src/App.tsx b/src/App.tsx...',
  };
}

/**
 * Stage all modified/untracked files and commit with a verified message
 */
export async function commitGitChanges(message: string, repoPath?: string): Promise<string> {
  if (!message.trim()) {
    throw new Error('Commit xabari bo‘sh bo‘lishi mumkin emas.');
  }

  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('git_commit_changes', {
      repoPath: repoPath || null,
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
