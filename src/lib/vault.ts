import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { VaultDump } from './db';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Save the vault JSON — native save dialog in Tauri, blob download in browser. Returns true when written. */
export async function exportVaultFile(json: string, defaultName: string = 'cognidev-vault.json'): Promise<boolean> {
  if (isTauri) {
    const path = await save({ defaultPath: defaultName, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path) return false;
    await writeTextFile(path, json);
    return true;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/** Pick a vault JSON file — native dialog in Tauri; caller handles browser <input> itself. */
export async function pickVaultFileContents(): Promise<string | null> {
  if (!isTauri) return null;
  const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (!path || Array.isArray(path)) return null;
  return readTextFile(path);
}

export function parseVault(text: string): VaultDump {
  const d = JSON.parse(text) as VaultDump;
  if (!d || (!Array.isArray(d.tasks) && !Array.isArray(d.workspaces))) {
    throw new Error('Not a valid CogniDev backup file (missing workspaces/tasks).');
  }
  return {
    version: d.version ?? 2,
    appName: d.appName ?? 'CogniDev',
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    workspaces: Array.isArray(d.workspaces) ? d.workspaces : [],
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    resolutions: Array.isArray(d.resolutions) ? d.resolutions : [],
    prompts: Array.isArray(d.prompts) ? d.prompts : [],
    retrospectives: Array.isArray(d.retrospectives) ? d.retrospectives : [],
    meetings: Array.isArray(d.meetings) ? d.meetings : [],
    notesDocs: Array.isArray(d.notesDocs) ? d.notesDocs : [],
    scheduleBlocks: Array.isArray(d.scheduleBlocks) ? d.scheduleBlocks : [],
    goals: Array.isArray(d.goals) ? d.goals : [],
    habits: Array.isArray(d.habits) ? d.habits : [],
    roadmaps: Array.isArray(d.roadmaps) ? d.roadmaps : [],
    learningLogs: Array.isArray(d.learningLogs) ? d.learningLogs : [],
    projectIdeas: Array.isArray(d.projectIdeas) ? d.projectIdeas : [],
    scheduledReminders: Array.isArray(d.scheduledReminders) ? d.scheduledReminders : [],
    teamGroups: Array.isArray(d.teamGroups) ? d.teamGroups : [],
    userProfile: d.userProfile,
  };
}
