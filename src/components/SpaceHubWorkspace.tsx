import React, { useState, useMemo } from 'react';
import {
  Folder,
  CheckSquare,
  Briefcase,
  FileText,
  Sparkles,
  Trash2,
  CheckCircle2,
  ArrowRight,
  User,
  GraduationCap,
  Languages,
  Brain,
  Activity,
  TrendingUp,
  Plane,
  Archive,
  Code,
  BookOpen,
  Coffee,
  Layers,
  Link2,
  ExternalLink,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { Task, SpaceItem } from '../lib/types';
import { callAi } from '../lib/ai';

const SPACE_ICON_MAP: Record<string, any> = {
  User,
  GraduationCap,
  Briefcase,
  Languages,
  Brain,
  Activity,
  TrendingUp,
  Plane,
  Archive,
  Code,
  Sparkles,
  BookOpen,
  Coffee,
  Folder,
};

export default function SpaceHubWorkspace() {
  const {
    spaces,
    activeSpaceId,
    selectSpace,
    tasks,
    addTask,
    updateTaskStatus,
    deleteTask,
    activeProjects,
    notesDocs,
    links,
    addLink,
    deleteLink,
    setMainView,
    setHud,
    userProfile,
  } = useSynapse();

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'projects' | 'notes' | 'links' | 'ai'>('overview');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<Task['priority']>('Normal');
  const [quickLinkTitle, setQuickLinkTitle] = useState('');
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Active space object
  const currentSpace: SpaceItem | undefined = useMemo(() => {
    return spaces.find((s) => s.id === activeSpaceId) || spaces[0];
  }, [spaces, activeSpaceId]);

  const IconComponent = currentSpace ? (SPACE_ICON_MAP[currentSpace.icon] || Folder) : Folder;

  // Filter items for this space
  const spaceTasks = useMemo(() => {
    if (!currentSpace) return [];
    const spaceKey = currentSpace.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return tasks.filter((t) => {
      if (t.space_id === currentSpace.id) return true;
      const tagMatch = (t.tags || []).some((tag) => tag.toLowerCase().includes(spaceKey) || currentSpace.name.toLowerCase().includes(tag.toLowerCase()));
      const titleMatch = t.title.toLowerCase().includes(`[${currentSpace.name.toLowerCase()}]`);
      return tagMatch || titleMatch;
    });
  }, [tasks, currentSpace]);

  const spaceProjects = useMemo(() => {
    if (!currentSpace) return [];
    const nameLow = currentSpace.name.toLowerCase();
    return activeProjects.filter((p) => {
      const catMatch = (p.category || '').toLowerCase().includes(nameLow) || nameLow.includes((p.category || '').toLowerCase());
      const tagMatch = (p.tags || []).some((tag) => nameLow.includes(tag.toLowerCase()));
      return catMatch || tagMatch;
    });
  }, [activeProjects, currentSpace]);

  const spaceNotes = useMemo(() => {
    if (!currentSpace) return [];
    const nameLow = currentSpace.name.toLowerCase();
    return notesDocs.filter((n) => {
      const titleMatch = n.title.toLowerCase().includes(nameLow);
      const tagMatch = (n.tags || []).some((tag) => nameLow.includes(tag.toLowerCase()));
      return titleMatch || tagMatch;
    });
  }, [notesDocs, currentSpace]);

  const spaceLinks = useMemo(() => {
    if (!currentSpace) return [];
    const nameLow = currentSpace.name.toLowerCase();
    return links.filter((l) => {
      if (l.space_id === currentSpace.id) return true;
      const tagMatch = (l.tags || []).some((tag) => nameLow.includes(tag.toLowerCase()));
      const titleMatch = l.title.toLowerCase().includes(nameLow);
      return tagMatch || titleMatch;
    });
  }, [links, currentSpace]);

  const handleAddSpaceLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLinkTitle.trim() || !quickLinkUrl.trim() || !currentSpace) return;
    const formattedUrl = quickLinkUrl.trim().startsWith('http') ? quickLinkUrl.trim() : `https://${quickLinkUrl.trim()}`;
    addLink({
      title: quickLinkTitle.trim(),
      url: formattedUrl,
      category: 'docs',
      description: `${currentSpace.name} bo'limiga tegishli resurs`,
      tags: [currentSpace.name.toLowerCase().replace(/\s+/g, '-'), 'space'],
      space_id: currentSpace.id,
      pinned: false,
    });
    setHud(`"${quickLinkTitle.trim()}" havolasi qo‘shildi ✓`);
    setQuickLinkTitle('');
    setQuickLinkUrl('');
    setShowAddLinkForm(false);
  };


  // Handle Quick Add Task inside Space
  const handleAddSpaceTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || !currentSpace) return;

    const newId = 'task-' + Date.now();
    const tag = currentSpace.name.toLowerCase().replace(/\s+/g, '-');

    addTask({
      id: newId,
      workspace_id: 'default',
      space_id: currentSpace.id,
      title: `[${currentSpace.name}] ${quickTaskTitle.trim()}`,
      status: 'active',
      priority: quickTaskPriority,
      git_branch: null,
      pr_url: null,
      ai_source: 'manual',
      assignee_name: userProfile?.full_name || 'Dasturchi',
      assignee_avatar: (userProfile?.full_name || 'D').slice(0, 2).toUpperCase(),
      assignee_name2: null,
      assignee_avatar2: null,
      tags: [tag, 'space'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setHud(`"${quickTaskTitle.trim()}" vazifasi "${currentSpace.name}" ga qo‘shildi ✓`);
    setQuickTaskTitle('');
  };

  // Handle Domain AI Advice
  const handleAskDomainAi = async (customQuestion?: string) => {
    const q = customQuestion || aiPrompt;
    if (!q.trim() || !currentSpace) return;

    setAiLoading(true);
    setAiResponse(null);

    const spaceName = currentSpace.name;
    const systemPrompt = `Siz CogniDev dasturchi kokpitida "${spaceName}" sohasi bo'yicha eng yuqori darajadagi mutaxassis va AI mentorsiz. 
Foydalanuvchiga toza, professional va juda amaliy o'zbek tilida 3-5 punktda aniq harakatlar rejasini taqdim eting.`;

    const userPrompt = `Mening "${spaceName}" bo'limim bo'yicha savolim: ${q}. 
Hozir bu bo'limda ${spaceTasks.length} ta vazifa va ${spaceProjects.length} ta loyiha mavjud.`;

    try {
      const res = await callAi(userPrompt, systemPrompt);
      setAiResponse(res.text.trim());
      setAiPrompt('');
    } catch {
      setAiResponse("Kechirasiz, AI bilan bog‘lanishda xatolik yuz berdi. Sozlamalardan AI kalitlarini tekshiring.");
    } finally {
      setAiLoading(false);
    }
  };

  if (!currentSpace) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-400">
        <div>
          <Folder size={48} className="mx-auto mb-3 opacity-30 text-blue-400" />
          <h2 className="text-base font-bold text-white">Space tanlanmagan</h2>
          <p className="text-xs text-zinc-500 mt-1">Yon paneldagi (Sidebar) Spaces ro‘yxatidan birini tanlang.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-6 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Space Hero Card */}
        <div
          className="rounded-3xl border border-white/[0.08] p-6 md:p-8 relative overflow-hidden shadow-2xl transition"
          style={{
            background: `linear-gradient(135deg, ${currentSpace.color}15 0%, #121319 65%, #0a0b0f 100%)`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl ring-1 ring-white/20"
                style={{ backgroundColor: `${currentSpace.color}30`, color: currentSpace.color }}
              >
                <IconComponent size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-white">{currentSpace.name} Space</h1>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
                    style={{
                      backgroundColor: `${currentSpace.color}20`,
                      borderColor: `${currentSpace.color}40`,
                      color: currentSpace.color,
                    }}
                  >
                    Faol Muhit
                  </span>
                </div>
                <p className="text-[13px] text-zinc-300 mt-1 max-w-xl">
                  {currentSpace.name} bo‘yicha alohida ajratilgan vazifalar, loyihalar, o‘rganish qaydlari va maxsus AI mentor markazi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => selectSpace(null)}
                className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-3.5 py-2 text-[12px] font-medium text-zinc-300 transition"
              >
                <span>Barcha Bo‘limlar (Home)</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.08] relative z-10">
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Space Vazifalari</p>
              <p className="text-xl font-bold text-white mt-0.5">{spaceTasks.length} ta</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Bog‘langan Loyihalar</p>
              <p className="text-xl font-bold text-white mt-0.5">{spaceProjects.length} ta</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3">
              <p className="text-[11px] font-medium text-zinc-400">Notion Qaydlari</p>
              <p className="text-xl font-bold text-white mt-0.5">{spaceNotes.length} ta</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3 hidden md:block">
              <p className="text-[11px] font-medium text-zinc-400">Bajarilganlik Darajasi</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {spaceTasks.length > 0 ? `${Math.round((spaceTasks.filter((t) => t.status === 'completed').length / spaceTasks.length) * 100)}%` : '100%'}
              </p>
            </div>
          </div>
        </div>

        {/* Space Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
            Spacelar:
          </span>
          {spaces.map((sp) => {
            const isCur = currentSpace.id === sp.id;
            const Icon = SPACE_ICON_MAP[sp.icon] || Folder;
            return (
              <button
                key={sp.id}
                onClick={() => selectSpace(sp.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition shrink-0 ${
                  isCur
                    ? 'bg-white/10 text-white font-semibold border border-white/15 shadow-sm'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <Icon size={13} style={{ color: sp.color }} />
                <span>{sp.name}</span>
              </button>
            );
          })}
        </div>

        {/* Space Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3 flex-wrap">
          {[
            { id: 'overview', label: 'Umumiy Ko‘rinish', icon: Layers },
            { id: 'tasks', label: `Vazifalar (${spaceTasks.length})`, icon: CheckSquare },
            { id: 'projects', label: `Loyihalar (${spaceProjects.length})`, icon: Briefcase },
            { id: 'notes', label: `Qaydlar (${spaceNotes.length})`, icon: FileText },
            { id: 'links', label: `Havolalar (${spaceLinks.length})`, icon: Link2 },
            { id: 'ai', label: 'AI Space Mentori', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Quick Add & Tasks Preview */}
            <div className="md:col-span-7 space-y-4">
              {/* Quick Task Input Form */}
              <form onSubmit={handleAddSpaceTask} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121319] p-2">
                <input
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder={`"${currentSpace.name}" uchun yangi vazifa yozing…`}
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <select
                  value={quickTaskPriority}
                  onChange={(e) => setQuickTaskPriority(e.target.value as any)}
                  className="rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="High Priority">Yuqori</option>
                  <option value="Critical">Kritik</option>
                  <option value="P0 Blocker">Blocker</option>
                </select>
                <button
                  type="submit"
                  disabled={!quickTaskTitle.trim()}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition"
                >
                  Qo‘shish
                </button>
              </form>

              {/* Tasks List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Ushbu Space Vazifalari
                </h3>
                {spaceTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-zinc-500 text-xs">
                    Bu bo‘limda hozircha vazifalar yo‘q. Yuqoridagi formadan birinchi vazifani qo‘shing.
                  </div>
                ) : (
                  spaceTasks.slice(0, 6).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#121319] p-3 hover:border-white/15 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => updateTaskStatus(t.id, t.status === 'completed' ? 'active' : 'completed')}
                          className={`transition ${t.status === 'completed' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <span className={`text-xs font-semibold truncate ${t.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {t.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {t.priority}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Projects & Notes Summary */}
            <div className="md:col-span-5 space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Briefcase size={14} className="text-blue-400" />
                    <span>Loyihalar</span>
                  </h4>
                  <button onClick={() => setMainView('projects')} className="text-[11px] text-blue-400 hover:underline">
                    Barchasi →
                  </button>
                </div>
                {spaceProjects.length === 0 ? (
                  <p className="text-xs text-zinc-500">Ushbu spacega tegishli loyihalar yo‘q.</p>
                ) : (
                  spaceProjects.map((p) => (
                    <div key={p.id} className="rounded-xl bg-black/30 p-2.5 border border-white/5 space-y-1">
                      <p className="text-xs font-semibold text-white">{p.title}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{p.subtitle}</p>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Space AI Advisor Box */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                  <Sparkles size={15} />
                  <span>{currentSpace.name} AI Mentori</span>
                </div>
                <p className="text-xs text-purple-200/80 leading-relaxed">
                  Ushbu bo‘lim bo‘yicha rejalarni optimallashtirish va yangi g‘oyalarni muhokama qilish uchun maslahatchiga murojaat qiling.
                </p>
                <button
                  onClick={() => setActiveTab('ai')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-200 transition"
                >
                  <span>AI Mentor bilan suhbat</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tasks Full View */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <form onSubmit={handleAddSpaceTask} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121319] p-2.5">
              <input
                type="text"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder={`"${currentSpace.name}" uchun yangi vazifa yozing…`}
                className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <select
                value={quickTaskPriority}
                onChange={(e) => setQuickTaskPriority(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-black/50 px-2.5 py-2 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="High Priority">Yuqori</option>
                <option value="Critical">Kritik</option>
                <option value="P0 Blocker">Blocker</option>
              </select>
              <button
                type="submit"
                disabled={!quickTaskTitle.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition shadow-md"
              >
                Qo‘shish
              </button>
            </form>

            <div className="space-y-2">
              {spaceTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500 text-xs">
                  Vazifalar mavjud emas.
                </div>
              ) : (
                spaceTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#121319] p-3.5 hover:border-white/15 transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => updateTaskStatus(t.id, t.status === 'completed' ? 'active' : 'completed')}
                        className={`transition ${t.status === 'completed' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <div>
                        <p className={`text-xs font-semibold truncate ${t.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {t.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-500 font-mono">{t.priority}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">• {new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Projects */}
        {activeTab === 'projects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spaceProjects.length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500 text-xs">
                Ushbu spacega mos loyihalar topilmadi. Loyihalar bo‘limida yangi loyiha ochishingiz mumkin.
              </div>
            ) : (
              spaceProjects.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{p.title}</h3>
                    <span className="text-xs font-mono font-semibold text-blue-400">{p.progress}%</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{p.subtitle}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.tags?.map((tg) => (
                      <span key={tg} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400 font-mono">
                        #{tg}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Notes */}
        {activeTab === 'notes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spaceNotes.length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500 text-xs">
                Ushbu spacega tegishli qaydlar topilmadi.
              </div>
            ) : (
              spaceNotes.map((n) => (
                <div key={n.id} className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 space-y-2">
                  <h3 className="text-sm font-bold text-white">{n.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-3">{n.content || 'Bo‘sh hujjat'}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Links View */}
        {activeTab === 'links' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {currentSpace.name} Resurslari & Havolalari ({spaceLinks.length})
              </h3>
              <button
                onClick={() => setShowAddLinkForm(!showAddLinkForm)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm"
              >
                <Plus size={13} />
                <span>Havola Qo‘shish</span>
              </button>
            </div>

            {showAddLinkForm && (
              <form onSubmit={handleAddSpaceLink} className="rounded-2xl border border-white/10 bg-[#121319] p-4 space-y-3 animate-in fade-in duration-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={quickLinkTitle}
                    onChange={(e) => setQuickLinkTitle(e.target.value)}
                    placeholder="Havola nomi (masalan: API documentation)..."
                    className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={quickLinkUrl}
                    onChange={(e) => setQuickLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddLinkForm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                  >
                    Bekor
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Saqlash
                  </button>
                </div>
              </form>
            )}

            {spaceLinks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500 text-xs">
                Ushbu bo‘lim uchun havolalar mavjud emas. Yuqoridagi tugma orqali resurs qo‘shing.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {spaceLinks.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => {
                      const target = l.url.startsWith('http') ? l.url : `https://${l.url}`;
                      window.open(target, '_blank', 'noopener,noreferrer');
                    }}
                    className="group rounded-2xl border border-white/[0.08] bg-[#121319] p-4 hover:border-white/20 transition cursor-pointer flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition truncate">
                          {l.title}
                        </h4>
                        <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">{l.url.replace(/^https?:\/\//, '')}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(l.url);
                            setCopiedLinkId(l.id);
                            setTimeout(() => setCopiedLinkId(null), 1500);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-white"
                          title="Nusxalash"
                        >
                          {copiedLinkId === l.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLink(l.id);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400"
                          title="O‘chirish"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10px] text-zinc-500">
                      <span className="uppercase font-semibold tracking-wider text-blue-400">{l.category}</span>
                      <span className="flex items-center gap-1 group-hover:text-white transition">
                        <span>Ochish</span>
                        <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Tab 5: AI Domain Mentor */}
        {activeTab === 'ai' && (
          <div className="rounded-3xl border border-purple-500/20 bg-[#121319] p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{currentSpace.name} AI Mentori</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Ushbu sohada sizga professional yo‘l-yo‘riq va tavsiyalar beruvchi intellektual yordamchi</p>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                `Ushbu hafta "${currentSpace.name}" da nimalarga e'tibor qaratay?`,
                `Men uchun 3 bosqichli amaliy o'rganish rejasi tuzib ber`,
                `Mavjud to'siqlarni yengish bo'yicha eng yaxshi amaliyotlar`,
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleAskDomainAi(chip)}
                  disabled={aiLoading}
                  className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAskDomainAi(); }}
                placeholder={`"${currentSpace.name}" bo'yicha AI maslahatchisiga savol bering…`}
                className="flex-1 rounded-2xl border border-white/10 bg-black/50 px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={() => handleAskDomainAi()}
                disabled={aiLoading || !aiPrompt.trim()}
                className="rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-5 py-2.5 text-xs font-semibold text-white transition shadow-md shadow-purple-600/20"
              >
                {aiLoading ? 'Javob tayyorlanmoqda…' : 'Yuborish'}
              </button>
            </div>

            {/* Response Box */}
            {aiResponse && (
              <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5 space-y-2 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Mentor Tavsiyasi:</span>
                </p>
                <div className="text-xs text-purple-100/90 leading-relaxed whitespace-pre-wrap font-sans">
                  {aiResponse}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
