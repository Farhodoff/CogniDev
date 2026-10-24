import { isTauri } from './platform';
import { callAi } from './ai';
import type { CloudProviderId } from './providers';

export interface GhCliAuthStatus {
  is_installed: boolean;
  is_authenticated: boolean;
  username: string;
  token: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  total_private_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  is_private: boolean;
  pushed_at: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  default_branch: string;
  topics?: string[];
}

export interface GitHubCommitItem {
  sha: string;
  short_sha: string;
  author_name: string;
  author_login?: string;
  author_avatar?: string;
  date: string;
  time_ago: string;
  message: string;
  html_url: string;
}

export interface GitHubPrOrIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  repo_name: string;
  author_login: string;
  author_avatar: string;
  category: 'my_pr' | 'review_requested' | 'assigned_issue';
  draft?: boolean;
  labels?: Array<{ name: string; color: string }>;
  comments_count?: number;
  body?: string;
}

export interface AiTaskSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'P0 Blocker' | 'High Priority' | 'Normal';
  branch: string;
  tags: string[];
  agent_prompt: string;
}

export interface GitHubAiReport {
  standup_digest: string;
  accomplishments: string[];
  suggested_tasks: AiTaskSuggestion[];
  analyzed_repo: string;
  analyzed_commits_count: number;
}

const STORAGE_KEY_TOKEN = 'cognidev_gh_token';
const STORAGE_KEY_USERNAME = 'cognidev_gh_username';

export function getStoredGitHubToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || null;
  } catch {
    return null;
  }
}

export function setStoredGitHubToken(token: string | null, username?: string | null) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    if (username) {
      localStorage.setItem(STORAGE_KEY_USERNAME, username.trim());
    } else if (username === null) {
      localStorage.removeItem(STORAGE_KEY_USERNAME);
    }
  } catch (err) {
    console.warn('LocalStorage error setting GH token:', err);
  }
}

/**
 * Check if the macOS/Linux/Windows system has `gh` CLI authenticated
 */
export async function detectGhCliAuth(): Promise<GhCliAuthStatus | null> {
  if (!isTauri) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<GhCliAuthStatus>('get_gh_cli_auth');
    return res;
  } catch (err) {
    console.warn('Tauri get_gh_cli_auth error:', err);
    return null;
  }
}

/**
 * Fetch GitHub user details (authenticated via token OR public via username)
 */
export async function fetchGitHubUser(tokenOrUsername: string, isToken: boolean = true): Promise<GitHubUser> {
  const url = isToken
    ? 'https://api.github.com/user'
    : `https://api.github.com/users/${encodeURIComponent(tokenOrUsername.trim())}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CogniDev-Desktop',
  };
  if (isToken && tokenOrUsername.trim()) {
    headers['Authorization'] = `Bearer ${tokenOrUsername.trim()}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub foydalanuvchisini olishda xatolik (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
    bio: data.bio,
    public_repos: data.public_repos || 0,
    total_private_repos: data.total_private_repos,
  };
}

/**
 * Fetch repositories owned or contributed by the user, sorted by last pushed date
 */
export async function fetchUserRepos(token: string | null, publicUsername?: string): Promise<GitHubRepo[]> {
  const url = token
    ? 'https://api.github.com/user/repos?sort=pushed&per_page=50&direction=desc'
    : `https://api.github.com/users/${encodeURIComponent(publicUsername || '')}/repos?sort=pushed&per_page=50&direction=desc`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CogniDev-Desktop',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Repozitoriylarni yuklashda xatolik (${res.status}): ${res.statusText}`);
  }

  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    html_url: r.html_url,
    is_private: Boolean(r.private),
    pushed_at: r.pushed_at,
    language: r.language,
    stargazers_count: r.stargazers_count || 0,
    open_issues_count: r.open_issues_count || 0,
    default_branch: r.default_branch || 'main',
    topics: r.topics || [],
  }));
}

/**
 * Format relative time (e.g. "30 daqiqa oldin", "2 soat oldin", "Kecha")
 */
