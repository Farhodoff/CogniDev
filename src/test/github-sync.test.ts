/** GitHub AI sync — unit testlar (fetch mock + fallback zanjiri). */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/ai', () => ({ callAi: vi.fn(async () => { throw new Error('offline'); }) }));

import {
  formatAgentPrompt,
  fetchRepoCommits,
  getStoredGitHubToken,
  setStoredGitHubToken,
  generateAiTasksFromGitHub,
  type GitHubRepo,
  type GitHubCommitItem,
} from '../lib/github';

const repo: GitHubRepo = {
  id: 1,
  name: 'CogniDev',
  full_name: 'Farhodoff/CogniDev',
  description: 'Test repo',
  html_url: 'https://github.com/Farhodoff/CogniDev',
  is_private: false,
  pushed_at: new Date().toISOString(),
  language: 'TypeScript',
  stargazers_count: 5,
  open_issues_count: 2,
  default_branch: 'main',
};

function commit(msg: string): GitHubCommitItem {
  return {
    sha: 'abc1234567890',
    short_sha: 'abc1234',
    author_name: 'Tester',
    date: new Date().toISOString(),
    time_ago: 'Hozirgina',
    message: msg,
    html_url: 'https://github.com/x/y/commit/abc',
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('github token storage', () => {
  it('token saqlash va o‘qish round-trip', () => {
    expect(getStoredGitHubToken()).toBeNull();
    setStoredGitHubToken('ghp_test123', 'tester');
    expect(getStoredGitHubToken()).toBe('ghp_test123');
    setStoredGitHubToken(null, null);
    expect(getStoredGitHubToken()).toBeNull();
  });
});

describe('formatAgentPrompt', () => {
  it('agent prompti branch va acceptance kriteriylari bilan tuziladi', () => {
    const out = formatAgentPrompt(
      { title: 'Testlar qo‘shish', description: 'Unit testlar yozish', branch: 'feat/cognidev-tests' },
      'CogniDev',
      'fix: old commit',
    );
    expect(out).toContain('feat/cognidev-tests');
    expect(out).toContain('Testlar qo‘shish');
    expect(out).toContain('Acceptance Criteria');
  });
});

describe('fetchRepoCommits', () => {
  it('commitlar ro‘yxatini normallashtiradi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          sha: 'deadbeefcafe1234',
          commit: { message: 'feat: yangi test\nbody', author: { name: 'Dev', date: new Date().toISOString() } },
          author: { login: 'dev', avatar_url: 'http://x' },
          html_url: 'http://github/commit/1',
        },
      ],
    })) as unknown as typeof fetch);

    const commits = await fetchRepoCommits('tok', 'Farhodoff', 'CogniDev', 5);
    expect(commits).toHaveLength(1);
    expect(commits[0].short_sha).toBe('deadbee');
    expect(commits[0].message).toBe('feat: yangi test');
  });

  it('API xatoligi aniq xabar bilan throw qiladi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 404, statusText: 'Not Found',
    })) as unknown as typeof fetch);
    await expect(fetchRepoCommits(null, 'a', 'b')).rejects.toThrow('Commitlarni yuklashda xatolik');
  });
});

describe('generateAiTasksFromGitHub fallback', () => {
  it('AI ishlamaganda evristik fallback 2 ta vazifa qaytaradi', async () => {
    const report = await generateAiTasksFromGitHub(repo, [commit('fix: persistence')], undefined, 'gemini');
    expect(report.analyzed_repo).toBe('Farhodoff/CogniDev');
    expect(report.suggested_tasks.length).toBeGreaterThanOrEqual(2);
    expect(report.suggested_tasks[0].agent_prompt).toContain('TASK OBJECTIVE');
  });
});
