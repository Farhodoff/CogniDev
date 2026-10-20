import { describe, it, expect } from 'vitest';
import {
  cleanDisplayUrl,
  formatUrl,
  parseTags,
  validateBookmarkInput,
  autoDetectCategoryAndTitle,
  filterBookmarks,
  searchBookmarks,
  createBookmark,
  formatExportMarkdown,
  buildAiResourceFinderPrompt,
  parseAiResourceResponse,
} from '../lib/links';
import type { DevLinkItem } from '../lib/types';

describe('Dev Bookmarks — Unit Tests', () => {
  describe('cleanDisplayUrl', () => {
    it('cleans protocols and trailing slashes for standard URLs', () => {
      expect(cleanDisplayUrl('https://github.com/')).toBe('github.com');
      expect(cleanDisplayUrl('http://v2.tauri.app/docs')).toBe('v2.tauri.app/docs');
      expect(cleanDisplayUrl('https://developer.mozilla.org/en-US/')).toBe('developer.mozilla.org/en-US/');
    });

    it('handles URLs without protocol', () => {
      expect(cleanDisplayUrl('github.com/Farhodoff/CogniDev')).toBe('github.com/Farhodoff/CogniDev');
    });

    it('gracefully handles empty and malformed inputs', () => {
      expect(cleanDisplayUrl('')).toBe('');
      expect(cleanDisplayUrl('   ')).toBe('');
      // @ts-expect-error test invalid types
      expect(cleanDisplayUrl(null)).toBe('');
      // @ts-expect-error test invalid types
      expect(cleanDisplayUrl(undefined)).toBe('');
      expect(cleanDisplayUrl('http://')).toBe('');
    });
  });

  describe('formatUrl', () => {
    it('preserves existing http and https protocols', () => {
      expect(formatUrl('https://supabase.com')).toBe('https://supabase.com');
      expect(formatUrl('http://localhost:1420')).toBe('http://localhost:1420');
    });

    it('prepends https:// when protocol is missing', () => {
      expect(formatUrl('github.com')).toBe('https://github.com');
      expect(formatUrl('  docs.rust-lang.org  ')).toBe('https://docs.rust-lang.org');
    });

    it('returns empty string for invalid inputs', () => {
      expect(formatUrl('')).toBe('');
      expect(formatUrl('   ')).toBe('');
      // @ts-expect-error test invalid types
      expect(formatUrl(null)).toBe('');
    });
  });

  describe('parseTags', () => {
    it('parses comma-separated tags into normalized lowercase strings', () => {
      const result = parseTags('react, TypeScript, frontend, React');
      expect(result).toEqual(['react', 'typescript', 'frontend']);
    });

    it('parses semicolon and space-separated tags stripping hashtags', () => {
      const result = parseTags('#api; #backend #REST  #docker');
      expect(result).toEqual(['api', 'backend', 'rest', 'docker']);
    });

    it('handles array of string tags with trimming and hashtag stripping', () => {
      const result = parseTags(['#Rust', '  Cargo  ', 'systems', '#Rust']);
      expect(result).toEqual(['rust', 'cargo', 'systems']);
    });

    it('returns empty array on empty or falsy inputs', () => {
      expect(parseTags('')).toEqual([]);
      expect(parseTags([])).toEqual([]);
      // @ts-expect-error test invalid types
      expect(parseTags(null)).toEqual([]);
    });
  });

  describe('validateBookmarkInput', () => {
    it('validates correct bookmark title and URL', () => {
      const res = validateBookmarkInput({
        title: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects empty or whitespace title', () => {
      expect(validateBookmarkInput({ title: '', url: 'https://github.com' })).toEqual({
        valid: false,
        error: 'Sarlavha kiritilishi shart',
      });
      expect(validateBookmarkInput({ title: '   ', url: 'https://github.com' })).toEqual({
        valid: false,
        error: 'Sarlavha kiritilishi shart',
      });
    });

    it('rejects empty or whitespace URL', () => {
      expect(validateBookmarkInput({ title: 'CogniDev', url: '' })).toEqual({
        valid: false,
        error: 'Havola URL manzili kiritilishi shart',
      });
      expect(validateBookmarkInput({ title: 'CogniDev', url: '   ' })).toEqual({
        valid: false,
        error: 'Havola URL manzili kiritilishi shart',
      });
    });

    it('rejects malformed URL', () => {
      const res = validateBookmarkInput({ title: 'Invalid', url: 'http://::/' });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('URL formati yaroqsiz');
    });
  });

  describe('autoDetectCategoryAndTitle', () => {
    it('detects GitHub repository URLs', () => {
      const res = autoDetectCategoryAndTitle('https://github.com/facebook/react');
      expect(res.category).toBe('repo');
      expect(res.suggestedTitle).toBe('GitHub Repository');
    });

    it('does not overwrite title if user has already entered a title', () => {
      const res = autoDetectCategoryAndTitle('https://github.com/facebook/react', 'React Core');
      expect(res.category).toBe('repo');
      expect(res.suggestedTitle).toBeUndefined();
    });

    it('detects GitLab and Bitbucket repository URLs', () => {
      expect(autoDetectCategoryAndTitle('https://gitlab.com/company/project').category).toBe('repo');
      expect(autoDetectCategoryAndTitle('https://bitbucket.org/team/repo').suggestedTitle).toBe('Git Repository');
    });

    it('detects documentation sites (MDN, docs.*)', () => {
      expect(autoDetectCategoryAndTitle('https://developer.mozilla.org').category).toBe('docs');
      expect(autoDetectCategoryAndTitle('https://docs.docker.com').category).toBe('docs');
      expect(autoDetectCategoryAndTitle('https://v2.tauri.app/docs/').category).toBe('docs');
    });

    it('detects design tools (Figma, Dribbble)', () => {
      const res = autoDetectCategoryAndTitle('https://www.figma.com/design/xyz');
      expect(res.category).toBe('design');
      expect(res.suggestedTitle).toBe('Design Workspace');
    });

    it('detects cloud providers (Vercel, Supabase, AWS)', () => {
      expect(autoDetectCategoryAndTitle('https://vercel.com/dashboard').category).toBe('cloud');
      expect(autoDetectCategoryAndTitle('https://supabase.com/projects').category).toBe('cloud');
      expect(autoDetectCategoryAndTitle('https://aws.amazon.com/console').category).toBe('cloud');
      expect(autoDetectCategoryAndTitle('https://cloudflare.com').category).toBe('cloud');
    });

    it('detects learning resources (StackOverflow, Frontend Masters)', () => {
      expect(autoDetectCategoryAndTitle('https://stackoverflow.com/questions/123').category).toBe('learning');
      expect(autoDetectCategoryAndTitle('https://frontendmasters.com/courses').category).toBe('learning');
    });

    it('detects developer tools (Postman, Docker, Bundlephobia)', () => {
      expect(autoDetectCategoryAndTitle('https://www.postman.com').category).toBe('tools');
      expect(autoDetectCategoryAndTitle('https://docker.com/products').category).toBe('tools');
    });

    it('returns empty object for unknown domain or empty url', () => {
      expect(autoDetectCategoryAndTitle('')).toEqual({});
      expect(autoDetectCategoryAndTitle('https://example.com')).toEqual({});
    });
  });

  describe('filterBookmarks & searchBookmarks', () => {
    const mockLinks: DevLinkItem[] = [
      {
        id: '1',
        title: 'React Documentation',
        url: 'https://react.dev',
        category: 'docs',
        description: 'The library for web and native user interfaces',
        tags: ['frontend', 'javascript', 'ui'],
        space_id: 'space-frontend',
        pinned: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Vite Next Generation Tooling',
        url: 'https://vite.dev',
        category: 'tools',
        description: 'Frontend build tool',
        tags: ['bundler', 'frontend', 'fast'],
        space_id: null,
        pinned: false,
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: '3',
        title: 'Supabase Cloud Backend',
        url: 'https://supabase.com',
        category: 'cloud',
        description: 'The Open Source Firebase Alternative',
        tags: ['postgres', 'auth', 'database'],
        space_id: 'space-backend',
        pinned: true,
        created_at: '2026-01-03T00:00:00Z',
      },
      {
        id: '4',
        title: 'CogniDev GitHub Repo',
        url: 'https://github.com/Farhodoff/CogniDev',
        category: 'repo',
        description: 'AI desktop workspace for engineering leadership',
        tags: ['tauri', 'rust', 'react'],
        space_id: null,
        pinned: false,
        created_at: '2026-01-04T00:00:00Z',
      },
    ];

    it('returns all links when default filters are applied', () => {
      const result = filterBookmarks(mockLinks);
      expect(result).toHaveLength(4);
    });

    it('filters links by category', () => {
      const docs = filterBookmarks(mockLinks, { category: 'docs' });
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('1');

      const repos = filterBookmarks(mockLinks, { category: 'repo' });
      expect(repos).toHaveLength(1);
      expect(repos[0].id).toBe('4');
    });

    it('filters links by space assignment', () => {
      const backendSpace = filterBookmarks(mockLinks, { spaceId: 'space-backend' });
      expect(backendSpace).toHaveLength(1);
      expect(backendSpace[0].id).toBe('3');

      const unassigned = filterBookmarks(mockLinks, { spaceId: 'unassigned' });
      expect(unassigned).toHaveLength(2);
      expect(unassigned.map((l) => l.id)).toEqual(['2', '4']);
    });

    it('searches across title, URL, description, and tags', () => {
      // By title
      expect(searchBookmarks(mockLinks, 'React')).toHaveLength(2); // React Doc & CogniDev (tag)
      // By URL
      expect(searchBookmarks(mockLinks, 'supabase.com')).toHaveLength(1);
      // By description
      expect(searchBookmarks(mockLinks, 'build tool')).toHaveLength(1);
      // By tags
      expect(searchBookmarks(mockLinks, 'postgres')).toHaveLength(1);
      // Case-insensitive
      expect(searchBookmarks(mockLinks, 'TAURI')).toHaveLength(1);
    });

    it('combines category, space, and search query filters', () => {
      const combined = filterBookmarks(mockLinks, {
        category: 'docs',
        spaceId: 'space-frontend',
        search: 'javascript',
      });
      expect(combined).toHaveLength(1);
      expect(combined[0].id).toBe('1');

      const noMatch = filterBookmarks(mockLinks, {
        category: 'cloud',
        spaceId: 'space-frontend',
      });
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('createBookmark', () => {
    it('creates a full DevLinkItem with generated id, normalized url, tags, and timestamp', () => {
      const item = createBookmark({
        title: 'MDN Web Docs',
        url: 'developer.mozilla.org',
        category: 'docs',
        tags: ['#docs', 'web', '#HTML'],
        description: 'Web development reference',
      });

      expect(item.id).toMatch(/^link-/);
      expect(item.url).toBe('https://developer.mozilla.org');
      expect(item.tags).toEqual(['docs', 'web', 'html']);
      expect(item.space_id).toBeNull();
      expect(item.pinned).toBe(false);
      expect(item.created_at).toBeDefined();
    });
  });

  describe('formatExportMarkdown', () => {
    it('generates structured Markdown grouped by categories', () => {
      const links: DevLinkItem[] = [
        {
          id: '1',
          title: 'MDN Web Docs',
          url: 'https://developer.mozilla.org',
          category: 'docs',
          description: 'Official web reference',
          tags: ['javascript', 'html'],
          created_at: '2026-01-01',
        },
        {
          id: '2',
          title: 'Vite',
          url: 'https://vite.dev',
          category: 'tools',
          tags: ['bundler'],
          created_at: '2026-01-02',
        },
      ];

      const md = formatExportMarkdown(links, new Date('2026-10-20T12:00:00Z'));
      expect(md).toContain('# 🌐 CogniDev Dasturchi Havolalari & Resurslar');
      expect(md).toContain('## Hujjatlar (Docs)');
      expect(md).toContain('- [**MDN Web Docs**](https://developer.mozilla.org) - Official web reference `[javascript, html]`');
      expect(md).toContain('## Asboblar (Tools)');
      expect(md).toContain('- [**Vite**](https://vite.dev) - Havola `[bundler]`');
    });
  });

  describe('AI Resource Finder Prompt & Parser', () => {
    it('buildAiResourceFinderPrompt creates clear instructions with JSON schema', () => {
      const prompt = buildAiResourceFinderPrompt('Tauri v2 state management');
      expect(prompt).toContain('Tauri v2 state management');
      expect(prompt).toContain('"category": "docs" | "tools" | "cloud" | "repo" | "learning" | "design" | "other"');
    });

    it('parseAiResourceResponse parses standard JSON arrays', () => {
      const raw = JSON.stringify([
        {
          title: 'Official Tauri Docs',
          url: 'https://v2.tauri.app',
          category: 'docs',
          description: 'Fast, secure cross-platform desktop apps',
          tags: ['tauri', 'rust'],
        },
      ]);

      const suggestions = parseAiResourceResponse(raw);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Official Tauri Docs');
      expect(suggestions[0].url).toBe('https://v2.tauri.app');
      expect(suggestions[0].category).toBe('docs');
      expect(suggestions[0].tags).toEqual(['tauri', 'rust']);
    });

    it('parseAiResourceResponse handles ```json code blocks', () => {
      const raw = `Mana topilgan resurslar:
\`\`\`json
[
  {
    "title": "Rust By Example",
    "url": "doc.rust-lang.org/rust-by-example",
    "category": "learning",
    "description": "Learn Rust with interactive examples",
    "tags": ["rust", "tutorial"]
  }
]
\`\`\`
Omad!`;

      const suggestions = parseAiResourceResponse(raw);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Rust By Example');
      expect(suggestions[0].url).toBe('https://doc.rust-lang.org/rust-by-example');
      expect(suggestions[0].category).toBe('learning');
    });

    it('parseAiResourceResponse handles generic code blocks without json language identifier', () => {
      const raw = `\`\`\`
[
  {
    "title": "Go Concurrency",
    "url": "https://go.dev/doc/effective_go",
    "category": "docs"
  }
]
\`\`\``;
      const suggestions = parseAiResourceResponse(raw);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Go Concurrency');
    });

    it('gracefully handles invalid JSON and malformed responses', () => {
      expect(parseAiResourceResponse('')).toEqual([]);
      expect(parseAiResourceResponse('Kechirasiz, resurs topilmadi.')).toEqual([]);
      expect(parseAiResourceResponse('{ "invalid": true }')).toEqual([]);
    });

    it('defaults unknown category to "other" and filters out invalid items without title or url', () => {
      const raw = JSON.stringify([
        { title: 'Valid Link', url: 'https://example.com', category: 'non_existent_category' },
        { title: '', url: 'https://no-title.com' },
        { title: 'No URL' },
        null,
      ]);

      const suggestions = parseAiResourceResponse(raw);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Valid Link');
      expect(suggestions[0].category).toBe('other');
    });
  });
});