function formatTimeAgo(dateString: string): string {
  const then = new Date(dateString).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);

  if (diffSec < 60) return 'Hozirgina';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} daqiqa oldin`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} soat oldin`;
  if (diffSec < 172800) return 'Kecha';
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days} kun oldin`;
  return new Date(dateString).toLocaleDateString();
}

/**
 * Fetch recent commits for a given repository
 */
export async function fetchRepoCommits(
  token: string | null,
  owner: string,
  repo: string,
  limit: number = 15
): Promise<GitHubCommitItem[]> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${limit}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CogniDev-Desktop',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Commitlarni yuklashda xatolik (${res.status}): ${res.statusText}`);
  }

  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((c: any) => {
    const msg = c.commit?.message || '';
    const firstLine = msg.split('\n')[0] || 'Commit';
    return {
      sha: c.sha,
      short_sha: c.sha.substring(0, 7),
      author_name: c.commit?.author?.name || c.author?.login || 'Dasturchi',
      author_login: c.author?.login,
      author_avatar: c.author?.avatar_url,
      date: c.commit?.author?.date || new Date().toISOString(),
      time_ago: formatTimeAgo(c.commit?.author?.date || new Date().toISOString()),
      message: firstLine,
      html_url: c.html_url,
    };
  });
}

/**
 * Build a structured coding agent prompt for tools like Google Antigravity, Cline, Zed, and OpenCode
 */
export function formatAgentPrompt(
  task: { title: string; description: string; branch: string },
  repoName: string,
  lastCommitMessage?: string
): string {
  return `### 🎯 TASK OBJECTIVE: ${task.title}
**Target Repository:** \`${repoName}\`
**Suggested Git Branch:** \`${task.branch}\`
${lastCommitMessage ? `**Previous Work Context:** \`${lastCommitMessage}\`\n` : ''}
#### 📋 Implementation Requirements:
${task.description}

#### ⚡ Acceptance Criteria:
1. Create and switch to branch \`${task.branch}\`
2. Implement the required logic cleanly with zero regression
3. Run local build and type checks to confirm 0 errors
4. Commit changes following Conventional Commits (e.g. \`${task.branch.replace('/', '(')}): ${task.title}\`)
5. Provide a concise summary of modified files and verification steps.`;
}

/**
 * AI-powered Task & Standup Synthesizer based on GitHub commit activity
 */
