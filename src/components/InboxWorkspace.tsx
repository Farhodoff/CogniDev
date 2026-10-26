import React, { useState, useMemo, useEffect } from 'react';
import {
  Inbox,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  Bell,
  Check,
  CheckSquare,
  AlertTriangle,
  Search,
  RefreshCw,
  FolderPlus,
  GitPullRequest,
  ExternalLink,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import type { Task } from '../lib/types';
import { callAi } from '../lib/ai';
import { fetchUserPrsAndIssues, getStoredGitHubToken, type GitHubPrOrIssue } from '../lib/github';
import { parseNaturalTimeToIso } from '../lib/notifications';

interface InboxNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'system' | 'blocker' | 'goal' | 'ai';
  read: boolean;
  actionableTaskTitle?: string;
}

interface AiRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'efficiency' | 'blocker' | 'project' | 'habit';
  priority: Task['priority'];
  suggestedTags: string[];
}

export default function InboxWorkspace() {
  const {
    tasks,
    updateTaskStatus,
    deleteTask,
    addTask,
    setTaskModal,
    setHud,
    setMainView,
    activeProjects,
    userProfile,
    reminders,
    deleteReminder,
    testNotification,
    addReminder,
  } = useSynapse();

  const [filterTab, setFilterTab] = useState<'all' | 'tasks' | 'notifications' | 'ai' | 'github_pr'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [reminderInput, setReminderInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // 🐙 GitHub PR & Issue Tracker State
  const [githubItems, setGithubItems] = useState<GitHubPrOrIssue[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubCategoryFilter, setGithubCategoryFilter] = useState<'all' | 'my_pr' | 'review_requested' | 'assigned_issue'>('all');

  const loadGitHubItems = async () => {
    setGithubLoading(true);
    try {
      const token = getStoredGitHubToken();
      const username = userProfile?.full_name || null;
      const items = await fetchUserPrsAndIssues(token, username);
      setGithubItems(items);
    } catch (err) {
      console.warn('GitHub items load error:', err);
    } finally {
      setGithubLoading(false);
    }
  };

  useEffect(() => {
    loadGitHubItems();
  }, []);

  const handleConvertPrToTask = (item: GitHubPrOrIssue) => {
    const priority: Task['priority'] =
      item.category === 'review_requested'
        ? 'Critical'
        : item.category === 'assigned_issue'
        ? 'High Priority'
        : 'Normal';

    const newId = 'task-' + Date.now();
    addTask({
      id: newId,
      workspace_id: 'default',
      title: item.title,
      status: 'active',
      priority,
      git_branch: item.category === 'my_pr' ? `pr/${item.number}` : null,
      pr_url: item.html_url,
      ai_source: 'github-pr',
      assignee_name: userProfile?.full_name || item.author_login,
      assignee_avatar: (userProfile?.full_name || item.author_login).slice(0, 2).toUpperCase(),
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['github', item.repo_name.split('/')[1] || item.repo_name, item.category],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setHud(`"${item.title.slice(0, 35)}..." vazifaga qo‘shildi ✓`);
  };

  // Active / non-completed inbox tasks
  const inboxTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed');
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return inboxTasks;
    const q = searchQuery.toLowerCase();
    return inboxTasks.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [inboxTasks, searchQuery]);

  const filteredGitHubItems = useMemo(() => {
    let list = githubItems;
    if (githubCategoryFilter !== 'all') {
      list = list.filter((item) => item.category === githubCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.repo_name.toLowerCase().includes(q) ||
          item.author_login.toLowerCase().includes(q) ||
          (item.labels || []).some((l) => l.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [githubItems, githubCategoryFilter, searchQuery]);

  // Dynamic system notifications computed from actual store state
  const [notifications, setNotifications] = useState<InboxNotification[]>(() => {
    const list: InboxNotification[] = [
      {
        id: 'notif-welcome',
        title: 'CogniDev faollashtirildi',
        message: 'Barcha modullar, SQLite xotirasi va AI dvigatellari muvaffaqiyatli tayyor.',
        time: 'Bugun',
        type: 'system',
        read: false,
      },
    ];

    const blockers = tasks.filter((t) => t.priority === 'P0 Blocker' || t.status === 'blocker');
    if (blockers.length > 0) {
      list.push({
        id: 'notif-blockers',
        title: `Diqqat: ${blockers.length} ta to‘siq (Blocker) mavjud`,
        message: `Eng birinchi navbatda "${blockers[0].title}" masalasini hal qilish tavsiya etiladi.`,
        time: 'Hozir',
        type: 'blocker',
        read: false,
        actionableTaskTitle: `[Yechim] ${blockers[0].title} to‘sig‘ini bartaraf etish`,
      });
    }

    if (activeProjects.length > 0) {
      list.push({
        id: 'notif-projects',
        title: 'Faol Loyihalar Holati',
        message: `Hozir tizimda ${activeProjects.length} ta loyiha boshqarilmoqda. Bugungi sprint maqsadlarini belgilang.`,
        time: 'Bugun',
        type: 'goal',
        read: false,
      });
    }

    return list;
  });

  // Actionable AI Recommendations state
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([
    {
      id: 'ai-rec-1',
      title: 'Top 3 ta ustuvor vazifani ertalab saralash',
      description: 'Ertalabki diqqat eng yuqori bo‘lgan paytda P0 yoki Critical vazifalarga kirishish mahsuldorlikni 40% oshiradi.',
      category: 'efficiency',
      priority: 'High Priority',
      suggestedTags: ['focus', 'priority'],
    },
    {
      id: 'ai-rec-2',
      title: 'PostgreSQL yoki DB so‘rovlariga indeks qo‘shish',
      description: 'Ma‘lumotlar bazasi tezligini optimallashtirish va sekin so‘rovlarni profil qilish.',
      category: 'project',
      priority: 'Normal',
      suggestedTags: ['backend', 'db'],
    },
    {
      id: 'ai-rec-3',
      title: 'Haftalik retro va to‘siqlar tahlilini o‘tkazish',
      description: 'O‘tgan hafta davomida nimalar sekinlashganini ko‘rib chiqib, keyingi haftaga reja belgilash.',
      category: 'habit',
      priority: 'Normal',
      suggestedTags: ['retro', 'planning'],
    },
  ]);

  // Handle Quick Capture inside Inbox
  const handleQuickCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const newId = 'task-' + Date.now();
    addTask({
      id: newId,
      workspace_id: 'default',
      title: quickInput.trim(),
      status: 'active',
      priority: 'Normal',
      git_branch: null,
      pr_url: null,
      ai_source: 'inbox',
      assignee_name: userProfile?.full_name || 'Dasturchi',
      assignee_avatar: (userProfile?.full_name || 'D').slice(0, 2).toUpperCase(),
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['inbox'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setHud(`"${quickInput.trim()}" Inbox'ga saqlandi ✓`);
    setQuickInput('');
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderInput.trim()) return;
    const parsed = parseNaturalTimeToIso(reminderInput.trim());
    await addReminder({
      title: reminderInput.trim(),
      description: '',
      target_time: parsed.iso,
      time_string: parsed.timeString,
      source_type: 'custom',
      sound_enabled: true,
    });
    setReminderInput('');
  };

  // Convert notification to Task
  const handleConvertNotificationToTask = (n: InboxNotification) => {
    const title = n.actionableTaskTitle || n.title;
    const newId = 'task-' + Date.now();
    addTask({
      id: newId,
      workspace_id: 'default',
      title: `[Bildirishnoma] ${title}`,
      status: 'active',
      priority: n.type === 'blocker' ? 'P0 Blocker' : 'Normal',
      git_branch: null,
      pr_url: null,
      ai_source: 'notification',
      assignee_name: userProfile?.full_name || 'Dasturchi',
      assignee_avatar: (userProfile?.full_name || 'D').slice(0, 2).toUpperCase(),
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['inbox', n.type],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setHud(`"${title}" yangi vazifa sifatida qo‘shildi ✓`);
  };

  // Accept AI Recommendation and convert to Task
  const handleAcceptAiRecommendation = (rec: AiRecommendation) => {
    const newId = 'task-' + Date.now();
    addTask({
      id: newId,
      workspace_id: 'default',
      title: `[AI Tavsiya] ${rec.title}`,
      status: 'active',
      priority: rec.priority,
      git_branch: null,
      pr_url: null,
      ai_source: 'gemini',
      assignee_name: userProfile?.full_name || 'Dasturchi',
      assignee_avatar: (userProfile?.full_name || 'D').slice(0, 2).toUpperCase(),
      assignee_name2: null,
      assignee_avatar2: null,
      tags: [...rec.suggestedTags, 'ai-tavsiya'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setAiRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
    setHud(`"${rec.title}" vazifalar oqimiga qo‘shildi ✓`);
  };

  // Generate fresh AI recommendations
  const handleGenerateFreshAiRecommendations = async () => {
    setAiGenerating(true);
    try {
      const activeTaskTitles = inboxTasks.slice(0, 8).map((t) => t.title).join('; ');
      const activeProjectTitles = activeProjects.map((p) => p.title).join('; ');

      const prompt = `Foydalanuvchi muhandislik kokpiti ma'lumotlari:
- Hozirgi faol vazifalar: ${activeTaskTitles || "Hali vazifalar kam"}
- Loyihalar: ${activeProjectTitles || "Hali loyihalar boshlanmagan"}

Iltimos, dasturchi uchun hozir eng kerakli bo'lgan aniq 3 ta tavsiya bering. Har bir tavsiya quyidagi formatda bo'lsin:
[Tavsiya 1]
Sarlavha: ...
Tavsif: ...
Kategoriya: efficiency | blocker | project | habit
Prioritet: High Priority | Normal

Formatga aniq rioya qiling.`;

      const res = await callAi(prompt, "Siz muhandislik mahsuldorligi bo'yicha ekspert AI yordamchisiz.");
      const text = res.text;

      // Parse recommendations
      const parsed: AiRecommendation[] = [];
      const sections: string[] = text.split(/\[Tavsiya \d+\]/i).filter((s: string) => s.trim().length > 10);

      sections.forEach((sec: string, idx: number) => {
        const titleMatch = sec.match(/Sarlavha:\s*(.+)/i);
        const descMatch = sec.match(/Tavsif:\s*(.+)/i);
        const catMatch = sec.match(/Kategoriya:\s*(.+)/i);
        const prioMatch = sec.match(/Prioritet:\s*(.+)/i);

        if (titleMatch) {
          const cat = (catMatch ? catMatch[1].trim().toLowerCase() : 'efficiency') as any;
          const prio = (prioMatch && prioMatch[1].includes('High') ? 'High Priority' : 'Normal') as any;
          parsed.push({
            id: 'ai-rec-' + Date.now() + '-' + idx,
            title: titleMatch[1].trim(),
            description: descMatch ? descMatch[1].trim() : 'Muhim takomillashtirish vazifasi.',
            category: ['efficiency', 'blocker', 'project', 'habit'].includes(cat) ? cat : 'efficiency',
            priority: prio,
            suggestedTags: ['ai-smart', cat],
          });
        }
      });

      if (parsed.length > 0) {
        setAiRecommendations(parsed);
        setHud(`${parsed.length} ta yangi AI tavsiyasi generatsiya qilindi ✓`);
      } else {
        setHud("AI tavsiyalari yangilandi ✓");
      }
    } catch {
      setHud("AI bilan bog‘lanishda xatolik yuz berdi");
    } finally {
      setAiGenerating(false);
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setHud('Barcha bildirishnomalar o‘qildi ✓');
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length + reminders.filter((r) => r.status === 'pending').length;
  const totalInboxBadge = inboxTasks.length + unreadNotifCount;
  const totalNotificationsCount = notifications.length + reminders.length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-6 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-500/10">
              <Inbox size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">Inbox & Bildirishnomalar</h1>
                {totalInboxBadge > 0 && (
                  <span className="rounded-full bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-[11px] font-bold text-blue-300">
                    {totalInboxBadge} yangi
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-zinc-400 mt-0.5">
                Kiruvchi vazifalar, tizim bildirishnomalari va faol AI tavsiyalari markazi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={testNotification}
              title="Native desktop bildirishnomani va ovozni sinash"
              className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-[12px] font-semibold text-amber-300 transition shadow-sm"
            >
              <Bell size={13} className="text-amber-400" />
              <span>Test Bildirishnoma</span>
            </button>
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition"
            >
              <Check size={13} />
              <span>O‘qilgan qilish</span>
            </button>
            <button
              onClick={() => setTaskModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-blue-600/20 transition"
            >
              <Plus size={14} />
              <span>Yangi Vazifa</span>
            </button>
          </div>
        </div>

        {/* Quick Capture Form */}
        <form onSubmit={handleQuickCapture} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121319] p-2.5 shadow-lg">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Tezkor fikr yoki yangi vazifani yozing va Enter bosing…"
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition shadow-sm"
          >
            Inbox’ga saqlash
          </button>
        </form>

        {/* Filter Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: `Barchasi (${totalInboxBadge})` },
              { id: 'tasks', label: `Vazifalar (${inboxTasks.length})` },
              { id: 'notifications', label: `Bildirishnomalar (${totalNotificationsCount})` },
              { id: 'ai', label: `AI Tavsiyalar (${aiRecommendations.length})` },
              { id: 'github_pr', label: `🐙 PR & Issues (${githubItems.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`rounded-xl px-3 py-1.5 text-[12px] font-medium transition ${
                  filterTab === tab.id
                    ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filterTab !== 'ai' && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Qidirish…"
                className="w-48 pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Tab 1: All View (Unified Grid) */}
        {filterTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Tasks */}
            <div className="md:col-span-7 space-y-4">
              <h2 className="text-[13px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <CheckSquare size={15} className="text-blue-400" />
                <span>Ko‘rib chiqilishi kerak bo‘lgan vazifalar ({filteredTasks.length})</span>
              </h2>

              {filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#121319]/50 p-8 text-center space-y-2">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                  <p className="text-xs text-zinc-400">Vazifalar qutisi toza.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#121319] p-3.5 hover:border-white/15 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => {
                            updateTaskStatus(t.id, 'completed');
                            setHud(`"${t.title}" bajarildi ✓`);
                          }}
                          className="text-zinc-500 hover:text-emerald-400 transition shrink-0"
                          title="Bajarildi deb belgilash"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-500 font-mono">{t.priority}</span>
                            {t.tags?.map((tag) => (
                              <span key={tag} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-zinc-400 font-mono">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setMainView('stream')}
                          className="flex items-center gap-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-2 py-1 text-[11px] text-zinc-300"
                        >
                          <span>Oqim</span>
                          <ArrowRight size={11} />
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="rounded-lg p-1 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Notifications & AI Preview */}
            <div className="md:col-span-5 space-y-5">
              {/* Notifications & Reminders List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Bell size={15} className="text-amber-400" />
                    <span>Bildirishnomalar ({totalNotificationsCount})</span>
                  </h2>
                  <button
                    onClick={testNotification}
                    className="text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:underline"
                  >
                    Sinash 🔔
                  </button>
                </div>

                {/* Quick Add Reminder Form */}
                <form onSubmit={handleCreateReminder} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#121319] p-1.5">
                  <Clock size={13} className="text-amber-400 ml-1.5 shrink-0" />
                  <input
                    type="text"
                    value={reminderInput}
                    onChange={(e) => setReminderInput(e.target.value)}
                    placeholder="Tezkor eslatma (masalan: 15 minutdan keyin standup)..."
                    className="flex-1 bg-transparent px-2 py-1 text-[11px] text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!reminderInput.trim()}
                    className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-2 py-1 text-[10.5px] font-semibold text-amber-300 disabled:opacity-40 transition"
                  >
                    + Qo‘shish
                  </button>
                </form>

                <div className="space-y-2.5">
                  {/* Scheduled Reminders */}
                  {reminders.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-1.5 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-amber-400" />
                          <span className="text-xs font-bold text-zinc-100">{r.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[9.5px] font-mono font-bold text-amber-300">
                            {r.status === 'pending' ? r.time_string : 'Yetkazildi ✓'}
                          </span>
                          <button onClick={() => deleteReminder(r.id)} className="text-zinc-500 hover:text-rose-400 p-0.5" title="O‘chirish">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      {r.description && <p className="text-[11px] text-zinc-400 pl-5">{r.description}</p>}
                    </div>
                  ))}

                  {/* System & Blocker Notifications */}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-2xl border p-3.5 space-y-2 transition ${
                        n.read
                          ? 'border-white/[0.05] bg-[#121319]/50 opacity-70'
                          : 'border-white/[0.08] bg-[#121319] shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {n.type === 'blocker' ? (
                            <AlertTriangle size={15} className="text-rose-400" />
                          ) : (
                            <Bell size={15} className="text-amber-400" />
                          )}
                          <span className="text-xs font-bold text-white">{n.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-500">{n.time}</span>
                          <button onClick={() => deleteNotification(n.id)} className="text-zinc-500 hover:text-rose-400 p-0.5">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed pl-5">{n.message}</p>

                      {n.actionableTaskTitle && (
                        <div className="pl-5 pt-1">
                          <button
                            onClick={() => handleConvertNotificationToTask(n)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 px-2.5 py-1 text-[11px] font-semibold text-blue-300 transition"
                          >
                            <FolderPlus size={12} />
                            <span>Vazifaga aylantirish</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendations Teaser */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                    <Sparkles size={14} />
                    <span>AI Tavsiyalari</span>
                  </div>
                  <button onClick={() => setFilterTab('ai')} className="text-[11px] text-purple-400 hover:underline">
                    Barchasi ({aiRecommendations.length}) →
                  </button>
                </div>
                {aiRecommendations.slice(0, 2).map((rec) => (
                  <div key={rec.id} className="rounded-xl bg-black/40 p-2.5 border border-purple-500/20 space-y-1">
                    <p className="text-xs font-bold text-purple-200">{rec.title}</p>
                    <p className="text-[11px] text-zinc-400 line-clamp-2">{rec.description}</p>
                    <button
                      onClick={() => handleAcceptAiRecommendation(rec)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 px-2 py-0.5 text-[10.5px] font-semibold text-purple-200"
                    >
                      <Plus size={11} />
                      <span>Vazifaga qo‘shish</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Only Tasks */}
        {filterTab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">Jami faol vazifalar: {filteredTasks.length} ta</p>
            </div>
            <div className="space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500 text-xs">
                  Vazifalar topilmadi.
                </div>
              ) : (
                filteredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#121319] p-4 hover:border-white/15 transition group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        onClick={() => {
                          updateTaskStatus(t.id, 'completed');
                          setHud(`"${t.title}" bajarildi ✓`);
                        }}
                        className="text-zinc-500 hover:text-emerald-400 transition"
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-100 truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-500 font-mono">{t.priority}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">• {new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMainView('stream')}
                        className="flex items-center gap-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 text-xs text-zinc-300"
                      >
                        <span>Oqimga o‘tish</span>
                        <ArrowRight size={12} />
                      </button>
                      <button onClick={() => deleteTask(t.id)} className="text-zinc-500 hover:text-rose-400 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Only Notifications & Reminders */}
        {filterTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-400">Jami faol bildirishnomalar va eslatmalar: {totalNotificationsCount} ta</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={testNotification}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 transition"
                >
                  <Bell size={13} className="text-amber-400" />
                  <span>Test Bildirishnoma</span>
                </button>
                <button onClick={markAllAsRead} className="text-xs text-blue-400 hover:underline">
                  Barchasini o‘qilgan qilish
                </button>
              </div>
            </div>

            {/* Quick Add Reminder Form */}
            <form onSubmit={handleCreateReminder} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121319] p-3 shadow-md">
              <Clock size={16} className="text-amber-400 ml-1 shrink-0" />
              <input
                type="text"
                value={reminderInput}
                onChange={(e) => setReminderInput(e.target.value)}
                placeholder="Tezkor eslatma yozing (masalan: 10 minutdan keyin, yoki soat 17:00 da code review)..."
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!reminderInput.trim()}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-black disabled:opacity-40 transition shadow-sm"
              >
                Eslatma Saqlash
              </button>
            </form>

            <div className="space-y-3">
              {/* Scheduled Reminders */}
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-2 transition shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock size={16} className="text-amber-400" />
                      <h4 className="text-xs font-bold text-white">{r.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                        {r.status === 'pending' ? `⏰ ${r.time_string}` : 'Yetkazildi ✓'}
                      </span>
                      <button onClick={() => deleteReminder(r.id)} className="text-zinc-500 hover:text-rose-400 p-1" title="O‘chirish">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {r.description && <p className="text-xs text-zinc-300 pl-6 leading-relaxed">{r.description}</p>}
                </div>
              ))}

              {/* System notices */}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-4 space-y-2 transition ${
                    n.read ? 'border-white/[0.05] bg-[#121319]/40 opacity-70' : 'border-white/[0.08] bg-[#121319]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {n.type === 'blocker' ? (
                        <AlertTriangle size={17} className="text-rose-400" />
                      ) : (
                        <Bell size={17} className="text-amber-400" />
                      )}
                      <h4 className="text-xs font-bold text-white">{n.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500">{n.time}</span>
                      <button onClick={() => deleteNotification(n.id)} className="text-zinc-500 hover:text-rose-400 p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 pl-6 leading-relaxed">{n.message}</p>
                  {n.actionableTaskTitle && (
                    <div className="pl-6 pt-1">
                      <button
                        onClick={() => handleConvertNotificationToTask(n)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300"
                      >
                        <FolderPlus size={13} />
                        <span>Vazifaga aylantirish</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: AI Recommendations */}
        {filterTab === 'ai' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <span>Amaliy AI Tavsiyalari</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Vazifalaringiz va loyihalaringizni tahlil qilib, tizim tomonidan taklif etilgan harakatlar
                </p>
              </div>
              <button
                onClick={handleGenerateFreshAiRecommendations}
                disabled={aiGenerating}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-purple-600/30 transition"
              >
                <RefreshCw size={13} className={aiGenerating ? 'animate-spin' : ''} />
                <span>{aiGenerating ? 'Generatsiya qilinmoqda…' : 'Yangi Tavsiyalar Olish'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-purple-500/25 bg-[#121319] p-5 space-y-3.5 flex flex-col justify-between shadow-lg hover:border-purple-500/40 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-300 font-mono uppercase">
                        {rec.category}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{rec.priority}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{rec.title}</h4>
                    <p className="text-xs text-zinc-300 leading-relaxed">{rec.description}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <div className="flex gap-1 flex-wrap">
                      {rec.suggestedTags.map((tg) => (
                        <span key={tg} className="text-[10px] text-zinc-500 font-mono">
                          #{tg}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAcceptAiRecommendation(rec)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm"
                    >
                      <Plus size={13} />
                      <span>Vazifaga qo‘shish</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: 🐙 GitHub PR & Issue Tracker */}
        {filterTab === 'github_pr' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <GitPullRequest size={16} className="text-emerald-400" />
                  <span>GitHub Pull Requestlar & Issue Tracker</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  GitHub shaxsiy tokeni (PAT) orqali sizga tegishli PR'lar, review so‘rovlari va biriktirilgan issuelar
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadGitHubItems}
                  disabled={githubLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/10 disabled:opacity-40 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 shadow-sm transition"
                >
                  <RefreshCw size={13} className={githubLoading ? 'animate-spin text-emerald-400' : 'text-zinc-400'} />
                  <span>{githubLoading ? 'Yangilanmoqda…' : 'Yangilash'}</span>
                </button>
              </div>
            </div>

            {/* Sub-filters for categories */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: `Barchasi (${githubItems.length})` },
                {
                  id: 'my_pr',
                  label: `Mening PR'larim (${githubItems.filter((i) => i.category === 'my_pr').length})`,
                },
                {
                  id: 'review_requested',
                  label: `Review so‘rovlari (${githubItems.filter((i) => i.category === 'review_requested').length})`,
                },
                {
                  id: 'assigned_issue',
                  label: `Biriktirilgan Issuelar (${githubItems.filter((i) => i.category === 'assigned_issue').length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setGithubCategoryFilter(f.id as any)}
                  className={`rounded-xl px-3 py-1 text-[11.5px] font-medium transition ${
                    githubCategoryFilter === f.id
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-sm'
                      : 'bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 border border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* List of items */}
            {filteredGitHubItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#121319]/40 p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                  <GitPullRequest size={24} />
                </div>
                <h4 className="text-sm font-bold text-white">Hech qanday element topilmadi</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Tanlangan toifada yoki qidiruv so‘rovi bo‘yicha ochiq PR yoki issue mavjud emas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGitHubItems.map((item) => {
                  const isReview = item.category === 'review_requested';
                  const isIssue = item.category === 'assigned_issue';
                  const isMyPr = item.category === 'my_pr';

                  const categoryLabel = isMyPr
                    ? "Mening PR'im"
                    : isReview
                    ? "Review so‘rovi"
                    : 'Biriktirilgan Issue';

                  const badgeClass = isMyPr
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : isReview
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-sky-500/15 border-sky-500/30 text-sky-300';

                  return (
                    <div
                      key={item.id}
                      className="group rounded-2xl border border-white/[0.07] bg-[#121319] p-4 hover:border-emerald-500/30 hover:bg-[#141620] transition shadow-md space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${badgeClass}`}
                          >
                            {isIssue ? (
                              <AlertTriangle size={15} />
                            ) : (
                              <GitPullRequest size={15} />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider font-mono ${badgeClass}`}
                              >
                                {categoryLabel}
                              </span>
                              <span className="text-xs font-mono font-medium text-zinc-400">
                                {item.repo_name}
                              </span>
                              <span className="text-xs font-mono text-zinc-500">#{item.number}</span>
                              {item.draft && (
                                <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-300">
                                  Draft
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition">
                              {item.title}
                            </h4>

                            {item.body && (
                              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                {item.body}
                              </p>
                            )}

                            {/* Labels & Meta */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {item.labels &&
                                item.labels.map((lbl) => (
                                  <span
                                    key={lbl.name}
                                    style={{
                                      backgroundColor: `#${lbl.color}20`,
                                      borderColor: `#${lbl.color}50`,
                                      color: `#${lbl.color}`,
                                    }}
                                    className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                  >
                                    {lbl.name}
                                  </span>
                                ))}

                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                <img
                                  src={item.author_avatar}
                                  alt={item.author_login}
                                  className="h-4 w-4 rounded-full border border-white/20"
                                />
                                <span>@{item.author_login}</span>
                              </div>

                              {item.comments_count !== undefined && item.comments_count > 0 && (
                                <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                                  <MessageSquare size={12} />
                                  <span>{item.comments_count}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <a
                            href={item.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition"
                          >
                            <ExternalLink size={13} />
                            <span>GitHub</span>
                          </a>

                          <button
                            onClick={() => handleConvertPrToTask(item)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition"
                          >
                            <Plus size={13} />
                            <span>Taskga aylantirish</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
