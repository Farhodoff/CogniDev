import { useEffect, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TaskStream from './components/TaskStream';
import WorkspaceEditor from './components/WorkspaceEditor';
import NotionNotesWorkspace from './components/NotionNotesWorkspace';
import RoadmapWorkspace from './components/RoadmapWorkspace';
import IdeasWorkspace from './components/IdeasWorkspace';
import RetroWorkspace from './components/RetroWorkspace';
import FloatingHud from './components/FloatingHud';
import StandupModal from './components/StandupModal';
import WeeklyCoachModal from './components/WeeklyCoachModal';
import CommandPalette from './components/CommandPalette';
import { useSynapse } from './lib/store';

export default function App() {
  const {
    init,
    setSearch,
    setTaskModal,
    selectedTaskId,
    tasks,
    mainView,
    setMainView,
  } = useSynapse();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    init();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      // macOS standard: ⌘N → new task (not while typing)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setTaskModal(true);
        }
      }
      // macOS Workspace shortcuts: ⌘1..⌘5
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) {
          if (e.key === '1') { e.preventDefault(); setMainView('stream'); }
          else if (e.key === '2') { e.preventDefault(); setMainView('notes'); }
          else if (e.key === '3') { e.preventDefault(); setMainView('roadmap'); }
          else if (e.key === '4') { e.preventDefault(); setMainView('ideas'); }
          else if (e.key === '5') { e.preventDefault(); setMainView('retro'); }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [init, setTaskModal, setMainView]);

  // Escape clears the header search when the palette is closed.
  useEffect(() => {
    if (paletteOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearch('');
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [paletteOpen, setSearch]);

  // macOS: native window title follows the selected view or task.
  useEffect(() => {
    let title = 'CogniDev';
    if (mainView === 'stream') {
      const t = tasks.find((x) => x.id === selectedTaskId);
      title = t ? `CogniDev — ${t.id} · ${t.title.slice(0, 40)}` : 'CogniDev — Vazifalar Oqimi';
    } else if (mainView === 'notes') {
      title = 'CogniDev — Notion Qaydlar & Docs';
    } else if (mainView === 'roadmap') {
      title = 'CogniDev — Backend Roadmap & O‘rganish';
    } else if (mainView === 'ideas') {
      title = 'CogniDev — G‘oyalar & Loyihalar Inkubatori';
    } else if (mainView === 'retro') {
      title = 'CogniDev — Haftalik Tahlil & Muammolar Yechimi';
    }

    document.title = title;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title).catch(() => {}))
      .catch(() => {});
  }, [mainView, selectedTaskId, tasks]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-obsidian-950 text-zinc-200 antialiased">
      <Header onPalette={() => setPaletteOpen(true)} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        {mainView === 'stream' && (
          <>
            <TaskStream />
            <WorkspaceEditor />
          </>
        )}
        {mainView === 'notes' && <NotionNotesWorkspace />}
        {mainView === 'roadmap' && <RoadmapWorkspace />}
        {mainView === 'ideas' && <IdeasWorkspace />}
        {mainView === 'retro' && <RetroWorkspace />}
      </div>
      <FloatingHud />
      <StandupModal />
      <WeeklyCoachModal />
      {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

