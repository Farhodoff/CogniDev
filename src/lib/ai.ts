import type { Task } from './types';

export function isBlocker(t: Task): boolean {
  return t.status === 'blocker' || t.priority === 'P0 Blocker' || t.priority === 'Critical';
}

export function analyzeBlockers(tasks: Task[]): string {
  const blockers = tasks.filter(isBlocker);
  if (blockers.length === 0) return "Faol blockerlar yo'q.";
  return blockers.map((b) => `- ${b.id}: ${b.title} (${b.priority})`).join('\n');
}

export function taskText(t: Task): string {
  return `${t.id} [${t.status}] ${t.title} (${t.priority})`;
}

export async function generateStandup(tasks: Task[]): Promise<{
  content: string;
  source: 'ollama' | 'fallback';
  model: string;
}> {
  const active = tasks.filter((t) => t.status === 'active' || t.status === 'in_review');
  const done = tasks.filter((t) => t.status === 'completed');
  const blockers = tasks.filter(isBlocker);

  const lines: string[] = [
    `# Kunlik Muhandislik Standupi — ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## 1. Kecha nimalar qilindi?',
    done.length === 0 ? '- Hozircha bajarilgan vazifalar qayd etilmagan.' : done.map((t) => `- ${taskText(t)}`).join('\n'),
    '',
    '## 2. Bugun nimalar rejalashtirilmoqda?',
    active.length === 0 ? '- Faol vazifalar roʻyxati boʻsh.' : active.map((t) => `- ${taskText(t)}`).join('\n'),
    '',
    '## 3. Toʻsiqlar (Blockers)',
    blockers.length === 0 ? '- Bloklovchi omillar mavjud emas.' : blockers.map((t) => `- ⚠️ ${taskText(t)}`).join('\n'),
  ];

  return {
    content: lines.join('\n'),
    source: 'fallback',
    model: 'built-in engine',
  };
}
