import { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  FolderGit2,
  FolderOpen,
  RefreshCw,
  Sparkles,
  Check,
  Copy,
  X,
  FilePlus,
  FileDiff,
  AlertCircle,
  ExternalLink,
  FolderSearch,
  Edit3,
} from 'lucide-react';
import {
  fetchGitRepoInfo,
  initGitRepo,
  commitGitChanges,
  generateAiCommitMessage,
  generateAiPrDescription,
  type GitRepoInfo,
} from '../lib/git';
import { useSynapse } from '../lib/store';
import { PROVIDERS, enabledProviders, type CloudProviderId } from '../lib/providers';
import { isTauri } from '../lib/platform';

interface GitInspectorModalProps {
  open: boolean;
  onClose: () => void;
  initialPath?: string;
}

export default function GitInspectorModal({ open, onClose, initialPath }: GitInspectorModalProps) {
  const { setHud, activeProjects } = useSynapse();
  const [repoPath, setRepoPath] = useState(() => {
    if (initialPath && !initialPath.startsWith('http')) return initialPath;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cognidev_last_git_repo_path') || '';
    }
    return '';
  });
  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [copiedDiff, setCopiedDiff] = useState(false);
  const [copiedPr, setCopiedPr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'changes' | 'commits' | 'pr'>('changes');
  const [prMarkdown, setPrMarkdown] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');

  const enabledIds = enabledProviders();
  const availableProviders = PROVIDERS.filter((p) => enabledIds.includes(p.id));
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>(
    availableProviders[0]?.id || 'gemini'
  );

  const loadGitInfo = async (path?: string) => {
    const target = path !== undefined ? path : repoPath;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGitRepoInfo(target || undefined);
      setGitInfo(data);
      if (data.repo_root) {
        setRepoPath(data.repo_root);
        setCustomPathInput(data.repo_root);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cognidev_last_git_repo_path', data.repo_root);
        }
      }
    } catch (err: unknown) {
      console.warn('Failed to load git repo info:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setGitInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseDirectory = async () => {
    if (isTauri) {
      try {
        const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
        const selected = await openDialog({
          directory: true,
          multiple: false,
          title: 'Git loyiha katalogini tanlang',
          defaultPath: repoPath || undefined,
        });
        if (selected && typeof selected === 'string') {
          setRepoPath(selected);
          setCustomPathInput(selected);
          setIsEditingPath(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cognidev_last_git_repo_path', selected);
          }
          await loadGitInfo(selected);
        }
      } catch (err) {
        console.warn('Directory picker error:', err);
      }
    } else {
      const entered = window.prompt(
        'Lokal Git katalog yo‘lini kiriting (masalan: /Users/username/Desktop/my-project):',
        repoPath
      );
      if (entered?.trim()) {
        const cleaned = entered.trim();
        setRepoPath(cleaned);
        setCustomPathInput(cleaned);
        setIsEditingPath(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cognidev_last_git_repo_path', cleaned);
        }
        await loadGitInfo(cleaned);
      }
    }
  };

  const handleInitRepo = async () => {
    const target = (repoPath || customPathInput).trim();
    if (!target) {
      setError('Iltimos, avval repozitoriy yaratmoqchi bo‘lgan katalogingizni tanlang yoki yozing.');
      return;
    }
    setInitializing(true);
    setError(null);
    try {
      await initGitRepo(target);
      setHud('✅ Yangi Git repozitoriyasi muvaffaqiyatli yaratildi!');
      await loadGitInfo(target);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Git init xatolik: ${msg}`);
    } finally {
      setInitializing(false);
    }
  };

  const handleApplyCustomPath = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = customPathInput.trim();
    if (!target) return;
    setRepoPath(target);
    setIsEditingPath(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cognidev_last_git_repo_path', target);
    }
    await loadGitInfo(target);
  };

  useEffect(() => {
    if (open) {
      const target = initialPath && !initialPath.startsWith('http') ? initialPath : undefined;
      loadGitInfo(target);
    }
  }, [open, initialPath]);

  if (!open) return null;

  const handleGenerateCommit = async () => {
    if (!gitInfo) return;
    if (gitInfo.files.length === 0) {
      setHud('Commit qilish uchun o‘zgarishlar mavjud emas (working tree clean)');
      return;
    }
    setAiGenerating(true);
    try {
      const msg = await generateAiCommitMessage(gitInfo, selectedProvider);
      setCommitMessage(msg);
      setHud('✨ AI Conventional Commit xabari tayyorlandi');
    } catch {
      setHud('AI orqali commit xabarini yaratishda xatolik yuz berdi');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Iltimos, commit xabarini kiriting.');
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      await commitGitChanges(commitMessage, gitInfo?.repo_root || repoPath);
      setHud('✅ O‘zgarishlar muvaffaqiyatli commit qilindi!');
      setCommitMessage('');
      await loadGitInfo();
    } catch (err: unknown) {
      setError(`Commit amalga oshmadi: ${String(err)}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleGeneratePr = async () => {
    if (!gitInfo) return;
    setAiGenerating(true);
    try {
      const prText = await generateAiPrDescription(gitInfo, selectedProvider);
      setPrMarkdown(prText);
      setActiveTab('pr');
      setHud('✨ AI Pull Request tavsifi tayyorlandi');
    } catch {
      setHud('PR tavsifini generatsiya qilishda xatolik');
    } finally {
      setAiGenerating(false);
    }
  };

  const totalChanges = gitInfo?.files?.length || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex h-[88vh] max-h-[720px] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121316] shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-black/40 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-orange-400 border border-orange-500/30">
              <FolderGit2 size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">Git Repozitoriy & Commits</h2>
                {gitInfo && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-mono text-emerald-300">
                    <GitBranch size={11} />
                    <span>{gitInfo.branch}</span>
                  </span>
                )}
              </div>

              {/* Path display or edit form */}
              {isEditingPath ? (
                <form onSubmit={handleApplyCustomPath} className="mt-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    placeholder="/Users/.../loyiha"
                    className="rounded-lg border border-white/15 bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white focus:border-sky-500 focus:outline-none w-72"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-600 px-2 py-0.5 text-[10.5px] font-medium text-white hover:bg-sky-500 transition"
                  >
                    Yuklash
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPath(false)}
                    className="rounded-lg bg-white/5 px-2 py-0.5 text-[10.5px] text-zinc-400 hover:text-white transition"
                  >
                    Bekor
                  </button>
                </form>
              ) : (
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span
                    className="truncate max-w-[420px] font-mono text-zinc-300 cursor-pointer hover:text-white transition"
                    onClick={() => {
                      setCustomPathInput(gitInfo?.repo_root || repoPath || '');
                      setIsEditingPath(true);
                    }}
                    title={gitInfo?.repo_root || repoPath || 'Katalogni belgilash uchun bosing'}
                  >
                    {gitInfo?.repo_root || repoPath || 'Loyiha katalogi tanlanmagan'}
                  </span>
                  <button
                    onClick={() => {
                      setCustomPathInput(gitInfo?.repo_root || repoPath || '');
                      setIsEditingPath(true);
                    }}
                    title="Yo‘lni qo‘lda kiritish"
                    className="p-0.5 hover:text-sky-400 transition text-zinc-500"
                  >
                    <Edit3 size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBrowseDirectory}
              title="Kompyuterdan boshqa papkani tanlash"
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition shadow-sm"
            >
              <FolderOpen size={13} />
              <span className="hidden sm:inline">Katalog Tanlash</span>
            </button>
            <button
              onClick={() => loadGitInfo()}
              disabled={loading}
              title="Yangilash"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-sky-400' : ''} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Path Bar & Metrics (only if git repo is loaded) */}
        {gitInfo && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-obsidian-900/60 px-5 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span className="text-zinc-500 font-medium">O‘zgarishlar:</span>
                <span
                  className={`rounded-md px-1.5 py-0.2 font-mono font-bold ${
                    totalChanges > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {totalChanges} ta fayl
                </span>
              </div>
              {gitInfo.remote_url && (
                <a
                  href={gitInfo.remote_url.replace(/\.git$/, '')}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden md:flex items-center gap-1 text-zinc-400 hover:text-sky-400 transition"
                  title={gitInfo.remote_url}
                >
                  <ExternalLink size={11} />
                  <span className="truncate max-w-[220px] font-mono text-[11px]">
                    {gitInfo.remote_url.split('/').slice(-1)[0] || 'remote'}
                  </span>
                </a>
              )}
            </div>

            {/* Tab buttons */}
            <div className="flex items-center gap-1 rounded-xl bg-black/40 p-0.5 border border-white/[0.06]">
              <button
                onClick={() => setActiveTab('changes')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === 'changes' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                O‘zgarishlar ({totalChanges})
              </button>
              <button
                onClick={() => setActiveTab('commits')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === 'commits' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                So‘nggi Commitlar ({gitInfo?.recent_commits?.length || 0})
              </button>
              {prMarkdown && (
                <button
                  onClick={() => setActiveTab('pr')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    activeTab === 'pr' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  PR Tavsifi
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error Banner if gitInfo is also loaded but has a warning */}
        {error && gitInfo && (
          <div className="flex items-center gap-2 bg-rose-500/10 border-b border-rose-500/20 px-5 py-2 text-xs text-rose-300">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* STATE A: NOT A GIT REPO OR NO REPO SELECTED */}
          {!gitInfo ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-black/20 overflow-y-auto">
              <div className="relative mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-xl shadow-amber-500/5">
                  <FolderSearch size={32} />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <AlertCircle size={14} />
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-1.5">
                Git Repozitoriyasi Topilmadi
              </h3>

              {error && (
                <div className="mb-4 max-w-lg rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300 font-mono text-center">
                  {error}
                </div>
              )}

              <p className="max-w-md text-xs text-zinc-400 leading-relaxed mb-6">
                Belgilangan katalogda <code className="text-zinc-200">.git</code> arxitekturasi mavjud emas. Kompyuteringizdagi mavjud Git loyihasi papkasini tanlang yoki yangi repozitoriy yarating.
              </p>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                <button
                  onClick={handleBrowseDirectory}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition"
                >
                  <FolderOpen size={16} />
                  <span>Kompyuterdan Katalogni Tanlash...</span>
                </button>

                {(repoPath || customPathInput) && (
                  <button
                    onClick={handleInitRepo}
                    disabled={initializing}
                    className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition disabled:opacity-50"
                  >
                    <Sparkles size={14} className={initializing ? 'animate-spin' : ''} />
                    <span>{initializing ? 'Yaratilmoqda...' : 'Ushbu joyda Git Init Qilish'}</span>
                  </button>
                )}
              </div>

              {/* Direct Path Input */}
              <form
                onSubmit={handleApplyCustomPath}
                className="flex w-full max-w-md items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-1.5 focus-within:border-sky-500 transition mb-4"
              >
                <input
                  type="text"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                  placeholder="Yoki yo‘lni kiriting: /Users/.../loyiham"
                  className="flex-1 bg-transparent px-3 py-1 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!customPathInput.trim() || loading}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
                >
                  Yuklash
                </button>
              </form>

              {/* Quick links to active projects */}
              {activeProjects && activeProjects.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] text-zinc-500 mb-2 font-medium">
                    Yoki faol loyihalaringizdan birini tanlang:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg">
                    {activeProjects.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          // Try matching local project name or prompt
                          setCustomPathInput(p.title);
                          setIsEditingPath(true);
                        }}
                        className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/15 hover:bg-white/[0.08] transition"
                      >
                        📁 {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* STATE B: GIT REPO LOADED */}
              {/* Tab 1: Changes & AI Commit Workspace */}
              {activeTab === 'changes' && (
                <div className="grid flex-1 grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.08] overflow-hidden">
                  {/* Left Column: File Changes List */}
                  <div className="flex flex-col h-full overflow-hidden bg-black/20">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 bg-black/10">
                      <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                        O‘zgargan Fayllar ({totalChanges})
                      </span>
                      {gitInfo.diff_summary && (
                        <span
                          className="text-[10.5px] font-mono text-zinc-500 truncate max-w-[200px]"
                          title={gitInfo.diff_summary}
                        >
                          {gitInfo.diff_summary}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                      {gitInfo.files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                          <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                            <Check size={20} />
                          </div>
                          <p className="text-xs font-medium text-zinc-300">
                            Ishchi daraxt toza (Working tree clean)
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Barcha fayllar commit qilingan yoki o‘zgarish yo‘q.
                          </p>
                        </div>
                      ) : (
                        gitInfo.files.map((file, idx) => {
                          const isUntracked = file.status === '??';
                          const isModified = file.status.includes('M');
                          const isDeleted = file.status.includes('D');
                          const isAdded = file.status.includes('A');

                          const statusColor = isUntracked
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : isModified
                            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            : isDeleted
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : isAdded
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700';

                          return (
                            <div
                              key={idx}
                              className="group flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs hover:border-white/10 hover:bg-white/[0.04] transition"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-bold ${statusColor}`}
                              >
                                {file.status}
                              </span>
                              <span
                                className="font-mono text-zinc-200 truncate flex-1 text-[11.5px]"
                                title={file.path}
                              >
                                {file.path}
                              </span>
                              {isUntracked && (
                                <FilePlus size={13} className="text-emerald-400/60 shrink-0" />
                              )}
                              {isModified && (
                                <FileDiff size={13} className="text-sky-400/60 shrink-0" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: AI Commit Generation & Action Panel */}
                  <div className="flex flex-col h-full overflow-y-auto p-4 bg-obsidian-950/40 space-y-4">
                    <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          <Sparkles size={14} className="text-purple-400" />
                          <span>AI Conventional Commit Generator</span>
                        </div>
                        {availableProviders.length > 1 && (
                          <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value as CloudProviderId)}
                            className="rounded-lg border border-white/10 bg-black/50 px-2 py-0.5 text-[11px] text-zinc-300 focus:outline-none"
                          >
                            {availableProviders.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                        O‘zgargan fayllar va diff tahlili asosida xalqaro{' '}
                        <code className="text-sky-300">feat(...)</code>,{' '}
                        <code className="text-amber-300">fix(...)</code> standarti bo‘yicha aniq commit xabari yaratadi.
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={handleGenerateCommit}
                          disabled={aiGenerating || totalChanges === 0}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                        >
                          <Sparkles size={13} className={aiGenerating ? 'animate-spin' : ''} />
                          <span>{aiGenerating ? 'Tahlil qilinmoqda…' : 'Commit Xabari Yaratish'}</span>
                        </button>

                        <button
                          onClick={handleGeneratePr}
                          disabled={aiGenerating || totalChanges === 0}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
                        >
                          <span>PR Tavsifi</span>
                        </button>
                      </div>
                    </div>

                    {/* Commit Message Box */}
                    <div className="flex-1 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                          Commit Xabari (Tahrirlash mumkin)
                        </label>
                        {commitMessage && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(commitMessage);
                              setCopiedDiff(true);
                              setTimeout(() => setCopiedDiff(false), 1500);
                            }}
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-sky-400 transition"
                          >
                            {copiedDiff ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedDiff ? 'Nusxalandi' : 'Nusxalash'}</span>
                          </button>
                        )}
                      </div>

                      <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Masalan: feat(projects): add live git branch inspector and commit generator"
                        rows={5}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none transition"
                      />

                      <div className="pt-2">
                        <button
                          onClick={handleCommit}
                          disabled={committing || !commitMessage.trim()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg active:scale-[0.99] transition disabled:opacity-50"
                        >
                          <GitCommit size={15} className={committing ? 'animate-spin' : ''} />
                          <span>
                            {committing
                              ? 'Commit qilinmoqda (git add & commit)…'
                              : 'O‘zgarishlarni Commit Qilish'}
                          </span>
                        </button>
                        <p className="text-[10.5px] text-zinc-500 text-center mt-1.5">
                          Bu buyruq{' '}
                          <code className="text-zinc-400 font-mono">
                            git add -A && git commit -m &quot;...&quot;
                          </code>{' '}
                          ni xavfsiz bajaradi.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Recent Commits */}
              {activeTab === 'commits' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-black/20">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      So‘nggi 8 ta Commit Tarixi
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      Shox: <span className="text-sky-400">{gitInfo.branch}</span>
                    </span>
                  </div>

                  {gitInfo.recent_commits?.map((c, i) => (
                    <div
                      key={c.hash || i}
                      className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-obsidian-900/50 p-3 hover:border-white/10 hover:bg-obsidian-900 transition"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 mt-0.5">
                        <GitCommit size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                            {c.hash}
                          </span>
                          <span className="text-[11px] font-medium text-zinc-400 truncate">
                            {c.author}
                          </span>
                          <span className="ml-auto text-[10.5px] text-zinc-500 whitespace-nowrap">
                            {c.time_ago}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-200 font-mono mt-1 leading-snug break-words">
                          {c.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: PR Description */}
              {activeTab === 'pr' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-black/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                      <Sparkles size={14} />
                      <span>GitHub Pull Request Tavsifi (Markdown)</span>
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(prMarkdown);
                        setCopiedPr(true);
                        setTimeout(() => setCopiedPr(false), 1500);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    >
                      {copiedPr ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedPr ? 'Nusxalandi!' : 'Nusxalash'}</span>
                    </button>
                  </div>

                  <textarea
                    value={prMarkdown}
                    onChange={(e) => setPrMarkdown(e.target.value)}
                    rows={14}
                    className="w-full rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none transition"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
