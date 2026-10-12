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


export interface ParsedAiIngestion {
  title: string;
  detectedModel: string;
  rawPrompt: string;
  problemSummary: string;
  solutionSnippet: string;
  keyLearnings: string[];
  tags: string[];
}

export function parseRawAiConversation(text: string): ParsedAiIngestion {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Model detection
  let detectedModel = 'Claude 3.5 Sonnet';
  if (lower.includes('gemini') || lower.includes('google')) detectedModel = 'Gemini 1.5 Pro';
  else if (lower.includes('gpt') || lower.includes('chatgpt') || lower.includes('openai')) detectedModel = 'ChatGPT (GPT-4o)';
  else if (lower.includes('deepseek')) detectedModel = 'DeepSeek V3';
  else if (lower.includes('llama') || lower.includes('ollama')) detectedModel = 'Ollama Local';

  // 2. Code snippet extraction
  const codeMatch = clean.match(/```(?:[a-z0-9_-]+)?\n([\s\S]*?)```/i);
  const solutionSnippet = codeMatch ? codeMatch[0] : '';

  // 3. User prompt vs Assistant response
  let rawPrompt = '';
  let problemSummary = '';

  const userMarkerMatch = clean.match(/(?:User|Human|Siz|Savol|Prompt):\s*([\s\S]*?)(?=(?:Assistant|Claude|Gemini|ChatGPT|AI|Javob):|$)/i);
  if (userMarkerMatch && userMarkerMatch[1]?.trim()) {
    rawPrompt = userMarkerMatch[1].trim();
  } else {
    // If no explicit marker, take the first 1-3 lines or up to 200 chars
    const lines = clean.split('\n').filter((l) => l.trim().length > 0);
    rawPrompt = lines.slice(0, 3).join('\n');
  }

  // 4. Title generation
  let title = '';
  const firstHeading = clean.match(/^(?:#+\s*|\*\*)([^\n*#]+)/m);
  if (firstHeading && firstHeading[1]?.trim()) {
    title = firstHeading[1].trim();
  } else {
    // Extract from prompt first sentence
    const firstSentence = rawPrompt.split(/[\n.!?]/)[0] ?? 'Yangi AI Yechimi';
    title = firstSentence.slice(0, 60).trim() || 'AI bilan topilgan yechim';
  }

  // 5. Key learnings extraction (bullet points)
  const keyLearnings: string[] = [];
  const bulletMatches = clean.matchAll(/^[*-]\s+(.+)$/gm);
  for (const m of bulletMatches) {
    if (m[1] && m[1].length < 140 && !m[1].includes('```')) {
      keyLearnings.push(m[1].trim());
    }
    if (keyLearnings.length >= 4) break;
  }
  if (keyLearnings.length === 0) {
    keyLearnings.push("AI yordamida muammo tahlil qilindi va kod tekshirildi");
    keyLearnings.push("Yechim arxitekturasi qayd etildi");
  }

  // 6. Tags
  const tags: string[] = ['#ai-synced'];
  if (detectedModel.includes('Claude')) tags.push('#claude');
  if (detectedModel.includes('Gemini')) tags.push('#gemini');
  if (detectedModel.includes('ChatGPT')) tags.push('#gpt');
  if (lower.includes('bug') || lower.includes('fix') || lower.includes('xato')) tags.push('#bugfix');
  if (lower.includes('sql') || lower.includes('db')) tags.push('#database');
  if (lower.includes('rust') || lower.includes('tauri')) tags.push('#rust');
  if (lower.includes('react') || lower.includes('ts')) tags.push('#frontend');

  problemSummary = clean.slice(0, 250);

  return {
    title,
    detectedModel,
    rawPrompt,
    problemSummary,
    solutionSnippet,
    keyLearnings,
    tags,
  };
}
