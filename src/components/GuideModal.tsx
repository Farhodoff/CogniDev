import { useState } from 'react';
import { BookOpen, X, CheckCircle2, Bot, Mic, Cpu, Search, Sparkles, ShieldCheck, Database } from 'lucide-react';
import { modKey, modPrefix } from '../lib/platform';

const SECTIONS = [
  {
    id: 'overview',
    title: 'CogniDev nima?',
    icon: <Sparkles size={16} className="text-sky-400" />,
    badge: 'Umumiy tushuncha',
  },
  {
    id: 'stream',
    title: '1. Muhandislik Oqimi (Task Stream)',
    icon: <CheckCircle2 size={16} className="text-emerald-400" />,
    badge: 'Asosiy panel',
  },
  {
    id: 'ai-vault',
    title: '2. AI Yechimlar & Prompt Vault',
    icon: <Bot size={16} className="text-violet-400" />,
    badge: 'Ikkinchi miya',
  },
  {
    id: 'voice',
    title: '3. Ovozli Qaydlar (Voice Memo)',
    icon: <Mic size={16} className="text-rose-400" />,
    badge: 'Ovozli diktovka',
  },
  {
    id: 'standup',
    title: '4. Standup & Haftalik Tahlil',
    icon: <Cpu size={16} className="text-amber-400" />,
    badge: 'AI Murabbiy',
  },
  {
    id: 'shortcuts',
    title: '5. Qidiruv & Klaviatura tugmalari',
    icon: <Search size={16} className="text-cyan-400" />,
    badge: 'Tezkor klavishlar',
  },
];

