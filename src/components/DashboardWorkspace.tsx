import { useState } from 'react';
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
  Edit2,
  Flame,
  Trash2,
  X,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { callAi } from '../lib/ai';
import { formatShortcut } from '../lib/platform';
import type { ScheduleBlock } from '../lib/types';
import FormattedAiText from './FormattedAiText';

export default function DashboardWorkspace() {
  const {
    tasks,
    updateTaskStatus,
    deleteTask,
    userProfile,
    notesDocs,
    activeProjects,
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
  const healthCompletedCount = tasks.filter((t) => t.tags?.some((x) => ['health', 'sport', 'gym'].includes(x.toLowerCase())) && t.status === 'completed').length;
  const personalCompletedCount = tasks.filter((t) => isPersonalTask(t) && t.status === 'completed').length;

  // Active Roadmap
  const currentRoadmap = roadmaps[selectedRoadmapIndex] || roadmaps[0];
  const roadmapNodes = currentRoadmap
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
    const realContext = `
Foydalanuvchi: Farhod (Software / Backend Engineer)
Bugungi sana: ${todayDateStr}
Haqiqiy faol vazifalar (${tasks.length} ta): ${tasks.slice(0, 8).map((t) => t.title).join('; ') || "Hozircha yo'q"}
Haqiqiy faol loyihalar: ${activeProjects.map((p) => p.title).join('; ') || "Hozircha yo'q"}
Haqiqiy maqsadlar: ${goals.map((g) => `${g.title} (${g.progress}%)`).join('; ') || "Hozircha yo'q"}
`.trim();

    const systemPrompt = `Siz Farhodning MySpace ilovasidagi shaxsiy, do'stona va professional AI yordamchisisiz.
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
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-4 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-[1550px] space-y-4">

        {/* 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* LEFT 8 COLUMNS: Main Cockpit */}
          <div className="lg:col-span-8 space-y-4">

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
                  {greeting}, {userProfile.full_name || 'Farhod'} 👋
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
              {filteredTasks.length === 0 ? (
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
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {filteredTasks.map((t) => {
                    const isDone = t.status === 'completed';
                    const mainTag = t.tags?.[0] || 'Task';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02] px-2 rounded-xl transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => updateTaskStatus(t.id, isDone ? 'active' : 'completed')}
                            className="text-zinc-400 hover:text-blue-400 transition shrink-0"
                          >
                            {isDone ? (
                              <CheckCircle2 size={17} className="text-blue-400 fill-blue-500/20" />
                            ) : (
                              <Circle size={17} className="text-zinc-500" />
                            )}
                          </button>
                          <span
                            className={`text-[12.5px] truncate font-medium ${
                              isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
                            }`}
                          >
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
              )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Learning Roadmap */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-purple-400" />
                    <h3 className="text-[13.5px] font-bold text-white">Learning Roadmap</h3>
                  </div>
                  <button
                    onClick={() => setMainView('roadmap')}
                    className="text-[11px] text-blue-400 hover:underline font-medium"
                  >
                    View
                  </button>
                </div>

                {roadmaps.length === 0 ? (
                  <div className="py-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                    <p className="text-[12px] text-zinc-400">Hozircha o‘rganish yo‘l xaritasi yo‘q.</p>
                    <button
                      onClick={() => setMainView('roadmap')}
                      className="mt-2 text-[11px] text-blue-400 hover:underline font-medium"
                    >
                      + Yo‘l xaritasi (Roadmap) yaratish
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                      {roadmaps.map((r, i) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRoadmapIndex(i)}
                          className={`rounded-lg px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap transition ${
                            selectedRoadmapIndex === i
                              ? 'bg-blue-600/25 text-blue-300 border border-blue-500/30'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                          }`}
                        >
                          {r.title}
                        </button>
                      ))}
                    </div>

                    <div className="pt-3 pb-2 px-1">
                      <div className="relative flex items-center justify-between">
                        <div className="absolute left-2 right-2 top-2 h-0.5 bg-white/10 -z-0" />
                        {roadmapNodes.slice(0, 6).map((node) => (
                          <div
                            key={node.id}
                            onClick={() => toggleTopicDone(node.roadmapId, node.milestoneId, node.id)}
                            className="relative z-10 flex flex-col items-center cursor-pointer group"
                          >
                            <div
                              className={`h-4 w-4 rounded-full flex items-center justify-center transition ${
                                node.status === 'done'
                                  ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.8)]'
                                  : 'bg-zinc-800 border border-white/20 group-hover:border-blue-400'
                              }`}
                            >
                              {node.status === 'done' && <span className="h-1.5 w-1.5 bg-white rounded-full" />}
                            </div>
                            <span
                              className={`mt-2 text-[10px] whitespace-nowrap text-center ${
                                node.status === 'done' ? 'text-zinc-300' : 'text-zinc-600'
                              }`}
                            >
                              {node.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Goals */}
              <div id="myspace-goals-card" className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
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

          {/* RIGHT 4 COLUMNS: AI Assistant, Weekly Progress, Calendar, Quick Capture */}
          <div className="lg:col-span-4 space-y-4">

            {/* 1. Integrated AI Assistant Card (Live Context) */}
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

            {/* 2. Weekly Progress Card (Real Calculated Progress) */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-white">Weekly Progress</h3>
                <button
                  onClick={() => setMainView('retro')}
                  className="text-[11px] text-blue-400 hover:underline font-medium"
                >
                  View Report
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-purple-400" />
                      <span className="text-zinc-300">Study (Tasks & Topics)</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">{completedStudyCount} / {Math.max(studyTasksCount, 1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.round((completedStudyCount / Math.max(studyTasksCount, 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Laptop size={12} className="text-blue-400" />
                      <span className="text-zinc-300">Work / Projects</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">{completedWorkCount} / {Math.max(workTasksCount, 1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.round((completedWorkCount / Math.max(workTasksCount, 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Flame size={12} className="text-emerald-400" />
                      <span className="text-zinc-300">Health & Sport</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">{healthCompletedCount} / 3 times</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.round((healthCompletedCount / 3) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare size={12} className="text-amber-400" />
                      <span className="text-zinc-300">Personal Tasks</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">{personalCompletedCount} / {Math.max(personalTasksCount, 1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.round((personalCompletedCount / Math.max(personalTasksCount, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
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
