import { invoke } from '@tauri-apps/api/core';
import type { GitCommit, GitRepoInfo } from './types';

/** Fetch current active git branch via Tauri process execution */
export async function fetchGitBranch(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_git_branch');
  } catch {
    return null;
  }
}

/** Fetch recent git commits from the local working repository */
export async function fetchRecentCommits(limit = 5): Promise<GitCommit[]> {
  try {
    return await invoke<GitCommit[]>('get_recent_commits', { limit });
  } catch {
    return [];
  }
}

/** Fetch current repo status (modified files count, clean status) */
export async function fetchGitStatus(): Promise<GitRepoInfo | null> {
  try {
    return await invoke<GitRepoInfo>('get_git_status');
  } catch {
    return null;
  }
}
