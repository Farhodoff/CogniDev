import type { Task, TaskPriority } from './types';
import { tryCloudProviders, trySingleProvider, type AiSource, type CloudProviderId } from './providers';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
// Cloud flagships first (fast fail when offline/unsigned), local 3b as offline fallback.
// NOTE: Ollama retired qwen3-coder/deepseek/kimi cloud IDs in mid-2026 — verify via /api/show.
const MODEL_CANDIDATES = ['gpt-oss:20b-cloud', 'gpt-oss:120b-cloud', 'llama3.2:3b', 'qwen2.5-coder:3b'];

export interface StandupResult {
  content: string;
  source: AiSource;
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
  return `⚠ ${blockers.length} ta to'siq aniqlandi:\n` + blockers.map((t) => `• ${t.id} [${t.priority}] ${t.title} (${t.ai_source ?? "AI yozuvi yo'q"})`).join('\n');
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

  // Chain: enabled cloud provider → local Ollama → offline template.
  const cloud = await tryCloudProviders(prompt);
  if (cloud) return { content: cloud.text, source: cloud.source, model: cloud.model };
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

export interface WeeklyCoachAi {
  bottlenecks: string[];
  recommendations: string[];
  summary: string;
  source: AiSource;
  model?: string;
}

/** AI-first weekly review: real model writes bottlenecks/recommendations/summary as JSON. */
async function tryCoachAi(
  completed: Task[],
  active: Task[],
  blockers: Task[],
  notes: Record<string, string>,
): Promise<WeeklyCoachAi | null> {
  const ctx = [
    `Bajarilgan (${completed.length}):`,
    ...completed.slice(0, 10).map((t) => `- ${t.id}: ${t.title}`),
    `Bajarilmagan/faol (${active.length}):`,
    ...active.slice(0, 10).map((t) => `- ${t.id} [${t.priority}]: ${t.title}`),
    `To'siqlar (${blockers.length}):`,
    ...blockers.map((t) => `- ${t.id}: ${t.title}`),
    'Eslatmalardan parcha:',
    Object.values(notes).join('\n').slice(0, 2000),
  ].join('\n');

  const prompt = `Sen dasturchining shaxsiy AI coachisan. Quyidagi haftalik ish ma'lumotini tahlil qilib, O'ZBEK tilida STRICT JSON qaytar (faqat JSON, boshqa matn yo'q):
{"bottlenecks": ["3 tagacha aniq to'siq"], "recommendations": ["3 tagacha amaliy tavsiya"], "summary": "2-3 gaplik samimiy xulosa: nima bajarildi, nima qoldi, nimani o'rganish kerak"}
Qamrash kerak: bajarilgan/yangi tasklar, QILINMAGAN (qoldirilgan) ishlar, hal qilingan muammolar, o'rganilgan bilimlar, keyingi hafta nimani o'rganish kerak.\n\n${ctx}`;

  const cloud = await tryCloudProviders(prompt).catch(() => null);
  const ollamaHit = cloud ? null : await tryOllama(prompt).catch(() => null);
  const text = cloud?.text ?? ollamaHit?.text;
  const source: AiSource = cloud ? cloud.source : ollamaHit ? 'ollama' : 'fallback';
  const model = cloud?.model ?? ollamaHit?.model;
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Partial<WeeklyCoachAi>;
    if (!Array.isArray(j.bottlenecks) || !Array.isArray(j.recommendations) || typeof j.summary !== 'string') return null;
    return {
      bottlenecks: j.bottlenecks.filter((s): s is string => typeof s === 'string').slice(0, 3),
      recommendations: j.recommendations.filter((s): s is string => typeof s === 'string').slice(0, 3),
      summary: j.summary.slice(0, 600),
      source,
      model,
    };
  } catch {
    return null;
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
  aiPowered: boolean;
  aiSource: AiSource;
  aiModel?: string;
}> {
  const completed = tasks.filter((t) => t.status === 'completed');
  const blockers = tasks.filter(isBlocker);
  const activeOrBacklog = tasks.filter((t) => t.status === 'active' || t.status === 'backlog');

  // Calculate deferred: active tasks that have been untouched or backlog items
  const deferredCount = Math.max(activeOrBacklog.length - 2, 0) + (tasks.length === 0 ? 0 : 1);
  const blockersCount = blockers.length;
  const completedCount = completed.length;
  const generatedAt = new Date().toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Smart path: real AI writes the narrative; counts stay local (always truthful).
  const ai = await tryCoachAi(completed, activeOrBacklog, blockers, notes);
  if (ai && (ai.bottlenecks.length || ai.recommendations.length)) {
    const { source, model, ...rest } = ai;
    return { completedCount, deferredCount, blockersCount, ...rest, generatedAt, aiPowered: true, aiSource: source, aiModel: model };
  }

  // Rule-based fallback (offline):

  // Extract bottlenecks
  const bottlenecks: string[] = [];
  const allText = tasks.map((t) => t.title).join(' ').toLowerCase() + ' ' + Object.values(notes).join(' ').toLowerCase();

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
    generatedAt,
    aiPowered: false,
    aiSource: 'fallback' as AiSource,
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

/** General-purpose AI invoker that respects preferred provider or falls back smoothly. */
export async function callAi(
  prompt: string,
  system = '',
  preferredProvider?: CloudProviderId | 'ollama',
): Promise<{ text: string; source: AiSource; model?: string }> {
  if (preferredProvider && preferredProvider !== 'ollama') {
    const hit = await trySingleProvider(preferredProvider, prompt, system);
    if (hit) return { text: hit.text, source: hit.source, model: hit.model };
  } else if (preferredProvider === 'ollama') {
    const hit = await tryOllama(system ? `${system}\n\n${prompt}` : prompt);
    if (hit) return { text: hit.text, source: 'ollama', model: hit.model };
  }

  // Fallback to active cloud providers
  const cloud = await tryCloudProviders(prompt, system);
  if (cloud) return { text: cloud.text, source: cloud.source, model: cloud.model };

  // Fallback to local Ollama
  const ollama = await tryOllama(system ? `${system}\n\n${prompt}` : prompt);
  if (ollama) return { text: ollama.text, source: 'ollama', model: ollama.model };

  return {
    text: "AI javobi olib bo'lmadi. Iltimos, Sozlamalardan (AI Provayderlar) API kalitingiz kiritilganini yoki mahalliy Ollama ishlab turganini tekshiring.",
    source: 'fallback',
  };
}

/** Breaks down a project idea into 4-6 developer tasks in Uzbek. */
export async function decomposeIdeaToTasks(
  title: string,
  stack: string,
  description: string,
  preferredProvider?: CloudProviderId,
): Promise<Array<{ title: string; priority: TaskPriority }>> {
  const system = `Siz katta dasturiy arxitektor va tech leadsiz. O'zbek tilida junior/middle dasturchi uchun loyiha g'oyasini 4-6 ta aniq, amaliy, ketma-ket bajariladigan vazifalarga (tasklarga) ajratib bering.
Har bir vazifa bitta qatorda bo'lsin.
Format:
[Prioritet] Vazifa nomi
Qayerdaki Prioritet quyidagilardan biri bo'lishi shart:
- [P0 Blocker] (arxitektura, ma'lumotlar bazasi sxemasi yoki muhim poydevor)
- [High Priority] (asosiy biznes mantiq, API yoki asosiy servis)
- [Normal] (qo'shimcha funksiyalar, testlar, optimallashtirish)

Faqat ro'yxatni qaytaring, ortiqcha kirish yoki xulosa so'zlar yozmang.`;

  const prompt = `Loyiha nomi: ${title}
Dasturlash tili / Stack: ${stack}
Tavsif / Konsept: ${description || 'Konsept belgilanmagan'}`;

  const res = await callAi(prompt, system, preferredProvider);
  const lines = res.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const tasks: Array<{ title: string; priority: TaskPriority }> = [];

  for (const line of lines) {
    const cleanLine = line.replace(/^\d+[\s.)-]+\s*/, '').replace(/^[-*]\s+/, '').trim();
    if (!cleanLine) continue;

    let priority: TaskPriority = 'Normal';
    let taskTitle = cleanLine;

    if (/\[P0 Blocker\]/i.test(cleanLine)) {
      priority = 'P0 Blocker';
      taskTitle = cleanLine.replace(/\[P0 Blocker\]/gi, '').trim();
    } else if (/\[Critical\]/i.test(cleanLine)) {
      priority = 'Critical';
      taskTitle = cleanLine.replace(/\[Critical\]/gi, '').trim();
    } else if (/\[High Priority\]/i.test(cleanLine) || /\[High\]/i.test(cleanLine)) {
      priority = 'High Priority';
      taskTitle = cleanLine.replace(/\[High Priority\]|\[High\]/gi, '').trim();
    } else if (/\[Normal\]/i.test(cleanLine)) {
      priority = 'Normal';
      taskTitle = cleanLine.replace(/\[Normal\]/gi, '').trim();
    }

    if (taskTitle.length > 3) {
      tasks.push({ title: taskTitle, priority });
    }
  }

  if (tasks.length === 0) {
    tasks.push({ title: `${stack} loyiha arxitekturasini loyihalash va bazani sozlash`, priority: 'P0 Blocker' });
    tasks.push({ title: `${title} uchun asosiy mantiq va API endpointlarni yozish`, priority: 'High Priority' });
    tasks.push({ title: `Xatoliklarni ushlash va unit testlar yozish`, priority: 'Normal' });
    tasks.push({ title: `Benchmark qilish va Docker konteyneriga o'rash`, priority: 'Normal' });
  }

  return tasks;
}

/** Provides constructive coaching and test questions for junior dev's daily study log. */
export async function analyzeLearningLog(
  learned: string,
  solvedProblem: string,
  nextGoal: string,
  preferredProvider?: CloudProviderId,
): Promise<string> {
  const system = `Siz dasturchilar uchun mehribon, tajribali Senior Mentor va Murabbiy AI'siz. Junior dasturchining kunlik o'rganish hisobotini tahlil qilasiz. O'zbek tilida, do'stona, lekin professional tilda tahlil bering:
1. Qisqa tahlil: O'rganilgan mavzuning dasturlashdagi o'rni va ahamiyati (2-3 jumla).
2. O'zlashtirishni sinash uchun 2 ta aniq, chuqur texnik savol yoki mini-kod misoli.
3. Ko'p uchraydigan tuzoqlar (Common pitfalls) — junior dasturchilar ushbu mavzuda ko'p qiladigan xato.
4. Ertangi maqsad bo'yicha amaliy maslahat.`;

  const prompt = `Bugun o'rgangani:
${learned}

Hal qilgan muammosi / xatosi:
${solvedProblem || "Ko'rsatilmagan"}

Ertangi maqsadi:
${nextGoal || "Ko'rsatilmagan"}`;

  const res = await callAi(prompt, system, preferredProvider);
  return res.text;
}

/** Enhances a Notion-style note with summaries, action items, or code review. */
export async function enhanceNoteWithAi(
  content: string,
  action: 'summarize' | 'action_items' | 'code_review' | 'format',
  preferredProvider?: CloudProviderId,
): Promise<string> {
  const prompts: Record<typeof action, { system: string; prompt: string }> = {
    summarize: {
      system: "Siz texnik hujjatlar tahlilchisisiz. Berilgan qayd matnini o'zbek tilida aniq, ixcham TL;DR va muhim xulosalarga ajratib bering.",
      prompt: `Qayd matni:\n${content}`,
    },
    action_items: {
      system: "Siz Agile tech leadsiz. Ushbu texnik qayddan amaliy dasturlash vazifalari (action items / todo checklist) ro'yxatini chiqarib bering. Har bir band '- [ ] ...' ko'rinishida bo'lsin.",
      prompt: `Qayd matni:\n${content}`,
    },
    code_review: {
      system: "Siz Senior Code Reviewer'siz. Berilgan qayddagi kod bloklari va arxitektura bo'yicha xavfsizlik, xotira, performance va toza kod (clean code) bo'yicha maslahat bering.",
      prompt: `Qayd matni:\n${content}`,
    },
    format: {
      system: "Siz Notion va Markdown bo'yicha mutaxassissiz. Matnni chiroyli Notion uslubidagi markdown sarlavhalari, calloutlari va kod bloklariga aylantirib bering.",
      prompt: `Matn:\n${content}`,
    },
  };

  const p = prompts[action];
  const res = await callAi(p.prompt, p.system, preferredProvider);
  return res.text;
}

