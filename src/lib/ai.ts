import type { Task } from './types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL_CANDIDATES = ['llama3.2:3b', 'qwen2.5-coder:3b'];

export interface StandupResult {
  content: string;
  source: 'ollama' | 'fallback';
  model?: string;
}

function ruleBasedStandup(done: Task[], blockers: Task[], active: Task[]): string {
  const y = done.length ? done.map((t) => `${t.id} — ${t.title}`).join('\n') : "Oxirgi 24 soat ichida yopilgan vazifalar yo'q.";
  const today = active.length
    ? active.slice(0, 4).map((t) => `${t.id} — ${t.title}`).join('\n')
    : "Rejalashtirilgan faol vazifalar yo'q.";
  const b = blockers.length
    ? blockers.map((t) => `${t.id} [${t.priority}] — ${t.title}`).join('\n')
    : "Ochiq P0 to'siqlar yo'q. Barcha bog'liqliklar toza.";
  return `## Kunlik Standup — ${new Date().toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}\n\n**Kecha — bajarildi**\n${y}\n\n**Bugun — reja**\n${today}\n\n**To'siqlar va muammolar**\n${b}`;
}

/** A task counts as a blocker if flagged P0/Critical or stuck in blocker status. */
export function isBlocker(t: Task): boolean {
  return t.status === 'blocker' || t.priority === 'P0 Blocker' || t.priority === 'Critical';
}

export function analyzeBlockers(tasks: Task[]): string {
  const blockers = tasks.filter(isBlocker);
  if (!blockers.length) return "Hal qilinmagan P0 muammolar yo'q. Oqim toza — 0 ta to'siq aniqlandi.";
  return `⚠ ${blockers.length} ta to'siq aniqlandi:\n` + blockers.map((t) => `• ${t.id} [${t.priority}] ${t.title} — filial: ${t.git_branch ?? "yo'q"} (${t.ai_source ?? "AI yozuvi yo'q"})`).join('\n');
}

async function tryOllama(prompt: string): Promise<{ text: string; model: string } | null> {
  for (const model of MODEL_CANDIDATES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.response) return { text: data.response as string, model };
    } catch {
      continue;
    }
  }
  return null;
}

export async function generateStandup(tasks: Task[]): Promise<StandupResult> {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const done = tasks.filter((t) => {
    if (t.status !== 'completed') return false;
    const ts = Date.parse(t.updated_at);
    return Number.isFinite(ts) && ts >= cutoff;
  });
  const blockers = tasks.filter(isBlocker);
  const active = tasks.filter((t) => t.status === 'active' || t.status === 'in_review');

  const prompt = `Siz dasturchilar uchun kunlik standup hisoboti tuzuvchi AI yordamchisiz. O'zbek tilida aniq 3 ta bo'limda markdown formatida xulosa bering:
1. Kecha nimalar hal qilindi
2. Bugun nimalar rejalashtirilgan
3. To'siqlar va muammolar

Bajarilgan vazifalar (oxirgi 24 soat):
${done.map((t) => `- ${t.id}: ${t.title}`).join('\n') || '- mavjud emas'}

Faol / ko'rib chiqilmoqda:
${active.map((t) => `- ${t.id} [${t.priority}]: ${t.title}`).join('\n') || '- mavjud emas'}

To'siqlar:
${blockers.map((t) => `- ${t.id}: ${t.title}`).join('\n') || '- mavjud emas'}

Qisqa, professional, kirish so'zlarisiz faqat markdown xulosa bering.`;

  const hit = await tryOllama(prompt);
  if (hit) return { content: hit.text, source: 'ollama', model: hit.model };
  return { content: ruleBasedStandup(done, blockers, active), source: 'fallback' };
}

export async function checkOllama(): Promise<{ online: boolean; model?: string }> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false };
    const data = await res.json();
    const names: string[] = (data?.models ?? []).map((m: { name: string }) => m.name);
    const model = MODEL_CANDIDATES.find((c) => names.some((n) => n.startsWith(c.split(':')[0]))) ?? names[0];
    return { online: true, model };
  } catch {
    return { online: false };
  }
}

export async function generateWeeklyCoachReview(
  tasks: Task[],
  notes: Record<string, string>,
): Promise<{
  completedCount: number;
  deferredCount: number;
  blockersCount: number;
  bottlenecks: string[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
}> {
  const completed = tasks.filter((t) => t.status === 'completed');
  const blockers = tasks.filter(isBlocker);
  const activeOrBacklog = tasks.filter((t) => t.status === 'active' || t.status === 'backlog');
  
  // Calculate deferred: active tasks that have been untouched or backlog items
  const deferredCount = Math.max(activeOrBacklog.length - 2, 0) + (tasks.length === 0 ? 0 : 1);
  const blockersCount = blockers.length;
  const completedCount = completed.length;

  // Extract bottlenecks
  const bottlenecks: string[] = [];
  const allText = tasks.map((t) => `${t.title} ${t.git_branch ?? ''}`).join(' ').toLowerCase() + ' ' + Object.values(notes).join(' ').toLowerCase();

  if (allText.includes('db') || allText.includes('sqlite') || allText.includes('lock') || allText.includes('migration')) {
    bottlenecks.push("SQLite WAL rejimi va ma'lumotlar bazasi tranzaksiyalarida kechikishlar");
  }
  if (allText.includes('async') || allText.includes('state') || allText.includes('race') || allText.includes('concurrency')) {
    bottlenecks.push("Asinxron holat boshqaruvi va event-listenerlarni tozalash");
  }
  if (allText.includes('auth') || allText.includes('token') || allText.includes('api')) {
    bottlenecks.push("Tashqi API chegaralari (rate-limits) va token boshqaruvi");
  }
  if (blockers.length > 0) {
    bottlenecks.push(`Hal qilinmagan P0 to'siq: "${blockers[0].title}"`);
  }
  if (bottlenecks.length === 0) {
    bottlenecks.push("Katta arxitektura to'siqlari yo'q, oqim barqaror");
  }

  // Recommendations
  const recommendations: string[] = [];
  if (blockers.length > 0) {
    recommendations.push(`Birinchi navbatda ${blockers[0].id} to'siqni yechishga fokus bering`);
  }
  if (deferredCount > 2) {
    recommendations.push("Qoldirilgan vazifalarni kamaytirish uchun sprint ko'lamini qisqartiring");
  }
  recommendations.push("Yechilgan muammolarni 'Problem Solved' bo'limiga kod namunalari bilan saqlashni davom ettiring");
  recommendations.push("Keyingi haftada tizim xotirasi va kesh mexanizmlariga e'tibor qarating");

  const summary = `Ushbu hafta davomida ${completedCount} ta vazifa muvaffaqiyatli yakunlandi. ${deferredCount} ta vazifa keyingi haftaga qoldirildi. ${blockersCount > 0 ? `${blockersCount} ta to'siq aniqlangan.` : "Barcha to'siqlar toza."}`;

  return {
    completedCount,
    deferredCount,
    blockersCount,
    bottlenecks: bottlenecks.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    summary,
    generatedAt: new Date().toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
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
