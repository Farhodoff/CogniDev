import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  GitBranch,
  Sparkles,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Plus,
  RefreshCw,
  FolderGit2,
  Lock,
  Globe,
  Star,
  AlertCircle,
  Zap,
  Terminal,
  Key,
  User,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import GithubIcon from './GithubIcon';
import { useSynapse } from '../lib/store';
import {
  detectGhCliAuth,
  getStoredGitHubToken,
  setStoredGitHubToken,
  fetchGitHubUser,
  fetchUserRepos,
  fetchRepoCommits,
  generateAiTasksFromGitHub,
  type GitHubUser,
  type GitHubRepo,
  type GitHubCommitItem,
  type GitHubAiReport,
  type AiTaskSuggestion,
  type GhCliAuthStatus,
} from '../lib/github';
import { PROVIDERS, type CloudProviderId } from '../lib/providers';

interface GitHubSyncModalProps {
  open: boolean;
  onClose: () => void;
  initialRepoUrl?: string;
}

export default function GitHubSyncModal({ open, onClose, initialRepoUrl }: GitHubSyncModalProps) {
  const { addTask, setHud, activeProjects, updateProjectProgress, userProfile } = useSynapse();

  // Auth & Connection State
  const [token, setToken] = useState<string>('');
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [publicUsernameInput, setPublicUsernameInput] = useState<string>('');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [authType, setAuthType] = useState<'cli' | 'token' | 'public' | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Detected CLI status on this specific computer
  const [detectedCli, setDetectedCli] = useState<GhCliAuthStatus | null>(null);

  // Active Connection Tab (when not connected)
  const [connectTab, setConnectTab] = useState<'cli' | 'pat' | 'public'>('cli');

  // Repositories State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  // Commits State
  const [commits, setCommits] = useState<GitHubCommitItem[]>([]);
  const [commitsLoading, setCommitsLoading] = useState<boolean>(false);

  // AI Synthesis State
  const [aiReport, setAiReport] = useState<GitHubAiReport | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [customGoal, setCustomGoal] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('gemini');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  // Handle Select Repo & Load Commits
  const handleSelectRepo = async (repo: GitHubRepo, activeToken?: string) => {
    setSelectedRepo(repo);
    setCommitsLoading(true);
    setAiReport(null);
    setSelectedTaskIds(new Set());

    const t = activeToken !== undefined ? activeToken : token;

    try {
      const [owner, name] = repo.full_name.split('/');
      const cms = await fetchRepoCommits(t || null, owner, name, 15);
      setCommits(cms);
    } catch (err: any) {
      console.warn('Commits fetch error:', err);
      setHud(`Commitlarni yuklashda xatolik: ${err.message}`);
    } finally {
      setCommitsLoading(false);
    }
  };

  // Load Repositories
  const loadRepos = async (activeToken: string | null, publicUser?: string) => {
    setReposLoading(true);
    try {
      const data = await fetchUserRepos(activeToken, publicUser);
      setRepos(data);

      // If initialRepoUrl is provided, select it automatically
      if (initialRepoUrl) {
        const found = data.find(
          (r) =>
            r.html_url.toLowerCase() === initialRepoUrl.toLowerCase() ||
            initialRepoUrl.toLowerCase().includes(r.full_name.toLowerCase())
        );
        if (found) {
          handleSelectRepo(found, activeToken || undefined);
        }
      } else if (data.length > 0 && !selectedRepo) {
        handleSelectRepo(data[0], activeToken || undefined);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Repozitoriylarni yuklashda xatolik');
    } finally {
      setReposLoading(false);
    }
  };

  // Check saved session & local CLI status on open
  useEffect(() => {
    if (!open) return;

    async function initCheck() {
      setAuthError(null);

      // 1. Check if user already explicitly saved a token in LocalStorage
      const savedToken = getStoredGitHubToken();
      if (savedToken) {
        try {
          setAuthLoading(true);
          const u = await fetchGitHubUser(savedToken, true);
          setUser(u);
          setToken(savedToken);
          setAuthType('token');
          await loadRepos(savedToken);
          setAuthLoading(false);
          return;
        } catch (err) {
          console.warn('Saved token expired or invalid:', err);
          setStoredGitHubToken(null);
        } finally {
          setAuthLoading(false);
        }
      }

      // 2. Check if local machine has `gh` CLI without auto-logging in
      try {
        const cliAuth = await detectGhCliAuth();
        if (cliAuth && cliAuth.is_installed) {
          setDetectedCli(cliAuth);
          if (cliAuth.is_authenticated) {
            setConnectTab('cli');
          } else {
            setConnectTab('pat');
          }
        } else {
          setConnectTab('pat');
        }
      } catch (err) {
        console.warn('CLI check error:', err);
        setConnectTab('pat');
      }
    }

    initCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Connect via Detected CLI (User explicitly clicks button)
  const handleConnectWithCli = async () => {
    if (!detectedCli || !detectedCli.token) {
      setAuthError("Tizimingizda `gh` CLI orqali faol login topilmadi. Terminalda 'gh auth login' bajaring.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const u = await fetchGitHubUser(detectedCli.token, true);
      setUser(u);
      setToken(detectedCli.token);
      setAuthType('cli');
      setStoredGitHubToken(detectedCli.token, u.login);
      setHud(`GitHub CLI orqali muvaffaqiyatli ulandi: @${u.login} ✓`);
      await loadRepos(detectedCli.token);
    } catch (err: any) {
      setAuthError(err.message || 'GitHub CLI orqali ulanishda xatolik');
    } finally {
      setAuthLoading(false);
    }
  };

  // Manual Token Connect (PAT)
  const handleConnectManualToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualTokenInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const cleaned = manualTokenInput.trim();
      const u = await fetchGitHubUser(cleaned, true);
      setUser(u);
      setToken(cleaned);
      setAuthType('token');
      setStoredGitHubToken(cleaned, u.login);
      setManualTokenInput('');
      setHud(`GitHub muvaffaqiyatli ulandi: @${u.login} ✓`);
      await loadRepos(cleaned);
    } catch (err: any) {
      setAuthError(err.message || 'Token tekshirishda xatolik yuz berdi');
    } finally {
      setAuthLoading(false);
    }
  };

  // Connect with Public Username (Zero Token)
  const handleConnectPublicUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!publicUsernameInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const uname = publicUsernameInput.trim().replace(/^@/, '');
      const u = await fetchGitHubUser(uname, false);
      setUser(u);
      setToken('');
      setAuthType('public');
      setPublicUsernameInput('');
      setHud(`@${u.login} ochiq profili yuklandi (Read-Only) ✓`);
      await loadRepos(null, uname);
    } catch (err: any) {
      setAuthError(err.message || 'Foydalanuvchini topishda xatolik yuz berdi');
    } finally {
      setAuthLoading(false);
    }
  };

  // Disconnect & Reset
  const handleDisconnect = () => {
    setToken('');
    setUser(null);
    setAuthType(null);
    setRepos([]);
    setSelectedRepo(null);
    setCommits([]);
    setAiReport(null);
    setStoredGitHubToken(null, null);
    setHud("GitHub ulanishi uzildi. Boshqa hisob bilan ulanishingiz mumkin.");
  };

  // Filter Repositories
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const q = searchQuery.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.language && r.language.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, searchQuery]);

  // Run AI Synthesis
  const handleRunAiSynthesis = async () => {
    if (!selectedRepo || commits.length === 0) return;

    setAiLoading(true);
    setHud(`AI "${selectedRepo.name}" bo'yicha commitlarni tahlil qilmoqda...`);
    try {
      const report = await generateAiTasksFromGitHub(
        selectedRepo,
        commits,
        customGoal.trim() || undefined,
        selectedProvider
      );
      setAiReport(report);
      // Select all generated tasks by default
      const allIds = new Set(report.suggested_tasks.map((t) => t.id));
      setSelectedTaskIds(allIds);
      setHud(`AI ${report.suggested_tasks.length} ta yangi vazifani shakllantirdi ✓`);
    } catch (err: any) {
      setHud(`AI tahlilida xatolik: ${err.message || 'Provayder kalitini tekshiring'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Toggle Task Selection
  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Import Selected Tasks into CogniDev
  const handleImportTasks = () => {
    if (!aiReport || !selectedRepo) return;
    const tasksToImport = aiReport.suggested_tasks.filter((t) => selectedTaskIds.has(t.id));
    if (tasksToImport.length === 0) {
      setHud('Kamida bitta vazifani belgilang.');
      return;
    }

    let count = 0;
    const authorName = user?.name || user?.login || userProfile?.full_name || 'Dasturchi';
    const authorAvatar = (user?.login || userProfile?.full_name || 'DEV').slice(0, 2).toUpperCase();

    for (const st of tasksToImport) {
      const newId = `DEV-${Date.now().toString().slice(-4)}${count + 1}`;
      addTask({
        id: newId,
        workspace_id: 'default',
        title: `[${selectedRepo.name}] ${st.title}`,
        status: st.priority === 'P0 Blocker' ? 'blocker' : 'active',
        priority: st.priority,
        git_branch: st.branch,
        pr_url: null,
        ai_source: 'gemini',
        assignee_name: authorName,
        assignee_avatar: authorAvatar,
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ['github', selectedRepo.name.toLowerCase(), ...st.tags],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      count++;
    }

    // If an ActiveProject exists with this repo URL, adjust progress
    const matchedProject = activeProjects.find(
      (p) =>
        p.github_url &&
        (p.github_url.toLowerCase().includes(selectedRepo.full_name.toLowerCase()) ||
          p.title.toLowerCase() === selectedRepo.name.toLowerCase())
    );
    if (matchedProject && matchedProject.progress < 90) {
      updateProjectProgress(matchedProject.id, Math.min(95, matchedProject.progress + 5));
    }

    setHud(`${count} ta vazifa CogniDev Task Stream doskasiga muvaffaqiyatli qo'shildi! 🚀`);
  };

  // Copy Agent Prompt
  const handleCopyAgentPrompt = (task: AiTaskSuggestion) => {
    navigator.clipboard.writeText(task.agent_prompt);
    setCopiedTaskId(task.id);
    setHud(`"${task.title}" uchun Antigravity / Cline ko'rsatmasi buferga nusxalandi ✓`);
    setTimeout(() => {
      setCopiedTaskId(null);
    }, 2500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl h-[88vh] bg-[#0c1017]/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#e6edf3]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#161b22]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <GithubIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white tracking-wide">
                  GitHub Hub & AI Task Synthesizer
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Universal · Open-Source
                </span>
              </div>
              <p className="text-xs text-[#8b949e]">
                O'z repozitoriyalaringiz commitlarini tahlil qiling va keyingi texnik vazifalarni AI orqali shakllantiring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active User Badge if Connected */}
            {user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.login} className="w-5 h-5 rounded-full ring-1 ring-white/20" />
                ) : (
                  <GithubIcon size={16} className="text-emerald-400" />
                )}
                <span className="font-mono font-medium text-white">@{user.login}</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  {authType === 'cli' ? 'GitHub CLI' : authType === 'token' ? 'PAT Token' : 'Ochiq Profil'}
                </span>
                <button
                  onClick={handleDisconnect}
                  title="Chiqish va boshqa hisobni ulash"
                  className="flex items-center gap-1 text-[#8b949e] hover:text-rose-400 ml-1.5 px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="text-[10px]">Chiqish</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[#8b949e] bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Mahalliy & Xavfsiz</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-[#8b949e] hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!user ? (
          /* Universal Connection Hub (When No Account is Connected) */
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10">
                <GithubIcon size={36} />
              </div>
              <h4 className="text-lg font-semibold text-white tracking-wide">
                GitHub Hisobingizni Tanlang
              </h4>
              <p className="text-xs text-[#8b949e] mt-1.5 max-w-md mx-auto leading-relaxed">
                CogniDev ochiq kodli dastur bo‘lib, hech qanday kalit yoki tokeningizni serverga yubormaydi. Barcha ma'lumotlar faqat kompyuteringizda xavfsiz saqlanadi.
              </p>
            </div>

            {authError && (
              <div className="w-full mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Connection Method Tabs */}
            <div className="flex items-center gap-2 p-1 bg-black/40 border border-white/10 rounded-xl mb-6 w-full">
              {detectedCli && (
                <button
                  onClick={() => setConnectTab('cli')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                    connectTab === 'cli'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-[#8b949e] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Kompyuter CLI</span>
                </button>
              )}
              <button
                onClick={() => setConnectTab('pat')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                  connectTab === 'pat'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-[#8b949e] hover:text-white hover:bg-white/5'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Personal Token (PAT)</span>
              </button>
              <button
                onClick={() => setConnectTab('public')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${
                  connectTab === 'public'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-[#8b949e] hover:text-white hover:bg-white/5'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Ochiq Profil (Tokensiz)</span>
              </button>
            </div>

            {/* Tab 1: Local GitHub CLI */}
            {connectTab === 'cli' && detectedCli && (
              <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">
                      Kompyuteringizdagi GitHub CLI topildi
                    </h5>
                    <p className="text-xs text-[#8b949e] mt-0.5">
                      Tizimingizda autentifikatsiya qilingan hisob: <strong className="text-white font-mono">@{detectedCli.username || 'user'}</strong>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Hech narsa nusxalash yoki kiritish shart emas. Ushbu kompyuterdagi mahalliy `gh` sessiyangiz orqali repozitoriyalaringizni darhol ulang.
                </p>

                <button
                  onClick={handleConnectWithCli}
                  disabled={authLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
                >
                  {authLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  <span>@{detectedCli.username} hisobi bilan davom etish</span>
                </button>
              </div>
            )}

            {/* Tab 2: Personal Access Token (PAT) */}
            {connectTab === 'pat' && (
              <form onSubmit={handleConnectManualToken} className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-white flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      <span>GitHub Personal Access Token (PAT):</span>
                    </label>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=CogniDev%20Desktop%20Cockpit"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
                    >
                      <span>Token yaratish</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx yoki github_pat_..."
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-black/50 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-[#8b949e] mt-1.5">
                    Faqat shaxsiy va tashkilot repozitoriyalarini o'qish uchun `repo` ruxsati kifoya.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={authLoading || !manualTokenInput.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
                >
                  {authLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Token orqali Xavfsiz Ulanish</span>
                </button>
              </form>
            )}

            {/* Tab 3: Public Profile (Zero Token) */}
            {connectTab === 'public' && (
              <form onSubmit={handleConnectPublicUsername} className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div>
                  <label className="text-xs font-medium text-white block mb-1.5">
                    GitHub Username (Foydalanuvchi nomi):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-[#8b949e] font-mono">@</span>
                    <input
                      type="text"
                      placeholder="masalan: torvalds yoki octocat"
                      value={publicUsernameInput}
                      onChange={(e) => setPublicUsernameInput(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 text-xs bg-black/50 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1.5">
                    Tokensiz rejim: barcha ochiq (public) repozitoriyalar va commitlarni yuklaydi.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={authLoading || !publicUsernameInput.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
                >
                  {authLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span>Ochiq Repozitoriyalarni Ko'rish</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Main Workspace View: Left Repo List + Right Detail & AI Synthesis */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Repositories List */}
            <div className="w-80 border-r border-white/10 flex flex-col bg-[#0d1117]/60">
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8b949e]" />
                  <input
                    type="text"
                    placeholder="Repozitoriyni qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {reposLoading ? (
                  <div className="p-8 text-center text-xs text-[#8b949e] flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                    <span>Repozitoriyalar yuklanmoqda...</span>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8b949e]">
                    Mos repozitoriya topilmadi
                  </div>
                ) : (
                  filteredRepos.map((r) => {
                    const isSelected = selectedRepo?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelectRepo(r)}
                        className={`w-full text-left p-2.5 rounded-lg border transition flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                            : 'bg-white/[0.02] border-transparent hover:bg-white/5 text-[#c9d1d9]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <div className="flex items-center gap-1.5 truncate font-medium text-xs">
                            {r.is_private ? (
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            ) : (
                              <Globe className="w-3 h-3 text-[#8b949e] shrink-0" />
                            )}
                            <span className="truncate">{r.name}</span>
                          </div>
                          {r.stargazers_count > 0 && (
                            <div className="flex items-center gap-0.5 text-[10px] text-amber-300">
                              <Star className="w-2.5 h-2.5 fill-amber-300" />
                              <span>{r.stargazers_count}</span>
                            </div>
                          )}
                        </div>

                        {r.description && (
                          <p className="text-[11px] text-[#8b949e] line-clamp-1">{r.description}</p>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-[#8b949e] mt-0.5">
                          {r.language && (
                            <span className="px-1.5 py-0.2 rounded bg-white/5 text-[#8b949e]">
                              {r.language}
                            </span>
                          )}
                          <span className="truncate">
                            {new Date(r.pushed_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Repo Details, Commits & AI Task Synthesizer */}
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#090d14]/80 p-6">
              {!selectedRepo ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#8b949e]">
                  <FolderGit2 className="w-12 h-12 mb-3 text-white/20" />
                  <h4 className="text-sm font-medium text-white">Repozitoriyani tanlang</h4>
                  <p className="text-xs max-w-sm mt-1">
                    Chap paneldan biror faol repozitoriyangizni tanlang. CogniDev uning oxirgi commitlarini yuklab, keyingi vazifalarni tuzib beradi.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Active Repo Overview Card */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-white tracking-wide">
                          {selectedRepo.name}
                        </h4>
                        <a
                          href={selectedRepo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#8b949e] hover:text-white transition"
                          title="GitHub'da ochish"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-xs text-[#8b949e] mt-0.5">
                        {selectedRepo.description || "Tavsif berilmagan"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-white/5 text-xs text-[#8b949e] border border-white/10 flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{selectedRepo.default_branch}</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-white/5 text-xs text-[#8b949e] border border-white/10 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{commits.length} ta so'nggi commit</span>
                      </span>
                    </div>
                  </div>

                  {/* Commits Timeline Card */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-[#8b949e] flex items-center gap-1.5">
                        <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>So'nggi Pushlar & Commit Tarixi</span>
                      </h5>
                      <button
                        onClick={() => handleSelectRepo(selectedRepo)}
                        disabled={commitsLoading}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${commitsLoading ? 'animate-spin' : ''}`} />
                        <span>Yangilash</span>
                      </button>
                    </div>

                    {commitsLoading ? (
                      <div className="py-6 text-center text-xs text-[#8b949e] flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Commitlar tahlil qilinmoqda...</span>
                      </div>
                    ) : commits.length === 0 ? (
                      <p className="text-xs text-[#8b949e] py-3 text-center">Commitlar topilmadi.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {commits.slice(0, 7).map((c) => (
                          <div
                            key={c.sha}
                            className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-xs hover:border-white/10 transition"
                          >
                            <div className="flex items-center gap-2 truncate mr-2">
                              <span className="font-mono text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 shrink-0">
                                {c.short_sha}
                              </span>
                              <span className="text-[#e6edf3] truncate font-medium">{c.message}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#8b949e] shrink-0">
                              <span>{c.author_name}</span>
                              <span>•</span>
                              <span>{c.time_ago}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Task Synthesis Trigger Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-blue-950/40 border border-indigo-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-white">
                          AI Vazifa & Standup Dvigateli
                        </h5>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedProvider}
                          onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
                          className="text-xs bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
                        >
                          {PROVIDERS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ixtiyoriy maqsad: Masalan 'Bugun API avtorizatsiyasini to'liq tugatamiz va test yozamiz'..."
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs bg-black/50 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                      />

                      <button
                        onClick={handleRunAiSynthesis}
                        disabled={aiLoading || commits.length === 0}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-lg flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/30 shrink-0"
                      >
                        {aiLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Tahlil qilinmoqda...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Vazifalarni Generatsiya Qilish</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* AI Generated Report & Tasks */}
                  {aiReport && (
                    <div className="space-y-4 animate-fade-in">
                      {/* Standup Digest Summary */}
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Bugungi Pushlar & Standup Xulosasi</span>
                        </h5>
                        <p className="text-xs text-[#c9d1d9] leading-relaxed">
                          {aiReport.standup_digest}
                        </p>

                        {aiReport.accomplishments?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {aiReport.accomplishments.map((acc, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              >
                                ✓ {acc}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Suggested Next-Step Tasks */}
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              <span>Mantiqan Keyingi Texnik Vazifalar</span>
                            </h5>
                            <p className="text-[11px] text-[#8b949e]">
                              Quyidagi vazifalarni to'g'ridan-to'g'ri CogniDev Kanban doskasiga qo'shishingiz yoki kodlovchi agentlar uchun promptini olishingiz mumkin
                            </p>
                          </div>

                          <button
                            onClick={handleImportTasks}
                            disabled={selectedTaskIds.size === 0}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>CogniDev Doskasiga Qo'shish ({selectedTaskIds.size})</span>
                          </button>
                        </div>

                        <div className="space-y-2.5 pt-1">
                          {aiReport.suggested_tasks.map((task) => {
                            const isChecked = selectedTaskIds.has(task.id);
                            const isCopied = copiedTaskId === task.id;

                            return (
                              <div
                                key={task.id}
                                className={`p-3.5 rounded-xl border transition flex flex-col gap-2 ${
                                  isChecked
                                    ? 'bg-indigo-500/10 border-indigo-500/40'
                                    : 'bg-black/40 border-white/5 opacity-80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleTaskSelection(task.id)}
                                      className="mt-0.5 rounded border-white/20 bg-black/60 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-semibold text-white tracking-wide">
                                          {task.title}
                                        </span>
                                        <span
                                          className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                                            task.priority === 'P0 Blocker'
                                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                              : task.priority === 'High Priority'
                                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                          }`}
                                        >
                                          {task.priority}
                                        </span>
                                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                                          <GitBranch className="w-3 h-3" />
                                          <span>{task.branch}</span>
                                        </span>
                                      </div>
                                      <p className="text-xs text-[#8b949e] mt-1.5 leading-relaxed">
                                        {task.description}
                                      </p>
                                    </div>
                                  </label>

                                  <button
                                    onClick={() => handleCopyAgentPrompt(task)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition shrink-0 ${
                                      isCopied
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                                    }`}
                                    title="Google Antigravity, Cline, Zed yoki OpenCode uchun tayyor Prompt"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Nusxalandi!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Agent Prompt</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
