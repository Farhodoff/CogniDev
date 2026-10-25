import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Sparkles,
  ExternalLink,
  FolderGit2,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  ArrowRight,
  Tag,
  X,
  Layers,
  Check,
  TrendingUp,
  ListTodo,
  Download,
  FileCode,
  FileText,
} from 'lucide-react';
import GithubIcon from './GithubIcon';
import { useSynapse } from '../lib/store';
import { callAi } from '../lib/ai';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';
import type { ActiveProject, TaskPriority } from '../lib/types';
import FormattedAiText from './FormattedAiText';
import GitInspectorModal from './GitInspectorModal';

const COLOR_OPTIONS = [
  { name: 'Ko‘k (Blue)', value: '#3b82f6' },
  { name: 'Siyohrang (Purple)', value: '#8b5cf6' },
  { name: 'Zumrad (Emerald)', value: '#10b981' },
  { name: 'Pushti (Pink/Rose)', value: '#ec4899' },
  { name: 'Sariq (Amber)', value: '#f59e0b' },
  { name: 'Moviy (Cyan)', value: '#06b6d4' },
  { name: 'Qizil (Red)', value: '#ef4444' },
];

const CATEGORY_PRESETS = [
  'Desktop App',
  'Fullstack Web',
  'Backend & API',
  'Systems & CLI',
  'AI & ML',
  'Mobile App',
  'DevOps & Cloud',
];

function downloadBlob(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportProjectsToMarkdown(projects: ActiveProject[]): string {
  let md = `# 🚀 Software Engineering Projects Portfolio\n\n`;
  md += `*Exported from CogniDev on ${new Date().toLocaleDateString()}*\n\n`;
  md += `## Projects Overview\n\n`;
  md += `| Project | Category | Status | Progress | GitHub | Tech Stack |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const p of projects) {
    const status = p.progress >= 100 ? '✅ Completed' : p.status === 'on_hold' ? '⏸️ On Hold' : '⚡ In Progress';
    const repo = p.github_url ? `[Link](${p.github_url})` : '-';
    const tags = p.tags && p.tags.length ? p.tags.join(', ') : '-';
    md += `| **${p.title}** | ${p.category || '-'} | ${status} | ${p.progress}% | ${repo} | \`${tags}\` |\n`;
  }
  md += `\n---\n\n## Technical Details\n\n`;
  for (const p of projects) {
    md += `### ${p.title}\n`;
    if (p.subtitle) md += `> ${p.subtitle}\n\n`;
    md += `- **Category:** ${p.category || 'General'}\n`;
    md += `- **Progress:** ${p.progress}%\n`;
    if (p.github_url) md += `- **Repository:** ${p.github_url}\n`;
    if (p.tags?.length) md += `- **Tech Stack:** ${p.tags.join(', ')}\n`;
    md += `\n`;
  }
  return md;
}

function exportProjectsToJson(projects: ActiveProject[]): string {
  return JSON.stringify(
    {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalProjects: projects.length,
      projects,
    },
    null,
    2
  );
}

