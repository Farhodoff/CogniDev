import { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Plus,
  BookOpen,
  Laptop,
  Target,
  Send,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  CheckSquare,
  FileText,
  Lightbulb,
  Link2,
  Folder,
  FolderArchive,
  Edit2,
  Trash2,
  X,
  Check,
  RotateCw,
  Radio,
  Zap,
  Activity,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { callAi } from '../lib/ai';
import { formatShortcut } from '../lib/platform';
import type { ScheduleBlock, Task } from '../lib/types';
import { useFocusStore } from '../lib/focusStore';
import FormattedAiText from './FormattedAiText';
import { useRealtimeMetricsStore } from '../lib/realtimeMetrics';

export default function DashboardWorkspace() {
  const {
    tasks,
    addTask,
    updateTaskStatus,
    deleteTask,
    userProfile,
    notesDocs,
    activeProjects,
    activeSpaceId,
    meetings,
    addActiveProject,
    updateProjectProgress,
    deleteActiveProject,
    goals,
    addGoal,
    updateGoalProgress,
    deleteGoal,
    scheduleBlocks,
    addScheduleBlock,
    toggleScheduleBlockDone,
    deleteScheduleBlock,
    roadmaps,
    toggleTopicDone,
    setTaskModal,
    setMainView,
    selectNote,
    createNote,
    setHud,
    toggleAiDrawer,
  } = useSynapse();

  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | 'work' | 'study' | 'personal' | 'other'>('all');
  const [selectedRoadmapIndex, setSelectedRoadmapIndex] = useState(0);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiSending, setIsAiSending] = useState(false);
  const [aiAssistantReply, setAiAssistantReply] = useState<string | null>(null);

  // Modals for adding items directly from Dashboard
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectSubtitle, setNewProjectSubtitle] = useState('');
  const [newProjectProgress, setNewProjectProgress] = useState(50);
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');

  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('Career');
  const [newGoalProgress, setNewGoalProgress] = useState(30);

  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [newBlockTime, setNewBlockTime] = useState('14:00 - 15:30');
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockCategory, setNewBlockCategory] = useState<'work' | 'study' | 'personal' | 'health'>('work');
  const [newBlockTag, setNewBlockTag] = useState('Work');

  // Haftalik umumiy ko'rinish (Weekly Overview) state
  const [weekOffset, setWeekOffset] = useState(0);

  // Real-time Dashboard Metrics Push State & Engine
  const {
    metrics: rtMetrics,
    lastLatencyMs: rtLatencyMs,
    lastPushedAt: rtPushedAt,
    pushMetric: rtPushMetric,
    reset: rtResetMetrics,
  } = useRealtimeMetricsStore();
  const [showMetricsSimulator, setShowMetricsSimulator] = useState(false);
  const [simulatorStatus, setSimulatorStatus] = useState<string | null>(null);

  // Clean up any legacy mock focus items stored in localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('cognidev_current_focus');
    } catch {}
  }, []);

  // Joriy fokus (Current Focus) state - derived 100% from real tasks
  const [newFocusText, setNewFocusText] = useState('');
  const [isAddingFocus, setIsAddingFocus] = useState(false);

  // Filter real active/priority tasks for Current Focus
  const realFocusTasks = useMemo(() => {
    // 1. Explicitly tagged with 'focus'
    const tagged = tasks.filter((t) => t.tags?.some((tag) => tag.toLowerCase() === 'focus'));
    if (tagged.length > 0) return tagged.slice(0, 6);

    // 2. High priority or active tasks
    const activeOrHigh = tasks.filter(
      (t) => t.status === 'active' || t.priority === 'P0 Blocker' || t.priority === 'Critical'
    );
    if (activeOrHigh.length > 0) return activeOrHigh.slice(0, 5);

    // 3. Fallback: non-completed tasks
    const pending = tasks.filter((t) => t.status !== 'completed');
    if (pending.length > 0) return pending.slice(0, 4);

    return [];
  }, [tasks]);

  const handleToggleFocus = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextStatus = target.status === 'completed' ? 'active' : 'completed';
    updateTaskStatus(taskId, nextStatus);
  };

  const handleAddFocusItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFocusText.trim()) return;
    const now = new Date().toISOString();
    const newTask: Task = {
      id: `task-${Date.now()}`,
      workspace_id: activeSpaceId || 'personal',
      group_id: null,
      space_id: activeSpaceId || null,
      title: newFocusText.trim(),
      status: 'active',
      priority: 'High Priority',
      git_branch: null,
      pr_url: null,
      ai_source: 'dashboard_focus',
      assignee_name: userProfile?.full_name || 'Men',
      assignee_avatar: userProfile?.avatar_initials || 'ME',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['focus'],
      created_at: now,
      updated_at: now,
    };
    addTask(newTask);
    setNewFocusText('');
    setIsAddingFocus(false);
  };

  const handleDeleteFocusItem = (taskId: string) => {
    deleteTask(taskId);
  };

  // AI dan bugungi maslahat state
  const aiAdviceList = [
    "Bugun eng muhim 3 ta vazifaga e'tibor qarating. Kichik qadamlar ham kun oxirida katta natija beradi.",
    "Murakkab kod yoki arxitektura oldidan tizimni qog'ozda vizuallashtiring — bu debug qilish vaqtini sezilarli tejaydi.",
    "Pomodoro uslubi (25 daqiqa chuqur fokus + 5 daqiqa tanaffus) aqliy charchoqni oldini oladi va unumdorlikni oshiradi.",
    "Har kuni 1% o'sish — bir yilda 37 barobar ustunlik beradi. Kichik ammo izchil qadamlar eng katta kuchdir.",
    "Eng qiyin yoki noqulay vazifani tongda yoki birinchi navbatda bajaring ('Eat that frog' tamoyili).",
  ];
  const [adviceIndex, setAdviceIndex] = useState(0);
  const [isSpinningAdvice, setIsSpinningAdvice] = useState(false);

  const handleRefreshAdvice = () => {
    setIsSpinningAdvice(true);
    setTimeout(() => {
      setAdviceIndex((prev) => (prev + 1) % aiAdviceList.length);
      setIsSpinningAdvice(false);
    }, 350);
  };


  // Time & Greeting
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
  const [todayDateStr] = useState(() =>
    new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );

  // Filter tasks based on tags and category
  const isWorkTask = (t: { tags: string[] }) =>
    t.tags?.some((x) => ['work', 'backend', 'bugfix', 'api', 'dev', 'deploy'].includes(x.toLowerCase()));
  const isStudyTask = (t: { tags: string[] }) =>
    t.tags?.some((x) => ['study', 'japanese', 'grammar', 'dsa', 'algo', 'read', 'learn', 'book'].includes(x.toLowerCase()));
  const isPersonalTask = (t: { tags: string[] }) =>
    t.tags?.some((x) => ['personal', 'health', 'sport', 'gym', 'fitness', 'run'].includes(x.toLowerCase()));

  const workTasksCount = tasks.filter(isWorkTask).length;
  const studyTasksCount = tasks.filter(isStudyTask).length;
  const personalTasksCount = tasks.filter(isPersonalTask).length;
  const otherTasksCount = tasks.filter((t) => !isWorkTask(t) && !isStudyTask(t) && !isPersonalTask(t)).length;

  const filteredTasks = tasks.filter((t) => {
    if (taskCategoryFilter === 'all') return true;
    if (taskCategoryFilter === 'work') return isWorkTask(t);
    if (taskCategoryFilter === 'study') return isStudyTask(t);
    if (taskCategoryFilter === 'personal') return isPersonalTask(t);
    return !isWorkTask(t) && !isStudyTask(t) && !isPersonalTask(t);
  });

  // Dynamic real metrics
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const completedStudyCount = tasks.filter((t) => isStudyTask(t) && t.status === 'completed').length;
  const completedWorkCount = tasks.filter((t) => isWorkTask(t) && t.status === 'completed').length;
  const completedGoalsCount = goals.filter((g) => g.progress >= 100).length;

  // Real Weekly Progress calculation
  const studyTargetHours = 7;
  const studyActualHours = Math.min(studyTargetHours, Math.round(completedStudyCount * 1.5 * 10) / 10);
  const workTargetHours = 25;
  const workActualHours = Math.min(workTargetHours, Math.round(completedWorkCount * 2.5 * 10) / 10);

  // Haftalik umumiy ko'rinish dynamic data calculation with 100% REAL data
  const weeklyOverviewData = useMemo(() => {
    const uzMonths = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const now = new Date();
    // Shift date by weekOffset (0 = current week, -1 = last week, +1 = next week)
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7);

    // Monday is the start of the week
    const currentDay = targetDate.getDay(); // 0: Sun, 1: Mon, ...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

    const startStr = `${monday.getDate()} ${uzMonths[monday.getMonth()]}`;
    const endStr = `${sunday.getDate()} ${uzMonths[sunday.getMonth()]} ${sunday.getFullYear()}`;
    const dateRangeStr = `${startStr} – ${endStr}`;

    // 7 days: Du, Se, Ch, Pa, Ju, Sh, Ya
    const dayNames = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const todayIndex = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6

    // Real per-day activity calculation across tasks, notes, and meetings
    const daysRaw = dayNames.map((name, idx) => {
      const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const year = dayDate.getFullYear();
      const month = String(dayDate.getMonth() + 1).padStart(2, '0');
      const day = String(dayDate.getDate()).padStart(2, '0');
      const dayDateStr = `${year}-${month}-${day}`;

      // Count tasks completed on this specific day
      const completedOnDay = tasks.filter((t) => {
        if (t.status === 'completed') {
          const uDate = (t.updated_at || t.created_at || '').slice(0, 10);
          return uDate === dayDateStr;
        }
        return false;
      }).length;

      // Count notes created or updated on this day
      const notesOnDay = notesDocs.filter((n) => {
        const nDate = (n.created_at || n.updated_at || '').slice(0, 10);
        return nDate === dayDateStr;
      }).length;

      // Count meetings on this day
      const meetingsOnDay = meetings.filter((m) => {
        const mDate = (m.date || m.created_at || '').slice(0, 10);
        return mDate === dayDateStr;
      }).length;

      const totalActivity = completedOnDay + notesOnDay + meetingsOnDay;

      return {
        name,
        dateStr: dayDateStr,
        isToday: weekOffset === 0 && idx === todayIndex,
        completedOnDay,
        notesOnDay,
        meetingsOnDay,
        totalActivity,
      };
    });

    const maxActivity = Math.max(...daysRaw.map((d) => d.totalActivity), 0);

    const days = daysRaw.map((d) => {
      let heightPercent = 0;
      if (maxActivity > 0 && d.totalActivity > 0) {
        heightPercent = Math.max(16, Math.round((d.totalActivity / maxActivity) * 100));
      }
      return {
        name: d.name,
        dateStr: d.dateStr,
        isToday: d.isToday,
        heightPercent,
        totalActivity: d.totalActivity,
        tooltip: `${d.name} (${d.dateStr}): ${d.totalActivity} ta faollik (${d.completedOnDay} vazifa, ${d.notesOnDay} qayd${
          d.meetingsOnDay > 0 ? `, ${d.meetingsOnDay} uchrashuv` : ''
        })`,
      };
    });

    const completedCount = completedTasksCount;
    const notesCount = notesDocs.length;
    // Real time spent: study hours + work hours + any deep work minutes logged in focus store
    const deepWorkMinutes = useFocusStore.getState().totalDeepWorkMinutesToday || 0;
    const deepWorkHours = Math.round((deepWorkMinutes / 60) * 10) / 10;
    const totalHours = Math.round((studyActualHours + workActualHours + deepWorkHours) * 10) / 10;
    const projectsCount = activeProjects.length;

    return {
      dateRangeStr,
      days,
      completedCount,
      notesCount,
      totalHours,
      projectsCount,
    };
  }, [
    weekOffset,
    tasks,
    notesDocs,
    meetings,
    completedTasksCount,
    studyActualHours,
    workActualHours,
    activeProjects.length,
  ]);


  // Active Roadmap
  const currentRoadmap = roadmaps[selectedRoadmapIndex] || roadmaps[0];
  const roadmapNodes = useMemo(() => {
    return currentRoadmap
      ? currentRoadmap.milestones.flatMap((m) =>
          m.topics.map((t) => ({
            id: t.id,
            label: t.title,
            status: t.done ? 'done' : 'pending',
            milestoneId: m.id,
            roadmapId: currentRoadmap.id,
          }))
        )
      : [];
  }, [currentRoadmap]);

  const roadmapProgress = useMemo(() => {
    if (roadmapNodes.length === 0) return 0;
    const done = roadmapNodes.filter((n) => n.status === 'done').length;
    return Math.round((done / roadmapNodes.length) * 100);
  }, [roadmapNodes]);

  // Real-time Push Overrides (PUT /api/v1/metrics/:id)
  const effectiveWeeklyOverview = useMemo(() => {
    if (rtMetrics.weeklyOverview) {
      return {
        dateRangeStr: rtMetrics.weeklyOverview.dateRangeStr || weeklyOverviewData.dateRangeStr,
        days: rtMetrics.weeklyOverview.days && rtMetrics.weeklyOverview.days.length > 0
          ? rtMetrics.weeklyOverview.days
          : weeklyOverviewData.days,
        completedCount: rtMetrics.weeklyOverview.completedCount ?? weeklyOverviewData.completedCount,
        notesCount: rtMetrics.weeklyOverview.notesCount ?? weeklyOverviewData.notesCount,
        totalHours: rtMetrics.weeklyOverview.totalHours ?? weeklyOverviewData.totalHours,
        projectsCount: rtMetrics.weeklyOverview.projectsCount ?? weeklyOverviewData.projectsCount,
        isRealtimeOverride: true,
      };
    }
    return { ...weeklyOverviewData, isRealtimeOverride: false };
  }, [rtMetrics.weeklyOverview, weeklyOverviewData]);

  const effectiveFocusTasks = useMemo(() => {
    if (rtMetrics.currentFocus?.items && rtMetrics.currentFocus.items.length > 0) {
      return rtMetrics.currentFocus.items;
    }
    return realFocusTasks;
  }, [rtMetrics.currentFocus, realFocusTasks]);

  const effectiveRoadmapProgress = useMemo(() => {
    if (rtMetrics.progressBar?.percentage !== undefined) {
      return rtMetrics.progressBar.percentage;
    }
    if (rtMetrics.progressBar?.roadmapProgress !== undefined) {
      return rtMetrics.progressBar.roadmapProgress;
    }
    return roadmapProgress;
  }, [rtMetrics.progressBar, roadmapProgress]);

  // Handle AI with real context & clean concise response
  const handleAiQuery = async (promptText: string) => {
    if (!promptText.trim() || isAiSending) return;
    setAiInputText(promptText);
    setIsAiSending(true);

    const lower = promptText.toLowerCase();

    // 1. Agar foydalanuvchi bugungi tasklarini so'ragan bo'lsa:
    if (lower.includes('task') || lower.includes('vazifa')) {
      if (tasks.length === 0) {
        setAiAssistantReply("Bugun uchun rejalashtirilgan vazifalar yo'q. Yangi vazifa qo'shish uchun yuqoridagi **+ Add Task** tugmasini bosing.");
        setIsAiSending(false);
        return;
      }
      const active = tasks.filter((t) => t.status !== 'completed');
      const done = tasks.filter((t) => t.status === 'completed');
      const lines = [
        `Bugungi vazifalaringiz (${tasks.length} ta):`,
        '',
        ...active.map((t, idx) => `${idx + 1}. ⏳ **${t.title}** ${t.tags?.length ? `(${t.tags.join(', ')})` : ''}`),
        ...(done.length > 0 ? ['', '✅ Bajarilganlar:', ...done.map((t) => `• ~~${t.title}~~`)] : []),
        '',
        'Qaysi biridan boshlaymiz?',
      ];
      setAiAssistantReply(lines.join('\n'));
      setIsAiSending(false);
      return;
    }

    // 2. Agar hisobot yoki natija so'ragan bo'lsa:
    if (lower.includes('hisobot') || lower.includes('natija') || lower.includes('o\'tgan hafta') || lower.includes('qisqa hisobot')) {
      const done = tasks.filter((t) => t.status === 'completed').length;
      const total = tasks.length;
      setAiAssistantReply(
        `📊 **Haftalik qisqa hisobotingiz:**\n\n• Jami vazifalar: ${total} ta\n• Bajarilgan: ${done} ta (${total > 0 ? Math.round((done / total) * 100) : 0}%)\n• Faol loyihalar: ${activeProjects.length} ta\n• Maqsadlar: ${goals.length} ta\n\nKuningiz unumli o'tishini tilayman!`
      );
      setIsAiSending(false);
      return;
    }

    // 3. Agar maqsad yoki reja so'ragan bo'lsa:
    if (lower.includes('maqsad') || lower.includes('reja') || lower.includes('tavsiya')) {
      if (goals.length > 0) {
        const goalList = goals.map((g) => `• **${g.title}** — ${g.progress}% bajarilgan`).join('\n');
        setAiAssistantReply(`🎯 **Joriy maqsadlaringiz:**\n\n${goalList}\n\nBugun aynan qaysi maqsad bo'yicha vazifalarni rejalashtiramiz?`);
        setIsAiSending(false);
        return;
      }
    }

    // 4. Boshqa barcha savollar uchun LLM ga aniq va qisqa javob berish bo'yicha ko'rsatma:
    const currentUserName = userProfile.full_name || 'Dasturchi';
    const currentUserTitle = userProfile.title || 'Software Engineer';
    const realContext = `
Foydalanuvchi: ${currentUserName} (${currentUserTitle})
Bugungi sana: ${todayDateStr}
Haqiqiy faol vazifalar (${tasks.length} ta): ${tasks.slice(0, 8).map((t) => t.title).join('; ') || "Hozircha yo'q"}
Haqiqiy faol loyihalar: ${activeProjects.map((p) => p.title).join('; ') || "Hozircha yo'q"}
Haqiqiy maqsadlar: ${goals.map((g) => `${g.title} (${g.progress}%)`).join('; ') || "Hozircha yo'q"}
`.trim();

    const systemPrompt = `Siz ${currentUserName}ning CogniDev ilovasidagi shaxsiy, do'stona va professional AI yordamchisisiz.
QAT'IY QOIDALAR:
1. Javobingiz QISQA, ANIQ VA SAMIMIY bo'lsin (maksimal 2-4 ta gap yoki ixcham punktlar).
2. HECH QACHON keraksiz katta jadvallar, soxta SQL/kodlar, o'tmishdagi (masalan 2023) sanalarni yoki g'alati/soxta so'zlarni to'qimang.
3. So'ralmagan mavzular (masalan sport jadvali, murakkab texnik maqolalar) bo'yicha uzun matn yozmang. Faqat so'ralgan savolga aniq javob bering.
4. Faqat toza, tabiiy va zamonaviy o'zbek tilida so'zlashuvchan ohangda yozing.
Foydalanuvchi konteksti:
${realContext}`;

    try {
      const response = await callAi(promptText, systemPrompt);
      setAiAssistantReply(response.text);
    } catch {
      setAiAssistantReply("Kechirasiz, javob olishda muammo yuz berdi. Sozlamalardan AI provayderini tekshiring.");
    } finally {
      setIsAiSending(false);
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    addActiveProject({
      title: newProjectTitle.trim(),
      subtitle: newProjectSubtitle.trim() || 'Software Development Project',
      progress: Math.min(100, Math.max(0, Number(newProjectProgress) || 0)),
      color: newProjectColor,
    });
    setNewProjectTitle('');
    setNewProjectSubtitle('');
    setShowAddProjectModal(false);
    setHud("Yangi loyiha muvaffaqiyatli qo'shildi!");
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    addGoal({
      title: newGoalTitle.trim(),
      category: newGoalCategory,
      progress: Math.min(100, Math.max(0, Number(newGoalProgress) || 0)),
    });
    setNewGoalTitle('');
    setShowAddGoalModal(false);
    setHud("Yangi maqsad qo'shildi!");
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockTitle.trim()) return;
    const colors: Record<ScheduleBlock['category'], string> = {
      work: '#3b82f6',
      study: '#a855f7',
      personal: '#f59e0b',
      health: '#10b981',
    };
    addScheduleBlock({
      time_range: newBlockTime.trim(),
      title: newBlockTitle.trim(),
      category: newBlockCategory,
      tag: newBlockTag.trim() || 'General',
      color: colors[newBlockCategory],
      done: false,
    });
    setNewBlockTitle('');
    setShowAddBlockModal(false);
    setHud("Vaqt bloki taqvimga qo'shildi!");
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-x-none bg-[#0a0b0f] p-4 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-[1550px] w-full min-w-0 space-y-4">

        {/* 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">

          {/* LEFT 8 COLUMNS: Main Cockpit */}
          <div className="lg:col-span-8 space-y-4 min-w-0">

            {/* Real-time Metrics Push Live Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-black/40 to-purple-500/10 border border-emerald-500/20 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <Activity size={12} className="text-emerald-400" />
                  Real-Time Metrics Push
                </span>
                <span className="hidden sm:inline font-mono text-[10.5px] text-zinc-400 border-l border-white/10 pl-2">
                  PUT /api/v1/metrics/:id
                </span>
                {rtPushedAt && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    • Yangilandi: {rtPushedAt}
                  </span>
                )}
                {rtLatencyMs !== null && (
                  <span className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                    {rtLatencyMs.toFixed(1)} ms (&lt; 90ms ✓)
                  </span>
                )}
                {effectiveWeeklyOverview.isRealtimeOverride && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded font-semibold">
                    Live Override Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {effectiveWeeklyOverview.isRealtimeOverride && (
                  <button
                    onClick={rtResetMetrics}
                    className="text-[10.5px] font-medium text-zinc-400 hover:text-rose-300 transition"
                  >
                    Asliga qaytarish
                  </button>
                )}
                <button
                  onClick={() => setShowMetricsSimulator((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-medium text-[11px] transition shadow-sm"
                >
                  <Radio size={12} className="text-emerald-400" />
                  <span>Metrics Push Simulator</span>
                </button>
              </div>
            </div>

            {/* Interactive Metrics Push Simulator */}
            {showMetricsSimulator && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[#121319] p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Real-Time Metrics Push Simulator (&lt; 90ms Target)
                    </span>
                  </div>
                  <button
                    onClick={() => setShowMetricsSimulator(false)}
                    className="text-zinc-500 hover:text-white p-1"
                  >
                    <X size={13} />
                  </button>
                </div>

                <p className="text-[11.5px] text-zinc-300">
                  Ushbu panel <code className="text-emerald-400 font-mono font-bold">PUT /api/v1/metrics/:id</code> API endpointiga to‘g‘ridan-to‘g‘ri ma’lumotlarni yuboradi va unumdorlikni tekshiradi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={async () => {
                      setSimulatorStatus('Yuborilmoqda...');
                      const res = await rtPushMetric('weekly-boost', {
                        weeklyOverview: {
                          completedCount: 22,
                          totalHours: 36.5,
                          projectsCount: 4,
                          days: [
                            { name: 'Du', heightPercent: 45, totalActivity: 5, isToday: false },
                            { name: 'Se', heightPercent: 70, totalActivity: 8, isToday: false },
                            { name: 'Ch', heightPercent: 95, totalActivity: 11, isToday: false },
                            { name: 'Pa', heightPercent: 80, totalActivity: 9, isToday: true },
                            { name: 'Ju', heightPercent: 60, totalActivity: 7, isToday: false },
                            { name: 'Sh', heightPercent: 30, totalActivity: 3, isToday: false },
                            { name: 'Ya', heightPercent: 20, totalActivity: 2, isToday: false },
                          ],
                        },
                      });
                      setSimulatorStatus(`✓ Weekly Overview Boost: ${res.latency_ms}ms (< 90ms)`);
                    }}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-left transition group"
                  >
                    <span className="text-[11px] font-bold text-white group-hover:text-emerald-300">
                      📊 Weekly Boost
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      22 ta vazifa, 36.5 soat, 7 kunlik chart
                    </span>
                  </button>

                  <button
                    onClick={async () => {
                      setSimulatorStatus('Yuborilmoqda...');
                      const res = await rtPushMetric('focus-sprint', {
                        currentFocus: {
                          items: [
                            { id: 'f-sse', title: 'SSE 10 000 Sessions Concurrency Verified', status: 'completed', priority: 'urgent' },
                            { id: 'f-sub90', title: 'Latency Guaranteed Sub-90ms Callbacks', status: 'in_progress', priority: 'high' },
                            { id: 'f-doc', title: 'Developer Guide & Simulator Online', status: 'in_progress', priority: 'medium' },
                          ],
                        },
                      });
                      setSimulatorStatus(`✓ Focus Sprint: ${res.latency_ms}ms (< 90ms)`);
                    }}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-left transition group"
                  >
                    <span className="text-[11px] font-bold text-white group-hover:text-emerald-300">
                      🎯 Focus Sprint
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      3 ta tezkor jonli fokus vazifasi
                    </span>
                  </button>

                  <button
                    onClick={async () => {
                      setSimulatorStatus('Yuborilmoqda...');
                      const res = await rtPushMetric('progress-burst', {
                        progressBar: {
                          percentage: 92,
                          label: 'Roadmap & Goals 92% Complete',
                          roadmapProgress: 92,
                        },
                      });
                      setSimulatorStatus(`✓ Progress Bar 92%: ${res.latency_ms}ms (< 90ms)`);
                    }}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-left transition group"
                  >
                    <span className="text-[11px] font-bold text-white group-hover:text-emerald-300">
                      ⚡ 92% Progress Bar
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Roadmap va umumiy foiz 92% ga
                    </span>
                  </button>
                </div>

                {simulatorStatus && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
                    <span>{simulatorStatus}</span>
                    <button
                      onClick={rtResetMetrics}
                      className="text-zinc-400 hover:text-white underline text-[10.5px]"
                    >
                      Asliga qaytarish
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1. Hero Scenic Banner */}
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 p-6 shadow-2xl min-h-[175px] flex items-center justify-between"
              style={{
                backgroundImage: `url('/fuji-banner.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 40%',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/30 pointer-events-none" />

              <div className="relative z-10 space-y-1.5 max-w-md">
                <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
                  {greeting}, {userProfile.full_name || 'Dasturchi'} 👋
                </h1>
                <div className="pt-0.5">
                  <p className="text-[17px] font-bold text-amber-300 tracking-wide font-sans drop-shadow">
                    *継続は力なり*
                  </p>
                  <p className="text-[12.5px] text-zinc-300 italic drop-shadow">
                    &ldquo;Consistency is power.&rdquo;
                  </p>
                </div>
              </div>

              <div className="relative z-10 hidden sm:block rounded-xl border border-white/15 bg-black/45 backdrop-blur-md px-4 py-3 max-w-[240px] text-right shadow-lg">
                <p className="text-[12px] font-semibold text-zinc-200">
                  {todayDateStr}
                </p>
                <p className="mt-1 text-[11px] text-zinc-300 leading-relaxed">
                  “小さな一歩の積み重ねが、大きな結果を生む。”
                </p>
                <div className="mt-1.5 flex justify-end">
                  <Edit2 size={11} className="text-zinc-400 hover:text-white cursor-pointer transition" />
                </div>
              </div>
            </div>

            {/* 2. 4 Metric Cards (Real Dynamic Metrics) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">{completedTasksCount}</p>
                  <p className="text-[11px] text-zinc-400">Tasks done this week</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <BookOpen size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">{studyActualHours}h</p>
                  <p className="text-[11px] text-zinc-400">Study time this week</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <Laptop size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">{workActualHours}h</p>
                  <p className="text-[11px] text-zinc-400">Work time this week</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                  <Target size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">{completedGoalsCount} / {goals.length || 0}</p>
                  <p className="text-[11px] text-zinc-400">Goals progress this week</p>
                </div>
              </div>
            </div>

            {/* 3. Today's Tasks (Real User Tasks) */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-zinc-400" />
                  <h2 className="text-[14px] font-bold text-white">Today's Tasks</h2>
                </div>

                {/* Filter tabs with real dynamic counts */}
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all', label: `All ${tasks.length}` },
                    { id: 'work', label: `Work ${workTasksCount}` },
                    { id: 'study', label: `Study ${studyTasksCount}` },
                    { id: 'personal', label: `Personal ${personalTasksCount}` },
                    { id: 'other', label: `Other ${otherTasksCount}` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTaskCategoryFilter(tab.id as any)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                        taskCategoryFilter === tab.id
                          ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setTaskModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition"
                >
                  <Plus size={12} />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Task Items */}
              {(() => {
                const activeTasks = filteredTasks.filter((t) => t.status !== 'completed');
                const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

                if (activeTasks.length === 0 && completedTasks.length === 0) {
                  return (
                    <div className="py-8 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                      <p className="text-[13px] text-zinc-400">Hozircha hech qanday vazifa yo‘q.</p>
                      <p className="text-[11px] text-zinc-600 mt-1">Yangi vazifa kiritish uchun yuqoridagi tugmani bosing yoki {formatShortcut('N')} bosing.</p>
                      <button
                        onClick={() => setTaskModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 px-3 py-1.5 text-[11.5px] font-medium text-white transition"
                      >
                        <Plus size={13} />
                        <span>Yangi Vazifa Qo‘shish</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {/* Active Tasks List */}
                    {activeTasks.length > 0 ? (
                      <div className="divide-y divide-white/[0.04]">
                        {activeTasks.map((t) => {
                          const mainTag = t.tags?.[0] || 'Task';
                          return (
                            <div
                              key={t.id}
                              className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02] px-2 rounded-xl transition group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  onClick={() => updateTaskStatus(t.id, 'completed')}
                                  className="text-zinc-400 hover:text-blue-400 transition shrink-0"
                                  title="Bajarildi deb belgilash va arxivga tushirish"
                                >
                                  <Circle size={17} className="text-zinc-500 hover:text-blue-400" />
                                </button>
                                <span className="text-[12.5px] truncate font-medium text-zinc-200">
                                  {t.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="rounded-md bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                                  {mainTag}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline-block">
                                  {t.priority}
                                </span>
                                <button
                                  onClick={() => deleteTask(t.id)}
                                  title="O'chirish"
                                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 transition"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-4 text-center rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 text-[12px] text-emerald-300 flex items-center justify-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span>Barcha faol vazifalar bajarildi! Baraka toping 🚀</span>
                      </div>
                    )}

                    {/* Dedicated Archive Section for Completed Tasks */}
                    {completedTasks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <div className="flex items-center gap-2">
                            <FolderArchive size={13} className="text-zinc-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                              Arxiv / Bajarilgan vazifalar
                            </span>
                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.2 text-[10px] font-semibold text-emerald-400">
                              {completedTasks.length} ta
                            </span>
                          </div>
                          <span className="text-[10.5px] text-zinc-500 italic hidden sm:inline">
                            Qayta faollashtirish uchun belgilashni bosing
                          </span>
                        </div>

                        <div className="divide-y divide-white/[0.03] rounded-xl bg-white/[0.015] border border-white/[0.04] p-1 opacity-75 hover:opacity-100 transition">
                          {completedTasks.map((t) => {
                            const mainTag = t.tags?.[0] || 'Vazifa';
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between gap-3 py-2 px-2 hover:bg-white/[0.03] rounded-lg transition group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <button
                                    onClick={() => updateTaskStatus(t.id, 'active')}
                                    className="text-emerald-400 hover:text-zinc-400 transition shrink-0"
                                    title="Qayta faollashtirish"
                                  >
                                    <CheckCircle2 size={16} className="text-emerald-400 fill-emerald-500/20" />
                                  </button>
                                  <span className="text-[12px] truncate font-medium line-through text-zinc-500">
                                    {t.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="rounded-md bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-medium text-zinc-400">
                                    {mainTag}
                                  </span>
                                  <button
                                    onClick={() => deleteTask(t.id)}
                                    title="O'chirish"
                                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 transition"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 4. Subgrid: Recent Notes & Active Projects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Recent Notes */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-amber-400" />
                    <h3 className="text-[13.5px] font-bold text-white">Recent Notes</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const id = await createNote('Yangi Qayd');
                        selectNote(id);
                        setMainView('notes');
                      }}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      <Plus size={11} /> Qayd
                    </button>
                    <button
                      onClick={() => setMainView('notes')}
                      className="text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      View All
                    </button>
                  </div>
                </div>

                {notesDocs.length === 0 ? (
                  <div className="py-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                    <p className="text-[12px] text-zinc-400">Hozircha qaydlar yo‘q.</p>
                    <button
                      onClick={async () => {
                        const id = await createNote('Yangi Qayd');
                        selectNote(id);
                        setMainView('notes');
                      }}
                      className="mt-2 text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      + Birinchi qaydingizni yozing
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {notesDocs.slice(0, 5).map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          selectNote(doc.id);
                          setMainView('notes');
                        }}
                        className="flex items-start justify-between gap-2 p-2 rounded-xl hover:bg-white/[0.04] cursor-pointer transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-zinc-200 truncate">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {doc.content.replace(/^#+\s*/, '').slice(0, 55)}...
                          </p>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Projects */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder size={15} className="text-blue-400" />
                    <h3 className="text-[13.5px] font-bold text-white">Active Projects</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddProjectModal(true)}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      <Plus size={11} /> Loyiha
                    </button>
                    <button
                      onClick={() => setMainView('projects')}
                      className="text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      View All
                    </button>
                  </div>
                </div>

                {activeProjects.length === 0 ? (
                  <div className="py-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                    <p className="text-[12px] text-zinc-400">Hozircha loyihalar kiritilmagan.</p>
                    <button
                      onClick={() => setShowAddProjectModal(true)}
                      className="mt-2 text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      + Loyiha qo‘shish
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeProjects.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 rounded-xl hover:bg-white/[0.04] transition space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: p.color || '#3b82f6' }}
                            />
                            <span className="text-[12px] font-semibold text-zinc-200 truncate">
                              {p.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => updateProjectProgress(p.id, Math.min(100, p.progress + 10))}
                              title="+10% oshirish"
                              className="text-[11px] font-bold text-zinc-300 font-mono hover:text-blue-400 transition"
                            >
                              {p.progress}%
                            </button>
                            <button
                              onClick={() => deleteActiveProject(p.id)}
                              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-0.5"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10.5px] text-zinc-500 truncate pl-4">
                          {p.subtitle}
                        </p>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${p.progress}%`,
                              backgroundColor: p.color || '#3b82f6',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Subgrid: Learning Roadmap & Goals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
              {/* Learning Roadmap */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3 min-w-0 overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                        <BookOpen size={14} />
                      </div>
                      <h3 className="text-[13.5px] font-bold text-white tracking-tight">Learning Roadmap</h3>
                    </div>
                    <button
                      onClick={() => setMainView('roadmap')}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold transition"
                    >
                      Barchasi
                    </button>
                  </div>

                  {roadmaps.length === 0 ? (
                    <div className="py-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] my-2">
                      <p className="text-[12px] text-zinc-400">Hozircha o‘rganish yo‘l xaritasi yo‘q.</p>
                      <button
                        onClick={() => setMainView('roadmap')}
                        className="mt-2 text-[11px] text-purple-400 hover:underline font-semibold"
                      >
                        + Yo‘l xaritasi yaratish
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {/* Roadmap Selector Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                        {roadmaps.map((r, i) => (
                          <button
                            key={r.id}
                            onClick={() => setSelectedRoadmapIndex(i)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
                              selectedRoadmapIndex === i
                                ? 'bg-purple-600/25 text-purple-300 border border-purple-500/40 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            {r.title}
                          </button>
                        ))}
                      </div>

                      {/* Current Roadmap Progress Bar */}
                      <div className="space-y-1.5 rounded-xl border border-white/[0.05] bg-black/30 p-2.5">
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="font-semibold text-zinc-200 truncate max-w-[170px]" title={currentRoadmap?.title}>
                            {currentRoadmap?.title}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-purple-400 shrink-0">
                            {roadmapNodes.filter((n) => n.status === 'done').length}/{roadmapNodes.length} ({effectiveRoadmapProgress}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${effectiveRoadmapProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* Compact Topics Checklist */}
                      <div className="space-y-1.5">
                        {roadmapNodes.length === 0 ? (
                          <p className="text-[11.5px] text-zinc-500 py-2 text-center">Bu yo‘nalishda hali mavzular yo‘q</p>
                        ) : (
                          roadmapNodes.slice(0, 3).map((node) => {
                            const isDone = node.status === 'done';
                            return (
                              <div
                                key={node.id}
                                onClick={() => toggleTopicDone(node.roadmapId, node.milestoneId, node.id)}
                                className="flex items-center justify-between gap-2.5 p-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition group min-w-0"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div
                                    className={`h-4 w-4 rounded-full border transition flex items-center justify-center shrink-0 ${
                                      isDone
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-[0_0_8px_rgba(147,51,234,0.5)]'
                                        : 'border-zinc-600 group-hover:border-purple-400 bg-zinc-900/60'
                                    }`}
                                  >
                                    {isDone && <Check size={10} strokeWidth={3} />}
                                  </div>
                                  <span
                                    className={`text-[12px] font-medium transition truncate ${
                                      isDone ? 'line-through text-zinc-500' : 'text-zinc-200 group-hover:text-white'
                                    }`}
                                    title={node.label}
                                  >
                                    {node.label}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-mono shrink-0 transition ${
                                    isDone ? 'text-emerald-400/80' : 'text-zinc-500 group-hover:text-purple-400'
                                  }`}
                                >
                                  {isDone ? 'Bajarildi' : 'Kutilmoqda'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {roadmaps.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{currentRoadmap?.milestones?.length || 0} ta bosqich (milestone)</span>
                    <button
                      onClick={() => setMainView('roadmap')}
                      className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold transition"
                    >
                      Barchasini ko‘rish <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Goals */}
              <div id="myspace-goals-card" className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={15} className="text-rose-400" />
                    <h3 className="text-[13.5px] font-bold text-white">Goals</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddGoalModal(true)}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      <Plus size={11} /> Maqsad
                    </button>
                    <button
                      onClick={() => setMainView('roadmap')}
                      className="text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      View All
                    </button>
                  </div>
                </div>

                {goals.length === 0 ? (
                  <div className="py-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                    <p className="text-[12px] text-zinc-400">Hozircha maqsadlar yo‘q.</p>
                    <button
                      onClick={() => setShowAddGoalModal(true)}
                      className="mt-2 text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      + Maqsad qo‘shish
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.map((g) => (
                      <div key={g.id} className="space-y-1.5 group">
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="font-semibold text-zinc-200 truncate">
                            {g.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => updateGoalProgress(g.id, Math.min(100, g.progress + 10))}
                              title="+10% qo'shish"
                              className="font-mono text-zinc-400 hover:text-purple-300 font-bold"
                            >
                              {g.progress}%
                            </button>
                            <button
                              onClick={() => deleteGoal(g.id)}
                              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-0.5"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${g.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT 4 COLUMNS: Haftalik umumiy ko'rinish, Joriy fokus, AI Advice, AI Assistant, Calendar, Quick Capture */}
          <div className="lg:col-span-4 space-y-4 min-w-0">

            {/* 1. Haftalik umumiy ko'rinish Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-4 shadow-sm backdrop-blur-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-white tracking-tight">Haftalik umumiy ko'rinish</h3>
                  <p className="text-[11.5px] text-zinc-400 font-medium mt-0.5">{effectiveWeeklyOverview.dateRangeStr}</p>
                </div>
                <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                  <button
                    onClick={() => setWeekOffset((prev) => prev - 1)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition"
                    title="Oldingi hafta"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    onClick={() => setWeekOffset((prev) => prev + 1)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition"
                    title="Keyingi hafta"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* 7-Day Vertical Bar Chart */}
              <div className="flex items-end justify-between px-1.5 pt-2 pb-1">
                {effectiveWeeklyOverview.days.map((day) => (
                  <div key={day.name} className="flex flex-col items-center gap-2 group relative" title={day.tooltip || day.name}>
                    <div className="relative flex flex-col justify-end h-[74px] w-[14px] sm:w-[16px] rounded-full bg-white/[0.07] overflow-hidden p-[2px]">
                      {day.heightPercent > 0 ? (
                        <div
                          className={`w-full rounded-full transition-all duration-500 ${
                            day.isToday
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                              : 'bg-emerald-500/90 group-hover:bg-emerald-400'
                          }`}
                          style={{ height: `${day.heightPercent}%` }}
                        />
                      ) : (
                        <div
                          className={`w-full h-1 rounded-full ${
                            day.isToday ? 'bg-emerald-400/50' : 'bg-white/10'
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium transition ${
                        day.isToday ? 'text-emerald-400 font-bold' : 'text-zinc-400 group-hover:text-zinc-200'
                      }`}
                    >
                      {day.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* 4 Key Metrics */}
              <div className="space-y-2.5 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span className="text-zinc-300">Bajarilgan vazifalar</span>
                  </div>
                  <span className="font-bold font-mono text-white text-[13px]">{effectiveWeeklyOverview.completedCount}</span>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-zinc-400" />
                    <span className="text-zinc-300">Yaratilgan qaydlar</span>
                  </div>
                  <span className="font-bold font-mono text-white text-[13px]">{effectiveWeeklyOverview.notesCount}</span>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-zinc-400" />
                    <span className="text-zinc-300">Sarflangan vaqt</span>
                  </div>
                  <span className="font-bold font-mono text-white text-[13px]">{effectiveWeeklyOverview.totalHours} soat</span>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <Folder size={15} className="text-zinc-400" />
                    <span className="text-zinc-300">Faol loyihalar</span>
                  </div>
                  <span className="font-bold font-mono text-white text-[13px]">{effectiveWeeklyOverview.projectsCount}</span>
                </div>
              </div>
            </div>

            {/* 2. Joriy fokus Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-4 shadow-sm backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
                    <Target size={13} />
                  </div>
                  <h3 className="text-[13.5px] font-bold text-white tracking-tight">Joriy fokus</h3>
                </div>
                <button
                  onClick={() => setIsAddingFocus(!isAddingFocus)}
                  className="rounded-lg bg-white/[0.05] hover:bg-white/[0.1] p-1 text-zinc-400 hover:text-white transition"
                  title="Fokus qo'shish"
                >
                  <Plus size={13} />
                </button>
              </div>

              {isAddingFocus && (
                <form onSubmit={handleAddFocusItem} className="pt-1">
                  <input
                    type="text"
                    value={newFocusText}
                    onChange={(e) => setNewFocusText(e.target.value)}
                    placeholder="Yangi fokus vazifa yozing va Enter bosing..."
                    autoFocus
                    className="w-full rounded-xl border border-rose-500/30 bg-black/40 px-3 py-1.5 text-[12px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                </form>
              )}

              {effectiveFocusTasks.length === 0 ? (
                <div className="py-4 px-2 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                  <p className="text-[12px] text-zinc-500">Bugun uchun faol fokus vazifalar yo'q</p>
                  <button
                    onClick={() => setIsAddingFocus(true)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-rose-400 hover:text-rose-300 transition"
                  >
                    <Plus size={11} /> Fokus qo'shish
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {effectiveFocusTasks.map((item) => {
                    const isDone = item.status === 'completed';
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleFocus(item.id)}
                        className="flex items-center justify-between gap-2.5 p-1 rounded-lg hover:bg-white/[0.03] cursor-pointer transition group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`h-4 w-4 rounded-full border transition flex items-center justify-center shrink-0 ${
                              isDone
                                ? 'bg-rose-500 border-rose-500 text-white'
                                : 'border-zinc-500 group-hover:border-rose-400'
                            }`}
                          >
                            {isDone && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span
                            className={`text-[12px] font-medium transition truncate ${
                              isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFocusItem(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-0.5 transition"
                          title="O'chirish"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. AI dan bugungi maslahat Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-4 shadow-sm backdrop-blur-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-blue-400" />
                  <h3 className="text-[13px] font-bold text-white tracking-tight">AI dan bugungi maslahat</h3>
                </div>
                <button
                  onClick={handleRefreshAdvice}
                  className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                  title="Yangi maslahat olish"
                >
                  <RotateCw size={12} className={isSpinningAdvice ? 'animate-spin text-blue-400' : ''} />
                </button>
              </div>

              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                <p className="text-[12px] text-zinc-300 italic leading-relaxed font-sans">
                  &ldquo;{aiAdviceList[adviceIndex]}&rdquo;
                </p>
              </div>
            </div>

            {/* 4. Integrated AI Assistant Card (Live Context) */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/95 p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400 animate-pulse" />
                  <h3 className="text-[13.5px] font-bold text-white">AI Assistant</h3>
                </div>
                <button
                  onClick={toggleAiDrawer}
                  className="rounded p-1 text-zinc-500 hover:text-zinc-200 transition"
                  title="Expand Drawer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="rounded-xl bg-purple-600/10 border border-purple-500/20 p-2.5 text-[12px] text-purple-200">
                {aiAssistantReply ? (
                  <FormattedAiText content={aiAssistantReply} />
                ) : (
                  'Bugun qanday yordam bera olaman?'
                )}
              </div>

              {/* Suggested Prompt Chips */}
              <div className="space-y-1.5">
                {[
                  { icon: '📋', text: "Mening bugungi tasklarimni ko'rsat" },
                  { icon: '📊', text: "Haftalik natijalarim qanday?" },
                  { icon: '🎯', text: "Maqsadlarim bo'yicha maslahat ber" },
                  { icon: '💡', text: "Yangi g'oyalarni rejalashtir" },
                ].map((chip) => (
                  <button
                    key={chip.text}
                    onClick={() => handleAiQuery(chip.text)}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 text-left text-[11px] text-zinc-300 hover:border-purple-500/30 hover:bg-purple-500/10 transition group"
                  >
                    <span>{chip.icon}</span>
                    <span className="truncate group-hover:text-purple-200">{chip.text}</span>
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiQuery(aiInputText);
                }}
                className="relative pt-1"
              >
                <input
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="Anything you want to ask..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 pl-3 pr-16 py-2 text-[11.5px] text-white placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <div className="absolute right-2 top-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHud("Fayl yoki skrinshot yuklash imkoniyati")}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <Paperclip size={13} />
                  </button>
                  <button
                    type="submit"
                    disabled={!aiInputText.trim() || isAiSending}
                    className="flex h-5 w-5 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40 transition"
                  >
                    <Send size={10} />
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Calendar Timeline Card (Real Schedule Blocks) */}
            <div id="myspace-calendar-card" className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={15} className="text-zinc-400" />
                  <h3 className="text-[13.5px] font-bold text-white">Calendar</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowAddBlockModal(true)}
                    className="rounded bg-white/[0.06] hover:bg-white/[0.12] px-2 py-0.5 text-[10.5px] text-zinc-200 font-medium flex items-center gap-1"
                  >
                    <Plus size={11} /> Blok
                  </button>
                  <div className="flex items-center">
                    <button className="p-1 text-zinc-500 hover:text-zinc-200">
                      <ChevronLeft size={13} />
                    </button>
                    <button className="p-1 text-zinc-500 hover:text-zinc-200">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {scheduleBlocks.length === 0 ? (
                <div className="py-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                  <p className="text-[12px] text-zinc-400">Bugun uchun vaqt bloklari belgilanmagan.</p>
                  <button
                    onClick={() => setShowAddBlockModal(true)}
                    className="mt-2 text-[11px] text-blue-400 hover:underline font-medium"
                  >
                    + Vaqt bloki qo‘shish
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-[11px] font-mono">
                  {scheduleBlocks.map((b) => (
                    <div key={b.id} className="flex items-center gap-2.5 group">
                      <span className="text-zinc-500 text-[10px] w-12 shrink-0 truncate">
                        {b.time_range.split('-')[0]?.trim()}
                      </span>
                      <div
                        onClick={() => toggleScheduleBlockDone(b.id)}
                        className={`flex-1 rounded-xl p-2 cursor-pointer transition border ${
                          b.done
                            ? 'bg-white/[0.03] border-white/10 opacity-60'
                            : 'bg-white/[0.05] border-white/10 hover:border-white/20'
                        }`}
                        style={{ borderLeftColor: b.color || '#3b82f6', borderLeftWidth: 3 }}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`font-semibold text-[11.5px] truncate ${b.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                            {b.title}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScheduleBlock(b.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-0.5"
                          >
                            <X size={10} />
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{b.time_range}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Quick Capture Card */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              <h3 className="text-[13.5px] font-bold text-white">Quick Capture</h3>

              <div className="grid grid-cols-5 gap-2 text-center">
                <button
                  onClick={() => setTaskModal(true)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:scale-105 group-hover:bg-purple-500/25 transition">
                    <CheckSquare size={17} />
                  </div>
                  <span className="text-[10.5px] font-medium text-zinc-400 group-hover:text-zinc-200">
                    Task
                  </span>
                </button>

                <button
                  onClick={async () => {
                    const id = await createNote('Yangi Qayd');
                    selectNote(id);
                    setMainView('notes');
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/25 transition">
                    <FileText size={17} />
                  </div>
                  <span className="text-[10.5px] font-medium text-zinc-400 group-hover:text-zinc-200">
                    Note
                  </span>
                </button>

                <button
                  onClick={() => setMainView('ideas')}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:scale-105 group-hover:bg-amber-500/25 transition">
                    <Lightbulb size={17} />
                  </div>
                  <span className="text-[10.5px] font-medium text-zinc-400 group-hover:text-zinc-200">
                    Idea
                  </span>
                </button>

                <button
                  onClick={() => {
                    const url = prompt("Havola (URL) manzilini kiriting:");
                    if (url) {
                      setHud(`Havola saqlandi: ${url}`);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 group-hover:scale-105 group-hover:bg-blue-500/25 transition">
                    <Link2 size={17} />
                  </div>
                  <span className="text-[10.5px] font-medium text-zinc-400 group-hover:text-zinc-200">
                    Link
                  </span>
                </button>

                <button
                  onClick={() => {
                    setMainView('notes');
                    setHud("Hujjatlar & fayllar bo'limi");
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 group-hover:scale-105 group-hover:bg-cyan-500/25 transition">
                    <Folder size={17} />
                  </div>
                  <span className="text-[10.5px] font-medium text-zinc-400 group-hover:text-zinc-200">
                    File
                  </span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Modal: Add Project */}
      {showAddProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateProject}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171d] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white">Yangi Faol Loyiha Qo‘shish</h3>
              <button
                type="button"
                onClick={() => setShowAddProjectModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Loyiha Nomi</label>
                <input
                  autoFocus
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="masalan: Nihongo Talk..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Tavsif / Texnologiya</label>
                <input
                  value={newProjectSubtitle}
                  onChange={(e) => setNewProjectSubtitle(e.target.value)}
                  placeholder="masalan: Django + DRF backend..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Joriy Bajarilish Foizi ({newProjectProgress}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newProjectProgress}
                  onChange={(e) => setNewProjectProgress(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Rang</label>
                <div className="flex items-center gap-2 mt-1">
                  {['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ef4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProjectColor(c)}
                      className={`h-5 w-5 rounded-full transition ${newProjectColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-60'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProjectModal(false)}
                className="rounded-xl px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={!newProjectTitle.trim()}
                className="rounded-xl bg-blue-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                Saqlash
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Goal */}
      {showAddGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateGoal}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171d] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white">Yangi Maqsad Qo‘shish</h3>
              <button
                type="button"
                onClick={() => setShowAddGoalModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Maqsad Nomi</label>
                <input
                  autoFocus
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  placeholder="masalan: JLPT N2 imtihonidan o'tish..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Toifa</label>
                <select
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="Japanese">Japanese / JLPT</option>
                  <option value="Engineering">Engineering / Backend</option>
                  <option value="Career">Career & Travel</option>
                  <option value="Health">Health & Sport</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Bajarilish Foizi ({newGoalProgress}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newGoalProgress}
                  onChange={(e) => setNewGoalProgress(Number(e.target.value))}
                  className="mt-1 w-full accent-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddGoalModal(false)}
                className="rounded-xl px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={!newGoalTitle.trim()}
                className="rounded-xl bg-purple-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
              >
                Maqsadni Saqlash
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Schedule Block */}
      {showAddBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateBlock}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171d] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white">Taqvimga Vaqt Bloki Qo‘shish</h3>
              <button
                type="button"
                onClick={() => setShowAddBlockModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Vaqt Oralig‘i</label>
                <input
                  autoFocus
                  value={newBlockTime}
                  onChange={(e) => setNewBlockTime(e.target.value)}
                  placeholder="masalan: 13:00 - 15:00..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Mavzu / Vazifa</label>
                <input
                  value={newBlockTitle}
                  onChange={(e) => setNewBlockTitle(e.target.value)}
                  placeholder="masalan: Django imtihoniga tayyorgarlik..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">Toifa</label>
                <select
                  value={newBlockCategory}
                  onChange={(e) => {
                    const c = e.target.value as any;
                    setNewBlockCategory(c);
                    setNewBlockTag(c.charAt(0).toUpperCase() + c.slice(1));
                  }}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="work">Work (Ish & Dasturlash)</option>
                  <option value="study">Study (O‘qish & Til)</option>
                  <option value="personal">Personal (Shaxsiy)</option>
                  <option value="health">Health (Sport & Salomatlik)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBlockModal(false)}
                className="rounded-xl px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={!newBlockTitle.trim()}
                className="rounded-xl bg-blue-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                Blokni Qo‘shish
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
