import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseCommitMessageForTask,
  getProcessedCommitHashes,
  syncTasksWithGitCommits,
  generateStandupFromGitDiff,
  type GitRepoInfo,
} from '../lib/git';
import { fetchUserPrsAndIssues } from '../lib/github';
import { callAi } from '../lib/ai';
import type { Task } from '../lib/types';

vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<any>('../lib/ai');
  return {
    ...actual,
    callAi: vi.fn(),
  };
});

describe('🐙 Git & GitHub Deep Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockTasks: Task[] = [
    {
      id: 'DEV-1',
      title: 'Redis kesh va gRPC xizmatini yozish',
      priority: 'High Priority',
      status: 'active',
      tags: ['backend', 'redis'],
      created_at: new Date().toISOString(),
    },
    {
      id: 'DEV-2',
      title: 'Tauri oyna fonini shaffof qilish',
      priority: 'Normal',
      status: 'active',
      tags: ['ui', 'tauri'],
      created_at: new Date().toISOString(),
    },
    {
      id: 'DEV-3',
      title: 'WebSocket orqali xotira oqishini bartaraf qilish',
      priority: 'Critical',
      status: 'active',
      tags: ['performance', 'memory'],
      created_at: new Date().toISOString(),
    },
  ] as unknown as Task[];

  describe('1. Git Commit → Avtomatik Task Done (parseCommitMessageForTask)', () => {
    it('matches exact task ID like fix: DEV-1 or feat: task-2', () => {
      const match1 = parseCommitMessageForTask('fix: DEV-1 connection pool timeout', mockTasks);
      expect(match1).not.toBeNull();
      expect(match1?.task.id).toBe('DEV-1');
      expect(match1?.type).toBe('id');

      const match2 = parseCommitMessageForTask('feat(ui): task-2 transparent backdrop', mockTasks);
      expect(match2).not.toBeNull();
      expect(match2?.task.id).toBe('DEV-2');
    });

    it('matches task title/keywords like feat: redis cache', () => {
      const match = parseCommitMessageForTask('feat: redis cache layer integration', mockTasks);
      expect(match).not.toBeNull();
      expect(match?.task.id).toBe('DEV-1');
      expect(match?.type).toBe('title');
    });

    it('matches task keywords with prefixes like resolve:, close:, fix:', () => {
      const match = parseCommitMessageForTask('close: WebSocket memory leak fix', mockTasks);
      expect(match).not.toBeNull();
      expect(match?.task.id).toBe('DEV-3');
    });

    it('returns null if no task ID or keywords match', () => {
      const match = parseCommitMessageForTask('chore: bump minor npm packages', mockTasks);
      expect(match).toBeNull();
    });
  });

  describe('2. syncTasksWithGitCommits & Duplicate Prevention', () => {
    it('marks matching tasks as completed and records commit hashes', () => {
      const statusUpdates: Array<{ id: string; status: Task['status'] }> = [];
      const hudMessages: string[] = [];

      const commits = [
        { hash: 'a1b2c3d', message: 'fix: DEV-1 resolve timeout in redis connection' },
        { hash: 'e4f5g6h', message: 'chore: update readme' },
      ];

      const res = syncTasksWithGitCommits(
        commits,
        mockTasks,
        (id, status) => statusUpdates.push({ id, status }),
        (msg) => hudMessages.push(msg)
      );

      expect(res.completedTasks.length).toBe(1);
      expect(res.completedTasks[0].id).toBe('DEV-1');
      expect(statusUpdates).toEqual([{ id: 'DEV-1', status: 'completed' }]);
      expect(hudMessages.length).toBe(1);
      expect(hudMessages[0]).toContain('completed qilindi');

      // Check commit hash was saved to prevent duplicate processing
      const processed = getProcessedCommitHashes();
      expect(processed.has('a1b2c3d')).toBe(true);

      // Running again with same commit should not trigger status update
      const secondUpdates: Array<{ id: string; status: Task['status'] }> = [];
      const res2 = syncTasksWithGitCommits(
        commits,
        mockTasks,
        (id, status) => secondUpdates.push({ id, status })
      );
      expect(res2.completedTasks.length).toBe(0);
      expect(secondUpdates.length).toBe(0);
    });
  });

  describe('3. AI Standup from Git Diff (generateStandupFromGitDiff)', () => {
    const mockGitInfo: GitRepoInfo = {
      is_repo: true,
      repo_root: '/Users/developer/project',
      branch: 'feature/redis-cache',
      remote_url: 'https://github.com/developer/project.git',
      modified_count: 2,
      untracked_count: 1,
      staged_count: 0,
      files: [
        { status: 'M', path: 'src/lib/redis.ts' },
        { status: 'M', path: 'src/lib/grpc.ts' },
      ],
      recent_commits: [
        {
          hash: '7c8d9e0',
          author: 'Farhod',
          time_ago: '3 hours ago',
          message: 'feat: add Redis connection pool and error retry logic',
        },
        {
          hash: '1a2b3c4',
          author: 'Farhod',
          time_ago: '18 hours ago',
          message: 'refactor: decouple gRPC client transport handlers',
        },
      ],
      diff_summary: '2 files changed, 140 insertions(+), 20 deletions(-)',
      diff_content: 'diff --git a/src/lib/redis.ts b/src/lib/redis.ts...',
    };

    it('generates a 100% real code-grounded daily standup using AI', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: `### 1. 🏆 Kecha qilingan ishlar (Real Git commitlar asosida)
- [7c8d9e0] feat: add Redis connection pool and error retry logic
- [1a2b3c4] refactor: decouple gRPC client transport handlers

### 2. 🎯 Bugungi rejalar va diqqat markazi (Branch: \`feature/redis-cache\`)
- Redis kesh va gRPC xizmatini to'liq testdan o'tkazish

### 3. ⚠️ To'siqlar va texnik xatarlar
- 2 ta o'zgargan fayl: src/lib/redis.ts, src/lib/grpc.ts`,
        source: 'gemini',
        model: 'gemini-1.5-flash',
      });

      const res = await generateStandupFromGitDiff(mockTasks, mockGitInfo);

      expect(res.source).toBe('git-diff');
      expect(res.content).toContain('Kecha qilingan ishlar');
      expect(res.content).toContain('feature/redis-cache');
      expect(callAi).toHaveBeenCalledTimes(1);
    });

    it('falls back to structured markdown template if AI call fails or offline', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network error'));

      const res = await generateStandupFromGitDiff(mockTasks, mockGitInfo);

      expect(res.source).toBe('git-diff-fallback');
      expect(res.content).toContain('Daily Standup');
      expect(res.content).toContain('feature/redis-cache');
      expect(res.content).toContain('feat: add Redis connection pool');
    });
  });

  describe('4. PR & Issue Tracker (fetchUserPrsAndIssues)', () => {
    it('returns structured PRs and Issues list with categories', async () => {
      const items = await fetchUserPrsAndIssues(null, 'developer');

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      const prItem = items.find((i) => i.category === 'my_pr');
      expect(prItem).toBeDefined();
      expect(prItem?.title).toBeDefined();
      expect(prItem?.repo_name).toBeDefined();
      expect(prItem?.html_url).toContain('github.com');

      const reviewItem = items.find((i) => i.category === 'review_requested');
      expect(reviewItem).toBeDefined();

      const issueItem = items.find((i) => i.category === 'assigned_issue');
      expect(issueItem).toBeDefined();
    });
  });
});
