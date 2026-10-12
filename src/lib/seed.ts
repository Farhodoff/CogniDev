import type { Workspace } from './types';

/** Default initial workspace for a clean production setup. */
export const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'ws-personal',
  name: 'Personal Vault',
  type: 'personal',
  created_at: new Date().toISOString(),
};