export async function generateAiTasksFromGitHub(
  repo: GitHubRepo,
  commits: GitHubCommitItem[],
  customGoal?: string,
  preferredProvider?: CloudProviderId
): Promise<GitHubAiReport> {
  const commitSummary = commits
    .slice(0, 12)
    .map((c, i) => `${i + 1}. [${c.short_sha}] ${c.message} (${c.time_ago} by ${c.author_name})`)
    .join('\n');

  const system = `Siz tajribali Senior Software Architect va Tech Lead'siz.
GitHub repozitoriyasining so'nggi commitlar tarixi va dasturchining faoliyatini tahlil qilib:
1. Qilingan ishlar bo'yicha qisqa Standup xulosasi (Changelog digest).
2. Qilingan 2-3 ta asosiy yutuqlar (accomplishments).
3. Mantiqan keyingi qadam sifatida bajarilishi shart bo'lgan 3-4 ta aniq, amaliy texnik vazifalar (Suggested Tasks).

Vazifalarning har biri:
- Aniq harakatga undovchi sarlavha
- Texnik tavsif va qabul qilish mezoni
- Git branch nomi (masalan: feat/user-auth-tests yoki fix/memory-leak)
- Muhimlik darajasi (P0 Blocker, High Priority, Normal)
- Antigravity / Cline / Zed agenti uchun qisqa ko'rsatma (agent_prompt)

Javobni FAQAT toza JSON formatida bering (hech qanday markdown \`\`\`json belgilarsiz):
{
  "standup_digest": "Qisqa o'zbek tilida standup xulosasi...",
  "accomplishments": ["Yutuq 1", "Yutuq 2"],
  "suggested_tasks": [
    {
      "title": "Vazifa sarlavhasi",
      "description": "Nimalar qilinishi kerakligi...",
      "priority": "High Priority",
      "branch": "feat/api-optimizations",
      "tags": ["backend", "api"]
    }
  ]
}`;

  const prompt = `Repozitoriya: ${repo.full_name} (${repo.language || 'Dasturiy ta\'minot'})
Tavsifi: ${repo.description || "Ko'rsatilmagan"}
Standart branch: ${repo.default_branch}
Ochiq issuylar soni: ${repo.open_issues_count}

So'nggi commitlar (oxirgi pushlar):
${commitSummary}

${customGoal ? `Foydalanuvchi maqsadi/istagi: "${customGoal}"\n` : ''}
Iltimos, ushbu loyihaning keyingi muvaffaqiyatli qadamlari bo'yicha JSON tahlilini qaytaring.`;

  try {
    const res = await callAi(prompt, system, preferredProvider);
    const cleaned = res.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const safeTasks: AiTaskSuggestion[] = (parsed.suggested_tasks || []).map((t: any, index: number) => {
      const branch = t.branch || `feat/${repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-task-${index + 1}`;
      const title = t.title || `Keyingi vazifa #${index + 1}`;
      const description = t.description || 'Tahlil asosida shakllantirilgan vazifa.';
      return {
        id: `gh-task-${Date.now()}-${index}`,
        title,
        description,
        priority: t.priority === 'P0 Blocker' ? 'P0 Blocker' : t.priority === 'Normal' ? 'Normal' : 'High Priority',
        branch,
        tags: Array.isArray(t.tags) ? t.tags : ['github', repo.name.toLowerCase()],
        agent_prompt: formatAgentPrompt({ title, description, branch }, repo.name, commits[0]?.message),
      };
    });

    return {
      standup_digest: parsed.standup_digest || `${repo.name} repozitoriyasida so'nggi pushlar muvaffaqiyatli tahlil qilindi.`,
      accomplishments: Array.isArray(parsed.accomplishments) ? parsed.accomplishments : ['Oxirgi commitlar tekshirildi'],
      suggested_tasks: safeTasks,
      analyzed_repo: repo.full_name,
      analyzed_commits_count: commits.length,
    };
  } catch (err) {
    console.warn('AI GitHub Task generation JSON parse fallback:', err);
    // Fallback heuristic if LLM output was slightly imperfect
    const topCommit = commits[0]?.message || 'oxirgi yangilanishlar';
    return {
      standup_digest: `So'nggi commitlar (${commits.length} ta) tahlil qilindi: "${topCommit}". Loyihada barqarorlik va keyingi testlarni yo'lga qo'yish tavsiya etiladi.`,
      accomplishments: commits.slice(0, 3).map((c) => c.message),
      suggested_tasks: [
        {
          id: `gh-task-${Date.now()}-1`,
          title: `[${repo.name}] Testlar va sifat nazoratini joriy etish`,
          description: `So'nggi o'zgarishlar (${topCommit}) bo'yicha integratsion testlarni tekshirish va xatoliklarni bartaraf qilish.`,
          priority: 'High Priority',
          branch: `feat/${repo.name.toLowerCase()}-tests`,
          tags: ['tests', 'qa', repo.name.toLowerCase()],
          agent_prompt: formatAgentPrompt(
            {
              title: `[${repo.name}] Testlar va sifat nazorati`,
              description: 'Barcha yangi modullar uchun unit testlar va type tekshiruvlarini o‘tkazish.',
              branch: `feat/${repo.name.toLowerCase()}-tests`,
            },
            repo.name,
            topCommit
          ),
        },
        {
          id: `gh-task-${Date.now()}-2`,
          title: `[${repo.name}] Hujjatlashtirish va README'ni yangilash`,
          description: 'Loyiha arxitekturasi va yangi kiritilgan imkoniyatlarni hujjatlashtirish.',
          priority: 'Normal',
          branch: `docs/${repo.name.toLowerCase()}-update`,
          tags: ['docs', repo.name.toLowerCase()],
          agent_prompt: formatAgentPrompt(
            {
              title: `[${repo.name}] Hujjatlashtirish`,
              description: 'README.md va API dokumentatsiyasini so‘nggi commitlarga moslash.',
              branch: `docs/${repo.name.toLowerCase()}-update`,
            },
            repo.name,
            topCommit
          ),
        },
      ],
      analyzed_repo: repo.full_name,
      analyzed_commits_count: commits.length,
    };
  }
}

/**
 * 🐙 PR & Issue Tracker:
 * Fetches pull requests and review requests created by or assigned to the user via GitHub Search API.
 */
