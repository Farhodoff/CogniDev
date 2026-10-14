import { useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  Bell,
  Check,
  CheckSquare,
} from 'lucide-react';
import { useSynapse } from '../lib/store';

export default function InboxWorkspace() {
  const {
    tasks,
    updateTaskStatus,
    deleteTask,
    setTaskModal,
    setHud,
    setMainView,
    activeProjects,
    goals,
  } = useSynapse();

  const [filterTab, setFilterTab] = useState<'all' | 'tasks' | 'notifications' | 'ai'>('all');

  // Inbox tasks: backlog or active tasks
  const inboxTasks = tasks.filter((t) => t.status !== 'completed');

  // Dynamic system notifications based on real data
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: 'Xush kelibsiz!',
      message: 'MySpace kokpiti to‘liq ishga tushirildi. Kunlik rejalaringizni belgilang.',
      time: 'Bugun',
      type: 'system',
      read: false,
    },
    {
      id: 'notif-2',
      title: 'Haftalik Maqsadlar',
      message: goals.length > 0
        ? `Sizda ${goals.length} ta faol maqsad mavjud. Ularni amalga oshirishda davom eting!`
        : 'Yangi maqsad belgilash vaqti keldi.',
      time: 'Bugun',
      type: 'goal',
      read: false,
    },
    {
      id: 'notif-3',
      title: 'AI Tavsiya',
      message: activeProjects.length > 0
        ? `Faol loyihalaringiz (${activeProjects.length} ta) bo‘yicha bugun muhim qismlarni yopish tavsiya etiladi.`
        : 'Kunlik rejalaringizni samarali tashkil qilish uchun vazifalar qo‘shing.',
      time: 'Bugun',
      type: 'ai',
      read: false,
    },
  ]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setHud('Barcha bildirishnomalar o‘qildi');
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length + inboxTasks.length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0b0f] p-6 text-zinc-100 select-none scrollbar-thin">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
              <Inbox size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">Inbox</h1>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-[11px] font-bold text-blue-300">
                    {unreadCount} yangi
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-zinc-400 mt-0.5">
                Kiruvchi vazifalar, bildirishnomalar va tizim xabarlari markazi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition"
            >
              <Check size={13} />
              <span>Barchasini o‘qilgan qilish</span>
            </button>
            <button
              onClick={() => setTaskModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-md transition"
            >
              <Plus size={14} />
              <span>Yangi Vazifa</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] pb-3">
          {[
            { id: 'all', label: `Barchasi (${unreadCount})` },
            { id: 'tasks', label: `Vazifalar (${inboxTasks.length})` },
            { id: 'notifications', label: `Bildirishnomalar (${notifications.length})` },
            { id: 'ai', label: 'AI Tavsiyalar' },
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Left Column (Tasks & Actions) */}
          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
                <CheckSquare size={16} className="text-blue-400" />
                <span>Ko‘rib chiqilishi kerak bo‘lgan vazifalar ({inboxTasks.length})</span>
              </h2>
            </div>

            {inboxTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#121319]/50 p-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 size={20} />
                </div>
                <h3 className="text-[14px] font-semibold text-white">Kiruvchi quti toza!</h3>
                <p className="text-[12px] text-zinc-400 max-w-xs mx-auto">
                  Hozirda yangi ko‘rib chiqilmagan vazifalar yo‘q. Barcha ishlar o‘z vaqtida bajarilmoqda.
                </p>
                <button
                  onClick={() => setTaskModal(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition"
                >
                  <Plus size={13} />
                  <span>Yangi Vazifa Qo‘shish</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {inboxTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#121319]/90 p-3.5 hover:border-white/15 transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => {
                          updateTaskStatus(t.id, 'completed');
                          setHud(`"${t.title}" bajarildi deb belgilandi ✓`);
                        }}
                        className="text-zinc-500 hover:text-emerald-400 transition shrink-0"
                        title="Bajarildi deb belgilash"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-zinc-200 truncate">
                          {t.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {t.tags?.map((tag) => (
                            <span key={tag} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                              #{tag}
                            </span>
                          ))}
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => setMainView('stream')}
                        className="flex items-center gap-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-2 py-1 text-[11px] text-zinc-300"
                        title="Vazifalar oqimiga o'tish"
                      >
                        <span>Oqim</span>
                        <ArrowRight size={11} />
                      </button>
                      <button
                        onClick={() => deleteTask(t.id)}
                        className="rounded-lg p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="O'chirish"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (Notifications & AI Insights) */}
          <div className="md:col-span-5 space-y-4">
            <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
              <Bell size={16} className="text-amber-400" />
              <span>Bildirishnomalar ({notifications.length})</span>
            </h2>

            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-3.5 space-y-1.5 transition ${
                    n.read
                      ? 'border-white/[0.05] bg-[#121319]/50 opacity-70'
                      : 'border-white/[0.08] bg-[#121319]/95 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {n.type === 'ai' ? (
                        <Sparkles size={14} className="text-purple-400" />
                      ) : n.type === 'goal' ? (
                        <Clock size={14} className="text-blue-400" />
                      ) : (
                        <Bell size={14} className="text-amber-400" />
                      )}
                      <span className="text-[12.5px] font-bold text-white">
                        {n.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500">{n.time}</span>
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="text-zinc-500 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[12px] text-zinc-400 leading-relaxed pl-5">
                    {n.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick Tips Box */}
            <div className="rounded-2xl border border-purple-500/20 bg-purple-950/15 p-4 space-y-2">
              <div className="flex items-center gap-2 text-purple-300 font-semibold text-[13px]">
                <Sparkles size={15} />
                <span>Samaradorlik bo‘yicha maslahat</span>
              </div>
              <p className="text-[12px] text-purple-200/80 leading-relaxed">
                Inbox’ga kelgan har qanday yangi vazifani 2 daqiqa ichida saralang: agar tez bajarilsa darhol yakunlang, aks holda taqvimga vaqt bloki qilib qo‘ying.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
