// Cross-platform helper for CogniDev (macOS & Windows)

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const isMac =
  typeof navigator !== 'undefined' &&
  (/Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ||
    (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform === 'macOS' ||
    (typeof navigator.platform === 'string' && /Mac/i.test(navigator.platform)));

export const isWindows =
  typeof navigator !== 'undefined' &&
  (/Win/.test(navigator.userAgent) ||
    (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform === 'Windows' ||
    (typeof navigator.platform === 'string' && /Win/i.test(navigator.platform)));

/**
 * Primary modifier key label: '⌘' on macOS, 'Ctrl' on Windows/Linux
 */
export const modKey = isMac ? '⌘' : 'Ctrl';

/**
 * Primary modifier key with connector: '⌘' on macOS, 'Ctrl+' on Windows/Linux
 */
export const modPrefix = isMac ? '⌘' : 'Ctrl+';

/**
 * Format shortcut for display in buttons, placeholders, and tooltips.
 * e.g. formatShortcut('K') -> '⌘K' (Mac) | 'Ctrl+K' (Windows)
 *      formatShortcut('K', true) -> '⌘ K' (Mac) | 'Ctrl+K' (Windows)
 */
export function formatShortcut(key: string, hasSpace = false): string {
  if (isMac) {
    return hasSpace ? `⌘ ${key}` : `⌘${key}`;
  }
  return `Ctrl+${key}`;
}
