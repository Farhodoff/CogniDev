import { useState } from 'react';
import {
  Home,
  Inbox,
  CheckSquare,
  Calendar,
  FileText,
  Briefcase,
  Lightbulb,
  GraduationCap,
  Flame,
  Mic,
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
  Edit2,
  Code,
  Sparkles,
  BookOpen,
  Coffee,
  X,
  Check,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { SpaceItem } from '../lib/types';

const SPACE_ICONS = [
  { id: 'User', label: 'User' },
  { id: 'GraduationCap', label: 'Study' },
  { id: 'Briefcase', label: 'Work' },
  { id: 'Languages', label: 'Lang' },
  { id: 'Brain', label: 'AI' },
  { id: 'Activity', label: 'Sport' },
  { id: 'TrendingUp', label: 'Money' },
  { id: 'Plane', label: 'Travel' },
  { id: 'Archive', label: 'Archive' },
  { id: 'Code', label: 'Code' },
  { id: 'Sparkles', label: 'Idea' },
  { id: 'BookOpen', label: 'Book' },
  { id: 'Coffee', label: 'Life' },
  { id: 'Folder', label: 'Folder' },
];

const SPACE_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#10b981',
  '#eab308',
  '#06b6d4',
  '#71717a',
];

export default function Sidebar() {
  const {
    mainView,
    setMainView,
    userProfile,
    setProfileModal,
    spaces,
    activeSpaceId,
    selectSpace,
    addSpace,
    updateSpace,
    deleteSpace,
    notesDocs,
    roadmaps,
    projectIdeas,
    activeProjects,
    meetings,
    tasks,
    setHud,
    setFilter,
    setSearch,
  } = useSynapse();

  // Create Space Form State
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceIcon, setNewSpaceIcon] = useState('Folder');
  const [newSpaceColor, setNewSpaceColor] = useState('#3b82f6');

  // Edit Space Form State
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceName, setEditSpaceName] = useState('');
  const [editSpaceIcon, setEditSpaceIcon] = useState('Folder');
  const [editSpaceColor, setEditSpaceColor] = useState('#3b82f6');

  // Space icon renderer
  const getSpaceIcon = (iconName: string, color: string, size = 14) => {
    const props = { size, style: { color } };
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
      case 'Code': return <Code {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'BookOpen': return <BookOpen {...props} />;
      case 'Coffee': return <Coffee {...props} />;
      default: return <Folder {...props} />;
    }
  };

  const handleStartEdit = (space: SpaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpaceId(space.id);
    setEditSpaceName(space.name);
    setEditSpaceIcon(space.icon);
    setEditSpaceColor(space.color);
  };

  const handleSaveEdit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editSpaceName.trim()) return;
    updateSpace(id, {
      name: editSpaceName.trim(),
      icon: editSpaceIcon,
      color: editSpaceColor,
    });
    setEditingSpaceId(null);
    setHud(`"${editSpaceName.trim()}" yangilandi ✓`);
  };

  const handleDeleteSpace = (space: SpaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSpace(space.id);
    setHud(`"${space.name}" o‘chirildi`);
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
      badge: tasks.filter((t) => t.status !== 'completed').length > 0
        ? String(tasks.filter((t) => t.status !== 'completed').length)
        : undefined,
      badgeColor: 'bg-blue-600/30 text-blue-300 border border-blue-500/30',
      onClick: () => {
        setMainView('inbox');
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
        setMainView('calendar');
        setHud("Kunlik va haftalik taqvim rejasi ochildi");
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
      count: activeProjects.length,
      onClick: () => {
        setMainView('projects');
        setHud("Faol loyihalar markazi");
      },
    },
    {
      id: 'meetings',
      label: 'Meetings',
      icon: Mic,
      count: meetings.length,
      view: 'meetings' as const,
      onClick: () => {
        selectSpace(null);
        setMainView('meetings');
        setFilter(null);
        setHud("AI Meetings & Ovozli Uchrashuvlar (Transkript, Konspekt & Topshiriqlar)");
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
      id: 'learning',
      label: 'Learning',
      icon: GraduationCap,
      count: roadmaps.length,
      onClick: () => {
        selectSpace(null);
        setMainView('roadmap');
      },
    },
    {
      id: 'habits',
      label: 'Habit Tracker',
      icon: Flame,
      view: 'habits' as const,
      onClick: () => {
        selectSpace(null);
        setMainView('habits');
        setFilter(null);
        setHud("Kunlik odatlar & consistency kuzatuvi (Habit Tracker)");
      },
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      onClick: () => {
        selectSpace(null);
        setMainView('retro');
      },
    },
    {
      id: 'files',
      label: 'Files & Links',
      icon: Paperclip,
      onClick: () => {
        setMainView('notes');
        selectSpace(null);
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
            (item.id === 'inbox' && mainView === 'inbox') ||
            (item.id === 'calendar' && mainView === 'calendar') ||
            (item.id === 'notes' && mainView === 'notes') ||
            (item.id === 'projects' && mainView === 'projects') ||
            (item.id === 'tasks' && mainView === 'stream') ||
            (item.id === 'learning' && mainView === 'roadmap') ||
            (item.id === 'ideas' && mainView === 'ideas') ||
            (item.id === 'habits' && mainView === 'habits') ||
            (item.id === 'meetings' && mainView === 'meetings') ||
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
              onClick={() => {
                setCreatingSpace((v) => !v);
                setEditingSpaceId(null);
              }}
              className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              title="Yangi space qo'shish"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Form: Add Space */}
          {creatingSpace && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newSpaceName.trim()) {
                  addSpace({
                    name: newSpaceName.trim(),
                    icon: newSpaceIcon,
                    color: newSpaceColor,
                  });
                  setNewSpaceName('');
                  setCreatingSpace(false);
                  setHud(`"${newSpaceName.trim()}" qo‘shildi ✓`);
                }
              }}
              className="mb-2 rounded-xl border border-white/10 bg-[#16171d] p-2.5 space-y-2.5 shadow-lg animate-in fade-in zoom-in-95 duration-100"
            >
              <input
                autoFocus
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Space nomi (masalan: Startup)…"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[11.5px] text-zinc-200 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none"
              />

              {/* Icon Picker */}
              <div>
                <p className="text-[9.5px] text-zinc-500 font-semibold uppercase mb-1">Belgi (Icon)</p>
                <div className="grid grid-cols-7 gap-1">
                  {SPACE_ICONS.map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setNewSpaceIcon(ic.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded transition ${
                        newSpaceIcon === ic.id ? 'bg-blue-600/40 ring-1 ring-blue-400' : 'hover:bg-white/10 opacity-70'
                      }`}
                      title={ic.label}
                    >
                      {getSpaceIcon(ic.id, newSpaceColor, 12)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <p className="text-[9.5px] text-zinc-500 font-semibold uppercase mb-1">Rang</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {SPACE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSpaceColor(c)}
                      className={`h-3.5 w-3.5 rounded-full transition ${newSpaceColor === c ? 'scale-125 ring-2 ring-white/60' : 'opacity-60'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
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

          {/* Spaces List */}
          <div className="space-y-0.5">
            {spaces.map((space) => {
              const isSelected = activeSpaceId === space.id;
              const isEditing = editingSpaceId === space.id;

              if (isEditing) {
                return (
                  <form
                    key={space.id}
                    onSubmit={(e) => handleSaveEdit(space.id, e)}
                    className="rounded-xl border border-blue-500/30 bg-[#16171d] p-2 space-y-2 shadow-lg"
                  >
                    <input
                      autoFocus
                      value={editSpaceName}
                      onChange={(e) => setEditSpaceName(e.target.value)}
                      placeholder="Space nomi…"
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[11.5px] text-zinc-200 focus:border-blue-400 focus:outline-none"
                    />

                    {/* Icon Picker */}
                    <div className="grid grid-cols-7 gap-1">
                      {SPACE_ICONS.map((ic) => (
                        <button
                          key={ic.id}
                          type="button"
                          onClick={() => setEditSpaceIcon(ic.id)}
                          className={`flex h-5 w-5 items-center justify-center rounded transition ${
                            editSpaceIcon === ic.id ? 'bg-blue-600/40 ring-1 ring-blue-400' : 'hover:bg-white/10 opacity-70'
                          }`}
                          title={ic.label}
                        >
                          {getSpaceIcon(ic.id, editSpaceColor, 12)}
                        </button>
                      ))}
                    </div>

                    {/* Color Picker */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {SPACE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditSpaceColor(c)}
                          className={`h-3.5 w-3.5 rounded-full transition ${editSpaceColor === c ? 'scale-125 ring-2 ring-white/60' : 'opacity-60'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingSpaceId(null)}
                        className="rounded p-1 text-zinc-400 hover:text-zinc-200"
                        title="Bekor qilish"
                      >
                        <X size={12} />
                      </button>
                      <button
                        type="submit"
                        disabled={!editSpaceName.trim()}
                        className="rounded bg-blue-600 p-1 text-white hover:bg-blue-500 disabled:opacity-40"
                        title="Saqlash"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={space.id}
                  onClick={() => {
                    selectSpace(isSelected ? null : space.id);
                    setHud(isSelected ? "Barcha bo'limlar" : `${space.name} bo'limi tanlandi`);
                  }}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[12px] font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.08]'
                      : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {getSpaceIcon(space.icon, space.color)}
                  </span>
                  <span className="truncate flex-1">{space.name}</span>

                  {/* Actions on hover: Edit & Delete */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleStartEdit(space, e)}
                      title="Tahrirlash"
                      className="p-1 text-zinc-500 hover:text-blue-400 rounded transition"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSpace(space, e)}
                      title="O'chirish"
                      className="p-1 text-zinc-500 hover:text-rose-400 rounded transition"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Glowing Blue Dot when selected (from screenshot) */}
                  {isSelected && (
                    <span className="ml-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)] shrink-0" />
                  )}
                </div>
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
            {userProfile.avatar_initials || (userProfile.full_name ? userProfile.full_name.charAt(0).toUpperCase() : 'D')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-zinc-200 group-hover:text-white transition">
              {userProfile.full_name || 'Dasturchi'}
            </p>
            <p className="truncate text-[10px] text-zinc-500 font-mono">
              {userProfile.title || 'Dasturchi'}
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
}
