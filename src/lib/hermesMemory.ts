import { fetchMemories, upsertMemory } from './db';
import type { AiMemoryItem } from './types';

/**
 * Curated seed memories extracted from Hermes Agent (~/.hermes/memories/USER.md & MEMORY.md).
 * These ensure CogniDev has rich, persistent context about the developer at all times.
 */
export const HERMES_BASE_MEMORIES: Array<{
  id: string;
  category: AiMemoryItem['category'];
  content: string;
}> = [
  {
    id: 'hermes-mem-backend-stack',
    category: 'tech_stack',
    content: 'Foydalanuvchi Backend yo‘nalishida Go va Java (Spring Boot), AWS bulut xizmatlari hamda Microservices arxitekturasiga e’tibor qaratmoqda.',
  },
  {
    id: 'hermes-mem-frontend-stack',
    category: 'tech_stack',
    content: 'Frontend yo‘nalishida Vue 3, React va TypeScript texnologiyalarini o‘rganmoqda.',
  },
  {
    id: 'hermes-mem-career-goals',
    category: 'goals',
    content: 'Asosiy maqsad: Yaponiya IT bozorida ishlash hamda Nova Renessans kompaniyasining Frontend Internship dasturiga muvaffaqiyatli tayyorlanish.',
  },
  {
    id: 'hermes-mem-engineering-standards',
    category: 'preferences',
    content: 'Muhandislik standartlariga qattiq rioya qiladi: Clean Code amaliyotlari, FSD (Feature-Sliced Design), System Design va Cloud-Native arxitektura.',
  },
  {
    id: 'hermes-mem-learning-style',
    category: 'preferences',
    content: 'Mentorlik uslubidagi o‘qitishni afzal ko‘radi: Nazariya ➔ Amaliyot ➔ Amaliy vazifa ➔ Tekshiruv. Sodda tutoriallar o‘rniga chuqur, professional darajadagi tushuntirishlarni xohlaydi.',
  },
  {
    id: 'hermes-mem-js-deep-dive',
    category: 'tech_stack',
    content: 'JavaScript fundamental bilimlarini (OOP, obyektlar, prototiplar, ES6+ xususiyatlari) chuqur o‘rganish ustida ishlamoqda.',
  },
  {
    id: 'hermes-mem-mini-drones',
    category: 'general',
    content: 'Mini-dronlar yasash, elektron qismlari va apparat (hardware) tuzilmasiga katta qiziqish bildiradi.',
  },
  {
    id: 'hermes-mem-yandex-dev-camp',
    category: 'goals',
    content: 'Yandex Uzbekistan Dev Camp (Backend, AI va Algoritmlar) yo‘nalishiga qiziqadi.',
  },
  {
    id: 'hermes-mem-ollama-local-models',
    category: 'tech_stack',
    content: 'Ollama orqali lokal AI modellari (qwen3:4b, llama3.2, gpt-oss) bilan terminalda ishlash tajribasiga ega.',
  },
];

/**
 * Syncs Hermes memories into CogniDev SQLite database (synapse.db).
 * Idempotent: upserts memories so they are never lost across restarts.
 */
export async function syncHermesMemoriesToDb(): Promise<AiMemoryItem[]> {
  try {
    const existing = await fetchMemories();
    const existingIds = new Set(existing.map((m) => m.id));

    for (const mem of HERMES_BASE_MEMORIES) {
      if (!existingIds.has(mem.id)) {
        await upsertMemory({
          id: mem.id,
          category: mem.category,
          content: mem.content,
          source: 'hermes_import',
        });
      }
    }

    return await fetchMemories();
  } catch (err) {
    console.warn('[hermesMemory] Failed to sync memories into SQLite:', err);
    return [];
  }
}

/**
 * Formats active memories into a compact markdown block for AI System Prompts.
 */
export function formatMemoriesForPrompt(memories: AiMemoryItem[]): string {
  if (!memories.length) return '';

  const grouped = memories.reduce<Record<string, string[]>>((acc, item) => {
    const cat = item.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item.content);
    return acc;
  }, {});

  const lines: string[] = ['### Foydalanuvchi haqidagi uzoq muddatli xotiralar (Hermes Memory):'];
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`- **[${cat.toUpperCase()}]:**`);
    items.forEach((it) => lines.push(`  • ${it}`));
  }

  return lines.join('\n');
}
