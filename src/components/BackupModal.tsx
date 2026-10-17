import React, { useState, useRef } from 'react';
import {
  X,
  Database,
  Download,
  Upload,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  RefreshCw,
  FileCheck,
  Calendar,
  Mic,
  FileText,
  ListTodo,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { dumpDatabase, restoreDatabase, type VaultDump } from '../lib/db';
import { exportVaultFile, isTauri, parseVault, pickVaultFileContents } from '../lib/vault';

interface BackupModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'status' | 'export' | 'import';
}

export default function BackupModal({ open, onClose, initialTab = 'status' }: BackupModalProps) {
  const {
    tasks,
    meetings,
    notesDocs,
    scheduleBlocks,
    goals,
    habits,
    roadmaps,
    reminders,
    dbMode,
    restoreAll,
    refresh,
    setHud,
    workspaces,
    prompts,
  } = useSynapse();

  const [activeTab, setActiveTab] = useState<'status' | 'export' | 'import'>(initialTab);

  React.useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);
  const [busy, setBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<VaultDump | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // Build current memory dump with all app entities
  const getFullMemoryDump = (): VaultDump => {
    return {
      version: 2,
      appName: 'CogniDev',
      exportedAt: new Date().toISOString(),
      workspaces,
      tasks,
      resolutions: tasks.map((t) => ({
        task_id: t.id,
        markdown_note: null,
        checklist_json: JSON.stringify([]),
      })),
      prompts,
      retrospectives: [],
      meetings,
      notesDocs,
      scheduleBlocks,
      goals,
      habits,
      roadmaps,
      scheduledReminders: reminders,
    };
  };

  // Export full backup
  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const dump = dbMode === 'sqlite' ? await dumpDatabase() : getFullMemoryDump();
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `cognidev-backup-${dateStr}.json`;
      const json = JSON.stringify(dump, null, 2);

      const ok = await exportVaultFile(json, fileName);
      if (ok) {
        const msg = `Zaxira fayli muvaffaqiyatli saqlandi (${dump.tasks.length} vazifa, ${(dump.meetings || []).length} uchrashuv)`;
        setSuccessMsg(msg);
        setHud(msg);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Zaxirani eksport qilishda xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  // Pick file for import
  const handlePickFile = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (isTauri) {
        setBusy(true);
        const text = await pickVaultFileContents();
        if (text) {
          processImportText(text, 'cognidev-backup.json');
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Faylni tanlashda xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  const handleBrowserFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    setBusy(true);
    try {
      const text = await f.text();
      processImportText(text, f.name);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Faylni o‘qishda xatolik');
    } finally {
      setBusy(false);
    }
  };

  const processImportText = (text: string, fileName: string) => {
    try {
      const dump = parseVault(text);
      setImportPreview(dump);
      setImportFileName(fileName);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Noto‘g‘ri zaxira fayli formati');
      setImportPreview(null);
    }
  };

  // Confirm restore
  const handleConfirmRestore = async () => {
    if (!importPreview || busy) return;
    setBusy(true);
    setErrorMsg('');
    try {
      if (dbMode === 'sqlite') {
        await restoreDatabase(importPreview);
        await refresh();
      }
      restoreAll(importPreview);
      const msg = `Barcha ma'lumotlar tiklandi: ${importPreview.tasks.length} vazifa, ${(importPreview.meetings || []).length} uchrashuv ✓`;
      setSuccessMsg(msg);
      setHud(msg);
      setImportPreview(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Zaxirani tiklashda xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-sky-500/20 bg-[#101117] shadow-2xl shadow-sky-500/10 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-purple-600/15 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.08] px-6 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-300">
              <Database size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-white">Ma’lumotlar & Zaxira Markazi (Backup)</h2>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-300">
                  SQLite & Disk
                </span>
              </div>
              <p className="text-[12px] text-zinc-400">
                Audio arxivlar, mahalliy SQLite bazasi va to‘liq loyiha ko‘chirish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 pt-2 bg-black/20">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 text-[12.5px] font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'status'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive size={13} className={activeTab === 'status' ? 'text-cyan-400' : ''} />
            <span>Xotira Holati</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 text-[12.5px] font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'export'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download size={13} className={activeTab === 'export' ? 'text-cyan-400' : ''} />
            <span>Zaxiralash (Eksport)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 text-[12.5px] font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'import'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload size={13} className={activeTab === 'import' ? 'text-cyan-400' : ''} />
            <span>Tiklash (Import)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[12.5px]">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[12.5px]">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-zinc-300 flex items-center gap-2">
                      <Database size={14} className="text-cyan-400" />
                      Lokal SQLite Baza
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Faol · synapse.db
                    </span>
                  </div>
                  <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                    Barcha topshiriqlar, qaydlar, taqvim rejalari va uchrashuv ma'lumotlari qurilmangizning SQLite faylida to‘g‘ridan-to‘g‘ri saqlanadi.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-zinc-300 flex items-center gap-2">
                      <FolderArchive size={14} className="text-purple-400" />
                      Audio & Yozuvlar Arxivi
                    </span>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      ~/.cognidev/recordings/
                    </span>
                  </div>
                  <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                    Audio fayllar brauzer/localStorage limitiga (5MB) kirmaydi va alohida papkada yuqori sifatli WAV formatida arxivlanadi.
                  </p>
                </div>
              </div>

              {/* Data Metrics Counter */}
              <div className="space-y-2 pt-2">
                <h3 className="text-[12px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                  Baza tarkibidagi obyektlar
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl border border-white/[0.06] bg-black/30">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                      <Mic size={12} className="text-purple-400" />
                      <span>Uchrashuvlar</span>
                    </div>
                    <p className="text-[18px] font-bold text-white font-mono">{meetings.length}</p>
                  </div>

                  <div className="p-3 rounded-xl border border-white/[0.06] bg-black/30">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                      <ListTodo size={12} className="text-sky-400" />
                      <span>Topshiriqlar</span>
                    </div>
                    <p className="text-[18px] font-bold text-white font-mono">{tasks.length}</p>
                  </div>

                  <div className="p-3 rounded-xl border border-white/[0.06] bg-black/30">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                      <FileText size={12} className="text-emerald-400" />
                      <span>Notion Qaydlar</span>
                    </div>
                    <p className="text-[18px] font-bold text-white font-mono">{notesDocs.length}</p>
                  </div>

                  <div className="p-3 rounded-xl border border-white/[0.06] bg-black/30">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                      <Calendar size={12} className="text-amber-400" />
                      <span>Taqvim Rejalari</span>
                    </div>
                    <p className="text-[18px] font-bold text-white font-mono">{scheduleBlocks.length}</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[11.5px] text-zinc-400">
                <span className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Hech qanday ma'lumot tashqi serverlarga ruxsatsiz yuborilmaydi (100% Local-First).
                </span>
                <button
                  onClick={() => refresh().then(() => setHud("Baza yangilandi ✓"))}
                  className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-mono text-[11px]"
                >
                  <RefreshCw size={11} /> Qayta tekshirish
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-sky-500/25 bg-sky-950/20 space-y-2">
                <h4 className="text-[13px] font-bold text-sky-200 flex items-center gap-2">
                  <Sparkles size={14} className="text-sky-400" />
                  To‘liq Loyihani Bitta Faylga Zaxiralash
                </h4>
                <p className="text-[12px] text-zinc-300 leading-relaxed">
                  Ushbu operatsiya butun ish muhiti (barcha vazifalar, uchrashuv yozuvlari va xulosalari, Notion hujjatlari, taqvim, maqsadlar va sozlamalar)ni ixcham <code>.json</code> formatida saqlab beradi.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-3">
                <div className="text-[12px] text-zinc-400 space-y-1 font-mono text-[11.5px]">
                  <p>• Eksport tarkibi: {tasks.length} vazifa, {meetings.length} uchrashuv, {notesDocs.length} qayd, {scheduleBlocks.length} reja</p>
                  <p>• Format: CogniDev Vault JSON v2</p>
                  <p>• Boshqa kompyuterga to‘g‘ridan-to‘g‘ri import qilish imkoniyati</p>
                </div>

                <button
                  onClick={handleExport}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                >
                  <Download size={15} />
                  <span>{busy ? 'Zaxira yaratilmoqda...' : 'Zaxira Faylini Yuklab Olish (.json)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleBrowserFileChange}
                className="hidden"
              />

              {!importPreview ? (
                <div
                  onClick={handlePickFile}
                  className="cursor-pointer border-2 border-dashed border-white/15 hover:border-cyan-400/50 hover:bg-white/[0.02] p-8 rounded-2xl flex flex-col items-center justify-center text-center transition group"
                >
                  <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-cyan-300 group-hover:scale-105 transition mb-3">
                    <Upload size={20} />
                  </div>
                  <p className="text-[13.5px] font-semibold text-white">
                    Zaxira faylini tanlang (.json)
                  </p>
                  <p className="text-[11.5px] text-zinc-500 mt-1 max-w-sm">
                    Avval eksport qilingan CogniDev zaxira faylini yuklang. Tizim avtomatik tahlil qiladi.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-[13px]">
                        <FileCheck size={16} />
                        <span>Fayl muvaffaqiyatli tahlil qilindi</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">{importFileName}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-zinc-300 text-[11.5px] pt-1">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                        <span className="block text-[10px] text-zinc-500">Vazifalar</span>
                        <strong className="text-white font-mono text-[14px]">{importPreview.tasks.length}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                        <span className="block text-[10px] text-zinc-500">Uchrashuvlar</span>
                        <strong className="text-white font-mono text-[14px]">{(importPreview.meetings || []).length}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                        <span className="block text-[10px] text-zinc-500">Notion Qaydlar</span>
                        <strong className="text-white font-mono text-[14px]">{(importPreview.notesDocs || []).length}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                        <span className="block text-[10px] text-zinc-500">Taqvim</span>
                        <strong className="text-white font-mono text-[14px]">{(importPreview.scheduleBlocks || []).length}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setImportPreview(null)}
                      className="px-4 py-2 rounded-xl border border-white/10 text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition"
                    >
                      Boshqa fayl tanlash
                    </button>
                    <button
                      onClick={handleConfirmRestore}
                      disabled={busy}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} />
                      <span>{busy ? 'Tiklanmoqda...' : 'Zaxirani To‘liq Tiklashni Boshlash'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] px-6 py-3.5 bg-black/30 flex items-center justify-between text-[11px] text-zinc-500">
          <span>CogniDev Local Data Center v2.0</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[11.5px] transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
