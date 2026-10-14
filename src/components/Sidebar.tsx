import { useState } from 'react';
import {
  Home,
  Inbox,
  CheckSquare,
  Calendar,
  FileText,
  Briefcase,
  Lightbulb,
  MessageSquare,
  GraduationCap,
  Target,
  Flame,
  BarChart3,
  Paperclip,
  Plus,
  Trash2,
  User,
  Languages,
  Brain,
  Activity,
  TrendingUp,
  Plane,
  Archive,
  Folder,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { SpaceItem } from '../lib/types';

export default function Sidebar() {
  const {
    mainView,
    setMainView,
    userProfile,
    setProfileModal,
    spaces,
    activeSpaceId,
    selectSpace,
    toggleAiDrawer,
    notesDocs,
    roadmaps,
    projectIdeas,
    setHud,
    setFilter,
    setSearch,
  } = useSynapse();

  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState('#3b82f6');

  // Space icon helper
  const getSpaceIcon = (iconName: string, color: string) => {
    const props = { size: 14, style: { color } };
    switch (iconName) {
      case 'User': return <User {...props} />;
      case 'GraduationCap': return <GraduationCap {...props} />;
      case 'Briefcase': return <Briefcase {...props} />;
      case 'Languages': return <Languages {...props} />;
      case 'Brain': return <Brain {...props} />;
      case 'Activity': return <Activity {...props} />;
      case 'TrendingUp': return <TrendingUp {...props} />;
      case 'Plane': return <Plane {...props} />;
      case 'Archive': return <Archive {...props} />;
      default: return <Folder {...props} />;
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: Home,
      view: 'dashboard' as const,
      onClick: () => {
        setMainView('dashboard');
        setFilter(null);
        setSearch('');
      },
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      badge: '3',
      badgeColor: 'bg-blue-600/30 text-blue-300 border border-blue-500/30',
      onClick: () => {
        setMainView('stream');
        setFilter(null);
        setHud("Kiruvchi xabarlar va yangi vazifalar (Inbox)");
      },
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      onClick: () => {
        setMainView('stream');
        setFilter(null);
      },
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      onClick: () => {
        setMainView('dashboard');
        setHud("Kunlik Taqvim ochildi");
        const el = document.getElementById('myspace-calendar-card');
        el?.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: FileText,
      count: notesDocs.length,
      onClick: () => setMainView('notes'),
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: Briefcase,
      count: 4,
      onClick: () => {
        setMainView('ideas');
        setHud("Faol loyihalar & inkubator");
      },
    },
    {
      id: 'ideas',
      label: 'Ideas',
      icon: Lightbulb,
      count: projectIdeas.length,
      onClick: () => setMainView('ideas'),
    },
    {
      id: 'ai-chat',
      label: 'AI Chat History',
      icon: MessageSquare,
      onClick: () => toggleAiDrawer(),
    },
    {
      id: 'learning',
      label: 'Learning',
      icon: GraduationCap,
      count: roadmaps.length,
      onClick: () => setMainView('roadmap'),
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: Target,
      onClick: () => {
        setMainView('dashboard');
        setHud("Maqsadlar ko'rsatkichi");
        const el = document.getElementById('myspace-goals-card');
        el?.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      id: 'habits',
      label: 'Habit Tracker',
      icon: Flame,
      onClick: () => {
        setMainView('dashboard');
        setHud("Kunlik odatlar & sport");
      },
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      onClick: () => setMainView('retro'),
    },
    {
      id: 'files',
      label: 'Files & Links',
      icon: Paperclip,
      onClick: () => {
        setMainView('notes');
        setHud("Hujjatlar & havolalar");
      },
    },
  ];

  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0d12]/95 px-3 py-3 select-none overflow-hidden">
      {/* Top Nav List */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            (item.view && mainView === item.view && !activeSpaceId) ||
            (item.id === 'notes' && mainView === 'notes') ||
            (item.id === 'tasks' && mainView === 'stream') ||
            (item.id === 'learning' && mainView === 'roadmap') ||
            (item.id === 'ideas' && mainView === 'ideas') ||
            (item.id === 'reports' && mainView === 'retro');

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] font-medium transition ${
                isActive
                  ? 'bg-blue-600/20 text-white font-semibold border border-blue-500/20 shadow-sm'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
              }`}
            >
              <Icon
                size={15}
                className={isActive ? 'text-blue-400' : 'text-zinc-400'}
              />
              <span className="truncate">{item.label}</span>

              {item.badge && (
                <span className={`ml-auto rounded-full px-2 py-0.2 text-[10px] font-bold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}

              {item.count !== undefined && !item.badge && (
                <span className="ml-auto rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* SPACES Section */}
        <div className="pt-3 pb-1">
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              SPACES
            </span>
            <button
              onClick={() => setCreatingSpace((v) => !v)}
              className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
              title="Yangi space qo'shish"
            >
              <Plus size={13} />
            </button>
          </div>

          {creatingSpace && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newSpaceName.trim()) {
                  const newSpace: SpaceItem = {
                    id: 'sp-' + Date.now(),
                    name: newSpaceName.trim(),
                    icon: 'Folder',
                    color: newSpaceColor,
                  };
                  const updated = [...spaces, newSpace];
                  try {
                    localStorage.setItem('cognidev_spaces', JSON.stringify(updated));
                  } catch {}
                  useSynapse.setState({ spaces: updated });
                  setNewSpaceName('');
                  setCreatingSpace(false);
                }
              }}
              className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 space-y-2"
            >
              <input
                autoFocus
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Space nomi (masalan: Startup)…"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[11.5px] text-zinc-200 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                {['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewSpaceColor(c)}
                    className={`h-3.5 w-3.5 rounded-full transition ${newSpaceColor === c ? 'scale-125 ring-2 ring-white/50' : 'opacity-60'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => setCreatingSpace(false)}
                  className="rounded px-2 py-0.5 text-[10.5px] text-zinc-400 hover:text-zinc-200"
                >
                  Bekor
                </button>
                <button
                  type="submit"
                  disabled={!newSpaceName.trim()}
                  className="rounded bg-blue-600 px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  Qo'shish
                </button>
              </div>
            </form>
          )}

          <div className="space-y-0.5">
            {spaces.map((space) => {
              const isSelected = activeSpaceId === space.id;
              return (
                <button
                  key={space.id}
                  onClick={() => {
                    selectSpace(isSelected ? null : space.id);
                    setHud(isSelected ? "Barcha bo'limlar" : `${space.name} bo'limi tanlandi`);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[12px] font-medium transition ${
                    isSelected
                      ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.08]'
                      : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {getSpaceIcon(space.icon, space.color)}
                  </span>
                  <span className="truncate">{space.name}</span>
                  {isSelected && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Trash & User Profile */}
      <div className="mt-auto pt-2 border-t border-white/[0.06] space-y-1.5">
        <button
          onClick={() => setHud("Chiqindi qutisi bo'sh")}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 transition"
        >
          <Trash2 size={14} className="text-zinc-500" />
          <span>Trash</span>
        </button>

        {/* User Profile Card */}
        <button
          onClick={() => setProfileModal(true)}
          className="flex w-full items-center gap-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] p-1.5 hover:bg-white/[0.06] transition text-left group"
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm ring-1 ring-white/10"
            style={{ backgroundColor: userProfile.avatar_color || '#3b82f6' }}
          >
            {userProfile.avatar_initials || 'F'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-zinc-200 group-hover:text-white transition">
              {userProfile.full_name || 'Farhod'}
            </p>
            <p className="truncate text-[10px] text-zinc-500 font-mono">
              {userProfile.title || 'Backend Developer'}
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
}
