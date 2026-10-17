import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  ChevronDown,
  Download,
  Mic,
  Search,
  Settings,
  ClipboardList,
  Upload,
  Bot,
  Plus,
  BookOpen,
  ArrowDownCircle,
  X,
  Sparkles,
  FileText,
  Lightbulb,
  Briefcase,
  Bell,
  Clock,
  Volume2,
  VolumeX,
  Trash2,
  Layout,
  GitBranch,
  FolderGit2,
} from 'lucide-react';
import GithubIcon from './GithubIcon';
import { useSynapse } from '../lib/store';
import { dumpDatabase, restoreDatabase, type VaultDump } from '../lib/db';
import { exportVaultFile, isTauri, parseVault, pickVaultFileContents } from '../lib/vault';
import { isMac, formatShortcut } from '../lib/platform';
import { rubaiStatus } from '../lib/stt';
import { enabledProviders } from '../lib/providers';
import { checkAppUpdate } from '../lib/updater';
import { fetchGitRepoInfo } from '../lib/git';
import FocusTimerPill from './FocusTimerPill';
import { useFocusStore } from '../lib/focusStore';

// Lazy-loaded dialogs & modals on-demand:
const TaskModal = lazy(() => import('./TaskModal'));
const LogChatModal = lazy(() => import('./LogChatModal'));
const VoiceRecorderModal = lazy(() => import('./VoiceRecorderModal'));
const AiProvidersModal = lazy(() => import('./AiProvidersModal'));
const ProfileModal = lazy(() => import('./ProfileModal'));
const GuideModal = lazy(() => import('./GuideModal'));
const UpdateModal = lazy(() => import('./UpdateModal'));
const GitInspectorModal = lazy(() => import('./GitInspectorModal'));
const GitHubSyncModal = lazy(() => import('./GitHubSyncModal'));

