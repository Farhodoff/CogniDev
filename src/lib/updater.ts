import { isTauri } from './vault';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
}

export type DownloadProgressCallback = (percent: number, downloadedBytes: number, totalBytes: number) => void;

/**
 * Checks for updates from GitHub Releases (or custom endpoint).
 * Safe to call even in browser mode (returns available: false).
 */
export async function checkAppUpdate(): Promise<{
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
  updateHandle?: any;
}> {
  if (!isTauri) {
    return { available: false };
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update?.available) {
      return {
        available: true,
        version: update.version,
        date: update.date,
        body: update.body,
        updateHandle: update,
      };
    }
    return { available: false };
  } catch (err) {
    console.warn('[Updater] Check failed or running in local dev:', err);
    return { available: false };
  }
}

/**
 * Downloads and installs the given update handle, then relaunches the app.
 */
export async function downloadAndApplyUpdate(
  updateHandle: any,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  if (!updateHandle) throw new Error('No update handle provided');

  let totalLength = 0;
  let downloadedLength = 0;

  await updateHandle.downloadAndInstall((event: any) => {
    if (event.event === 'Started') {
      totalLength = event.data?.contentLength ?? 0;
    } else if (event.event === 'Progress') {
      downloadedLength += event.data?.chunkLength ?? 0;
      const pct = totalLength > 0 ? Math.round((downloadedLength / totalLength) * 100) : 0;
      onProgress?.(pct, downloadedLength, totalLength);
    } else if (event.event === 'Finished') {
      onProgress?.(100, totalLength, totalLength);
    }
  });

  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