export default function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="relative flex h-[82vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-sky-500/25 bg-[#121319] shadow-2xl shadow-sky-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />

        {/* Chap panel: Bo'limlar ro'yxati */}
        <div className="flex w-72 shrink-0 flex-col border-r border-white/[0.08] bg-[#0c0d12]/90 p-4">
          <div className="flex items-center gap-2.5 px-2 pb-4 pt-1 border-b border-white/[0.06]">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
              <BookOpen size={16} />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white">Qo'llanma</h2>
              <p className="text-[11px] text-zinc-500">CogniDev qanday ishlaydi?</p>
            </div>
          </div>

          <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
            {SECTIONS.map((s) => {
              const on = activeTab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                    on
                      ? 'border border-sky-500/30 bg-sky-500/15 text-white shadow-sm'
                      : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                  }`}
                >
                  <span className="shrink-0">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">{s.title}</span>
                    <span className="block text-[10px] text-zinc-500">{s.badge}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-auto border-t border-white/[0.06] pt-3 px-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              <span>100% Mahalliy va Maxfiy</span>
            </div>
          </div>
        </div>

        {/* O'ng panel: Kontent */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 font-mono text-[11.5px] text-zinc-400">
              <span className="text-sky-400 font-bold">CogniDev Cockpit</span>
              <span>/</span>
              <span className="text-zinc-200">{SECTIONS.find((s) => s.id === activeTab)?.title}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px] leading-relaxed text-zinc-300">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 to-transparent p-5">
                  <h3 className="text-[17px] font-bold text-white mb-2">
                    Dasturchining Ikkinchi Miyasi (Developer Second Brain)
                  </h3>
                  <p className="text-zinc-300 leading-relaxed text-[13.5px]">
                    <strong>CogniDev</strong> — bu dasturchilar uchun loyihalardagi barcha texnik qaydlar, yechilgan murakkab xatolar, AI (ChatGPT, Claude, Gemini) yordamida topilgan tayyor kod parchalari va kunlik vazifalarni bitta mahalliy markazda saqlash uchun yaratilgan tizimdir.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-sky-400 font-semibold mb-1 text-[13.5px]">
                      <Database size={16} /> 100% Mahalliy (Local-First)
                    </div>
                    <p className="text-zinc-400 text-[12px] leading-relaxed">
                      Barcha ma'lumotlar o'zingizning Mac kompyuteringizdagi <code>synapse.db</code> (SQLite) bazasida saqlanadi. Hech qanday ma'lumot begona serverlarga yuborilmaydi.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-violet-400 font-semibold mb-1 text-[13.5px]">
                      <Bot size={16} /> Ko'p AI integratsiyasi
                    </div>
                    <p className="text-zinc-400 text-[12px] leading-relaxed">
                      Claude, ChatGPT, Gemini, DeepSeek va mahalliy Ollama bilan integratsiya. Har bir yechim qaysi model orqali topilgani xotirada saqlanadi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stream' && (
              <div className="space-y-4">
                <h3 className="text-[16px] font-bold text-white">Muhandislik Oqimi (Task Stream) qanday ishlaydi?</h3>
                <p>
                  Chapdagi oqim orqali har bir texnik vazifa yoki nosozlikni boshqarishingiz mumkin:
                </p>
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 font-mono text-[11px] font-bold">1</span>
                    <div>
                      <strong className="text-white block text-[13px]">Tezkor vazifa qo'shish (Quick Capture):</strong>
                      <span className="text-zinc-400 text-[12px]">
                        Stream panelining eng pastki qismidagi maydonga <code>#bugfix Auth token xatosi</code> deb yozib Enter bosing. Tizim avtomatik tegni ajratib vazifa ochadi.
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 font-mono text-[11px] font-bold">2</span>
                    <div>
                      <strong className="text-white block text-[13px]">Git Branch va Pull Request biriktirish:</strong>
                      <span className="text-zinc-400 text-[12px]">
                        Markaziy muharrir tepasida <code>git_branch</code> va <code>PR URL</code> maydonlari mavjud. Kod yozish jarayonida qaysi filialda ishlayotganingiz ko'rinib turadi.
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">3</span>
                    <div>
                      <strong className="text-white block text-[13px]">Nazorat Ro'yxati (Checklist):</strong>
                      <span className="text-zinc-400 text-[12px]">
                        Vazifani bosqichlarga bo'lib, bajarilganlarini bitta bosish bilan belgilab borasiz.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai-vault' && (
              <div className="space-y-4">
                <h3 className="text-[16px] font-bold text-white">AI Yechimlar va Prompt Ombori (Vault)</h3>
                <p>
                  Ko'pincha ChatGPT yoki Claude'da uzoq bahslashib ajoyib yechim topasiz, lekin 2 kundan keyin u suhbat qayerda qolgani unutiladi. CogniDev buni to'xtatadi:
                </p>
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-violet-300 font-bold text-[13.5px]">
                    <Sparkles size={16} /> 1-Click AI Import
                  </div>
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed">
                    Tepadagi <strong>"Yangi" → "AI Import"</strong> tugmasini bosing yoki <code>{modPrefix}K</code> menyusidan tanlang. Brauzerdagi AI suhbatini nusxalab (Ctrl+C), ushbu oynaga qo'ying.
                  </p>
                  <p className="text-[12px] text-zinc-400">
                    Tizim suhbatdan <strong>kod yechimini</strong>, <strong>asosiy xulosalarni</strong> va <strong>promptni</strong> avtomatik ajratib, tegishli vazifaga biriktirib beradi!
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-4">
                <h3 className="text-[16px] font-bold text-white">Ovozli Qaydlar (Voice Memo)</h3>
                <p>
                  Klaviatura bilan yozishga vaqt bo'lmaganda yoki fikrlarni tezda qayd etish kerak bo'lganda ovozdan foydalaning:
                </p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                    <strong className="text-emerald-300 block mb-1">RubaiSTT (O'zbekcha)</strong>
                    <p className="text-[12px] text-zinc-400">
                      O'zbek tilidagi nutqni to'g'ridan-to'g'ri Apple Silicon chipida oflayn tarzda yuqori aniqlikda matnga aylantiradi.
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
                    <strong className="text-sky-300 block mb-1">Web Speech (Inglizcha)</strong>
                    <p className="text-[12px] text-zinc-400">
                      Ingliz tilidagi texnik atamalar va kod tavsiflarini jonli translatsiya qiladi.
                    </p>
                  </div>
                </div>
                <p className="text-[12px] text-zinc-500">
                  Ovoz yozilgach, <strong>"Yangi vazifa"</strong> yoki ochiq turgan vazifaning <strong>"Qaydlariga qo'shish"</strong> rejimini tanlashingiz mumkin.
                </p>
              </div>
            )}

            {activeTab === 'standup' && (
              <div className="space-y-4">
                <h3 className="text-[16px] font-bold text-white">Standup va Haftalik Tahlil (Weekly Coach)</h3>
                <p>
                  Kun oxirida yoki dushanba tongida jamoaga yoki o'zingizga hisobot tayyorlash juda oson:
                </p>
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <span className="text-white font-semibold block text-[13px]">Kunlik Standup:</span>
                    <span className="text-zinc-400 text-[12px]">
                      Sidebar yoki Command Palette orqali Standup ochiladi. AI oxirgi 24 soat ichida yopilgan vazifalar, bugungi rejalar va P0 to'siqlarni saralab hisobot tuzib beradi. Nusxalab Slack/Telegram'ga tashlash mumkin.
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <span className="text-white font-semibold block text-[13px]">Haftalik Murabbiy (Weekly Coach):</span>
                    <span className="text-zinc-400 text-[12px]">
                      Qaysi vazifalarda qotib qolganingizni, qancha ishlar kechiktirilganini va keyingi sprintda nimalarga e'tibor qaratish kerakligini tavsiya qiladi.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <h3 className="text-[16px] font-bold text-white">Klaviatura Yorliqlari (Shortcuts)</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                    <span className="text-zinc-200">Ish maydonlari o‘rtasida tezkor almashish (Dashboard, Vazifalar, Qaydlar, Roadmap, G‘oyalar, Tahlil)</span>
                    <kbd className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-amber-300">{modKey} + 1 .. 6</kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                    <span className="text-zinc-200">AI Assistant Chat paneli (yig‘ish / ochish)</span>
                    <kbd className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 font-mono text-[11px] text-purple-300">{modKey} + J</kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                    <span className="text-zinc-200">Spotlight tezkor qidiruv (Command Palette)</span>
                    <kbd className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-sky-300">{modKey} + K</kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                    <span className="text-zinc-200">Yangi muhandislik vazifasi qo‘shish</span>
                    <kbd className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-sky-300">{modKey} + N</kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                    <span className="text-zinc-200">Oynalarni yopish / Qidiruvni tozalash</span>
                    <kbd className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-zinc-400">Esc</kbd>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-3.5 bg-white/[0.01]">
            <span className="font-mono text-[11px] text-zinc-500">CogniDev v0.1.3 · macOS & Windows Engineering Cockpit</span>
            <button
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-1.5 text-[12.5px] font-semibold text-white shadow-md hover:brightness-110 transition"
            >
              Tushunarli!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