export default function Header({ onPalette }: { onPalette: () => void }) {
  const {
    workspaces,
    search,
    tasks,
    notes,
    checklists,
    prompts,
    refresh,
    restoreAll,
    dbMode,
    setHud,
    showTaskModal,
    setTaskModal,
    showChatModal,
    setChatModal,
    showProfileModal,
    setProfileModal,
    showGuideModal,
    setGuideModal,
    showProvidersModal,
    setProvidersModal,
    showGitHubModal,
    setGitHubModal,
    gitHubTargetRepoUrl,
    toggleAiDrawer,
    userProfile,
    createNote,
    setMainView,
    reminders,
    soundEnabled,
    toggleSoundEnabled,
    deleteReminder,
    testNotification,
  } = useSynapse();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const enabledCount = enabledProviders().length;
  const pendingCount = reminders.filter((r) => r.status === 'pending').length;
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateAutoStart, setUpdateAutoStart] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; version?: string; body?: string; handle?: any } | null>(null);

  // Live Git State
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [gitChangesCount, setGitChangesCount] = useState<number>(0);

  const refreshGit = () => {
    fetchGitRepoInfo()
      .then((info) => {
        if (info?.is_repo) {
          setGitBranch(info.branch);
          setGitChangesCount(info.files.length);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshGit();
  }, []);

  useEffect(() => {
    const runCheck = () => {
      checkAppUpdate()
        .then((res) => {
          if (res.available) {
            setUpdateInfo({ available: true, version: res.version, body: res.body, handle: res.updateHandle });
          }
        })
        .catch(() => {});
    };

    runCheck();
    const interval = setInterval(runCheck, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  function memoryDump(): VaultDump {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      workspaces,
      tasks,
      resolutions: tasks.map((t) => ({
        task_id: t.id,
        markdown_note: notes[t.id] ?? null,
        checklist_json: JSON.stringify(checklists[t.id] ?? []),
      })),
      prompts,
      retrospectives: [],
    };
  }

  async function doExport() {
    setSettingsOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const dump = dbMode === 'sqlite' ? await dumpDatabase() : memoryDump();
      const ok = await exportVaultFile(JSON.stringify(dump, null, 2));
      setHud(ok ? `Ombor eksport qilindi — ${dump.tasks.length} vazifa` : 'Eksport bekor qilindi');
    } catch {
      setHud('Eksport qilishda xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  }

  async function applyImportText(text: string) {
    const dump = parseVault(text);
    if (dbMode === 'sqlite') {
      await restoreDatabase(dump);
      await refresh();
    } else {
      restoreAll(dump);
    }
    setHud(`Ombor yuklandi — ${dump.tasks.length} ta vazifa tiklandi`);
  }

  async function doImport() {
    setSettingsOpen(false);
    if (busy) return;
    try {
      if (isTauri) {
        setBusy(true);
        const text = await pickVaultFileContents();
        if (text) await applyImportText(text);
      } else {
        fileRef.current?.click();
      }
    } catch (e) {
      setHud(e instanceof Error ? `Import xatosi: ${e.message}` : 'Import xatosi');
    } finally {
      setBusy(false);
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      await applyImportText(await f.text());
    } catch (err) {
      setHud(err instanceof Error ? `Import xatosi: ${err.message}` : 'Import xatosi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header
        data-tauri-drag-region
        className="sticky top-0 z-40 flex h-13 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0d12]/95 px-4 backdrop-blur-xl"
        style={isTauri && isMac ? { paddingLeft: 84 } : undefined}
      >
        {/* Left Side: Traffic lights (macOS only), Layout icon & MySpace title */}
        <div className="flex items-center gap-3 shrink-0">
          {!isTauri && isMac && (
            <div className="flex shrink-0 items-center gap-1.5 pr-2" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-[#ff5f57] border border-[#e0443e]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e] border border-[#d8a127]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840] border border-[#24aa36]" />
            </div>
          )}

          {/* Window layout icon */}
          <button
            title="Toggle View Mode"
            onClick={() => setMainView('dashboard')}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white transition"
          >
            <Layout size={15} />
          </button>

          {/* App title: MySpace */}
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-bold tracking-tight text-white">
              MySpace
            </span>
            <span className="hidden sm:inline-block rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] font-medium text-zinc-400 border border-white/[0.06]">
              build a better life
            </span>
          </div>
        </div>

        {/* Center: Search bar (⌘ K) */}
        <div className="flex-1 max-w-[420px] mx-4">
          <button
            onClick={() => {
              if (onPalette) onPalette();
            }}
            className="flex w-full items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-left text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] transition shadow-inner group"
            title={`Search anything... (${formatShortcut('K')})`}
          >
            <Search size={13} className="text-zinc-500 group-hover:text-zinc-300 transition shrink-0" />
            <span className="w-full truncate text-[12px] text-zinc-400 font-normal">
              {search || `Search anything... (${formatShortcut('K', true)})`}
            </span>
          </button>
        </div>

        {/* Right Side: + Quick Add, ✨ AI Assistant, Profile Avatar, Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {/* + Quick Add Button */}
          <div className="relative">
            <button
              onClick={() => setQuickAddOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/10 px-3 py-1.2 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.12] hover:text-white transition"
            >
              <Plus size={13} />
              <span>Quick Add</span>
              <ChevronDown size={11} className={`opacity-60 transition-transform ${quickAddOpen ? 'rotate-180' : ''}`} />
            </button>

            {quickAddOpen && (
              <div className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    setTaskModal(true);
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <ClipboardList size={14} className="text-blue-400" />
                  <span>New Task</span>
                  <kbd className="ml-auto text-[10px] text-zinc-500 font-mono">{formatShortcut('N')}</kbd>
                </button>
                <button
                  onClick={async () => {
                    setQuickAddOpen(false);
                    await createNote('Yangi Qayd');
                    setMainView('notes');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <FileText size={14} className="text-emerald-400" />
                  <span>New Note</span>
                </button>
                <button
                  onClick={() => {
                    setMainView('projects');
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <Briefcase size={14} className="text-purple-400" />
                  <span>New Project</span>
                </button>
                <button
                  onClick={() => {
                    setMainView('ideas');
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <Lightbulb size={14} className="text-amber-400" />
                  <span>New Idea</span>
                </button>
                <button
                  onClick={() => {
                    setChatModal(true);
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <Bot size={14} className="text-purple-400" />
                  <span>AI Import</span>
                </button>
                <button
                  onClick={() => {
                    setVoiceOpen(true);
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <Mic size={14} className="text-rose-400" />
                  <span>Voice Note</span>
                </button>
                <button
                  onClick={() => {
                    setGitModalOpen(true);
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <FolderGit2 size={14} className="text-orange-400" />
                  <span>Git Repozitoriy</span>
                </button>
                <button
                  onClick={() => {
                    setGitHubModal(true);
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <GithubIcon size={14} className="text-indigo-400" />
                  <span>GitHub AI Tasks</span>
                  <kbd className="ml-auto text-[10px] text-zinc-500 font-mono">{formatShortcut('G')}</kbd>
                </button>
                <button
                  onClick={() => {
                    useFocusStore.getState().setShowModal(true);
                    setQuickAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <span className="text-sm">🍅</span>
                  <span>Focus Sprint</span>
                  <kbd className="ml-auto text-[10px] text-zinc-500 font-mono">{formatShortcut('P')}</kbd>
                </button>
              </div>
            )}
          </div>

          {/* 🍅 Pomodoro & Deep Work Focus Pill */}
          <FocusTimerPill />

          {/* 🌿 Git Branch & Status Pill */}
          <button
            onClick={() => setGitModalOpen(true)}
            title="Git Repozitoriy va Commitlar"
            className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-1 text-[11.5px] font-mono text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            <GitBranch size={12} className="text-orange-400" />
            <span className="truncate max-w-[100px]">{gitBranch || 'git'}</span>
            {gitChangesCount > 0 && (
              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-300">
                {gitChangesCount}
              </span>
            )}
          </button>

          {/* 🐙 GitHub Hub & AI Task Synthesizer Pill */}
          <button
            onClick={() => setGitHubModal(true)}
            title={`GitHub Repositories & AI Task Engine (${formatShortcut('G')})`}
            className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 text-[11.5px] font-mono text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition shadow-sm shadow-indigo-500/10"
          >
            <GithubIcon size={12} className="text-indigo-400" />
            <span className="hidden sm:inline">GitHub AI</span>
          </button>

          {/* ✨ AI Assistant Button */}
          <button
            onClick={toggleAiDrawer}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600/80 to-indigo-600/80 border border-purple-500/30 px-3 py-1.2 text-[12px] font-medium text-white shadow-sm hover:brightness-110 active:scale-95 transition"
          >
            <Sparkles size={13} className="text-purple-200" />
            <span>AI Assistant</span>
          </button>

          {/* Auto-updater button if update is available */}
          {updateInfo?.available && (
            <button
              onClick={() => {
                setUpdateAutoStart(true);
                setUpdateModalOpen(true);
              }}
              title={`Yangi versiya mavjud: ${updateInfo.version} · Yuklash va o‘rnatish`}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md hover:brightness-110 transition animate-pulse"
            >
              <ArrowDownCircle size={13} />
              <span>Update ({updateInfo.version})</span>
            </button>
          )}

          {/* Settings icon */}
          <div className="relative">
            <button
              title="Sozlamalar"
              aria-label="Sozlamalar"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`rounded-full p-1.5 transition ${settingsOpen ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'}`}
            >
              <Settings size={15} />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-9 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl p-1.5">
                <div className="border-b border-white/[0.06] px-3 py-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {dbMode === 'sqlite' ? 'synapse.db · SQLite Lokal' : 'Vaqtinchalik xotira (RAM)'}
                  </span>
                </div>
                <button onClick={doExport} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <Download size={13} className="text-sky-300" /> Zaxira eksporti (.json)
                </button>
                <button onClick={doImport} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <Upload size={13} className="text-emerald-300" /> Zaxiradan tiklash (.json)
                </button>
                <button onClick={() => { setProvidersModal(true); setSettingsOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <Bot size={13} className="text-violet-300" /> AI provayderlar va API
                  {enabledCount > 0 && <span className="ml-auto rounded-md bg-emerald-500/15 px-1.5 py-px font-mono text-[10px] text-emerald-300">{enabledCount}</span>}
                </button>
                <button onClick={() => { setGuideModal(true); setSettingsOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <BookOpen size={13} className="text-blue-300" /> Qo'llanma va Imkoniyatlar
                </button>
                <button onClick={() => { setUpdateModalOpen(true); setSettingsOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <ArrowDownCircle size={13} className="text-sky-300" /> Yangilanishlarni tekshirish
                  {updateInfo?.available && <span className="ml-auto h-2 w-2 rounded-full bg-sky-400 animate-ping" />}
                </button>
                <SttStatusRow />
              </div>
            )}
          </div>

          {/* Notifications / Reminders Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setSettingsOpen(false);
                setQuickAddOpen(false);
              }}
              title="Eslatmalar va Bildirishnomalar"
              className={`relative flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                pendingCount > 0
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              <Bell size={13} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[9px] font-bold text-black shadow">
                  {pendingCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-9 z-50 w-80 rounded-2xl border border-white/10 bg-[#16171d] p-3 shadow-2xl backdrop-blur-xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Bell size={13} className="text-amber-400" />
                    <span className="text-[12px] font-bold text-white">Eslatmalar & Bildirishnomalar</span>
                  </div>
                  <button
                    onClick={toggleSoundEnabled}
                    title={soundEnabled ? "Ovoz yoqilgan" : "Ovoz o'chirilgan"}
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/5 transition"
                  >
                    {soundEnabled ? <Volume2 size={13} className="text-emerald-400" /> : <VolumeX size={13} className="text-zinc-600" />}
                  </button>
                </div>

                {/* Reminders List */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 py-1">
                  {reminders.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500 text-[11.5px] space-y-1">
                      <p>Rejalashtirilgan bildirishnomalar yo‘q</p>
                      <p className="text-[10.5px] text-zinc-600">Ovoz orqali "soat 10 da eslatma" deb ayting!</p>
                    </div>
                  ) : (
                    reminders.map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-[12px] transition ${
                          r.status === 'triggered'
                            ? 'border-white/[0.05] bg-white/[0.02] opacity-60'
                            : 'border-amber-500/20 bg-amber-500/5'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-semibold text-white truncate">{r.title}</p>
                          <p className="font-mono text-[10.5px] text-amber-300 flex items-center gap-1">
                            <Clock size={10} /> {r.time_string}
                            {r.status === 'triggered' && <span className="text-zinc-500">(Bajarildi)</span>}
                            {r.cron_expression && <span className="text-purple-400 font-bold">(Cron)</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteReminder(r.id)}
                          title="O'chirish"
                          className="p-1 text-zinc-500 hover:text-rose-400 transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom actions */}
                <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setVoiceOpen(true);
                      setNotificationsOpen(false);
                    }}
                    className="flex-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1.5 text-center text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition"
                  >
                    + Ovozli Eslatma
                  </button>
                  <button
                    onClick={() => testNotification()}
                    className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition"
                  >
                    🔔 Sinab ko‘rish
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar F */}
          <button
            onClick={() => setProfileModal(true)}
            title="Profile"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e293b] border border-white/20 text-[11px] font-bold text-zinc-200 hover:border-white/40 hover:scale-105 transition"
          >
            {userProfile.avatar_initials || 'F'}
          </button>
        </div>
      </header>

      {/* Update notification banner if available */}
      {updateInfo?.available && !bannerDismissed && (
        <div className="flex items-center justify-between border-b border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-sky-500/15 px-6 py-2 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <p className="text-[12px] text-emerald-200">
              🎉 <strong>CogniDev {updateInfo.version}</strong> yangilanishi chiqdi!
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setUpdateAutoStart(true);
                setUpdateModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-bold text-black hover:bg-emerald-400 shadow-md transition"
            >
              <ArrowDownCircle size={13} />
              <span>Hozir Yangilang</span>
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 text-zinc-400 hover:text-white transition"
              title="Yopish"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFilePicked} />
      <Suspense fallback={null}>
        {showTaskModal && <TaskModal open={showTaskModal} onClose={() => setTaskModal(false)} />}
        {showChatModal && <LogChatModal open={showChatModal} onClose={() => setChatModal(false)} />}
        {voiceOpen && <VoiceRecorderModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />}
        {showProvidersModal && <AiProvidersModal open={showProvidersModal} onClose={() => setProvidersModal(false)} />}
        {showProfileModal && <ProfileModal open={showProfileModal} onClose={() => setProfileModal(false)} />}
        {showGuideModal && <GuideModal open={showGuideModal} onClose={() => setGuideModal(false)} />}
        {gitModalOpen && (
          <GitInspectorModal
            open={gitModalOpen}
            onClose={() => {
              setGitModalOpen(false);
              refreshGit();
            }}
          />
        )}
        {showGitHubModal && (
          <GitHubSyncModal
            open={showGitHubModal}
            onClose={() => setGitHubModal(false)}
            initialRepoUrl={gitHubTargetRepoUrl || undefined}
          />
        )}
        {updateModalOpen && (
          <UpdateModal
            open={updateModalOpen}
            onClose={() => {
              setUpdateModalOpen(false);
              setUpdateAutoStart(false);
            }}
            initialUpdateHandle={updateInfo?.handle}
            initialVersion={updateInfo?.version}
            initialBody={updateInfo?.body}
            autoStart={updateAutoStart}
          />
        )}
      </Suspense>
    </>
  );
}

function SttStatusRow() {
  const [label, setLabel] = useState('RubaiSTT tekshirilmoqda…');
  const [ok, setOk] = useState(false);
  useEffect(() => {
    rubaiStatus()
      .then((s) => {
        if (s?.ready) {
          setOk(true);
          setLabel('RubaiSTT · rubaistt v2 (lokal, tayyor)');
        } else {
          setOk(false);
          setLabel('RubaiSTT topilmadi (faqat Web Speech)');
        }
      })
      .catch(() => {
        setOk(false);
        setLabel('RubaiSTT topilmadi (faqat Web Speech)');
      });
  }, []);
  return (
    <div className="mt-1 flex items-center gap-2 border-t border-white/[0.06] px-3 py-1.5" title={label}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      <span className="truncate font-mono text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
