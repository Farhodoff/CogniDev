import { useRef, useState } from 'react';
import { ChevronDown, Download, Mic, Search, Settings, ClipboardList, Upload, RefreshCw, Bot, Plus } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { dumpDatabase, restoreDatabase, type VaultDump } from '../lib/db';
import { exportVaultFile, isTauri, parseVault, pickVaultFileContents } from '../lib/vault';
import TaskModal from './TaskModal';
import LogChatModal from './LogChatModal';
import VoiceRecorderModal from './VoiceRecorderModal';

export default function Header({ onPalette }: { onPalette: () => void }) {
  const {
    workspaces,
    activeWorkspaceId,
    setWorkspace,
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
    setSpotlight,
  } = useSynapse();

  const [wsOpen, setWsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [aiSyncOpen, setAiSyncOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = workspaces.find((w) => w.id === activeWorkspaceId);

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
      setHud(ok ? `Ombor eksport qilindi — ${dump.tasks.length} vazifa, ${dump.prompts.length} prompt` : 'Eksport bekor qilindi');
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
        className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0d11]/90 px-4 backdrop-blur-xl"
        style={isTauri ? { paddingLeft: 84 } : undefined}
      >
        {/* Chap qism: Traffic lights & Workspace Selector */}
        <div className="flex items-center gap-3 shrink-0">
          {!isTauri && (
            <div className="flex shrink-0 items-center gap-2 pr-1" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_2px_rgba(0,0,0,0.3)]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_2px_rgba(0,0,0,0.3)]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_0_2px_rgba(0,0,0,0.3)]" />
            </div>
          )}

          <div className="flex items-center gap-2 pr-1">
            <img src="/logo.svg" alt="CogniDev Logo" className="h-6 w-6 rounded-lg shadow-sm" />
            <span className="font-bold tracking-tight text-[13px] bg-gradient-to-r from-sky-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
              CogniDev
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setWsOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-zinc-100 hover:bg-white/[0.07] transition"
            >
              <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_1px_rgba(56,189,248,0.8)]" />
              <span className="max-w-[170px] truncate">{active?.name ?? 'Personal Dev Hub'}</span>
              <ChevronDown size={13} className="text-zinc-500" />
            </button>
            {wsOpen && (
              <div className="absolute left-0 top-10 z-50 w-60 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-150">
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setWorkspace(w.id);
                      setWsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12.5px] transition ${
                      w.id === activeWorkspaceId ? 'bg-sky-500/15 text-sky-200 font-semibold' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${w.type === 'team' ? 'bg-sky-400' : 'bg-violet-400'}`} />
                      {w.name}
                    </span>
                    {w.id === activeWorkspaceId && <span className="text-[10.5px] text-sky-300 font-mono">faol</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Markaziy qism: macOS Spotlight Quick Search (⌘K) */}
        <div className="flex-1 max-w-[500px] mx-4">
          <button
            onClick={() => {
              if (onPalette) onPalette();
              setSpotlight(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-left text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] transition shadow-inner group"
            title="Spotlight tezkor qidiruv (⌘K)"
          >
            <Search size={14} className="text-zinc-500 group-hover:text-zinc-300 transition shrink-0" />
            <span className="w-full truncate text-[12.5px] text-zinc-400">
              {search || '⌘K Quick Search across tasks, solutions, and AI notes...'}
            </span>
            <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:block">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* O'ng qism: Multi-AI Sync, + Yangi, Sozlamalar va Profil */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Multi-AI Sync Status Pill */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setAiSyncOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition shadow-sm"
              title="Ulangan AI modellar holati"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">Multi-AI Sync</span>
              <span className="hidden xl:inline text-zinc-400 text-[11px]">• Claude • ChatGPT • Gemini</span>
              <ChevronDown size={13} className={`text-emerald-400 transition-transform ${aiSyncOpen ? 'rotate-180' : ''}`} />
            </button>

            {aiSyncOpen && (
              <div className="absolute right-0 top-10 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#16171d] shadow-2xl p-2.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2 py-1 border-b border-white/[0.06]">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400 font-semibold">Ulangan AI Modellar</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-mono">Barchasi faol</span>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] text-[12px]">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Claude 3.5 Sonnet
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">Ulangan ✓</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] text-[12px]">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Gemini 1.5 Pro
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">Ulangan ✓</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] text-[12px]">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ChatGPT (GPT-4o)
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">Ulangan ✓</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] text-[12px]">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Local Ollama
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">Lokal ✓</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => {
                      setAiSyncOpen(false);
                      setHud('Barcha AI suhbatlari va xulosalari muvaffaqiyatli yangilandi');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow hover:brightness-110 transition"
                  >
                    <RefreshCw size={12} /> Hozir Sinxronlash
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bitta toza + Yangi tugmasi (Dropdown) */}
          <div className="relative">
            <button
              onClick={() => setCreateMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-md hover:brightness-110 transition"
            >
              <Plus size={14} />
              <span>Yangi</span>
              <ChevronDown size={12} className={`opacity-80 transition-transform ${createMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {createMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-60 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    setTaskModal(true);
                    setCreateMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <ClipboardList size={14} className="text-sky-400" />
                  <span>Yangi Vazifa</span>
                  <kbd className="ml-auto text-[10px] text-zinc-500 font-mono">⌘N</kbd>
                </button>
                <button
                  onClick={() => {
                    setChatModal(true);
                    setCreateMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <Bot size={14} className="text-violet-400" />
                  <span>Universal AI Ingest</span>
                </button>
                <button
                  onClick={() => {
                    setVoiceOpen(true);
                    setCreateMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] text-zinc-200 hover:bg-white/5 transition"
                >
                  <Mic size={14} className="text-emerald-400" />
                  <span>Ovozli Eslatma</span>
                </button>
              </div>
            )}
          </div>

          {/* Sozlamalar */}
          <div className="relative">
            <button
              title="Sozlamalar"
              aria-label="Sozlamalar"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`rounded-xl p-2 transition ${settingsOpen ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'}`}
            >
              <Settings size={16} />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl p-1.5">
                <div className="border-b border-white/[0.06] px-3 py-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {dbMode === 'sqlite' ? 'synapse.db · SQLite Lokal' : 'Xotira rejimi'}
                  </span>
                </div>
                <button onClick={doExport} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <Download size={14} className="text-sky-300" /> Omborni eksport qilish (.json)
                </button>
                <button onClick={doImport} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-zinc-200 hover:bg-white/5 rounded-lg transition">
                  <Upload size={14} className="text-emerald-300" /> Omborni import qilish (.json)
                </button>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-white shadow-sm ring-2 ring-[#0c0d11]">
            F
          </div>
        </div>
      </header>

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFilePicked} />
      {showTaskModal && <TaskModal open={showTaskModal} onClose={() => setTaskModal(false)} />}
      {showChatModal && <LogChatModal open={showChatModal} onClose={() => setChatModal(false)} />}
      {voiceOpen && <VoiceRecorderModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />}
    </>
  );
}
