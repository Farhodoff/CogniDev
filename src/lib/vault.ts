import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { VaultDump } from './db';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Save the vault JSON — native save dialog in Tauri, blob download in browser. Returns true when written. */
export async function exportVaultFile(json: string): Promise<boolean> {
  if (isTauri) {
    const path = await save({ defaultPath: 'synapselog-vault.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path) return false;
    await writeTextFile(path, json);
    return true;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'synapselog-vault.json';
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
  if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.workspaces)) {
    throw new Error('Not a SynapseLog vault file (missing workspaces/tasks).');
  }
  return {
    version: 1,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    workspaces: d.workspaces,
    tasks: d.tasks,
    resolutions: Array.isArray(d.resolutions) ? d.resolutions : [],
    prompts: Array.isArray(d.prompts) ? d.prompts : [],
    retrospectives: Array.isArray(d.retrospectives) ? d.retrospectives : [],
  };
}
