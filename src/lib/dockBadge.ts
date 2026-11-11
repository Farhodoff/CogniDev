import { invoke } from '@tauri-apps/api/core';

export async function updateDockBadge(count: number): Promise<void> {
  try {
    const badgeLabel = count > 0 ? String(count) : '';
    await invoke('set_dock_badge', { badge: badgeLabel });
  } catch {
    // Non-fatal on unsupported platforms or during web dev
  }
}