export default function ProjectsWorkspace() {
  const {
    activeProjects,
    updateProjectProgress,
    addActiveProject,
    updateActiveProject,
    deleteActiveProject,
    tasks,
    addTask,
    setMainView,
    setHud,
    setGitHubModal,
    setGitHubTargetRepoUrl,
    userProfile,
  } = useSynapse();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'on_hold'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ActiveProject | null>(null);
  const [aiDecomposingProject, setAiDecomposingProject] = useState<ActiveProject | null>(null);
  const [showGitModal, setShowGitModal] = useState(false);
  const [gitModalPath, setGitModalPath] = useState<string | undefined>(undefined);

  // Form states for Create / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formCategory, setFormCategory] = useState('Fullstack Web');
  const [formProgress, setFormProgress] = useState(25);
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formGithubUrl, setFormGithubUrl] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'in_progress' | 'completed' | 'on_hold'>('active');

  // AI Task Generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedTasks, setAiGeneratedTasks] = useState<
    Array<{ title: string; priority: TaskPriority; git_branch?: string }>
  >([]);
  const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormTitle('');
    setFormSubtitle('');
    setFormCategory('Fullstack Web');
    setFormProgress(10);
    setFormColor('#3b82f6');
    setFormGithubUrl('');
    setFormTags('React, TypeScript');
    setFormStatus('active');
    setEditingProject(null);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (project: ActiveProject) => {
    setEditingProject(project);
    setFormTitle(project.title);
    setFormSubtitle(project.subtitle || '');
    setFormCategory(project.category || 'Fullstack Web');
    setFormProgress(project.progress);
    setFormColor(project.color || '#3b82f6');
    setFormGithubUrl(project.github_url || '');
    setFormTags(project.tags ? project.tags.join(', ') : '');
    setFormStatus(project.status || (project.progress >= 100 ? 'completed' : 'active'));
    setShowCreateModal(true);
  };

  // Save Project (Create or Edit)
  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingProject) {
      updateActiveProject(editingProject.id, {
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        category: formCategory,
        progress: Math.min(100, Math.max(0, formProgress)),
        color: formColor,
        github_url: formGithubUrl.trim() || undefined,
        tags: tagsArray,
        status: formProgress >= 100 ? 'completed' : formStatus,
      });
      setHud(`"${formTitle.trim()}" loyihasi muvaffaqiyatli yangilandi ✓`);
    } else {
      addActiveProject({
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        category: formCategory,
        progress: Math.min(100, Math.max(0, formProgress)),
        color: formColor,
        github_url: formGithubUrl.trim() || undefined,
        tags: tagsArray,
        status: formProgress >= 100 ? 'completed' : formStatus,
        created_at: new Date().toISOString(),
      });
      setHud(`Yangi "${formTitle.trim()}" loyihasi qo‘shildi ✓`);
    }

    setShowCreateModal(false);
  };

  // Quick progress update
  const handleAdjustProgress = (id: string, current: number, delta: number) => {
    const next = Math.min(100, Math.max(0, current + delta));
    updateProjectProgress(id, next);
    if (next >= 100) {
      updateActiveProject(id, { status: 'completed' });
      setHud("Loyiha 100% ga yetkazildi! Tabriklaymiz 🎉");
    }
  };

  // Unique tags from all projects
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of activeProjects) {
      if (p.tags) {
        for (const t of p.tags) {
          if (t.trim()) set.add(t.trim());
        }
      }
    }
    return Array.from(set).sort();
  }, [activeProjects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return activeProjects.filter((p) => {
      // Status filter
      if (statusFilter === 'in_progress' && p.progress >= 100) return false;
      if (statusFilter === 'completed' && p.progress < 100) return false;
      if (statusFilter === 'on_hold' && p.status !== 'on_hold') return false;

      // Tag filter
      if (selectedTagFilter && !p.tags?.some((t) => t.toLowerCase() === selectedTagFilter.toLowerCase())) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = p.title.toLowerCase().includes(q);
      const inSubtitle = p.subtitle?.toLowerCase().includes(q);
      const inCategory = p.category?.toLowerCase().includes(q);
      const inTags = p.tags?.some((t) => t.toLowerCase().includes(q));
      return inTitle || inSubtitle || inCategory || inTags;
    });
  }, [activeProjects, statusFilter, selectedTagFilter, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = activeProjects.length;
    const completed = activeProjects.filter((p) => p.progress >= 100).length;
    const inProgress = activeProjects.filter((p) => p.progress < 100 && p.status !== 'on_hold').length;
    const avgProgress =
      total > 0 ? Math.round(activeProjects.reduce((acc, p) => acc + p.progress, 0) / total) : 0;
    return { total, completed, inProgress, avgProgress };
  }, [activeProjects]);

  // Open AI Project Decomposition
  const handleOpenAiDecompose = (project: ActiveProject) => {
    setAiDecomposingProject(project);
    setAiGeneratedTasks([]);
    setAiAnalysisText(null);
  };

  // Trigger AI Decomposition
  const handleRunAiDecompose = async () => {
    if (!aiDecomposingProject) return;

    setAiLoading(true);
    setHud("AI loyihani texnik arxitektura va vazifalarga ajratmoqda...");

    const prompt = `Loyiha nomi: ${aiDecomposingProject.title}
Tavsifi: ${aiDecomposingProject.subtitle || "Ko'rsatilmagan"}
Yo'nalishi: ${aiDecomposingProject.category || "Dasturiy loyiha"}
Texnologiyalar: ${aiDecomposingProject.tags?.join(', ') || 'TypeScript, Go, Rust, React'}
Joriy progress: ${aiDecomposingProject.progress}%

Iltimos, ushbu loyihani muvaffaqiyatli yakunlash uchun 4-5 ta aniq, amaliy texnik vazifalar (tasks) rejasini tuzib bering.
Har bir vazifa uchun:
- Vazifa sarlavhasi (aniq, harakatga undovchi)
- Tavsiya etilgan Git branch nomi (masalan: feat/auth-service)
- Muhimlik darajasi (P0 Blocker, High Priority, Normal)

Javobni toza va aniq formatda bering. Ortiqcha tinish belgilari, sun'iy ASCII jadvallar va panjaralarsiz (##) yozing.`;

    const system = "Siz tajribali Senior Tech Lead va dasturiy arxitektorsiz. O'zbek tilida junior/middle dasturchi loyihasini tartibli arxitektura vazifalariga ajratasiz.";

    try {
      const res = await callAi(prompt, system, selectedProvider);
      setAiAnalysisText(res.text);

      // Extract tasks from response text
      const extracted: Array<{ title: string; priority: TaskPriority; git_branch?: string }> = [];
      const lines = res.text.split('\n');

      for (const line of lines) {
        const clean = line.trim();
        const taskMatch = clean.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
        if (taskMatch && taskMatch[1].length > 8 && !taskMatch[1].startsWith('#')) {
          const raw = taskMatch[1].replace(/\*\*/g, '').trim();
          let priority: TaskPriority = 'High Priority';
          if (raw.toLowerCase().includes('p0') || raw.toLowerCase().includes('muhim') || raw.toLowerCase().includes('blocker')) {
            priority = 'P0 Blocker';
          } else if (raw.toLowerCase().includes('normal') || raw.toLowerCase().includes('oddiy')) {
            priority = 'Normal';
          }

          // branch deduction
          const branch = `feat/${aiDecomposingProject.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-task-${extracted.length + 1}`;
          extracted.push({
            title: raw.slice(0, 90),
            priority,
            git_branch: branch,
          });
        }
        if (extracted.length >= 5) break;
      }

      setAiGeneratedTasks(extracted);
      setHud("AI loyiha vazifalari muvaffaqiyatli shakllantirildi ✓");
    } catch {
      setHud("AI tahlilida xatolik yuz berdi. Provayder kalitini tekshiring.");
    } finally {
      setAiLoading(false);
    }
  };

  // Export AI Tasks to Task Stream
  const handleExportTasksToStream = () => {
    if (!aiGeneratedTasks.length || !aiDecomposingProject) return;

    const now = new Date().toISOString();
    for (let idx = 0; idx < aiGeneratedTasks.length; idx++) {
      const t = aiGeneratedTasks[idx];
      const taskId = `DEV-${Date.now().toString().slice(-4)}${idx + 1}`;
      addTask({
        id: taskId,
        workspace_id: 'default',
        title: `[${aiDecomposingProject.title}] ${t.title}`,
        status: t.priority === 'P0 Blocker' ? 'blocker' : 'active',
        priority: t.priority,
        git_branch: t.git_branch || null,
        pr_url: null,
        ai_source: 'gemini',
        assignee_name: userProfile?.full_name || 'Dasturchi',
        assignee_avatar: (userProfile?.full_name || 'D').slice(0, 2).toUpperCase(),
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ['project', aiDecomposingProject.title.toLowerCase().replace(/\s+/g, '-')],
        created_at: now,
        updated_at: now,
      });
    }

    setHud(`${aiGeneratedTasks.length} ta yangi vazifa Vazifalar Oqimiga (Stream) qo‘shildi ✓`);
    setAiDecomposingProject(null);
    setMainView('stream');
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-[#0d0e12]">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#121318]/90 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
            <Briefcase size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-white tracking-wide">
                Loyihalar Portfeli & Boshqaruvi
              </h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-300 border border-blue-500/20">
                {activeProjects.length} ta loyiha
              </span>
            </div>
            <p className="text-[11.5px] text-zinc-400">
              Faol dasturiy ta'minot loyihalaringiz, rivojlanish progressi va bog‘langan vazifalar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Provider selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/40 px-2.5 py-1 text-[11.5px]">
            <Sparkles size={13} className="text-purple-400" />
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
              className="bg-transparent font-medium text-zinc-300 focus:outline-none cursor-pointer"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#181920] text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
              title="Portfelni eksport qilish"
            >
              <Download size={14} />
              <span>Eksport</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-white/10 bg-[#16171d] p-1.5 shadow-2xl space-y-1">
                <button
                  onClick={() => {
                    const md = exportProjectsToMarkdown(activeProjects);
                    downloadBlob('projects_portfolio.md', md, 'text/markdown');
                    setHud("Loyihalar Markdown fayli yuklab olindi ✓");
                    setShowExportMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] text-zinc-300 hover:bg-white/5 hover:text-white transition"
                >
                  <FileText size={13} className="text-emerald-400" />
                  <span>Markdown (.md)</span>
                </button>
                <button
                  onClick={() => {
                    const json = exportProjectsToJson(activeProjects);
                    downloadBlob('projects_portfolio.json', json, 'application/json');
                    setHud("Loyihalar JSON fayli yuklab olindi ✓");
                    setShowExportMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] text-zinc-300 hover:bg-white/5 hover:text-white transition"
                >
                  <FileCode size={13} className="text-blue-400" />
                  <span>JSON (.json)</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setGitModalPath(undefined);
              setShowGitModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[12px] font-medium text-orange-300 hover:bg-orange-500/20 transition"
          >
            <FolderGit2 size={13} className="text-orange-400" />
            <span>Git Repozitoriy</span>
          </button>

          <button
            onClick={() => {
              setGitHubTargetRepoUrl(null);
              setGitHubModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[12px] font-medium text-indigo-300 hover:bg-indigo-500/20 transition shadow-sm shadow-indigo-500/10"
            title="GitHub repozitoriyalari commitlari va AI vazifalar dvigateli"
          >
            <GithubIcon size={13} className="text-indigo-400" />
            <span>GitHub Hub & AI</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-sky-500 transition"
          >
            <Plus size={15} />
            <span>Yangi Loyiha</span>
          </button>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div className="grid grid-cols-4 gap-4 border-b border-white/[0.06] bg-black/20 px-6 py-3">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <Layers size={16} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 uppercase">Jami Loyihalar</p>
            <p className="text-[17px] font-bold text-white font-mono">{stats.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <Clock size={16} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 uppercase">Faol Jarayonda</p>
            <p className="text-[17px] font-bold text-amber-300 font-mono">{stats.inProgress}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 uppercase">Yakunlangan</p>
            <p className="text-[17px] font-bold text-emerald-300 font-mono">{stats.completed}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
            <TrendingUp size={16} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 uppercase">O‘rtacha Progress</p>
            <p className="text-[17px] font-bold text-purple-300 font-mono">{stats.avgProgress}%</p>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0f1015] px-6 py-2.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-3 py-1 text-[11.5px] font-medium transition ${
              statusFilter === 'all'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Barchasi ({activeProjects.length})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`rounded-lg px-3 py-1 text-[11.5px] font-medium transition ${
              statusFilter === 'in_progress'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Faol ({stats.inProgress})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`rounded-lg px-3 py-1 text-[11.5px] font-medium transition ${
              statusFilter === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Yakunlangan ({stats.completed})
          </button>
          <button
            onClick={() => setStatusFilter('on_hold')}
            className={`rounded-lg px-3 py-1 text-[11.5px] font-medium transition ${
              statusFilter === 'on_hold'
                ? 'bg-zinc-700/50 text-zinc-200 border border-zinc-600'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Kutilmoqda
          </button>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Loyiha yoki texnologiya izlash..."
            className="w-full rounded-xl border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-[12px] text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* ── TECH TAG PILLS BAR ── */}
      {allUniqueTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.04] bg-black/20 px-6 py-2 scrollbar-none">
          <span className="text-[10.5px] font-semibold uppercase text-zinc-500 shrink-0 mr-1 flex items-center gap-1">
            <Tag size={10} /> Stek:
          </span>
          <button
            onClick={() => setSelectedTagFilter(null)}
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-mono transition ${
              selectedTagFilter === null
                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/30 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Barchasi
          </button>
          {allUniqueTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
              className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10.5px] transition ${
                selectedTagFilter === tag
                  ? 'bg-blue-600/40 text-blue-200 border border-blue-400 font-bold'
                  : 'bg-white/[0.02] text-zinc-400 border border-white/[0.05] hover:bg-white/[0.06] hover:text-zinc-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* ── PROJECTS GRID ── */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {filteredProjects.length === 0 ? (
          <div className="mx-auto max-w-md p-10 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] my-8 space-y-3">
            <FolderGit2 size={36} className="mx-auto text-zinc-600" />
            <h3 className="text-[14.5px] font-bold text-white">Hech qanday loyiha topilmadi</h3>
            <p className="text-[12px] text-zinc-400">
              Qidiruv so‘zini o‘zgartiring yoki yangi loyihangizni portfelga kiriting.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow hover:bg-blue-500 transition"
            >
              <Plus size={14} /> Loyiha qo‘shish
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProjects.map((p) => {
              const isCompleted = p.progress >= 100;
              const relatedTasks = tasks.filter(
                (t) =>
                  t.title.toLowerCase().includes(p.title.toLowerCase()) ||
                  t.tags.some((tag) => tag.toLowerCase() === p.title.toLowerCase().replace(/\s+/g, '-'))
              );

              return (
                <div
                  key={p.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#121318]/90 p-5 shadow-lg transition-all duration-200 hover:border-white/20 hover:shadow-2xl"
                  style={{
                    borderTop: `3px solid ${p.color || '#3b82f6'}`,
                  }}
                >
                  <div className="space-y-3">
                    {/* Top row: Category & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-semibold text-zinc-300">
                        {p.category || 'Software Project'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isCompleted ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={11} /> Tugallandi
                          </span>
                        ) : p.status === 'on_hold' ? (
                          <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                            To'xtatilgan
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                            <Clock size={10} /> Jarayonda
                          </span>
                        )}

                        {/* Edit & Delete actions */}
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-white transition"
                          title="Tahrirlash"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${p.title}" loyihasini o'chirmoqchimisiz?`)) {
                              deleteActiveProject(p.id);
                              setHud("Loyiha o'chirildi");
                            }
                          }}
                          className="rounded p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                          title="O'chirish"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div>
                      <h3 className="text-[15px] font-bold text-white group-hover:text-blue-300 transition">
                        {p.title}
                      </h3>
                      {p.subtitle && (
                        <p className="mt-1 text-[12px] leading-relaxed text-zinc-400 line-clamp-2">
                          {p.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-black/40 border border-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                          >
                            <Tag size={9} />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* GitHub link if available */}
                    {p.github_url && (
                      <div className="pt-0.5">
                        <a
                          href={p.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-sky-400 hover:text-sky-300 transition"
                        >
                          <FolderGit2 size={13} />
                          <span className="truncate max-w-[240px]">
                            {p.github_url.replace('https://github.com/', '')}
                          </span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Progress & Action Buttons */}
                  <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-3.5">
                    {/* Progress slider bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="font-semibold text-zinc-400">Progress</span>
                        <span className="font-mono font-bold text-white">{p.progress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-black/50 border border-white/5">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${p.progress}%`,
                            backgroundColor: p.color || '#3b82f6',
                          }}
                        />
                      </div>

                      {/* Quick progress adjustments */}
                      <div className="mt-2 flex items-center justify-between gap-1 text-[10.5px]">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleAdjustProgress(p.id, p.progress, -10)}
                            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                          >
                            -10%
                          </button>
                          <button
                            onClick={() => handleAdjustProgress(p.id, p.progress, 10)}
                            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                          >
                            +10%
                          </button>
                          <button
                            onClick={() => handleAdjustProgress(p.id, p.progress, 25)}
                            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                          >
                            +25%
                          </button>
                        </div>

                        {!isCompleted && (
                          <button
                            onClick={() => handleAdjustProgress(p.id, p.progress, 100)}
                            className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
                          >
                            <Check size={11} /> 100%
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Related Tasks & AI decompose trigger */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => {
                          setMainView('stream');
                          setHud(`"${p.title}" bo'yicha vazifalar oqimiga o'tildi`);
                        }}
                        className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition"
                      >
                        <ListTodo size={12} className="text-blue-400" />
                        <span>Bog‘langan vazifalar ({relatedTasks.length})</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {p.github_url && (
                          <button
                            onClick={() => {
                              setGitHubTargetRepoUrl(p.github_url || null);
                              setGitHubModal(true);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-indigo-500/15 px-2 py-1 text-[10.5px] font-semibold text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition"
                            title="GitHub commitlar va AI vazifalar generatori"
                          >
                            <GithubIcon size={11} /> GitHub AI
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setGitModalPath(undefined);
                            setShowGitModal(true);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-orange-500/10 px-2 py-1 text-[10.5px] font-semibold text-orange-300 border border-orange-500/20 hover:bg-orange-500/20 transition"
                          title="Git holatini ko'rish"
                        >
                          <FolderGit2 size={11} /> Git
                        </button>
                        <button
                          onClick={() => handleOpenAiDecompose(p)}
                          className="flex items-center gap-1 rounded-lg bg-purple-500/10 px-2 py-1 text-[10.5px] font-semibold text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition"
                          title="AI orqali vazifalar rejasini tuzish"
                        >
                          <Sparkles size={11} /> AI Reja
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: CREATE / EDIT PROJECT ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121318] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-blue-400" />
                <h3 className="text-[15px] font-bold text-white">
                  {editingProject ? 'Loyihani Tahrirlash' : 'Yangi Loyiha Qo‘shish'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Loyiha Nomi *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Masalan: CogniDev Desktop yoki Nihongo Talk"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[12.5px] text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Qisqa Tavsif / Maqsad
                </label>
                <textarea
                  rows={2}
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Loyiha nima vazifani bajarishi va asosiy xususiyatlari..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Kategoriya
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[12px] text-white focus:outline-none"
                  >
                    {CATEGORY_PRESETS.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#181920]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(
                        e.target.value as 'active' | 'in_progress' | 'completed' | 'on_hold'
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[12px] text-white focus:outline-none"
                  >
                    <option value="active" className="bg-[#181920]">
                      Faol (Active)
                    </option>
                    <option value="in_progress" className="bg-[#181920]">
                      Jarayonda (In Progress)
                    </option>
                    <option value="completed" className="bg-[#181920]">
                      Yakunlangan (Completed)
                    </option>
                    <option value="on_hold" className="bg-[#181920]">
                      To‘xtatilgan (On Hold)
                    </option>
                  </select>
                </div>
              </div>

              {/* Progress Slider */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1">
                  <span>Boshlang'ich Progress:</span>
                  <span className="font-mono text-white font-bold">{formProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formProgress}
                  onChange={(e) => setFormProgress(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* GitHub repo URL */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  GitHub Repository Havolasi (ixtiyoriy)
                </label>
                <input
                  type="url"
                  value={formGithubUrl}
                  onChange={(e) => setFormGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/project"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              {/* Tech Stack Tags */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Texnologiyalar (vergul bilan ajrating)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="React, TypeScript, Go, Docker"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase mb-1.5 block">
                  Rang Belgisi
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        formColor === c.value ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-[12px] font-semibold text-white shadow-lg hover:bg-blue-500 transition"
                >
                  {editingProject ? 'Saqlash' : 'Loyiha Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: AI PROJECT DECOMPOSITION & ROADMAP ── */}
      {aiDecomposingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-purple-500/30 bg-[#121318] p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">
                    AI Tech Lead: "{aiDecomposingProject.title}" Rejasi
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Loyihani avtomatik amaliy muhandislik vazifalariga ajratish
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiDecomposingProject(null)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {/* Actions Header */}
              <div className="flex items-center justify-between rounded-xl bg-purple-500/[0.06] border border-purple-500/20 p-3.5">
                <p className="text-[12px] text-zinc-300">
                  AI loyihaning texnik stekini hisobga olgan holda aniq tasklar ro'yxatini tuzadi.
                </p>
                <button
                  onClick={handleRunAiDecompose}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-[11.5px] font-semibold text-white shadow hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
                  <span>{aiLoading ? 'Tahlil qilinmoqda...' : 'Reja Tuzish'}</span>
                </button>
              </div>

              {/* AI Analysis Output */}
              {aiAnalysisText && (
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
                  <h4 className="text-[12.5px] font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles size={13} /> Arxitektura Xulosasi:
                  </h4>
                  <FormattedAiText content={aiAnalysisText} />
                </div>
              )}

              {/* Extracted Tasks to export */}
              {aiGeneratedTasks.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                    <ListTodo size={14} className="text-blue-400" /> Aniqlangan Vazifalar ({aiGeneratedTasks.length}):
                  </h4>

                  <div className="space-y-2">
                    {aiGeneratedTasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 hover:border-white/20 transition"
                      >
                        <div className="space-y-1">
                          <p className="text-[12.5px] font-medium text-white">{t.title}</p>
                          {t.git_branch && (
                            <p className="font-mono text-[10.5px] text-zinc-400">
                              Branch: <span className="text-sky-300">{t.git_branch}</span>
                            </p>
                          )}
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            t.priority === 'P0 Blocker'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-[11px] text-zinc-500">
                Provayder: {selectedProvider.toUpperCase()}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiDecomposingProject(null)}
                  className="rounded-xl px-4 py-1.5 text-[12px] text-zinc-400 hover:text-white transition"
                >
                  Yopish
                </button>

                {aiGeneratedTasks.length > 0 && (
                  <button
                    onClick={handleExportTasksToStream}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-lg hover:from-blue-500 hover:to-sky-500 transition"
                  >
                    <span>Vazifalar Oqimiga Qo‘shish</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GIT INSPECTOR MODAL ── */}
      {showGitModal && (
        <GitInspectorModal
          open={showGitModal}
          onClose={() => setShowGitModal(false)}
          initialPath={gitModalPath}
        />
      )}
    </div>
  );
}
