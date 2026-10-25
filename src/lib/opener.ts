import { isTauri } from './platform';

/**
 * Opens an external URL in the user's default browser (Safari, Chrome, etc.)
 * Works reliably in Tauri desktop (macOS, Windows, Linux) and falls back to window.open in web mode.
 */
export async function openExternalUrl(rawUrl: string): Promise<void> {
  if (!rawUrl || !rawUrl.trim()) return;
  let target = rawUrl.trim();

  // Ensure protocol
  if (!/^https?:\/\//i.test(target) && !/^mailto:/i.test(target)) {
    target = `https://${target}`;
  }

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_external_url', { url: target });
      return;
    } catch (err) {
      console.warn('Native open_external_url failed, falling back to window.open:', err);
    }
  }

  // Browser fallback
  window.open(target, '_blank', 'noopener,noreferrer');
}

/**
 * Global listener that intercepts click events on any <a href="http..."> or [target="_blank"]
 * anywhere in the app (e.g. Flashcards, Roadmap topics, Notes, Markdown, Dev Links, Project GitHub URLs)
 * and opens them natively in the operating system's default browser.
 */
export function setupGlobalExternalLinkHandler(): () => void {
  const handler = (e: MouseEvent) => {
    // If the click is on or inside an anchor element
    const anchor = (e.target as HTMLElement)?.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Check if external web or mail link
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      anchor.target === '_blank'
    ) {
      e.preventDefault();
      e.stopPropagation();
      openExternalUrl(href);
    }
  };

  document.addEventListener('click', handler, true);
  return () => {
    document.removeEventListener('click', handler, true);
  };
}
