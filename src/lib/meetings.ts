import type { MeetingItem, MeetingAiConfig, MeetingActionItem, TaskPriority } from './types';
import { tryCloudProviders } from './providers';

export const DEFAULT_MEETINGS_AI_CONFIG: MeetingAiConfig = {
  useDedicatedKey: false,
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.0-flash',
  sttEngine: 'rubai',
  noiseSuppression: true,
  autoGainControl: true,
  echoCancellation: true,
};

const LS_CONFIG_KEY = 'cognidev.meetings.ai_config.v1';

export function getMeetingAiConfig(): MeetingAiConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_MEETINGS_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_MEETINGS_AI_CONFIG;
}

export function saveMeetingAiConfig(cfg: MeetingAiConfig): void {
  try {
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export const INITIAL_MEETINGS: MeetingItem[] = [];

export type MeetingTemplateId = 'general' | 'standup' | 'one_on_one' | 'tech_review' | 'retro_planning';

export interface MeetingTemplateOption {
  id: MeetingTemplateId;
  label: string;
  icon: string;
  badge: string;
  description: string;
  systemPromptAddition: string;
}

export const MEETING_TEMPLATES: MeetingTemplateOption[] = [
  {
    id: 'general',
    label: 'Umumiy Uchrashuv',
    icon: '🌐',
    badge: 'General',
    description: 'Biznes va umumiy jamoa uchrashuvlari, strategik kelishuvlar',
    systemPromptAddition: `Umumiy yig'ilish uslubida tahlil qiling: asosiy muhokama mavzulari, strategik xulosalar va umumiy topshiriqlarni belgilang.`,
  },
  {
    id: 'standup',
    label: 'Daily Standup / Scrum',
    icon: '⚡',
    badge: 'Standup',
    description: 'Kecha nima qilindi, bugun nima rejalashtirildi va to‘siqlar (Blockers)',
    systemPromptAddition: `Daily Standup / Scrum formati:
- Summary qismida har bir ishtirokchining bugungi rejasi va to'siqlari (blockers) haqida umumiy hisobot bering.
- decisions ga qabul qilingan reja yoki konsensuslarni yozing.
- action_items ga aynan bugun qilinadigan ishlar va to'siqlarni yechish topshiriqlarini 'P0 Blocker' yoki 'High Priority' bilan kiriting.
- key_takeaways ga eng muhim to'siqlar va e'tibor qaratilishi kerak bo'lgan masalalarni yozing.`,
  },
  {
    id: 'one_on_one',
    label: '1-on-1 Suhbat',
    icon: '👥',
    badge: '1-on-1',
    description: 'Xodim holati, motivatsiya, o‘zaro fikr-mulohaza (feedback) va rivojlanish',
    systemPromptAddition: `1-on-1 yakkama-yakka suhbat formati:
- Summary qismida xodimning kayfiyati, joriy ishlardan qoniqishi, duch kelayotgan qiyinchiliklari va maqsadlarini ifodalang.
- decisions ga ikkala tomon kelishib olgan tamoyillar va kelgusi rejani yozing.
- action_items ga xodim va rahbar bajarishi kerak bo'lgan shaxsiy va professional rivojlanish qadamlarini qo'shing.
- key_takeaways ga xodim motivatsiyasi, unga kerakli yordam va berilgan fikr-mulohazalarni (feedback) yozing.`,
  },
  {
    id: 'tech_review',
    label: 'Texnik / Architecture Review',
    icon: '🏗️',
    badge: 'Tech / ADR',
    description: 'Arxitektura qarorlari (ADR), kod tahlili, texnik qarz va tizim xavflari',
    systemPromptAddition: `Texnik arxitektura va Code Review formati (ADR uslubida):
- Summary qismida texnik muammo va tavsiya etilgan yechimlar haqida aniq muhandislik tahlilini bering.
- decisions ga qabul qilingan texnik arxitektura qarorini (Architectural Decision Record - nima sababdan tanlandi, qanday alternativalar rad etildi) yozing.
- action_items ga refaktoring, kod yozish, testlash yoki DevOps bo'yicha texnik topshiriqlarni aniq yozing.
- key_takeaways ga tizim barqarorligi, xavfsizlik, miqyoslanish (scalability) va texnik qarz xavflarini kiriting.`,
  },
  {
    id: 'retro_planning',
    label: 'Sprint Rejalashtirish & Retro',
    icon: '🎯',
    badge: 'Sprint / Retro',
    description: 'Nimalar yaxshi bo‘ldi, nimani yaxshilash kerak va keyingi sprint maqsadlari',
    systemPromptAddition: `Sprint Rejalashtirish va Retrospektiva formati:
- Summary qismida sprint natijalari, yakunlangan vazifalar va umumiy sur'at (velocity) haqida xulosa bering.
- decisions ga jamoa nimani boshlaydi (Start), nimani to'xtatadi (Stop) va nimani davom ettiradi (Continue) kabi kelishuvlarni yozing.
- action_items ga keyingi sprintga kiritiladigan ustuvor backlog vazifalarini yozing.
- key_takeaways ga retrospektivaning asosiy saboqlari va jarayonni yaxshilash g'oyalarini yozing.`,
  },
];

export function getMeetingTemplate(id?: string): MeetingTemplateOption {
  return MEETING_TEMPLATES.find((t) => t.id === id) || MEETING_TEMPLATES[0];
}

export interface MeetingAnalysisResult {
  title: string;
  summary: string;
  decisions: string[];
  action_items: MeetingActionItem[];
  key_takeaways: string[];
  providerUsed: string;
  modelUsed: string;
  templateUsed?: MeetingTemplateId;
}

/**
 * Calls Dedicated AI endpoint or system-enabled cloud provider to parse meeting transcript.
 */
export async function analyzeMeetingWithAi(
  transcript: string,
  cfgOverride?: MeetingAiConfig,
  templateId: MeetingTemplateId = 'general',
  liveNotes?: string
): Promise<MeetingAnalysisResult> {
  const cfg = cfgOverride || getMeetingAiConfig();
  const template = getMeetingTemplate(templateId);

  const systemPrompt = `Siz professional AI Meeting Assistant va kotibsiz (Notion AI uslubida).
Uchrashuv formati: ${template.label} (${template.badge}).
Maxsus ko'rsatma:
${template.systemPromptAddition}
${liveNotes?.trim() ? "\nEslatma: Foydalanuvchi uchrashuv davomida muhim kun tartibi va shaxsiy qaydlarni yozib borgan. Ushbu qaydlarni tahlilda alohida inobatga oling va vazifalar/xulosalarga qo'shing." : ""}

Quyidagi uchrashuv / yig'ilish transkriptini chuqur tahlil qiling va natijani FAQAT quyidagi JSON formatida qaytaring:

{
  "title": "Uchrashuv mavzusini ifodalovchi qisqa sarlavha",
  "summary": "Uchrashuvning asosiy mazmuni (3-4 jumla, o'zbek tilida)",
  "decisions": [
    "Qabul qilingan 1-aniq qaror",
    "Qabul qilingan 2-aniq qaror"
  ],
  "action_items": [
    {
      "text": "Bajarilishi kerak bo'lgan vazifa nomi",
      "assignee": "Mas'ul shaxs ismi (agar ma'lum bo'lsa, aks holda 'Jamoa')",
      "priority": "P0 Blocker | Critical | High Priority | Normal",
      "due_date": "Muddati (agar ma'lum bo'lsa, masalan 'Ertaga' yoki 'Juma')"
    }
  ],
  "key_takeaways": [
    "Asosiy xulosa yoki muhim fakt 1",
    "Asosiy xulosa yoki muhim fakt 2"
  ]
}

Hech qanday boshqa so'z yoki markdown belgilarisiz, toza JSON bering.`;

  let userPrompt = `Uchrashuv transkripti:\n\n${transcript}`;
  if (liveNotes?.trim()) {
    userPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━\nUchrashuv davomida yozilgan jonli qaydlar va kun tartibi:\n${liveNotes.trim()}`;
  }

  // 1. Try dedicated provider if enabled
  if (cfg.useDedicatedKey && cfg.apiKey.trim().length > 0) {
    try {
      let rawText: string | null = null;
      if (cfg.provider === 'gemini') {
        rawText = await callGeminiDirect(userPrompt, systemPrompt, cfg.apiKey.trim(), cfg.model.trim() || 'gemini-2.0-flash');
      } else if (cfg.provider === 'openai' || cfg.provider === 'deepseek' || cfg.provider === 'groq') {
        rawText = await callOpenAiCompatible(cfg.provider, userPrompt, systemPrompt, cfg.apiKey.trim(), cfg.model.trim());
      }

      if (rawText) {
        const parsed = parseMeetingJson(rawText, cfg.provider, cfg.model);
        if (parsed) return parsed;
      }
    } catch (err) {
      console.warn('[MeetingAI] Dedicated key call error, falling back:', err);
    }
  }

  // 2. Try global enabled cloud providers
  try {
    const cloudHit = await tryCloudProviders(userPrompt, systemPrompt);
    if (cloudHit?.text) {
      const parsed = parseMeetingJson(cloudHit.text, cloudHit.source, cloudHit.model);
      if (parsed) return parsed;
    }
  } catch (err) {
    console.warn('[MeetingAI] Cloud provider fallback error:', err);
  }

  // 3. Try Local Ollama if available
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      if (data?.response) {
        const parsed = parseMeetingJson(data.response, 'Ollama (Local)', 'qwen2.5:7b');
        if (parsed) return parsed;
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Smart heuristic rule-based extraction fallback
  return ruleBasedMeetingAnalysis(transcript);
}

/**
 * Ask a specific question about the meeting.
 * Evaluates in order:
 * 1. Dedicated Key (Gemini 2.0 Flash / OpenAI / Groq / DeepSeek)
 * 2. Global Cloud Providers (if enabled in settings)
 * 3. Local Ollama (if any model is running locally)
 * 4. Context-aware intelligent semantic extractor (summaries, decisions, tasks, assignees, quotes)
 */
export async function askMeetingQuestion(
  transcript: string,
  question: string,
  contextMeeting?: Partial<MeetingItem> | null,
  cfgOverride?: MeetingAiConfig
): Promise<string> {
  const cfg = cfgOverride || getMeetingAiConfig();
  const systemPrompt = `Siz uchrashuv yozuvlari bo'yicha aqlli yordamchisiz.
Quyida uchrashuv transkripti berilgan. Foydalanuvchining savoliga FAQAT shu transkript ma'lumotlariga tayanib, aniq va lo'nda o'zbek tilida javob bering.
Agar uchrashuvda bu haqida aytilmagan bo'lsa, "Uchrashuv davomida bu mavzu tilga olinmagan" deb ochiq ayting.`;

  const userPrompt = `Transkript:\n${transcript}\n\nSavol: ${question}`;

  // 1. Dedicated Key
  if (cfg.useDedicatedKey && cfg.apiKey.trim().length > 0) {
    try {
      if (cfg.provider === 'gemini') {
        const res = await callGeminiDirect(userPrompt, systemPrompt, cfg.apiKey.trim(), cfg.model.trim() || 'gemini-2.0-flash');
        if (res) return res;
      } else {
        const res = await callOpenAiCompatible(cfg.provider as any, userPrompt, systemPrompt, cfg.apiKey.trim(), cfg.model.trim());
        if (res) return res;
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Global Cloud Providers
  try {
    const cloud = await tryCloudProviders(userPrompt, systemPrompt);
    if (cloud?.text) return cloud.text;
  } catch {
    /* ignore */
  }

  // 3. Local Ollama if available
  try {
    const tagsRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (tagsRes.ok) {
      const tagsData = await tagsRes.json();
      const availableModels: string[] = (tagsData?.models ?? []).map((m: any) => m.name || m.model);
      const chosenModel = availableModels.find((m) => m.includes('qwen') || m.includes('llama') || m.includes('mistral')) || availableModels[0];
      if (chosenModel) {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: chosenModel,
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            stream: false,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (ollamaRes.ok) {
          const oData = await ollamaRes.json();
          if (oData?.response?.trim()) return oData.response.trim();
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Intelligent Context-Aware Extraction Engine (Always returns real, relevant facts)
  return smartMeetingAnswer(transcript, question, contextMeeting);
}

function smartMeetingAnswer(
  transcript: string,
  question: string,
  contextMeeting?: Partial<MeetingItem> | null
): string {
  const qClean = question.trim().toLowerCase();

  // Extract clean sentences from transcript
  const rawSentences = transcript
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim().replace(/^[-•*#\d.]+\s*/, ''))
    .filter((s) => s.length > 5);

  // A. Summary / Mazmun / Xulosa
  if (/(xulosa|mazmun|nima haqida|mavzu|summary|haqida gap|qisqacha)/i.test(qClean)) {
    if (contextMeeting?.summary && !contextMeeting.summary.includes('Uchrashuv yozib olindi')) {
      const takeaways = (contextMeeting.key_takeaways || []).map((t) => `• ${t}`).join('\n');
      return `Uchrashuvning qisqacha mazmuni:\n\n${contextMeeting.summary}${takeaways ? `\n\nAsosiy xulosalar:\n${takeaways}` : ''}`;
    }
    const keyPoints = rawSentences.slice(0, 3).map((s) => `• ${s}`).join('\n');
    return `Uchrashuvdan olingan asosiy xulosalar:\n\n${keyPoints || (transcript.length > 200 ? transcript.slice(0, 200) + '...' : transcript)}`;
  }

  // B. Decisions / Qarorlar
  if (/(qaror|kelishil|kelishuv|to'xtam|decision|natija|tanlandi)/i.test(qClean)) {
    if (contextMeeting?.decisions && contextMeeting.decisions.length > 0) {
      return `Uchrashuvda qabul qilingan qarorlar:\n\n${contextMeeting.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;
    }
    const decisionMatches = rawSentences.filter((s) =>
      /(kelishdik|qaror|to'xtaldik|tanladik|ma'qul|tasdiq|kelishuv|hal bo'ldi)/i.test(s)
    );
    if (decisionMatches.length > 0) {
      return `Uchrashuvda kelishilgan asosiy bandlar:\n\n${decisionMatches.slice(0, 5).map((d, i) => `${i + 1}. ${d}`).join('\n')}`;
    }
    return `Uchrashuv davomida alohida rasmiy qaror nomi keltirilmagan. Muhokama qilingan masalalar transkripsiyada saqlangan.`;
  }

  // C. Tasks / Action items / Assignees
  if (/(vazifa|topshiriq|kimga|mas'ul|task|assignee|kim nima|bajaradi|qilishi)/i.test(qClean)) {
    if (contextMeeting?.action_items && contextMeeting.action_items.length > 0) {
      return `Uchrashuv bo'yicha belgilangan topshiriqlar:\n\n${contextMeeting.action_items
        .map(
          (a, i) =>
            `${i + 1}. ${a.text} — Mas'ul: ${a.assignee || 'Jamoa'}${a.due_date ? ` (Muddati: ${a.due_date})` : ''}`
        )
        .join('\n')}`;
    }
    const taskMatches = rawSentences.filter((s) =>
      /(kerak|qilsin|bajarilsin|vazifa|topshiriq|yozsin|tayyorla|mas'ul)/i.test(s)
    );
    if (taskMatches.length > 0) {
      return `Transkriptdan aniqlangan harakatlar va topshiriqlar:\n\n${taskMatches.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    }
    return `Transkriptda aniq taqsimlangan topshiriqlar qayd etilmagan.`;
  }

  // D. Next Plan / Reja
  if (/(keyingi|reja|keyin nima|qadam|next|plan|muddat|qachon)/i.test(qClean)) {
    const futureMatches = rawSentences.filter((s) =>
      /(ertaga|keyin|rejada|hafta|ko'rib chiqamiz|boshlaymiz|kelasi|tayyor)/i.test(s)
    );
    if (futureMatches.length > 0) {
      return `Keyingi rejalar va kutilayotgan ishlar:\n\n${futureMatches.slice(0, 4).map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
    }
    if (contextMeeting?.action_items?.length) {
      return `Keyingi navbatda bajariladigan ishlar:\n\n${contextMeeting.action_items.map((a, i) => `${i + 1}. ${a.text}`).join('\n')}`;
    }
  }

  // E. Semantic keyword search in transcript
  const stopWords = new Set([
    'uchrashuv', 'haqida', 'nima', 'qanday', 'qachon', 'kim', 'nega', 'qaysi',
    'bilan', 'uchun', 'bo\'yicha', 'deb', 'edi', 'bor', 'yo\'q', 'kerak', 'transkript',
    'transkripsiya', 'bormi', 'ekan', 'ham', 'bu', 'shu', 'o\'sha', 'va'
  ]);
  const queryTokens = qClean
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  if (queryTokens.length > 0) {
    const scored = rawSentences.map((sent) => {
      const lower = sent.toLowerCase();
      let score = 0;
      for (const tok of queryTokens) {
        if (lower.includes(tok)) score += 1;
      }
      return { sent, score };
    }).filter((x) => x.score > 0);

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const matchedQuotes = scored.slice(0, 4).map((s) => `• "${s.sent}"`).join('\n');
      return `Transkriptdan savolingiz bo'yicha tegishli parchalar:\n\n${matchedQuotes}\n\nUchrashuvda ushbu mavzu yuzasidan yuqoridagi fikrlar bildirildi.`;
    }
  }

  // Fallback: clear and honest, referencing real context
  const sampleSentences = rawSentences.slice(0, 2).map((s) => `• ${s}`).join('\n');
  return `Transkriptda ushbu savol bo'yicha aniq ma'lumot topilmadi.\n\nUchrashuvda tilga olingan asosiy fikrlar:\n${sampleSentences || 'Transkripsiya matni mavjud.'}\n\nQisqacha xulosa yoki vazifalarni bilish uchun quyidagi tayyor tugmalardan foydalanishingiz mumkin.`;
}

/**
 * Uses AI to identify speaker turns and format the transcript with speaker tags.
 */
export async function diarizeTranscriptWithAi(
  transcript: string,
  cfgOverride?: MeetingAiConfig
): Promise<string> {
  const cfg = cfgOverride || getMeetingAiConfig();

  const systemPrompt = `Siz professional audio kotib va nutq tahlilchisi (Speech Diarization AI) mutaxassisiz.
Quyidagi uchrashuv transkriptini diqqat bilan o'rganing va gapiruvchi turli shaxslarni (spikerlarni) mantiqiy dialog ko'rinishida ajrating.
Har bir yangi spiker uchun aniq quyidagi formatda yangi qatordan yozing:
[Spiker 1]: Matn...
[Spiker 2]: Javob matni...
[Spiker 1]: Keyingi fikr...

Agar matnda gapiruvchilarning ismlari aytilgan bo'lsa (masalan: "Farhod", "Sardor", "Lola"), [Farhod], [Sardor] kabi aniq ismlardan foydalaning.
Faqat spikerlarga ajratilgan toza transkript matnini qaytaring, boshqa hech qanday izoh yoki kirish so'zi qo'shmang.`;

  const userPrompt = `Uchrashuv transkripti:\n\n${transcript}`;

  // 1. Dedicated provider if enabled
  if (cfg.useDedicatedKey && cfg.apiKey.trim().length > 0) {
    try {
      if (cfg.provider === 'gemini') {
        const res = await callGeminiDirect(userPrompt, systemPrompt, cfg.apiKey.trim(), cfg.model.trim() || 'gemini-2.0-flash');
        if (res?.trim()) return res.trim();
      } else if (cfg.provider === 'openai' || cfg.provider === 'deepseek' || cfg.provider === 'groq') {
        const res = await callOpenAiCompatible(cfg.provider, userPrompt, systemPrompt, cfg.apiKey.trim(), cfg.model.trim());
        if (res?.trim()) return res.trim();
      }
    } catch (err) {
      console.warn('[diarizeTranscriptWithAi] dedicated call failed:', err);
    }
  }

  // 2. Cloud provider fallback
  try {
    const cloudHit = await tryCloudProviders(userPrompt, systemPrompt);
    if (cloudHit?.text?.trim()) return cloudHit.text.trim();
  } catch (err) {
    console.warn('[diarizeTranscriptWithAi] cloud provider fallback failed:', err);
  }

  // 3. Fallback heuristic: alternate every 2-3 sentences between Spiker 1 and Spiker 2
  const sentences = transcript.split(/(?<=[.!?\n])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length <= 1) return `[Spiker 1]: ${transcript}`;

  let out = '';
  let currentSpeaker = 1;
  let countInTurn = 0;

  for (let i = 0; i < sentences.length; i++) {
    if (countInTurn === 0) {
      out += (out ? '\n\n' : '') + `[Spiker ${currentSpeaker}]: ${sentences[i]}`;
    } else {
      out += ' ' + sentences[i];
    }
    countInTurn++;
    if (countInTurn >= 2) {
      currentSpeaker = currentSpeaker === 1 ? 2 : 1;
      countInTurn = 0;
    }
  }

  return out;
}

/**
 * Renames a speaker tag across the entire transcript (e.g. "[Spiker 1]" -> "[Farhod]").
 */
export function renameSpeakerInTranscript(
  transcript: string,
  oldName: string,
  newName: string
): string {
  if (!oldName.trim() || !newName.trim()) return transcript;
  const cleanOld = oldName.replace(/^\[+|\]+$/g, '').trim();
  const cleanNew = newName.replace(/^\[+|\]+$/g, '').trim();
  const escaped = cleanOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\[${escaped}\\]`, 'gi');
  return transcript.replace(regex, `[${cleanNew}]`);
}

async function callGeminiDirect(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  const text = system ? `${system}\n\n${prompt}` : prompt;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts as Array<{ text?: string }> | undefined;
  return (parts ?? []).map((p) => p.text ?? '').join('').trim() || null;
}

async function callOpenAiCompatible(
  provider: 'openai' | 'deepseek' | 'groq' | string,
  prompt: string,
  system: string,
  key: string,
  model: string
): Promise<string | null> {
  const urlMap: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
  };
  const endpoint = urlMap[provider] || urlMap.openai;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

function parseMeetingJson(raw: string, provider: string, model: string): MeetingAnalysisResult | null {
  try {
    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();

    const json = JSON.parse(clean);
    return {
      title: json.title || 'Uchrashuv xulosasi',
      summary: json.summary || 'Uchrashuv tafsilotlari tahlil qilindi.',
      decisions: Array.isArray(json.decisions) ? json.decisions : [],
      action_items: Array.isArray(json.action_items)
        ? json.action_items.map((a: any, idx: number) => ({
            id: `act-${Date.now()}-${idx}`,
            text: a.text || String(a),
            assignee: a.assignee || 'Jamoa',
            priority: (a.priority as TaskPriority) || 'High Priority',
            due_date: a.due_date || undefined,
            added_to_tasks: false,
          }))
        : [],
      key_takeaways: Array.isArray(json.key_takeaways) ? json.key_takeaways : [],
      providerUsed: provider,
      modelUsed: model,
    };
  } catch {
    return null;
  }
}

function ruleBasedMeetingAnalysis(transcript: string): MeetingAnalysisResult {
  const lines = transcript
    .split(/(?<=[.!?\n])\s+/)
    .map((l) => l.trim().replace(/^[-•*#\d.]+\s*/, ''))
    .filter((l) => l.length > 6);

  const title = lines[0]?.slice(0, 45) || 'Audio Yozuv & Uchrashuv';

  // Dynamic decisions from transcript
  const decisionSentences = lines.filter((l) =>
    /(kelishdik|qaror|to'xtaldik|tanladik|ma'qul|tasdiq|kelishuv|hal bo'ldi)/i.test(l)
  );
  const decisions = decisionSentences.length > 0
    ? decisionSentences.slice(0, 3)
    : lines.slice(0, 2);

  // Dynamic action items
  const actionSentences = lines.filter((l) =>
    /(kerak|qilamiz|bajarish|yozish|tuzish|ishlash|o'rganish|sinash|vazifa|topshiriq|tayyorlash)/i.test(l)
  );
  const action_items: MeetingActionItem[] = (
    actionSentences.length > 0 ? actionSentences.slice(0, 4) : lines.slice(0, 2)
  ).map((text, idx) => ({
    id: `act-${Date.now()}-${idx}`,
    text: text.slice(0, 90),
    assignee: 'Jamoa',
    priority: idx === 0 ? 'High Priority' : 'Normal',
    added_to_tasks: false,
  }));

  const key_takeaways = lines.slice(0, 4);

  const summary = lines.length > 2
    ? lines.slice(0, 3).join('. ') + '.'
    : lines[0] || 'Uchrashuv audio transkripsiyasi saqlandi.';

  return {
    title,
    summary,
    decisions: decisions.length ? decisions : ['Kun tartibidagi masalalar muhokama qilindi.'],
    action_items: action_items.length ? action_items : [
      {
        id: `act-${Date.now()}-1`,
        text: 'Transkript matni va kelgusi qadamlarni muvofiqlashtirish',
        assignee: 'Jamoa',
        priority: 'Normal',
        added_to_tasks: false,
      },
    ],
    key_takeaways: key_takeaways.length ? key_takeaways : ['Uchrashuv transkripsiya matni saqlangan.'],
    providerUsed: 'Lokal Tahlil',
    modelUsed: 'smart-parser',
  };
}

/**
 * Exports meeting data to clean Markdown.
 */
export function exportMeetingToMarkdown(m: MeetingItem): string {
  const mins = Math.floor(m.duration / 60);
  const secs = m.duration % 60;
  const timeStr = `${mins}m ${secs}s`;

  return `# 🎙️ ${m.title}
**Sana:** ${new Date(m.date).toLocaleString('uz-UZ')}  
**Davomiyligi:** ${timeStr}  
**Teglar:** ${m.tags.map((t) => `#${t}`).join(' ')}

---

## 📌 Qisqacha Mazmun
${m.summary ?? 'Mavjud emas.'}

## 🎯 Qabul qilingan Qarorlar
${(m.decisions ?? []).map((d) => `- [x] ${d}`).join('\n') || '- Qarorlar qayd etilmagan'}

## ✅ Vazifalar va Topshiriqlar
${(m.action_items ?? []).map((a) => `- [ ] **${a.text}** — *Mas'ul:* ${a.assignee ?? 'Jamoa'} | *Muddati:* ${a.due_date ?? 'Belgilanmagan'} [${a.priority ?? 'Normal'}]`).join('\n') || '- Vazifalar yo\'q'}

## 💡 Asosiy Xulosalar
${(m.key_takeaways ?? []).map((k) => `• ${k}`).join('\n') || '- Xulosalar yo\'q'}

---

## 📑 Transkripsiya
\`\`\`
${m.transcript}
\`\`\`
`;
}

/**
 * Exports meeting data to Telegram Markdown format.
 */
export function exportMeetingToTelegram(m: MeetingItem): string {
  const mins = Math.floor((m.duration || 0) / 60);
  const secs = (m.duration || 0) % 60;
  const timeStr = `${mins > 0 ? `${mins} daq ` : ''}${secs} soniya`;
  const dateStr = new Date(m.date).toLocaleString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let out = `🎙 *${m.title}*\n`;
  out += `📅 ${dateStr} | ⏱ ${timeStr}\n`;
  if (m.tags?.length) {
    out += `${m.tags.map((t) => `#${t.replace(/\s+/g, '_')}`).join(' ')}\n`;
  }
  out += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (m.summary) {
    out += `📝 *Qisqacha mazmun:*\n${m.summary}\n\n`;
  }

  if (m.decisions?.length) {
    out += `💡 *Qabul qilingan qarorlar:*\n`;
    m.decisions.forEach((d) => {
      out += `• ${d}\n`;
    });
    out += `\n`;
  }

  if (m.action_items?.length) {
    out += `🎯 *Topshiriqlar (Action Items):*\n`;
    m.action_items.forEach((a) => {
      const status = a.completed ? '✅' : '▫️';
      const assignee = a.assignee ? ` — @${a.assignee}` : '';
      const due = a.due_date ? ` (⏰ ${a.due_date})` : '';
      const priority = a.priority && a.priority !== 'Normal' ? ` [${a.priority}]` : '';
      out += `${status} ${a.text}${assignee}${due}${priority}\n`;
    });
    out += `\n`;
  }

  if (m.key_takeaways?.length) {
    out += `📌 *Asosiy xulosalar:*\n`;
    m.key_takeaways.forEach((k) => {
      out += `• ${k}\n`;
    });
    out += `\n`;
  }

  return out.trim();
}

/**
 * Exports meeting data to Slack mrkdwn format.
 */
export function exportMeetingToSlack(m: MeetingItem): string {
  const mins = Math.floor((m.duration || 0) / 60);
  const secs = (m.duration || 0) % 60;
  const timeStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
  const dateStr = new Date(m.date).toLocaleString('uz-UZ');

  let out = `*🎙 ${m.title}*\n`;
  out += `_${dateStr} | Davomiyligi: ${timeStr}_\n\n`;

  if (m.summary) {
    out += `*📝 Qisqacha Mazmun:*\n> ${m.summary.replace(/\n/g, '\n> ')}\n\n`;
  }

  if (m.decisions?.length) {
    out += `*💡 Qabul qilingan qarorlar:*\n`;
    m.decisions.forEach((d) => {
      out += `• ${d}\n`;
    });
    out += `\n`;
  }

  if (m.action_items?.length) {
    out += `*🎯 Topshiriqlar:*\n`;
    m.action_items.forEach((a) => {
      const box = a.completed ? '[x]' : '[ ]';
      const assignee = a.assignee ? ` _(${a.assignee})_` : '';
      const due = a.due_date ? ` \`Muddat: ${a.due_date}\`` : '';
      const prio = a.priority && a.priority !== 'Normal' ? ` *${a.priority}*` : '';
      out += `• ${box} *${a.text}*${assignee}${due}${prio}\n`;
    });
    out += `\n`;
  }

  if (m.key_takeaways?.length) {
    out += `*📌 Asosiy Xulosalar:*\n`;
    m.key_takeaways.forEach((k) => {
      out += `• ${k}\n`;
    });
    out += `\n`;
  }

  return out.trim();
}

/**
 * Exports meeting data to human-readable plain text.
 */
export function exportMeetingToPlainText(m: MeetingItem): string {
  const mins = Math.floor((m.duration || 0) / 60);
  const secs = (m.duration || 0) % 60;
  const timeStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
  const dateStr = new Date(m.date).toLocaleString('uz-UZ');

  let out = `========================================\n`;
  out += `  UCHRASHUV: ${m.title.toUpperCase()}\n`;
  out += `  Sana: ${dateStr} | Davomiyligi: ${timeStr}\n`;
  out += `========================================\n\n`;

  if (m.summary) {
    out += `[QISQACHA MAZMUN]\n${m.summary}\n\n`;
  }

  if (m.decisions?.length) {
    out += `[QABUL QILINGAN QARORLAR]\n`;
    m.decisions.forEach((d, i) => {
      out += `  ${i + 1}. ${d}\n`;
    });
    out += `\n`;
  }

  if (m.action_items?.length) {
    out += `[TOPSHIRIQLAR VA VAZIFALAR]\n`;
    m.action_items.forEach((a, i) => {
      const status = a.completed ? '[BAJARILDI]' : '[KUTILMOQDA]';
      const assignee = a.assignee ? ` | Mas'ul: ${a.assignee}` : '';
      const due = a.due_date ? ` | Muddat: ${a.due_date}` : '';
      const prio = a.priority ? ` | Prioritet: ${a.priority}` : '';
      out += `  ${i + 1}. ${status} ${a.text}${assignee}${due}${prio}\n`;
    });
    out += `\n`;
  }

  if (m.key_takeaways?.length) {
    out += `[ASOSIY XULOSALAR]\n`;
    m.key_takeaways.forEach((k) => {
      out += `  • ${k}\n`;
    });
    out += `\n`;
  }

  if (m.transcript) {
    out += `----------------------------------------\n`;
    out += `[TRANSKRIPT]\n${m.transcript}\n`;
  }

  return out.trim();
}

/**
 * Helper to download text file to local filesystem.
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Text-to-Speech (TTS) reader for meeting summary using Web Speech API.
 */
export function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
): { stop: () => void } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { stop: () => {} };
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Prefer Uzbek or English voice
  const voices = window.speechSynthesis.getVoices();
  const uzVoice = voices.find((v) => v.lang.startsWith('uz') || v.lang.startsWith('tr') || v.lang.startsWith('ru'));
  if (uzVoice) utterance.voice = uzVoice;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);

  return {
    stop: () => {
      window.speechSynthesis.cancel();
      onEnd?.();
    },
  };
}