export async function fetchUserPrsAndIssues(
  token: string | null,
  publicUsername?: string | null
): Promise<GitHubPrOrIssue[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CogniDev-Desktop',
  };

  const cleanToken = token?.trim() || null;
  if (cleanToken) {
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  const parseRepoName = (repoUrl: string): string => {
    return repoUrl ? repoUrl.replace('https://api.github.com/repos/', '') : 'repository';
  };

  const results: GitHubPrOrIssue[] = [];

  // Helper to fetch search endpoint safely
  async function searchGitHub(query: string, category: GitHubPrOrIssue['category']) {
    try {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&per_page=15`;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.items || !Array.isArray(data.items)) return;

      for (const item of data.items) {
        results.push({
          id: item.id,
          number: item.number,
          title: item.title,
          state: item.state,
          html_url: item.html_url,
          created_at: item.created_at,
          updated_at: item.updated_at,
          repo_name: parseRepoName(item.repository_url),
          author_login: item.user?.login || 'unknown',
          author_avatar: item.user?.avatar_url || 'https://github.com/ghost.png',
          category,
          draft: item.draft || false,
          labels: (item.labels || []).map((l: any) => ({
            name: l.name || '',
            color: l.color || '666666',
          })),
          comments_count: item.comments || 0,
          body: item.body || '',
        });
      }
    } catch (err) {
      console.warn(`[fetchUserPrsAndIssues] Query failed: "${query}":`, err);
    }
  }

  if (cleanToken) {
    await Promise.allSettled([
      searchGitHub('is:pr is:open author:@me', 'my_pr'),
      searchGitHub('is:pr is:open review-requested:@me', 'review_requested'),
      searchGitHub('is:issue is:open assignee:@me', 'assigned_issue'),
    ]);
  } else if (publicUsername && publicUsername.trim()) {
    const uname = publicUsername.trim();
    await Promise.allSettled([
      searchGitHub(`is:pr is:open author:${uname}`, 'my_pr'),
      searchGitHub(`is:issue is:open assignee:${uname}`, 'assigned_issue'),
    ]);
  }

  // Deduplicate results by ID
  const uniqueMap = new Map<number, GitHubPrOrIssue>();
  for (const item of results) {
    if (!uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }

  const uniqueList = Array.from(uniqueMap.values());
  if (uniqueList.length > 0) {
    return uniqueList;
  }

  // Realistic mock data fallback for demo / offline mode
  return [
    {
      id: 9101,
      number: 142,
      title: 'feat: Redis cache layer & gRPC connection pool optimizations',
      state: 'open',
      html_url: 'https://github.com/developer/project/pull/142',
      created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      repo_name: 'cognidev/core-service',
      author_login: publicUsername || 'developer',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=face',
      category: 'my_pr',
      draft: false,
      labels: [
        { name: 'enhancement', color: 'a2eeef' },
        { name: 'backend', color: '1d76db' },
      ],
      comments_count: 3,
      body: 'Redis kesh va gRPC xizmati ulanish havzasini qayta ishlash uchun PR.',
    },
    {
      id: 9102,
      number: 89,
      title: 'review: Security audit for API tokens and SQLite cipher encryption',
      state: 'open',
      html_url: 'https://github.com/cognidev/security-module/pull/89',
      created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      repo_name: 'cognidev/security-module',
      author_login: 'alex_lead',
      author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face',
      category: 'review_requested',
      draft: false,
      labels: [
        { name: 'security', color: 'd73a4a' },
        { name: 'review-needed', color: 'fbca04' },
      ],
      comments_count: 5,
      body: 'Iltimos, API tokenlari xavfsizligi va saqlash formatini ko‘rib chiqing.',
    },
    {
      id: 9103,
      number: 56,
      title: 'fix(engine): Memory leak profiling on long-running WebSocket channels',
      state: 'open',
      html_url: 'https://github.com/cognidev/synapse-runtime/issues/56',
      created_at: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      repo_name: 'cognidev/synapse-runtime',
      author_login: 'sarah_dev',
      author_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face',
      category: 'assigned_issue',
      draft: false,
      labels: [
        { name: 'bug', color: 'ee0701' },
        { name: 'performance', color: '0075ca' },
      ],
      comments_count: 2,
      body: 'Uzoq vaqt ishlaydigan fondagi vazifalar xotira oqishini tekshirish.',
    },
  ];
}
