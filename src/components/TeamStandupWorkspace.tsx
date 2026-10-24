import { useState, useMemo } from 'react';
import {
  Users,
  Sparkles,
  RefreshCw,
  Plus,
  Share2,
  Download,
  AlertCircle,
  GitPullRequest,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  Copy,
  Check,
  Zap,
  ArrowRight,
  UserCheck,
  Network,
  X,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import {
  loadStoredTeamMembers,
  saveStoredTeamMembers,
  generateMyStandupPayload,
  exportTeamStandupJson,
  importTeamStandupJson,
  synthesizeTeamStandupsWithAi,
  DEFAULT_SAMPLE_MEMBERS,
  type TeamMemberStandup,
  type TeamAiSynthesis,
  type TeamMemberStatus,
} from '../lib/teamStandup';

export default function TeamStandupWorkspace() {
  const { userProfile, tasks, setHud } = useSynapse();

  const [members, setMembers] = useState<TeamMemberStandup[]>(() => loadStoredTeamMembers());
  const [synthesis, setSynthesis] = useState<TeamAiSynthesis | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | TeamMemberStatus>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncJsonText, setSyncJsonText] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);

  // New Member form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newStatus, setNewStatus] = useState<TeamMemberStatus>('active');
  const [newMood, setNewMood] = useState('🔥');
  const [newFocus1, setNewFocus1] = useState('');
  const [newFocus2, setNewFocus2] = useState('');
  const [newFocus3, setNewFocus3] = useState('');
  const [newBlocker, setNewBlocker] = useState('');

  // Total metrics
  const activeBlockersTotal = useMemo(
    () => members.reduce((acc, m) => acc + m.blockers.length, 0),
    [members]
  );
  const totalPrReviews = useMemo(
    () => members.reduce((acc, m) => acc + m.prReviews.length, 0),
    [members]
  );

  const filteredMembers = useMemo(() => {
    if (statusFilter === 'all') return members;
    return members.filter((m) => m.currentStatus === statusFilter);
  }, [members, statusFilter]);

  const updateAndPersist = (updated: TeamMemberStandup[]) => {
    setMembers(updated);
    saveStoredTeamMembers(updated);
  };

  // Sync my own standup from tasks and profile
  const handlePublishMyStandup = () => {
    const myPayload = generateMyStandupPayload(userProfile, tasks);
    const existingIndex = members.findIndex((m) => m.id === myPayload.id || m.name.includes('(Siz)'));

    let updated: TeamMemberStandup[];
    if (existingIndex >= 0) {
      updated = [...members];
      updated[existingIndex] = myPayload;
    } else {
      updated = [myPayload, ...members];
    }

    updateAndPersist(updated);
    setHud?.('⚡️ Sizning bugungi standupingiz jamoa doskasiga sinxronlandi!');
  };

  // Run AI Team Synthesizer
  const handleRunAiSynthesis = async () => {
    setSynthesizing(true);
    try {
      const result = await synthesizeTeamStandupsWithAi(members);
      setSynthesis(result);
      setHud?.(`🤖 AI Jamoaviy Sintez tayyor: ${result.activeBlockersCount} ta blocker aniqlandi`);
    } catch (err) {
      console.error(err);
      setHud?.('Sintez yaratishda xatolik yuz berdi');
    } finally {
      setSynthesizing(false);
    }
  };

  // Reset to default sample squad
  const handleResetToSample = () => {
    updateAndPersist(DEFAULT_SAMPLE_MEMBERS);
    setSynthesis(null);
    setHud?.('🔄 Jamoa standupi namunaviy startap holatiga qaytarildi');
  };

  // Delete a member
  const handleDeleteMember = (id: string) => {
    const updated = members.filter((m) => m.id !== id);
    updateAndPersist(updated);
    setHud?.("A'zo o'chirildi");
  };

  // Handle Add Member
  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const todayFocus = [newFocus1, newFocus2, newFocus3].filter((f) => f.trim().length > 0);
    const blockers = newBlocker.trim() ? [newBlocker.trim()] : [];

    const newMember: TeamMemberStandup = {
      id: `member-${Date.now()}`,
      name: newName.trim(),
      avatarInitials: newName.trim().slice(0, 1).toUpperCase(),
      role: newRole.trim() || 'Software Engineer',
      currentStatus: newStatus,
      moodEmoji: newMood || '💻',
      todayFocus: todayFocus.length ? todayFocus : ['Joriy sprint vazifalari'],
      blockers,
      prReviews: [],
      lastSyncedAt: new Date().toISOString(),
    };

    updateAndPersist([...members, newMember]);
    setShowAddModal(false);
    setNewName('');
    setNewRole('');
    setNewFocus1('');
    setNewFocus2('');
    setNewFocus3('');
    setNewBlocker('');
    setHud?.(`👥 Yangi a'zo ${newName} qo'shildi`);
  };

  // Export & Copy JSON
  const handleCopyJson = () => {
    const jsonStr = exportTeamStandupJson(members);
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
    setHud?.('📋 Jamoa standup JSON nusxalandi');
  };

  // Import JSON
  const handleImportJson = () => {
    if (!syncJsonText.trim()) return;
    const res = importTeamStandupJson(syncJsonText, members);
    if (res.success) {
      setMembers(res.members);
      setShowSyncModal(false);
      setSyncJsonText('');
      setHud?.(res.message);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0d0e12] text-zinc-100 p-4 sm:p-8 space-y-6 custom-scrollbar">
      {/* Top Cockpit Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl border border-white/10 bg-gradient-to-r from-blue-900/20 via-purple-900/10 to-transparent backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">Team P2P Standup Cockpit</h1>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Decentralized Sync
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Kichik startap jamoalari uchun markazsiz, shifrlangan kundalik fokus, blockerlar va AI sinxronlashuvi
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePublishMyStandup}
            className="flex items-center gap-1.5 rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/15 hover:text-white transition shadow-sm"
            title="O‘zingizning joriy vazifalar va statuslaringizni doskaga yuklash"
          >
            <UserCheck size={14} className="text-blue-400" />
            <span>Mening Standupimni Yangilash</span>
          </button>

          <button
            onClick={handleRunAiSynthesis}
            disabled={synthesizing}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95 transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            {synthesizing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} className="text-purple-200" />
            )}
            <span>{synthesizing ? 'Tahlil qilinmoqda...' : 'AI Jamoaviy Sintez'}</span>
          </button>

          <button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
            title="JSON orqali import/eksport"
          >
            <Network size={14} className="text-amber-400" />
            <span>Sync / JSON</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <Plus size={14} className="text-emerald-400" />
            <span>A'zo qo'shish</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">{members.length}</div>
            <div className="text-[11.5px] text-zinc-400">Jamoa a'zolari</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Users size={18} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-rose-400">{activeBlockersTotal}</div>
            <div className="text-[11.5px] text-zinc-400">Faol Blockerlar</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <AlertCircle size={18} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-purple-400">{totalPrReviews}</div>
            <div className="text-[11.5px] text-zinc-400">Kutilayotgan PR Review</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <GitPullRequest size={18} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-emerald-400">
              {members.filter((m) => m.currentStatus === 'in_flow').length}
            </div>
            <div className="text-[11.5px] text-zinc-400">Deep Work Flow holatida</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Zap size={18} />
          </div>
        </div>
      </div>

      {/* AI Synthesis Card (if generated) */}
      {synthesis && (
        <div className="p-5 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/30 via-indigo-950/20 to-black/40 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              <h2 className="text-sm font-bold text-purple-200">AI Agile Team Synthesis</h2>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                {synthesis.aiSource || 'AI Engine'}
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {new Date(synthesis.synthesizedAt).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-zinc-200">{synthesis.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Cross Dependencies */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Network size={13} />
                <span>O‘zaro Bog‘liqliklar & Bottlenecks</span>
              </h3>
              <ul className="space-y-1 text-xs text-zinc-400">
                {synthesis.crossDependencies.length ? (
                  synthesis.crossDependencies.map((dep, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">▪</span>
                      <span>{dep}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-zinc-500 italic">Hech qanday to‘siq yoki bog‘lanish aniqlanmadi.</li>
                )}
              </ul>
            </div>

            {/* Suggested Pair Programming */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <Zap size={13} />
                <span>Tavsiya Etilgan Juftliklar (Pair Synergy)</span>
              </h3>
              <ul className="space-y-1 text-xs text-zinc-400">
                {synthesis.suggestedPairings.map((pair, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">▪</span>
                    <span>{pair}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Reset */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.2 rounded-xl font-medium transition ${
              statusFilter === 'all'
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Barchasi ({members.length})
          </button>
          <button
            onClick={() => setStatusFilter('in_flow')}
            className={`px-3 py-1.2 rounded-xl font-medium transition ${
              statusFilter === 'in_flow'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            In Flow 🟣
          </button>
          <button
            onClick={() => setStatusFilter('blocked')}
            className={`px-3 py-1.2 rounded-xl font-medium transition ${
              statusFilter === 'blocked'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Blocked 🔴 ({activeBlockersTotal})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.2 rounded-xl font-medium transition ${
              statusFilter === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Active 🟢
          </button>
        </div>

        <button
          onClick={handleResetToSample}
          className="text-zinc-500 hover:text-zinc-300 transition text-[11px]"
        >
          Namunaviy jamoani yuklash
        </button>
      </div>

      {/* Team Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => {
          const isBlocked = member.currentStatus === 'blocked' || member.blockers.length > 0;
          return (
            <div
              key={member.id}
              className={`flex flex-col justify-between p-5 rounded-3xl border transition shadow-xl ${
                isBlocked
                  ? 'border-rose-500/30 bg-[#161214]/90 shadow-rose-950/20'
                  : member.currentStatus === 'in_flow'
                  ? 'border-purple-500/30 bg-[#13111b]/90 shadow-purple-950/20'
                  : 'border-white/10 bg-[#121318]/90'
              }`}
            >
              <div className="space-y-4">
                {/* Member Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-white/15 text-sm font-bold text-white shadow">
                        {member.avatarInitials}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#121318] ${
                          member.currentStatus === 'in_flow'
                            ? 'bg-purple-400 animate-pulse'
                            : member.currentStatus === 'blocked'
                            ? 'bg-rose-500 animate-ping'
                            : member.currentStatus === 'active'
                            ? 'bg-emerald-400'
                            : 'bg-zinc-600'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-100">{member.name}</h3>
                        <span>{member.moodEmoji}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">{member.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const summaryText = `*${member.name}* Standup:\n${member.todayFocus
                          .map((f) => `- ${f}`)
                          .join('\n')}${member.blockers.length ? `\nBlocker: ${member.blockers.join(', ')}` : ''}`;
                        navigator.clipboard.writeText(summaryText);
                        setHud?.(`${member.name} standupi buferga nusxalandi`);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                      title="Nusxa olish"
                    >
                      <Copy size={13} />
                    </button>
                    {!member.name.includes('(Siz)') && (
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 text-zinc-500 hover:bg-rose-500/20 hover:text-rose-400 transition"
                        title="O'chirish"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Today's 3 Focus Tasks */}
                <div className="space-y-1.5">
                  <span className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                    Bugungi Fokus (3 ta asosiy)
                  </span>
                  <div className="space-y-1">
                    {member.todayFocus.map((focus, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-200"
                      >
                        <CheckCircle2 size={13} className="text-blue-400 mt-0.5 shrink-0" />
                        <span className="leading-snug">{focus}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blocker alert if any */}
                {member.blockers.length > 0 && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                      <AlertCircle size={13} />
                      <span>🚨 Blocker</span>
                    </div>
                    {member.blockers.map((b, idx) => (
                      <p key={idx} className="text-[11.5px] text-rose-200 leading-relaxed">
                        {b}
                      </p>
                    ))}
                  </div>
                )}

                {/* PR Review queue */}
                {member.prReviews.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10.5px] font-semibold text-purple-300 uppercase tracking-wider font-mono">
                      Review Kutilmoqda
                    </span>
                    {member.prReviews.map((pr) => (
                      <a
                        key={pr.id}
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 hover:bg-purple-500/20 transition group"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <GitPullRequest size={13} className="text-purple-400 shrink-0" />
                          <span className="truncate">{pr.title}</span>
                        </div>
                        <ArrowRight size={12} className="opacity-60 group-hover:translate-x-0.5 transition" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Timestamp & Quick Nudge */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  <span>
                    {new Date(member.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>

                <button
                  onClick={() => setHud?.(`👋 ${member.name} ga tezkor salom / Nudge yuborildi!`)}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                >
                  <Send size={11} />
                  <span>Nudge</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#16171d] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Yangi Jamoa A'zosi Qo'shish</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400">Ism va familiya</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Masalan: Sardor Aliyev"
                  required
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-zinc-400">Lavozim / Rol</label>
                  <input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Masalan: Backend Go"
                    className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400">Holat</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TeamMemberStatus)}
                    className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  >
                    <option value="active">Active 🟢</option>
                    <option value="in_flow">In Flow 🟣</option>
                    <option value="blocked">Blocked 🔴</option>
                    <option value="offline">Offline ⚪️</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400">Mood</label>
                  <select
                    value={newMood}
                    onChange={(e) => setNewMood(e.target.value)}
                    className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  >
                    <option value="🔥">🔥 Hot</option>
                    <option value="🚀">🚀 Fast</option>
                    <option value="⚡️">⚡️ Energized</option>
                    <option value="☕️">☕️ Chill</option>
                    <option value="🧠">🧠 Focus</option>
                    <option value="🚧">🚧 Blocked</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-zinc-400">Bugungi 3 ta Fokus Vazifalar</label>
                <input
                  value={newFocus1}
                  onChange={(e) => setNewFocus1(e.target.value)}
                  placeholder="1. Asosiy maqsad..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none"
                />
                <input
                  value={newFocus2}
                  onChange={(e) => setNewFocus2(e.target.value)}
                  placeholder="2. Ikkinchi maqsad..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none"
                />
                <input
                  value={newFocus3}
                  onChange={(e) => setNewFocus3(e.target.value)}
                  placeholder="3. Uchinchi maqsad..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400">Blocker (agar bo‘lsa)</label>
                <input
                  value={newBlocker}
                  onChange={(e) => setNewBlocker(e.target.value)}
                  placeholder="Kutilayotgan API, ruxsat yoki server nosozligi..."
                  className="w-full mt-1 bg-black/40 border border-rose-500/20 rounded-xl px-3 py-2 text-rose-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition shadow"
                >
                  A'zoni saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync / JSON Modal */}
      {showSyncModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#16171d] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-blue-400" />
                <h2 className="text-base font-bold text-white">Decentralized P2P & JSON Sync</h2>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Jamoa standupingizni boshqa dasturchilarga yuborish uchun JSON nusxalang yoki jamoadoshingiz yuborgan JSON matnini joylang:
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 rounded-xl bg-blue-500/20 border border-blue-500/30 px-3.5 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition"
              >
                {copiedJson ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedJson ? 'Nusxalandi!' : 'Joriy Standup JSONni Nusxalash'}</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs text-zinc-400">Jamoadan olingan JSONni joylashtiring:</label>
              <textarea
                value={syncJsonText}
                onChange={(e) => setSyncJsonText(e.target.value)}
                placeholder='{"version": "1.0", "members": [...]}'
                rows={5}
                className="w-full font-mono text-xs bg-black/40 border border-white/10 rounded-2xl p-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Yopish
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                disabled={!syncJsonText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-40"
              >
                <Download size={13} />
                <span>Import Qilish & Sinxronlash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
