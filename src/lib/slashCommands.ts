import type { Task, AiMemoryItem } from './types';
import { firstEnabledProvider, getActiveModelOverride, setActiveModelOverride } from './providers';

export interface SlashCommandDef {
  command: string;
  label: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { command: '/model', label: '/model', description: 'AI modelini ko‘rish yoki o‘zgartirish' },
  { command: '/usage', label: '/usage', description: 'Foydalanish statistikasi va tizim holati' },
  { command: '/tasks', label: '/tasks', description: 'CogniDev faol vazifalar ro‘yxati' },
  { command: '/memory', label: '/memory', description: 'Hermes uzoq muddatli xotiralari' },
  { command: '/clear', label: '/clear', description: 'Yozishmalar tarixini tozalash' },
  { command: '/help', label: '/help', description: 'Barcha buyruqlar va qo‘llanma' },
];

export interface SlashCommandContext {
  tasks: Task[];
  memories: AiMemoryItem[];
  messagesCount: number;
  roadmapsCount: number;
  projectIdeasCount: number;
  currentUserName: string;
  onClearHistory: () => void;
  onSetModelOverride?: (model: string) => void;
}

export function isSlashCommand(text: string): boolean {
  return text.trim().startsWith('/');
}

export async function executeSlashCommand(
  rawText: string,
  context: SlashCommandContext,
): Promise<string> {
  const parts = rawText.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().replace('/', '');
  const arg = parts.slice(1).join(' ').trim();

  switch (cmd) {
    case 'start':
    case 'help': {
      return (
        `👋 *Assalomu alaykum, ${context.currentUserName}!*\n\n` +
        `Men sizning CogniDev AI Agentingizman. Hermes uzoq muddatli xotirasi va SQLite bazasi bilan ishlayman.\n\n` +
        `📌 *Mavjud buyruqlar:*\n` +
        `• \`/model\` — Joriy AI modelini ko‘rish yoki almashtirish\n` +
        `• \`/usage\` — Foydalanish statistikasi, faol vazifalar va xotira\n` +
        `• \`/tasks\` — Faol muhandislik vazifalari ro‘yxati\n` +
        `• \`/memory\` — Hermes uzoq muddatli xotira faktlari\n` +
        `• \`/clear\` — Suhbat tarixini tozalash\n` +
        `• \`/help\` — Ushbu buyruqlar ro‘yxati\n\n` +
        `💡 *Maslahat:* Oddiy xabar yozsangiz, AI to‘g‘ridan-to‘g‘ri javob beradi!`
      );
    }

    case 'model':
    case 'change_model':
    case 'changemodel': {
      const activeProvider = firstEnabledProvider();
      const override = getActiveModelOverride();
      const currentModel = override || activeProvider?.modelDefault || 'llama3.2:3b / qwen2.5-coder:3b';
      const providerName = activeProvider?.name || 'Mahalliy Ollama';

      if (arg) {
        setActiveModelOverride(arg);
        if (context.onSetModelOverride) context.onSetModelOverride(arg);
        return (
          `✅ *AI modeli muvaffaqiyatli o‘zgartirildi!*\n\n` +
          `• Yangi faol model: \`${arg}\`\n` +
          `• Provayder: ${providerName}\n\n` +
          `Endi barcha keyingi so‘rovlaringiz ushbu model orqali bajariladi.`
        );
      }

      return (
        `🤖 *AI Model & Provayder holati:*\n\n` +
        `• *Joriy faol model:* \`${currentModel}\`\n` +
        `• *Provayder:* ${providerName}\n\n` +
        `🔄 *Modelni almashtirish uchun quyidagicha yozing:*\n` +
        `• \`/model llama3.2:3b\` (Lokal tezkor)\n` +
        `• \`/model qwen2.5-coder:3b\` (Kodlash uchun)\n` +
        `• \`/model gpt-oss:20b-cloud\` (Ollama Cloud)\n` +
        `• \`/model gemini-2.5-flash\` (Google)\n` +
        `• \`/model gpt-4o-mini\` (OpenAI)\n` +
        `• \`/model deepseek-chat\` (DeepSeek)\n\n` +
        `*Misol:* \`/model llama3.2:3b\``
      );
    }

    case 'usage':
    case 'stats': {
      const activeProvider = firstEnabledProvider();
      const override = getActiveModelOverride();
      const currentModel = override || activeProvider?.modelDefault || 'llama3.2:3b';
      const activeTasks = context.tasks.filter((t) => t.status === 'active');
      const completedTasks = context.tasks.filter((t) => t.status === 'completed');
      const blockers = context.tasks.filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker');

      return (
        `📊 *CogniDev & AI Foydalanish statistikasi:*\n\n` +
        `🤖 *AI & Xotira holati:*\n` +
        `• Faol model: \`${currentModel}\`\n` +
        `• Provayder: ${activeProvider?.name || 'Mahalliy Ollama'}\n` +
        `• Saqlangan xabarlar: *${context.messagesCount} ta*\n` +
        `• Hermes xotira faktlari: *${context.memories.length} ta*\n\n` +
        `📋 *Vazifalar & Loyihalar:*\n` +
        `• Faol vazifalar: *${activeTasks.length} ta*\n` +
        `• Bajarilgan: *${completedTasks.length} ta*\n` +
        `• P0 To‘siqlar (Blockers): *${blockers.length} ta*\n` +
        `• Yo‘l xaritalari (Roadmaps): *${context.roadmapsCount} ta*\n` +
        `• Loyiha g‘oyalari: *${context.projectIdeasCount} ta*\n\n` +
        `⏱ *Sana:* ${new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
        `🟢 *Tizim:* SQLite va Telegram Bot faol`
      );
    }

    case 'tasks': {
      const active = context.tasks.filter((t) => t.status === 'active').slice(0, 10);
      if (active.length === 0) {
        return `📋 *Faol vazifalar:* Hozircha faol vazifalar yo‘q.`;
      }
      const list = active.map((t, idx) => `${idx + 1}. [${t.priority}] *${t.title}*`).join('\n');
      return `📋 *CogniDev Faol Vazifalar (${active.length} ta):*\n\n${list}`;
    }

    case 'memory': {
      if (context.memories.length === 0) {
        return `🧠 *Hermes xotirasi:* Xotiralar hali bo‘sh yoki sinxronlanmagan.`;
      }
      const list = context.memories.map((m, idx) => `${idx + 1}. [${m.category.toUpperCase()}] ${m.content}`).join('\n\n');
      return `🧠 *Hermes Uzoq Muddatli Xotiralari (${context.memories.length} ta fakt):*\n\n${list}`;
    }

    case 'clear': {
      context.onClearHistory();
      return `🧹 *Suhbatlar tarixi tozalandi!*\n\nSQLite bazasi va joriy sessiya tozalandi. Yangi savolingizni yozishingiz mumkin.`;
    }

    default:
      return (
        `❓ Noma’lum buyruq: \`/${cmd}\`\n\n` +
        `Barcha buyruqlar ro‘yxatini ko‘rish uchun \`/help\` deb yozing.`
      );
  }
}
