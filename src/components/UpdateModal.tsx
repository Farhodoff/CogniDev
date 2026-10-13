import { useState, useEffect } from 'react';
import { ArrowDownCircle, Check, Loader2, Sparkles, X, AlertCircle } from 'lucide-react';
import { checkAppUpdate, downloadAndApplyUpdate } from '../lib/updater';

export default function UpdateModal({
  open,
  onClose,
  initialUpdateHandle,
  initialVersion,
  initialBody,
}: {
  open: boolean;
  onClose: () => void;
  initialUpdateHandle?: any;
  initialVersion?: string;
  initialBody?: string;
}) {
  if (!open) return null;
  return (
    <UpdateDialog
      onClose={onClose}
      initialUpdateHandle={initialUpdateHandle}
      initialVersion={initialVersion}
      initialBody={initialBody}
    />
  );
}

function UpdateDialog({
  onClose,
  initialUpdateHandle,
  initialVersion,
  initialBody,
}: {
  onClose: () => void;
  initialUpdateHandle?: any;
  initialVersion?: string;
  initialBody?: string;
}) {
  const [checking, setChecking] = useState(!initialUpdateHandle);
  const [updateObj, setUpdateObj] = useState<any>(initialUpdateHandle ?? null);
  const [version, setVersion] = useState<string>(initialVersion ?? '');
  const [releaseNotes, setReleaseNotes] = useState<string>(initialBody ?? '');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUpdateHandle) return;
    let cancelled = false;
    checkAppUpdate()
      .then((res) => {
        if (cancelled) return;
        if (res.available) {
          setUpdateObj(res.updateHandle);
          setVersion(res.version ?? '');
          setReleaseNotes(res.body ?? '');
        } else {
          setUpdateObj(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Yangilanishlarni tekshirishda xatolik yuz berdi');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialUpdateHandle]);

  async function handleApply() {
    if (!updateObj || downloading) return;
    setDownloading(true);
    setProgress(0);
    setError(null);
    try {
      await downloadAndApplyUpdate(updateObj, (pct) => {
        setProgress(pct);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuklab olish yoki o‘rnatishda xatolik yuz berdi');
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md animate-in fade-in duration-150" onClick={onClose}>
      <div className="relative w-full max-w-[500px] overflow-hidden rounded-2xl border border-white/10 bg-[#16171d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white">Dastur Yangilanishi</h2>
              <p className="text-[11px] text-zinc-400">Avtomatik yangilash tizimi (Auto-Updater)</p>
            </div>
          </div>
          {!downloading && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white transition">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {checking ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 size={24} className="mx-auto text-sky-400 animate-spin" />
              <p className="text-[13px] text-zinc-300">GitHub Releases orqali yangilanishlar tekshirilmoqda…</p>
            </div>
          ) : updateObj ? (
            <>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-3">
                <ArrowDownCircle size={24} className="text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-[13.5px] font-bold text-white">
                    Yangi versiya mavjud: <span className="font-mono text-emerald-300">{version}</span>
                  </h3>
                  <p className="text-[11.5px] text-zinc-300 mt-0.5">
                    Yangi imkoniyatlar va yaxshilanishlar tayyor.
                  </p>
                </div>
              </div>

              {releaseNotes && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Yangiliklar tafsiloti:</span>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/40 p-3 font-mono text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {releaseNotes}
                  </div>
                </div>
              )}

              {downloading && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-[12px] font-mono text-zinc-300">
                    <span>Yuklab olinmoqda va o'rnatilmoqda…</span>
                    <span className="font-bold text-sky-400">{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 text-center">
                    Yuklangandan so'ng dastur avtomatik qayta ishga tushadi.
                  </p>
                </div>
              )}
            </>
          ) : error ? (
            <div className="py-4 text-center space-y-2">
              <AlertCircle size={24} className="mx-auto text-amber-400" />
              <p className="text-[13px] text-zinc-300">{error}</p>
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <Check size={20} />
              </div>
              <h3 className="text-[14px] font-semibold text-white">Sizda eng so'nggi versiya o'rnatilgan</h3>
              <p className="text-[12px] text-zinc-400 max-w-xs mx-auto">
                CogniDev v0.1.1 hozirgi vaqtda eng so'nggi holatda. Yangilanishlar chiqarilishi bilan bu yerda paydo bo'ladi.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3.5 bg-white/[0.02]">
          {updateObj && !downloading ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-300 hover:bg-white/10 transition"
              >
                Keyinroq
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <ArrowDownCircle size={14} />
                <span>Hozir yangilash</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={downloading}
              onClick={onClose}
              className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] px-4 py-1.5 text-[12.5px] font-semibold text-zinc-200 transition"
            >
              Yopish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
