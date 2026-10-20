import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LinksWorkspace from '../components/LinksWorkspace';
import { useSynapse } from '../lib/store';
import * as aiModule from '../lib/ai';

describe('Dev Bookmarks — Playwright & UI Flow Integration Scenarios', () => {
  beforeEach(() => {
    localStorage.clear();
    useSynapse.setState({
      links: [
        {
          id: 'test-1',
          title: 'Official React Documentation',
          url: 'https://react.dev',
          category: 'docs',
          description: 'The library for web and native user interfaces',
          tags: ['react', 'frontend'],
          space_id: null,
          pinned: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'test-2',
          title: 'Docker Engine Docs',
          url: 'https://docs.docker.com',
          category: 'tools',
          description: 'Containerization platform',
          tags: ['docker', 'devops'],
          space_id: null,
          pinned: false,
          created_at: new Date().toISOString(),
        },
      ],
      spaces: [
        { id: 'space-frontend', name: 'Frontend Space', icon: 'Code', color: '#3b82f6' },
      ],
      hudMessage: null,
    });
  });

  it('renders initial workspace header, stats counters, and default bookmarks', () => {
    render(<LinksWorkspace />);

    expect(screen.getByText('Havolalar & Resurslar')).toBeDefined();
    expect(screen.getByText('2 ta saqlangan')).toBeDefined();
    expect(screen.getByText('Official React Documentation')).toBeDefined();
    expect(screen.getByText('Docker Engine Docs')).toBeDefined();
    expect(screen.getByText(/Tezkor Havolalar/)).toBeDefined();
  });

  it('filters bookmarks in real time using the search input', async () => {
    render(<LinksWorkspace />);

    const searchInput = screen.getByPlaceholderText('Havolalardan qidirish...');
    expect(searchInput).toBeDefined();

    // Search for 'Docker'
    fireEvent.change(searchInput, { target: { value: 'Docker' } });

    await waitFor(() => {
      expect(screen.getByText('Docker Engine Docs')).toBeDefined();
      expect(screen.queryByText('Official React Documentation')).toBeNull();
    });

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText('Official React Documentation')).toBeDefined();
      expect(screen.getByText('Docker Engine Docs')).toBeDefined();
    });
  });

  it('filters bookmarks by clicking category filter buttons', async () => {
    render(<LinksWorkspace />);

    // Click 'Asboblar (Tools)' category button
    const toolsButton = screen.getByRole('button', { name: /Asboblar/i });
    fireEvent.click(toolsButton);

    await waitFor(() => {
      expect(screen.getByText('Docker Engine Docs')).toBeDefined();
      expect(screen.queryByText('Official React Documentation')).toBeNull();
    });

    // Click 'Barchasi' to restore all
    const allButton = screen.getByRole('button', { name: /Barchasi/i });
    fireEvent.click(allButton);

    await waitFor(() => {
      expect(screen.getByText('Official React Documentation')).toBeDefined();
      expect(screen.getByText('Docker Engine Docs')).toBeDefined();
    });
  });

  it('opens add modal, auto-detects category from URL, and adds new bookmark', async () => {
    render(<LinksWorkspace />);

    // Open Add Modal
    const addModalBtn = screen.getByRole('button', { name: /Yangi Havola Qo‘shish/i });
    fireEvent.click(addModalBtn);

    expect(screen.getByText('Yangi Dev Havola Qo‘shish')).toBeDefined();

    // Type GitHub URL and observe auto-detection
    const urlInput = screen.getByPlaceholderText(/https:\/\/github.com\/facebook\/react/);
    fireEvent.change(urlInput, { target: { value: 'https://github.com/Farhodoff/CogniDev' } });

    // Title input should have auto-suggested "GitHub Repository"
    const titleInput = screen.getByPlaceholderText(/Masalan: React Rasmiy Hujjatlari/);
    expect((titleInput as HTMLInputElement).value).toBe('GitHub Repository');

    // Change title to specific name
    fireEvent.change(titleInput, { target: { value: 'CogniDev Desktop Workspace' } });

    // Add tags
    const tagsInput = screen.getByPlaceholderText(/react, frontend, hooks/);
    fireEvent.change(tagsInput, { target: { value: 'tauri, rust, ai' } });

    // Submit form (button with 'Qo‘shish')
    const submitBtn = screen.getByRole('button', { name: /^Qo‘shish$/i });
    fireEvent.click(submitBtn);

    // Modal should close and new link should be rendered
    await waitFor(() => {
      expect(screen.getByText('CogniDev Desktop Workspace')).toBeDefined();
      expect(useSynapse.getState().hudMessage).toBe('"CogniDev Desktop Workspace" havolasi saqlandi ✓');
    });

    // Verify persisted in store
    const links = useSynapse.getState().links;
    expect(links.some((l) => l.title === 'CogniDev Desktop Workspace')).toBe(true);
  });

  it('triggers AI Resource Finder modal, generates suggestions, and adds suggestion to bookmarks', async () => {
    // Mock callAi response
    vi.spyOn(aiModule, 'callAi').mockResolvedValueOnce({
      text: JSON.stringify([
        {
          title: 'Vite Plugin React Guide',
          url: 'https://github.com/vitejs/vite-plugin-react',
          category: 'repo',
          description: 'Official React plugin for Vite',
          tags: ['vite', 'react'],
        },
      ]),
      source: 'ollama',
      model: 'qwen2.5-coder:3b',
    });

    render(<LinksWorkspace />);

    // Open AI Finder Modal
    const aiModalBtn = screen.getByRole('button', { name: /AI bilan Resurs Qidirish/i });
    fireEvent.click(aiModalBtn);

    expect(screen.getByText('AI Dasturchi Resurs Topuvchisi')).toBeDefined();

    // Enter AI prompt
    const aiInput = screen.getByPlaceholderText(/Qaysi texnologiya yoki muammo/i);
    fireEvent.change(aiInput, { target: { value: 'Vite React setup' } });

    // Click search
    const submitSearchBtn = screen.getByRole('button', { name: /^Qidirish$/i });
    fireEvent.click(submitSearchBtn);

    // Verify suggestion rendered
    await waitFor(() => {
      expect(screen.getByText('Vite Plugin React Guide')).toBeDefined();
    });

    // Click "Qo‘shish" on suggestion
    const addSuggestionBtn = screen.getByRole('button', { name: /^Qo‘shish$/i });
    fireEvent.click(addSuggestionBtn);

    // Verify added to store and notification triggered
    await waitFor(() => {
      expect(useSynapse.getState().hudMessage).toBe('"Vite Plugin React Guide" qo‘shildi ✓');
      const links = useSynapse.getState().links;
      expect(links.some((l) => l.title === 'Vite Plugin React Guide')).toBe(true);
    });
  });

  it('toggles pin state on bookmark cards', async () => {
    render(<LinksWorkspace />);

    // Unpin the pinned link
    const pinBtn = screen.getByTitle('Pinni olib tashlash');
    fireEvent.click(pinBtn);

    await waitFor(() => {
      const link = useSynapse.getState().links.find((l) => l.id === 'test-1');
      expect(link?.pinned).toBe(false);
    });
  });

  it('copies bookmark URL to clipboard and sets HUD notification', async () => {
    render(<LinksWorkspace />);

    const copyBtn = screen.getAllByTitle('Nusxalash')[0];
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://react.dev');
      expect(useSynapse.getState().hudMessage).toBe('Havola nusxalandi ✓');
    });
  });

  it('deletes bookmark upon clicking delete button', async () => {
    render(<LinksWorkspace />);

    const deleteBtn = screen.getByTitle('O‘chirish');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(useSynapse.getState().links.some((l) => l.id === 'test-2')).toBe(false);
      expect(screen.queryByText('Docker Engine Docs')).toBeNull();
    });
  });

  it('triggers Markdown export', async () => {
    render(<LinksWorkspace />);

    const exportBtn = screen.getByRole('button', { name: /Eksport/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(useSynapse.getState().hudMessage).toBe('Havolalar Markdown formatida yuklab olindi ✓');
    });
  });
});
