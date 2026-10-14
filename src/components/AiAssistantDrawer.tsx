import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Settings,
  Bot,
  User,
  Lightbulb,
  CheckCircle,
  Clock,
  Target,
  Wrench,
  Copy,
  Check,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { firstEnabledProvider } from '../lib/providers';
import { formatShortcut } from '../lib/platform';
import FormattedAiText from './FormattedAiText';

const QUICK_PROMPTS = [
  { icon: Clock, label: 'Bugungi kunimni tahlil qilib ber', prompt: 'Bugungi kunim va bajargan vazifalarimni tahlil qilib, xulosa va tavsiyalar ber.' },
  { icon: CheckCircle, label: 'Qaysi vazifalar tugallanmagan?', prompt: 'Mening joriy faol va tugallanmagan vazifalarim qaysilar? Qaysi biriga birinchi navbatda fokus berishim kerak?' },
  { icon: Target, label: 'Haftalik hisobot tayyorla', prompt: 'Ushbu haftadagi umumiy muhandislik rivojlanishim, yechilgan muammolar va yangi o‘rganishlar bo‘yicha hisobot tayyorla.' },
  { icon: Lightbulb, label: 'Yangi loyiha g‘oyalari taklif qil', prompt: 'Mening backend texnologiyalarim (Python, FastAPI, PostgreSQL, Go, Rust) asosida rezyumega qo‘shish mumkin bo‘lgan 2 ta yuqori yuklamali loyiha g‘oyasini taklif qil.' },
  { icon: Wrench, label: 'Texnik masalada yordam ber', prompt: 'PostgreSQL da B-Tree va GIN indekslar qachon ishlatiladi va EXPLAIN ANALYZE da qanday ko‘rinadi? Qisqa tushuntir.' },
];

export default function AiAssistantDrawer() {
  const {
    isAiDrawerOpen,
    setAiDrawerOpen,
    aiDrawerMessages,
    isAiDrawerThinking,
    sendAiDrawerMessage,
    clearAiDrawerMessages,
    setProvidersModal,
  } = useSynapse();

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentProviderName = firstEnabledProvider()?.name || 'Mahalliy / AI';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiDrawerMessages, isAiDrawerThinking]);

  if (!isAiDrawerOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || input;
    if (!q.trim() || isAiDrawerThinking) return;
    setInput('');
    await sendAiDrawerMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside className="relative flex h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-obsidian-950/95 backdrop-blur-2xl shadow-2xl transition-all duration-300 z-30">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 bg-black/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>AI Assistant</span>
            </h3>
            <button
              onClick={() => setProvidersModal(true)}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-purple-300 transition"
              title="AI modelini o'zgartirish"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{currentProviderName}</span>
              <Settings size={10} className="ml-0.5 text-zinc-500" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearAiDrawerMessages}
            title="Suhbat tarixini tozalash"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setAiDrawerOpen(false)}
            title={`Yopish (${formatShortcut('J')})`}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Message History & Quick Chips */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Quick Suggestion Chips */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Tezkor so‘rovlar:
          </p>
          <div className="flex flex-col gap-1.5">
            {QUICK_PROMPTS.map((qp, idx) => {
              const Icon = qp.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(qp.prompt)}
                  disabled={isAiDrawerThinking}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-left text-xs text-zinc-300 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white transition disabled:opacity-50"
                >
                  <Icon size={13} className="shrink-0 text-purple-400" />
                  <span className="truncate">{qp.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/5 my-2" />

        {/* Chat History Bubbles */}
        {aiDrawerMessages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 pb-1 text-[10px] text-zinc-500">
                {isUser ? (
                  <>
                    <span>Siz</span>
                    <User size={11} />
                  </>
                ) : (
                  <>
                    <Bot size={11} className="text-purple-400" />
                    <span>AI {msg.model ? `(${msg.model})` : ''}</span>
                  </>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              <div
                className={`relative group max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-br-none shadow-md'
                    : 'border border-white/10 bg-white/[0.04] text-zinc-200 rounded-bl-none shadow-sm'
                }`}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap select-text">{msg.content}</div>
                ) : (
                  <div className="select-text">
                    <FormattedAiText content={msg.content} />
                  </div>
                )}

                {!isUser && (
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="absolute -bottom-2 right-2 hidden group-hover:flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-zinc-400 border border-white/10 hover:text-white"
                  >
                    {copiedId === msg.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedId === msg.id ? 'Nusxalandi' : 'Nusxa'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isAiDrawerThinking && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs text-purple-300">
            <Sparkles size={14} className="animate-spin text-purple-400" />
            <span>AI tahlil qilmoqda...</span>
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="border-t border-white/10 p-3 bg-black/40">
        <div className="relative rounded-xl border border-white/10 bg-black/60 focus-within:border-purple-400/50 transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Savolingizni yozing... (Enter — yuborish)"
            rows={2}
            className="w-full resize-none bg-transparent px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] text-zinc-600">Shift+Enter yangi qator</span>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isAiDrawerThinking}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500 text-white hover:bg-purple-400 active:scale-95 transition disabled:opacity-30"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

    </aside>
  );
}
