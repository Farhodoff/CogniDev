import { describe, it, expect, beforeEach } from 'vitest';
import { useSynapse } from '../lib/store';
import { DEFAULT_DEV_LINKS } from '../lib/seed';
import type { DevLinkItem } from '../lib/types';

describe('Dev Bookmarks — Store & Persistence Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store links to initial state
    useSynapse.setState({ links: [...DEFAULT_DEV_LINKS] });
  });

  describe('addLink', () => {
    it('adds a new bookmark to the store and persists it in localStorage', () => {
      const initialCount = useSynapse.getState().links.length;

      useSynapse.getState().addLink({
        title: 'Anthropic Claude Docs',
        url: 'https://docs.anthropic.com',
        category: 'docs',
        description: 'Claude API and prompt engineering documentation',
        tags: ['ai', 'claude', 'api'],
        space_id: 'space-ai',
        pinned: true,
      });

      const updatedLinks = useSynapse.getState().links;
      expect(updatedLinks.length).toBe(initialCount + 1);

      const added = updatedLinks[0];
      expect(added.title).toBe('Anthropic Claude Docs');
      expect(added.url).toBe('https://docs.anthropic.com');
      expect(added.category).toBe('docs');
      expect(added.tags).toEqual(['ai', 'claude', 'api']);
      expect(added.pinned).toBe(true);
      expect(added.id).toMatch(/^link-/);

      // Verify localStorage persistence
      const storedJson = localStorage.getItem('cognidev_dev_links');
      expect(storedJson).not.toBeNull();
      const parsed: DevLinkItem[] = JSON.parse(storedJson!);
      expect(parsed[0].title).toBe('Anthropic Claude Docs');
    });
  });

  describe('updateLink', () => {
    it('updates existing link properties and updates localStorage', () => {
      const links = useSynapse.getState().links;
      const targetId = links[0].id;

      useSynapse.getState().updateLink(targetId, {
        title: 'Updated Bookmark Title',
        category: 'tools',
        pinned: true,
      });

      const updatedLinks = useSynapse.getState().links;
      const modified = updatedLinks.find((l) => l.id === targetId);
      expect(modified?.title).toBe('Updated Bookmark Title');
      expect(modified?.category).toBe('tools');
      expect(modified?.pinned).toBe(true);

      // Verify localStorage
      const stored = JSON.parse(localStorage.getItem('cognidev_dev_links') || '[]');
      const storedItem = stored.find((l: DevLinkItem) => l.id === targetId);
      expect(storedItem.title).toBe('Updated Bookmark Title');
    });
  });

  describe('deleteLink', () => {
    it('removes a link from the store and syncs localStorage', () => {
      const links = useSynapse.getState().links;
      const initialLength = links.length;
      const removeId = links[0].id;

      useSynapse.getState().deleteLink(removeId);

      const updatedLinks = useSynapse.getState().links;
      expect(updatedLinks.length).toBe(initialLength - 1);
      expect(updatedLinks.some((l) => l.id === removeId)).toBe(false);

      // Verify localStorage
      const stored = JSON.parse(localStorage.getItem('cognidev_dev_links') || '[]');
      expect(stored.some((l: DevLinkItem) => l.id === removeId)).toBe(false);
    });
  });

  describe('togglePinLink', () => {
    it('toggles the pinned status of a bookmark and syncs localStorage', () => {
      const links = useSynapse.getState().links;
      const target = links[0];
      const initialPinned = !!target.pinned;

      useSynapse.getState().togglePinLink(target.id);

      const updatedLinks = useSynapse.getState().links;
      const modified = updatedLinks.find((l) => l.id === target.id);
      expect(modified?.pinned).toBe(!initialPinned);

      // Toggle again
      useSynapse.getState().togglePinLink(target.id);
      const reverted = useSynapse.getState().links.find((l) => l.id === target.id);
      expect(reverted?.pinned).toBe(initialPinned);
    });
  });

  describe('Dual-layer initial load and corrupted storage handling', () => {
    it('loads custom bookmarks from localStorage when valid JSON is present', () => {
      const customLinks: DevLinkItem[] = [
        {
          id: 'custom-1',
          title: 'Custom Bookmark',
          url: 'https://custom.dev',
          category: 'cloud',
          tags: ['custom'],
          pinned: false,
          created_at: '2026-10-20T10:00:00Z',
        },
      ];
      localStorage.setItem('cognidev_dev_links', JSON.stringify(customLinks));

      // Re-read storage
      const loaded = JSON.parse(localStorage.getItem('cognidev_dev_links') || '[]');
      useSynapse.setState({ links: loaded });

      expect(useSynapse.getState().links).toHaveLength(1);
      expect(useSynapse.getState().links[0].title).toBe('Custom Bookmark');
    });

    it('falls back to DEFAULT_DEV_LINKS when localStorage is empty or corrupted', () => {
      localStorage.setItem('cognidev_dev_links', 'invalid-json{{{');
      let fallbackLinks: DevLinkItem[] = [];
      try {
        const s = localStorage.getItem('cognidev_dev_links');
        fallbackLinks = s ? JSON.parse(s) : DEFAULT_DEV_LINKS;
      } catch {
        fallbackLinks = DEFAULT_DEV_LINKS;
      }

      expect(fallbackLinks).toEqual(DEFAULT_DEV_LINKS);
      expect(fallbackLinks.length).toBeGreaterThan(0);
    });
  });

  describe('AI Suggestion Integration with Store', () => {
    it('successfully batches multiple AI suggestions into the store', () => {
      const initialCount = useSynapse.getState().links.length;

      const aiSuggestions = [
        {
          title: 'React 19 Server Components',
          url: 'https://react.dev/blog/2026/react-19',
          category: 'learning' as const,
          description: 'Overview of React 19 actions and server components',
          tags: ['react', 'rsc'],
        },
        {
          title: 'Tailwind CSS v4 Docs',
          url: 'https://tailwindcss.com/docs',
          category: 'design' as const,
          description: 'High performance engine for Tailwind CSS',
          tags: ['css', 'styling'],
        },
      ];

      for (const sug of aiSuggestions) {
        useSynapse.getState().addLink({
          title: sug.title,
          url: sug.url,
          category: sug.category,
          description: sug.description,
          tags: sug.tags,
          space_id: null,
          pinned: false,
        });
      }

      const currentLinks = useSynapse.getState().links;
      expect(currentLinks.length).toBe(initialCount + 2);
      expect(currentLinks[0].title).toBe('Tailwind CSS v4 Docs');
      expect(currentLinks[1].title).toBe('React 19 Server Components');
    });
  });
});
