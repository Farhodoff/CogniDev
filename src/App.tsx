import { useEffect, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TaskStream from './components/TaskStream';
import WorkspaceEditor from './components/WorkspaceEditor';
import FloatingHud from './components/FloatingHud';
import StandupModal from './components/StandupModal';
import WeeklyCoachModal from './components/WeeklyCoachModal';
import CommandPalette from './components/CommandPalette';
import { useSynapse } from './lib/store';

export default function App() {
  const { init, setSearch, setTaskModal, selectedTaskId, tasks } = useSynapse();
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [init, setTaskModal]);

  // Escape clears the header search when the palette is closed.
  useEffect(() => {
    if (paletteOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearch('');
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [paletteOpen, setSearch]);

  // macOS: native window title follows the selected task.
  useEffect(() => {
    const t = tasks.find((x) => x.id === selectedTaskId);
    const title = t ? `CogniDev — ${t.id} · ${t.title.slice(0, 40)}` : 'CogniDev';
    document.title = title;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title).catch(() => {}))
      .catch(() => {});
  }, [selectedTaskId, tasks]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-obsidian-950 text-zinc-200 antialiased">
      <Header onPalette={() => setPaletteOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <TaskStream />
        <WorkspaceEditor />
      </div>
      <FloatingHud />
      <StandupModal />
      <WeeklyCoachModal />
      {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
