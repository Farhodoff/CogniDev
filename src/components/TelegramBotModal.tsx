import { useState } from 'react';
import {
  X,
  Send,
  Check,
  AlertCircle,
  RefreshCw,
  Power,
  ShieldCheck,
  Bot,
  ExternalLink,
  BrainCircuit,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { testTelegramToken } from '../lib/telegramBot';

interface TelegramBotModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TelegramBotModal({ open, onClose }: TelegramBotModalProps) {
  const {
    telegramConfig,
    telegramStatus,
    telegramBotName,
    updateTelegramConfig,
    startTelegramBot,
    stopTelegramBot,
    memories,
    syncHermesMemoriesAction,
  } = useSynapse();

  const [token, setToken] = useState(telegramConfig.bot_token || '');
  const [allowedUsers, setAllowedUsers] = useState(telegramConfig.allowed_user_ids || '');
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingMemories, setIsSyncingMemories] = useState(false);

  if (!open) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testTelegramToken(token);
    setIsTesting(false);
    if (res.ok) {
      setTestResult({
        ok: true,
        message: `Muvaffaqiyatli bog‘landi! Bot: @${res.botUsername} (${res.botName})`,
      });
    } else {
      setTestResult({
        ok: false,
        message: res.error || 'Token yaroqsiz',
      });
    }
  };

  const handleSaveAndToggle = async (activate?: boolean) => {
    setIsSaving(true);
    const newActive = activate !== undefined ? activate : telegramConfig.is_active;

    await updateTelegramConfig({
      bot_token: token.trim(),
      allowed_user_ids: allowedUsers.trim(),
      is_active: newActive,
    });

    if (newActive && token.trim()) {
      await startTelegramBot();
    } else {
      stopTelegramBot();
    }

    setIsSaving(false);
  };

  const handleSyncMemories = async () => {
    setIsSyncingMemories(true);
    await syncHermesMemoriesAction();
    setIsSyncingMemories(false);
  };

  const isRunning = telegramStatus === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Telegram Bot & Hermes Xotirasi
                {isRunning && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Online
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">CogniDev AI agentini Telegram orqali masofadan boshqaring</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Status banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isRunning
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : telegramStatus === 'error'
              ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-emerald-400 animate-ping' : telegramStatus === 'error' ? 'bg-rose-500' : 'bg-zinc-500'
              }`} />
              <div>
                <p className="text-sm font-medium">
                  {isRunning
                    ? `Bot faol: ${telegramBotName || 'CogniDev AI'}`
                    : telegramStatus === 'error'
                    ? 'Ulanishda xatolik yuz berdi'
                    : 'Telegram bot to‘xtatilgan'}
                </p>
                <p className="text-xs opacity-75">
                  {isRunning
                    ? 'Yangi xabarlarni tinglamoqda va SQLite bilan sinxronlamoqda'
                    : 'Botni ishga tushirish uchun quyidagi tugmani bosing'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleSaveAndToggle(!isRunning)}
              disabled={isSaving || (!isRunning && !token.trim())}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition shadow-sm ${
                isRunning
                  ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } disabled:opacity-50`}
            >
              <Power className="w-3.5 h-3.5" />
              {isRunning ? 'To‘xtatish' : 'Ishga tushirish'}
            </button>
          </div>

          {/* Bot Token Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
              <span>Telegram Bot Token</span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                @BotFather orqali token olish <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTestResult(null);
                }}
                placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 pr-20 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 rounded"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !token.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition disabled:opacity-50 border border-zinc-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              Ulanishni tekshirish
            </button>
            {testResult && (
              <span className={`text-xs flex items-center gap-1.5 ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {testResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {testResult.message}
              </span>
            )}
          </div>

          {/* Allowed User IDs */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Ruxsat etilgan Telegram User ID'lar
            </label>
            <input
              type="text"
              value={allowedUsers}
              onChange={(e) => setAllowedUsers(e.target.value)}
              placeholder="Masalan: 6756073816 (vergul bilan bir nechta yozish mumkin)"
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
            <p className="text-[11px] text-zinc-500">
              Bot begonalar so‘rovlariga javob bermasligi uchun o‘z Telegram ID raqamingizni kiriting.
              (O‘z ID raqamingizni @userinfobot orqali bilib olishingiz mumkin).
            </p>
          </div>

          {/* Hermes Persistent Memory Status */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-zinc-200">Hermes Uzoq Muddatli Xotirasi</span>
              </div>
              <button
                onClick={handleSyncMemories}
                disabled={isSyncingMemories}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingMemories ? 'animate-spin' : ''}`} />
                Qayta sinxronlash
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Hermes Agent xotiralari SQLite bazasiga import qilingan: <strong className="text-purple-300">{memories.length} ta doimiy fakt</strong> faol.
            </p>
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
              {memories.map((m) => (
                <div key={m.id} className="text-[11px] text-zinc-300 bg-zinc-900/80 px-2.5 py-1.5 rounded-lg border border-zinc-800/60 flex items-start gap-2">
                  <span className="text-[10px] uppercase font-bold text-sky-400 bg-sky-950/50 px-1 rounded border border-sky-800/40 shrink-0">
                    {m.category}
                  </span>
                  <span className="line-clamp-2 leading-relaxed">{m.content}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition"
          >
            Yopish
          </button>
          <button
            onClick={() => handleSaveAndToggle()}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition shadow-lg shadow-sky-600/20 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Sozlamalarni saqlash
          </button>
        </div>
      </div>
    </div>
  );
}
