/** Integratsiya testlari uchun sof helper (mock yo‘q — hoisting muammosiz). */
import type { Task } from '../lib/types';

export function makeStoreTask(over: Partial<Task> & { id: string }): Task {
  return {
    workspace_id: 'ws-personal',
    title: `Task ${over.id}`,
    status: 'active',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: null,
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}
