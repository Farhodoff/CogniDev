import { useEffect, useRef, useState } from 'react';
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
  Layout,
  FileText,
  Lightbulb,
  Briefcase,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { dumpDatabase, restoreDatabase, type VaultDump } from '../lib/db';
import { exportVaultFile, isTauri, parseVault, pickVaultFileContents } from '../lib/vault';
import { isMac, formatShortcut } from '../lib/platform';
import { rubaiStatus } from '../lib/stt';
import { enabledProviders } from '../lib/providers';
import { checkAppUpdate } from '../lib/updater';
import TaskModal from './TaskModal';
import LogChatModal from './LogChatModal';
import VoiceRecorderModal from './VoiceRecorderModal';
import AiProvidersModal from './AiProvidersModal';
import ProfileModal from './ProfileModal';
import GuideModal from './GuideModal';
import UpdateModal from './UpdateModal';

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
    toggleAiDrawer,
    userProfile,
    createNote,
    setMainView,
  } = useSynapse();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const enabledCount = enabledProviders().length;
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateAutoStart, setUpdateAutoStart] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; version?: string; body?: string; handle?: any } | null>(null);

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
              </div>
            )}
          </div>

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
      {showTaskModal && <TaskModal open={showTaskModal} onClose={() => setTaskModal(false)} />}
      {showChatModal && <LogChatModal open={showChatModal} onClose={() => setChatModal(false)} />}
      {voiceOpen && <VoiceRecorderModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />}
      {showProvidersModal && <AiProvidersModal open={showProvidersModal} onClose={() => setProvidersModal(false)} />}
      {showProfileModal && <ProfileModal open={showProfileModal} onClose={() => setProfileModal(false)} />}
      {showGuideModal && <GuideModal open={showGuideModal} onClose={() => setGuideModal(false)} />}
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
