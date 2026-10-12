import { useEffect, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TaskStream from './components/TaskStream';
import WorkspaceEditor from './components/WorkspaceEditor';
import FloatingHud from './components/FloatingHud';
import StandupModal from './components/StandupModal';
import WeeklyCoachModal from './components/WeeklyCoachModal';
import CommandPalette from './components/CommandPalette';
import { SpotlightModal } from './components/SpotlightModal';
import { useSynapse } from './lib/store';

export default function App() {
  const { init, setSearch } = useSynapse();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    init();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [init]);

  // Escape clears the header search when the palette is closed.
  useEffect(() => {
    if (paletteOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearch('');
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [paletteOpen, setSearch]);

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
      <SpotlightModal />
      {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
