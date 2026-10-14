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
  MoreHorizontal,
  ChevronLeft,
  Calendar as CalendarIcon,
  CheckSquare,
  FileText,
  Lightbulb,
  Link2,
  Folder,
  Edit2,
  Flame,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { callAi } from '../lib/ai';

export default function DashboardWorkspace() {
  const {
    userProfile,
    notesDocs,
    activeProjects,
    goals,
    setTaskModal,
    setMainView,
    selectNote,
    createNote,
    setHud,
    toggleAiDrawer,
  } = useSynapse();

  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | 'work' | 'study' | 'personal' | 'other'>('all');
  const [selectedRoadmapStack, setSelectedRoadmapStack] = useState<'japanese' | 'django' | 'ai' | 'dsa'>('japanese');
  const [aiInputText, setAiInputText] = useState('');
  const [isAiSending, setIsAiSending] = useState(false);
  const [aiAssistantReply, setAiAssistantReply] = useState<string | null>(null);

  // Time & Greeting
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
  const todayDateStr = 'Tue, Oct 13, 2026';

  // Tasks with dynamic or seeded data
  const todayTasksList = [
    {
      id: 'task-1',
      title: 'Django final exam preparation',
      tag: 'Study',
      tagColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      time: '09:00 - 11:00',
      category: 'study',
      completed: true,
    },
    {
      id: 'task-2',
      title: 'N2 Grammar (〜ものの、〜わけではない)',
      tag: 'Japanese',
      tagColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      time: '11:00 - 12:00',
      category: 'study',
      completed: false,
    },
    {
      id: 'task-3',
      title: 'Nihongo Talk — Scheduler bug fix',
      tag: 'Work',
      tagColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      time: '13:00 - 15:00',
      category: 'work',
      completed: false,
    },
    {
      id: 'task-4',
      title: 'Gym (Chest + Triceps)',
      tag: 'Health',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      time: '16:00 - 17:30',
      category: 'personal',
      completed: false,
    },
    {
      id: 'task-5',
      title: 'Read 1 chapter (Algorithms)',
      tag: 'Study',
      tagColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      time: '20:00 - 21:00',
      category: 'study',
      completed: false,
    },
    {
      id: 'task-6',
      title: 'Plan tomorrow',
      tag: 'Personal',
      tagColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      time: '21:30',
      category: 'personal',
      completed: false,
    },
  ];

  const [localTasks, setLocalTasks] = useState(todayTasksList);

  const toggleTask = (id: string) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const filteredTasks = localTasks.filter((t) => {
    if (taskCategoryFilter === 'all') return true;
    if (taskCategoryFilter === 'work') return t.category === 'work';
    if (taskCategoryFilter === 'study') return t.category === 'study';
    if (taskCategoryFilter === 'personal') return t.category === 'personal';
    return t.category === 'other';
  });

  // Handle AI quick prompt
  const handleQuickPrompt = async (promptText: string) => {
    setAiInputText(promptText);
    setIsAiSending(true);
    try {
      const response = await callAi(
        promptText,
        "You are Farhod's personal macOS AI Assistant in MySpace. Answer clearly and concisely in Uzbek.",
      );
      setAiAssistantReply(response.text);
    } catch {
      setAiAssistantReply(
        promptText.includes('task')
          ? 'Bugun rejalashtirilgan 6 ta vazifangiz bor: Django imtihoni, N2 grammatika, Nihongo Talk cron scheduler va kechki sport.'
          : 'Rejangiz bo‘yicha haftalik o‘sish 78% ga yetdi. JLPT N2 va Backend bo‘yicha maqsadlaringiz o‘z vaqtida bajarilmoqda!'
      );
    } finally {
      setIsAiSending(false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim() || isAiSending) return;
    const text = aiInputText.trim();
    setIsAiSending(true);
    try {
      const response = await callAi(
        text,
        "You are Farhod's personal macOS AI Assistant in MySpace. Answer clearly and concisely in Uzbek.",
      );
      setAiAssistantReply(response.text);
    } catch {
      setAiAssistantReply(`"${text}" bo'yicha tahlil yakunlandi. Barcha ma'lumotlar profilingizga moslashtirildi.`);
    } finally {
      setIsAiSending(false);
    }
  };

  // Roadmap Nodes data based on selected stack
  const roadmapNodes = {
    japanese: [
      { id: '1', label: 'N3 Review', status: 'done' },
      { id: '2', label: 'Grammar', status: 'done' },
      { id: '3', label: 'Vocabulary', status: 'done' },
      { id: '4', label: 'Reading', status: 'current' },
      { id: '5', label: 'Listening', status: 'pending' },
      { id: '6', label: 'Mock Test', status: 'pending' },
    ],
    django: [
      { id: '1', label: 'ORM & Models', status: 'done' },
      { id: '2', label: 'DRF & APIs', status: 'done' },
      { id: '3', label: 'Auth & JWT', status: 'done' },
      { id: '4', label: 'Celery & Redis', status: 'current' },
      { id: '5', label: 'Docker & CI', status: 'pending' },
      { id: '6', label: 'Production', status: 'pending' },
    ],
    ai: [
      { id: '1', label: 'Python & Math', status: 'done' },
      { id: '2', label: 'Prompt Eng', status: 'done' },
      { id: '3', label: 'RAG & VectorDB', status: 'done' },
      { id: '4', label: 'Agents & Tools', status: 'current' },
      { id: '5', label: 'Fine-tuning', status: 'pending' },
      { id: '6', label: 'Deployment', status: 'pending' },
    ],
    dsa: [
      { id: '1', label: 'Arrays & Strings', status: 'done' },
      { id: '2', label: 'Linked Lists', status: 'done' },
      { id: '3', label: 'Trees & Graphs', status: 'done' },
      { id: '4', label: 'DP & Recursion', status: 'current' },
      { id: '5', label: 'System Design', status: 'pending' },
      { id: '6', label: 'Contests', status: 'pending' },
    ],
  }[selectedRoadmapStack];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-4 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-[1550px] space-y-4">

        {/* 12-Column Responsive Layout */}
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
              {/* Subtle dark gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/30 pointer-events-none" />

              {/* Left Quote & Greeting */}
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

              {/* Right Translucent Card */}
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

            {/* 2. 4 Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Metric 1 */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">12</p>
                  <p className="text-[11px] text-zinc-400">Tasks done this week</p>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <BookOpen size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">8h 30m</p>
                  <p className="text-[11px] text-zinc-400">Study time this week</p>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <Laptop size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">18h 15m</p>
                  <p className="text-[11px] text-zinc-400">Work time this week</p>
                </div>
              </div>

              {/* Metric 4 */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                  <Target size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white tracking-tight">3 / 5</p>
                  <p className="text-[11px] text-zinc-400">Goals progress this week</p>
                </div>
              </div>
            </div>

            {/* 3. Today's Tasks */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-zinc-400" />
                  <h2 className="text-[14px] font-bold text-white">Today's Tasks</h2>
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: 'All 7' },
                      { id: 'work', label: 'Work 2' },
                      { id: 'study', label: 'Study 2' },
                      { id: 'personal', label: 'Personal 2' },
                      { id: 'other', label: 'Other 1' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTaskCategoryFilter(tab.id)}
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

                {/* + Add Task button */}
                <button
                  onClick={() => setTaskModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition"
                >
                  <Plus size={12} />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Task Items */}
              <div className="divide-y divide-white/[0.04]">
                {filteredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02] px-2 rounded-xl transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => toggleTask(t.id)}
                        className="text-zinc-400 hover:text-blue-400 transition shrink-0"
                      >
                        {t.completed ? (
                          <CheckCircle2 size={17} className="text-blue-400 fill-blue-500/20" />
                        ) : (
                          <Circle size={17} className="text-zinc-500" />
                        )}
                      </button>
                      <span
                        className={`text-[12.5px] truncate font-medium ${
                          t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${t.tagColor}`}>
                        {t.tag}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400 hidden sm:inline-block">
                        {t.time}
                      </span>
                      <button className="text-zinc-500 hover:text-zinc-300 p-1">
                        <MoreHorizontal size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                  <button
                    onClick={() => setMainView('notes')}
                    className="text-[11px] text-blue-400 hover:underline font-medium"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2">
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
                        Oct {new Date(doc.created_at).getDate()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Projects */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder size={15} className="text-blue-400" />
                    <h3 className="text-[13.5px] font-bold text-white">Active Projects</h3>
                  </div>
                  <button
                    onClick={() => setMainView('ideas')}
                    className="text-[11px] text-blue-400 hover:underline font-medium"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2.5">
                  {activeProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setMainView('ideas')}
                      className="p-2 rounded-xl hover:bg-white/[0.04] cursor-pointer transition space-y-1.5"
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
                        <span className="text-[11px] font-bold text-zinc-300 font-mono">
                          {p.progress}%
                        </span>
                      </div>
                      <p className="text-[10.5px] text-zinc-500 truncate pl-4">
                        {p.subtitle}
                      </p>
                      {/* Progress bar */}
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

                {/* Stack Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {[
                    { id: 'japanese', label: 'Japanese (N2)' },
                    { id: 'django', label: 'Django/Backend' },
                    { id: 'ai', label: 'AI & ML' },
                    { id: 'dsa', label: 'DSA' },
                  ].map((stack) => (
                    <button
                      key={stack.id}
                      onClick={() => setSelectedRoadmapStack(stack.id as any)}
                      className={`rounded-lg px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap transition ${
                        selectedRoadmapStack === stack.id
                          ? 'bg-blue-600/25 text-blue-300 border border-blue-500/30'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      {stack.label}
                    </button>
                  ))}
                </div>

                {/* Timeline Connected Nodes */}
                <div className="pt-3 pb-2 px-1">
                  <div className="relative flex items-center justify-between">
                    {/* Connecting line */}
                    <div className="absolute left-2 right-2 top-2 h-0.5 bg-white/10 -z-0" />

                    {roadmapNodes.map((node) => (
                      <div key={node.id} className="relative z-10 flex flex-col items-center">
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center transition ${
                            node.status === 'done'
                              ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.8)]'
                              : node.status === 'current'
                              ? 'bg-blue-500 ring-4 ring-blue-500/20'
                              : 'bg-zinc-800 border border-white/20'
                          }`}
                        >
                          {node.status === 'done' && <span className="h-1.5 w-1.5 bg-white rounded-full" />}
                        </div>
                        <span
                          className={`mt-2 text-[10px] whitespace-nowrap text-center ${
                            node.status === 'current'
                              ? 'text-blue-300 font-bold'
                              : node.status === 'done'
                              ? 'text-zinc-300'
                              : 'text-zinc-600'
                          }`}
                        >
                          {node.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Goals */}
              <div id="myspace-goals-card" className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={15} className="text-rose-400" />
                    <h3 className="text-[13.5px] font-bold text-white">Goals</h3>
                  </div>
                  <button
                    onClick={() => setMainView('roadmap')}
                    className="text-[11px] text-blue-400 hover:underline font-medium"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {goals.map((g) => (
                    <div key={g.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="font-semibold text-zinc-200 truncate">
                          {g.title}
                        </span>
                        <span className="font-mono text-zinc-400 font-bold">
                          {g.progress}%
                        </span>
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
              </div>
            </div>

          </div>

          {/* RIGHT 4 COLUMNS: AI Assistant, Weekly Progress, Calendar, Quick Capture */}
          <div className="lg:col-span-4 space-y-4">

            {/* 1. Integrated AI Assistant Card */}
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

              {/* Greeting Bubble */}
              <div className="rounded-xl bg-purple-600/10 border border-purple-500/20 p-2.5 text-[12px] text-purple-200">
                {aiAssistantReply || 'Bugun qanday yordam bera olaman?'}
              </div>

              {/* Suggested Prompt Chips */}
              <div className="space-y-1.5">
                {[
                  {
                    icon: '📋',
                    text: "Mening bugungi tasklarimni ko'rsat",
                  },
                  {
                    icon: '📊',
                    text: "O'tgan haftaning qisqa hisobotini ber",
                  },
                  {
                    icon: '🇯🇵',
                    text: "JLPT N2 uchun o'quv reja tavsiya qil",
                  },
                  {
                    icon: '💡',
                    text: "Yangi loyiha g'oyalarini aniqla",
                  },
                ].map((chip) => (
                  <button
                    key={chip.text}
                    onClick={() => handleQuickPrompt(chip.text)}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 text-left text-[11px] text-zinc-300 hover:border-purple-500/30 hover:bg-purple-500/10 transition group"
                  >
                    <span>{chip.icon}</span>
                    <span className="truncate group-hover:text-purple-200">{chip.text}</span>
                  </button>
                ))}
              </div>

              {/* Input Box */}
              <form onSubmit={handleAiSubmit} className="relative pt-1">
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

            {/* 2. Weekly Progress Card */}
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
                {/* Study */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-purple-400" />
                      <span className="text-zinc-300">Study (JLPT N2)</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">4.5 / 7 h</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: '64%' }} />
                  </div>
                </div>

                {/* Work */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Laptop size={12} className="text-blue-400" />
                      <span className="text-zinc-300">Work / Projects</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">18 / 25 h</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>

                {/* Health */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Flame size={12} className="text-emerald-400" />
                      <span className="text-zinc-300">Health & Sport</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">2 / 3 times</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '66%' }} />
                  </div>
                </div>

                {/* Personal */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare size={12} className="text-amber-400" />
                      <span className="text-zinc-300">Personal Tasks</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">5 / 7</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '71%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Calendar Timeline Card */}
            <div id="myspace-calendar-card" className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={15} className="text-zinc-400" />
                  <h3 className="text-[13.5px] font-bold text-white">Calendar</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-zinc-300 font-medium">
                    Today
                  </span>
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

              {/* Timeline slots */}
              <div className="space-y-2 text-[11px] font-mono">
                {/* 09:00 - 11:00 */}
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-11 shrink-0">9:00</span>
                  <div className="flex-1 rounded-xl bg-purple-500/15 border border-purple-500/30 p-2 text-purple-200">
                    <p className="font-semibold text-[11.5px]">Django final exam</p>
                    <p className="text-[10px] text-purple-400 font-mono">09:00 - 11:00</p>
                  </div>
                </div>

                {/* 11:00 - 12:00 */}
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-11 shrink-0">11:00</span>
                  <div className="flex-1 rounded-xl bg-rose-500/15 border border-rose-500/30 p-2 text-rose-200">
                    <p className="font-semibold text-[11.5px]">N2 Grammar</p>
                    <p className="text-[10px] text-rose-400 font-mono">11:00 - 12:00</p>
                  </div>
                </div>

                {/* 13:00 - 15:00 */}
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-11 shrink-0">13:00</span>
                  <div className="flex-1 rounded-xl bg-blue-500/15 border border-blue-500/30 p-2 text-blue-200">
                    <p className="font-semibold text-[11.5px]">Nihongo Talk — Scheduler fix</p>
                    <p className="text-[10px] text-blue-400 font-mono">13:00 - 15:00</p>
                  </div>
                </div>

                {/* 16:00 - 17:30 */}
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-11 shrink-0">16:00</span>
                  <div className="flex-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2 text-emerald-200">
                    <p className="font-semibold text-[11.5px]">Gym</p>
                    <p className="text-[10px] text-emerald-400 font-mono">16:00 - 17:30</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Quick Capture Card */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-4 shadow-sm space-y-3">
              <h3 className="text-[13.5px] font-bold text-white">Quick Capture</h3>

              <div className="grid grid-cols-5 gap-2 text-center">
                {/* Task */}
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

                {/* Note */}
                <button
                  onClick={async () => {
                    await createNote('Yangi Qayd');
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

                {/* Idea */}
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

                {/* Link */}
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

                {/* File */}
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
    </div>
  );
}
