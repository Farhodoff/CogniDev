import { useEffect, useState, lazy, Suspense } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardWorkspace from './components/DashboardWorkspace';
import TaskStream from './components/TaskStream';
import WorkspaceEditor from './components/WorkspaceEditor';
import FloatingHud from './components/FloatingHud';
import NotificationBanner from './components/NotificationBanner';
import WorkspaceLoading from './components/WorkspaceLoading';
import { useSynapse } from './lib/store';

// Workspaces lazy loaded on demand for faster initial startup:
const NotionNotesWorkspace = lazy(() => import('./components/NotionNotesWorkspace'));
const RoadmapWorkspace = lazy(() => import('./components/RoadmapWorkspace'));
const IdeasWorkspace = lazy(() => import('./components/IdeasWorkspace'));
const RetroWorkspace = lazy(() => import('./components/RetroWorkspace'));
const InboxWorkspace = lazy(() => import('./components/InboxWorkspace'));
const CalendarWorkspace = lazy(() => import('./components/CalendarWorkspace'));
const ProjectsWorkspace = lazy(() => import('./components/ProjectsWorkspace'));

// Drawers & Modals lazy loaded on demand:
const AiAssistantDrawer = lazy(() => import('./components/AiAssistantDrawer'));
const StandupModal = lazy(() => import('./components/StandupModal'));
const WeeklyCoachModal = lazy(() => import('./components/WeeklyCoachModal'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const FocusModal = lazy(() => import('./components/FocusModal'));
import { useFocusStore } from './lib/focusStore';

export default function App() {
  const {
    init,
    setSearch,
    setTaskModal,
    setGitHubModal,
    selectedTaskId,
    tasks,
    mainView,
    setMainView,
    toggleAiDrawer,
  } = useSynapse();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    init();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      // ⌘J → Toggle AI Assistant Drawer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          toggleAiDrawer();
        }
      }
      // ⌘P → Toggle Pomodoro & Deep Work Focus Modal
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          useFocusStore.getState().setShowModal(!useFocusStore.getState().showModal);
        }
      }
      // ⌘G → Toggle GitHub Hub & AI Task Synthesizer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setGitHubModal(true);
        }
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
      // macOS Workspace shortcuts: ⌘1..⌘6
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) {
          if (e.key === '1') { e.preventDefault(); setMainView('dashboard'); }
          else if (e.key === '2') { e.preventDefault(); setMainView('stream'); }
          else if (e.key === '3') { e.preventDefault(); setMainView('notes'); }
          else if (e.key === '4') { e.preventDefault(); setMainView('projects'); }
          else if (e.key === '5') { e.preventDefault(); setMainView('roadmap'); }
          else if (e.key === '6') { e.preventDefault(); setMainView('ideas'); }
          else if (e.key === '7') { e.preventDefault(); setMainView('retro'); }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [init, setTaskModal, setGitHubModal, setMainView, toggleAiDrawer]);

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
    if (mainView === 'dashboard') {
      title = 'CogniDev — Asosiy Boshqaruv Markazi';
    } else if (mainView === 'inbox') {
      title = 'CogniDev — Kiruvchi Xabarlar & Vazifalar (Inbox)';
    } else if (mainView === 'calendar') {
      title = 'CogniDev — Kalendar & Vaqt Rejasi (Calendar)';
    } else if (mainView === 'stream') {
      const t = tasks.find((x) => x.id === selectedTaskId);
      title = t ? `CogniDev — ${t.id} · ${t.title.slice(0, 40)}` : 'CogniDev — Vazifalar Oqimi';
    } else if (mainView === 'notes') {
      title = 'CogniDev — Notion Qaydlar & Docs';
    } else if (mainView === 'projects') {
      title = 'CogniDev — Faol Loyihalar & Portfel';
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
        <Suspense fallback={<WorkspaceLoading />}>
          {mainView === 'dashboard' && <DashboardWorkspace />}
          {mainView === 'inbox' && <InboxWorkspace />}
          {mainView === 'calendar' && <CalendarWorkspace />}
          {mainView === 'stream' && (
            <>
              <TaskStream />
              <WorkspaceEditor />
            </>
          )}
          {mainView === 'notes' && <NotionNotesWorkspace />}
          {mainView === 'projects' && <ProjectsWorkspace />}
          {mainView === 'roadmap' && <RoadmapWorkspace />}
          {mainView === 'ideas' && <IdeasWorkspace />}
          {mainView === 'retro' && <RetroWorkspace />}
        </Suspense>
        <Suspense fallback={null}>
          <AiAssistantDrawer />
        </Suspense>
      </div>
      <FloatingHud />
      <NotificationBanner />
      <Suspense fallback={null}>
        <StandupModal />
        <WeeklyCoachModal />
        <FocusModal />
        {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
      </Suspense>
    </div>
  );
}

