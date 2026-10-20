/**
 * Dev Bookmarks & Resource Links Utility Library for CogniDev
 * Provides pure, testable functions for bookmark creation, formatting,
 * auto-categorization, search, filtering, markdown export, and AI resource finding.
 */

import type { DevLinkItem, LinkCategory } from './types';

export const LINK_CATEGORIES: Array<{ id: LinkCategory | 'all'; label: string; color: string }> = [
  { id: 'all', label: 'Barchasi', color: '#3b82f6' },
  { id: 'docs', label: 'Hujjatlar (Docs)', color: '#10b981' },
  { id: 'tools', label: 'Asboblar (Tools)', color: '#8b5cf6' },
  { id: 'cloud', label: 'Cloud & Server', color: '#06b6d4' },
  { id: 'repo', label: 'Repozitoriyalar', color: '#f59e0b' },
  { id: 'learning', label: 'O‘rganish', color: '#ec4899' },
  { id: 'design', label: 'UI / UX Dizayn', color: '#f43f5e' },
  { id: 'other', label: 'Boshqa', color: '#71717a' },
];

/**
 * Cleans a URL for user-friendly UI display (removes protocol and trailing slash).
 */
export function cleanDisplayUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return `${u.hostname}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return trimmed.replace(/^https?:\/\//, '');
  }
}

/**
 * Formats a raw URL into a valid http/https string.
 */
export function formatUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Parses a comma-, semicolon-, or space-separated tags string or array into normalized tags.
 */
export function parseTags(rawTags: string | string[]): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) {
    return Array.from(
      new Set(
        rawTags
          .map((t) => (typeof t === 'string' ? t.trim().toLowerCase().replace(/^#+/, '') : ''))
          .filter(Boolean)
      )
    );
  }
  return Array.from(
    new Set(
      rawTags
        .split(/[,;\s]+/)
        .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
        .filter(Boolean)
    )
  );
}

/**
 * Validates a bookmark input before creation or update.
 */
export function validateBookmarkInput(input: {
  title?: string;
  url?: string;
}): { valid: boolean; error?: string } {
  if (!input.title || !input.title.trim()) {
    return { valid: false, error: 'Sarlavha kiritilishi shart' };
  }
  if (!input.url || !input.url.trim()) {
    return { valid: false, error: 'Havola URL manzili kiritilishi shart' };
  }
  const formatted = formatUrl(input.url);
  try {
    new URL(formatted);
  } catch {
    return { valid: false, error: 'URL formati yaroqsiz' };
  }
  return { valid: true };
}

/**
 * Automatically detects category and suggested title from URL pattern.
 */
export function autoDetectCategoryAndTitle(
  url: string,
  currentTitle?: string
): { category?: LinkCategory; suggestedTitle?: string } {
  if (!url) return {};
  const low = url.toLowerCase();
  const hasTitle = Boolean(currentTitle && currentTitle.trim());

  if (low.includes('github.com')) {
    return {
      category: 'repo',
      suggestedTitle: hasTitle ? undefined : 'GitHub Repository',
    };
  }
  if (low.includes('gitlab.com') || low.includes('bitbucket.org')) {
    return {
      category: 'repo',
      suggestedTitle: hasTitle ? undefined : 'Git Repository',
    };
  }
  if (low.includes('developer.mozilla.org') || low.includes('docs.') || low.includes('/docs')) {
    return {
      category: 'docs',
      suggestedTitle: hasTitle ? undefined : 'Documentation',
    };
  }
  if (low.includes('figma.com') || low.includes('dribbble.com') || low.includes('behance.net')) {
    return {
      category: 'design',
      suggestedTitle: hasTitle ? undefined : 'Design Workspace',
    };
  }
  if (
    low.includes('vercel.com') ||
    low.includes('aws.') ||
    low.includes('supabase.com') ||
    low.includes('cloud.google.com') ||
    low.includes('cloudflare.com')
  ) {
    return {
      category: 'cloud',
      suggestedTitle: hasTitle ? undefined : 'Cloud Console',
    };
  }
  if (
    low.includes('stackoverflow.com') ||
    low.includes('frontendmasters.com') ||
    low.includes('coursera.org') ||
    low.includes('egghead.io')
  ) {
    return {
      category: 'learning',
      suggestedTitle: hasTitle ? undefined : 'Learning Resource',
    };
  }
  if (low.includes('postman.com') || low.includes('docker.com') || low.includes('bundlephobia.com')) {
    return {
      category: 'tools',
      suggestedTitle: hasTitle ? undefined : 'Developer Tool',
    };
  }

  return {};
}

export interface FilterBookmarksOptions {
  category?: LinkCategory | 'all';
  spaceId?: string; // 'all' | 'unassigned' | specific uuid
  search?: string;
}

/**
 * Searches and filters dev bookmarks by category, space assignment, and text query.
 */
export function filterBookmarks(
  links: DevLinkItem[],
  options: FilterBookmarksOptions = {}
): DevLinkItem[] {
  const { category = 'all', spaceId = 'all', search = '' } = options;
  const q = search.trim().toLowerCase();

  return links.filter((link) => {
    // 1. Category filter
    if (category !== 'all' && link.category !== category) {
      return false;
    }

    // 2. Space filter
    if (spaceId !== 'all') {
      if (spaceId === 'unassigned' && link.space_id) {
        return false;
      }
      if (spaceId !== 'unassigned' && link.space_id !== spaceId) {
        return false;
      }
    }

    // 3. Search query
    if (q) {
      const matchTitle = link.title.toLowerCase().includes(q);
      const matchUrl = link.url.toLowerCase().includes(q);
      const matchDesc = (link.description || '').toLowerCase().includes(q);
      const matchTags = (link.tags || []).some((t) => t.toLowerCase().includes(q));

      if (!matchTitle && !matchUrl && !matchDesc && !matchTags) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Convenience search function matching title, URL, description, or tags.
 */
export function searchBookmarks(links: DevLinkItem[], query: string): DevLinkItem[] {
  return filterBookmarks(links, { search: query });
}

/**
 * Creates a complete DevLinkItem object with generated ID and timestamp.
 */
export function createBookmark(
  link: Omit<DevLinkItem, 'id' | 'created_at'> & { id?: string; created_at?: string }
): DevLinkItem {
  return {
    ...link,
    id: link.id || 'link-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    url: formatUrl(link.url),
    tags: parseTags(link.tags || []),
    space_id: link.space_id || null,
    pinned: Boolean(link.pinned),
    created_at: link.created_at || new Date().toISOString(),
  };
}

/**
 * Formats a list of bookmarks into a beautifully structured Markdown document.
 */
export function formatExportMarkdown(links: DevLinkItem[], date: Date = new Date()): string {
  let md = `# 🌐 CogniDev Dasturchi Havolalari & Resurslar\n\n`;
  md += `*Exported: ${date.toLocaleDateString('uz-UZ')}*\n\n`;

  for (const cat of LINK_CATEGORIES) {
    if (cat.id === 'all') continue;
    const catLinks = links.filter((l) => l.category === cat.id);
    if (catLinks.length === 0) continue;

    md += `## ${cat.label}\n\n`;
    for (const l of catLinks) {
      const tagsStr = l.tags && l.tags.length ? ` \`[${l.tags.join(', ')}]\`` : '';
      const descStr = ` - ${l.description || 'Havola'}`;
      md += `- [**${l.title}**](${l.url})${descStr}${tagsStr}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Builds the AI Resource Finder system and user prompt.
 */
export function buildAiResourceFinderPrompt(query: string): string {
  return `Siz katta dasturiy ta'minot muhandisi va resurslar ekspertisiz.
Foydalanuvchi quyidagi mavzu bo'yicha eng yaxshi 3-4 ta rasmiy yoki yuqori sifatli dasturchi havolalarini (dokumentatsiya, asbob, repo yoki maqola) qidirmoqda:
"${query}"

Faqat va faqat quyidagi JSON formatida massiv qaytaring:
[
  {
    "title": "Resurs Nomi",
    "url": "https://...",
    "category": "docs" | "tools" | "cloud" | "repo" | "learning" | "design" | "other",
    "description": "Nima uchun foydali ekani haqida 1 ta qisqa gap",
    "tags": ["tag1", "tag2"]
  }
]`;
}

export interface AiLinkSuggestion {
  title: string;
  url: string;
  category: LinkCategory;
  description: string;
  tags: string[];
}

/**
 * Parses raw AI text response into structured resource suggestions.
 * Robust against Markdown code blocks, raw arrays, or extra text.
 */
export function parseAiResourceResponse(rawText: string): AiLinkSuggestion[] {
  if (!rawText || typeof rawText !== 'string') return [];

  let cleaned = rawText.trim();
  // Strip ```json or ``` code fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  // Find json array within text if surrounded by remarks
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        const url = typeof item.url === 'string' ? formatUrl(item.url) : '';
        if (!title || !url) return null;

        const validCategories: LinkCategory[] = ['docs', 'tools', 'cloud', 'repo', 'learning', 'design', 'other'];
        const category: LinkCategory = validCategories.includes(item.category) ? item.category : 'other';
        const description = typeof item.description === 'string' ? item.description.trim() : '';
        const tags = parseTags(item.tags || []);

        return {
          title,
          url,
          category,
          description,
          tags,
        };
      })
      .filter((item): item is AiLinkSuggestion => item !== null);
  } catch {
    return [];
  }
}
