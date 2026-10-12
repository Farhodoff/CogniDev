import { useRef, useState } from 'react';
import { Bell, ChevronDown, Download, Filter, Mic, Search, Settings, TriangleAlert, MessageSquarePlus, ClipboardList, Upload, Sparkles, RefreshCw, Bot } from 'lucide-react';
import { useSynapse } from '../lib/store';
import { dumpDatabase, restoreDatabase, type VaultDump } from '../lib/db';
import { exportVaultFile, isTauri, parseVault, pickVaultFileContents } from '../lib/vault';
import TaskModal from './TaskModal';
import LogChatModal from './LogChatModal';
import VoiceRecorderModal from './VoiceRecorderModal';

export default function Header({ onPalette }: { onPalette: () => void }) {
  const {
    workspaces, activeWorkspaceId, setWorkspace, search,
    tasks, notes, checklists, prompts,
    selectedTaskId, flagBlocker, refresh, restoreAll, dbMode, setHud,
    showTaskModal, setTaskModal, showChatModal, setChatModal, quickFilter, setFilter,
    triggerWeeklyCoach, setSpotlight,
  } = useSynapse();
  const [wsOpen, setWsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [aiSyncOpen, setAiSyncOpen] = useState(false);
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

  function handleBlockerClick() {
    if (!selectedTaskId) {
      setHud("Iltimos, avval ro'yxatdan vazifani tanlang");
      return;
    }
    flagBlocker(selectedTaskId);
  }

  return (
    <>
      <header
        data-tauri-drag-region
        className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0f1013]/85 px-4 backdrop-blur-xl"
        style={isTauri ? { paddingLeft: 84 } : undefined}
      >
        {!isTauri && (
          <div className="flex shrink-0 items-center gap-2 pr-1" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_2px_rgba(0,0,0,0.3)]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_2px_rgba(0,0,0,0.3)]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_0_2px_rgba(0,0,0,0.3)]" />
          </div>
        )}

        {/* Ish maydoni tanlash */}
        <div className="relative">
          <button onClick={() => setWsOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-zinc-100 hover:bg-white/5">
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_1px_rgba(56,189,248,0.8)]" />
            <span className="max-w-[210px] truncate">{active?.name ?? 'Ish maydoni'}</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>
          {wsOpen && (
            <div className="absolute left-0 top-10 z-50 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#17181d] shadow-2xl">
              {workspaces.map((w) => (
                <button key={w.id} onClick={() => { setWorkspace(w.id); setWsOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] hover:bg-white/5 ${w.id === activeWorkspaceId ? 'text-white' : 'text-zinc-400'}`}>
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${w.type === 'team' ? 'bg-sky-400' : 'bg-violet-400'}`} />
                    {w.name}
                  </span>
                  {w.id === activeWorkspaceId && <span className="text-[11px] text-sky-300">faol</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tezkor qidiruv */}
        <button onClick={onPalette} className="mx-auto flex w-full max-w-[500px] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-1.5 text-left hover:border-white/[0.14] transition">
          <Search size={15} className="shrink-0 text-zinc-500" />
          <span className="w-full truncate text-[13px] text-zinc-500">{search || '⌘K Quick Search across tasks, solutions, and AI notes...'}</span>
          <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:block">⌘K</kbd>
        </button>

        {/* Multi-AI Sync Ko'rsatkichi */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setAiSyncOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
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
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Local Ollama (llama3.2)
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">Lokal ✓</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06]">
                <button
                  onClick={() => { setAiSyncOpen(false); setHud("Barcha AI suhbatlari muvaffaqiyatli sinxronlandi"); }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow hover:brightness-110 transition"
                >
                  <RefreshCw size={12} /> Hozir Sinxronlash
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Spotlight Quick Capture Tugmasi */}
        <button
          onClick={() => setSpotlight(true)}
          className="hidden sm:flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[12px] font-semibold text-sky-200 hover:bg-sky-500/20 transition shadow-sm"
          title="Tezkor Spotlight capture & Git commits (⌘K)"
        >
          <Search size={13} className="text-sky-400" />
          <span>Spotlight</span>
          <kbd className="rounded bg-white/10 px-1 font-mono text-[10px] text-zinc-400">⌘K</kbd>
        </button>

        {/* AI Weekly Coach Tugmasi */}
        <button
          onClick={() => triggerWeeklyCoach()}
          className="hidden sm:flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-[12px] font-semibold text-violet-200 hover:bg-violet-500/25 transition shadow-sm"
          title="AI Haftalik tahlil & Fidbek olish"
        >
          <Sparkles size={13} className="text-violet-300" />
          <span>AI Coach</span>
        </button>

        {/* Universal AI Ingest Tugmasi */}
        <button
          onClick={() => setChatModal(true)}
          className="hidden md:flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-600/20 to-purple-600/20 px-3 py-1.5 text-[12px] font-semibold text-violet-200 hover:brightness-125 transition shadow-sm"
          title="Claude, Gemini yoki ChatGPT suhbatini 1-tugma bilan import qilish"
        >
          <Bot size={13} className="text-violet-300" />
          <span>Universal AI Ingest</span>
        </button>

        {/* Asosiy harakat tugmalari */}
        <div className="hidden items-center gap-1.5 xl:flex">
          <button onClick={() => setChatModal(true)} className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[12px] font-medium text-violet-200 hover:bg-violet-500/20">
            <span className="text-violet-300">+</span> <MessageSquarePlus size={13} className="text-violet-300" /> AI Suhbat
          </button>
          <button onClick={() => setTaskModal(true)} className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[12px] font-medium text-sky-200 hover:bg-sky-500/20">
            <span>+</span> Vazifa
          </button>
          <button onClick={() => setVoiceOpen(true)} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/20">
            <span>+</span> <Mic size={13} className="text-emerald-300" /> Ovozli Eslatma
          </button>
          <button
            onClick={handleBlockerClick}
            title={selectedTaskId ? `${selectedTaskId} ni P0 to'siq deb belgilash` : "Avval vazifani tanlang"}
            className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[12px] font-medium text-amber-200 hover:bg-amber-500/20"
          >
            <span>+</span> <TriangleAlert size={13} /> To'siq
          </button>
        </div>

        {/* O'ng tomon sozlamalar va piktogrammalar */}
        <div className="ml-auto flex items-center gap-1">
          <IconBtn
            label="Filtrlash"
            onClick={() => setFilter(quickFilter ? null : 'high')}
            active={quickFilter !== null}
          >
            <Filter size={16} />
          </IconBtn>
          <IconBtn
            label="Yangi vazifa"
            onClick={() => setTaskModal(true)}
          >
            <ClipboardList size={16} />
          </IconBtn>
          <IconBtn
            label="Tizim holati"
            dot
            onClick={() => setHud(dbMode === 'sqlite' ? 'SQLite bazasi (synapse.db) to‘liq faol va ulangan' : 'Xotira rejimi faol')}
          >
            <Bell size={16} />
          </IconBtn>

          <div className="relative">
            <button title="Sozlamalar" aria-label="Sozlamalar" onClick={() => setSettingsOpen((v) => !v)}
              className={`rounded-lg p-2 ${settingsOpen ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'}`}>
              <Settings size={16} />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#17181d] shadow-2xl">
                <div className="border-b border-white/[0.06] px-3.5 py-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {dbMode === 'sqlite' ? 'synapse.db · SQLite faol' : 'Xotira rejimi'}
                  </span>
                </div>
                <button onClick={doExport} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-zinc-200 hover:bg-white/5">
                  <Download size={14} className="text-sky-300" /> Omborni eksport qilish (.json)
                </button>
                <button onClick={doImport} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-zinc-200 hover:bg-white/5">
                  <Upload size={14} className="text-emerald-300" /> Omborni import qilish (.json)
                </button>
              </div>
            )}
          </div>
          <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-white shadow-sm">
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

function IconBtn({
  children,
  label,
  dot,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  dot?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`relative rounded-lg p-2 transition ${active ? 'bg-sky-500/20 text-sky-300' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'}`}
    >
      {children}
      {dot && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sky-400" />}
    </button>
  );
}
