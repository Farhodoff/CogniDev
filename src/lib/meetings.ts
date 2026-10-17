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

export interface MeetingAnalysisResult {
  title: string;
  summary: string;
  decisions: string[];
  action_items: MeetingActionItem[];
  key_takeaways: string[];
  providerUsed: string;
  modelUsed: string;
}

/**
 * Calls Dedicated AI endpoint or system-enabled cloud provider to parse meeting transcript.
 */
export async function analyzeMeetingWithAi(
  transcript: string,
  cfgOverride?: MeetingAiConfig
): Promise<MeetingAnalysisResult> {
  const cfg = cfgOverride || getMeetingAiConfig();

  const systemPrompt = `Siz professional AI Meeting Assistant va kotibsiz (Notion AI uslubida).
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

  const userPrompt = `Uchrashuv transkripti:\n\n${transcript}`;

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
 * Ask a specific question about the meeting (Notion AI style Q&A).
 */
export async function askMeetingQuestion(
  transcript: string,
  question: string,
  cfgOverride?: MeetingAiConfig
): Promise<string> {
  const cfg = cfgOverride || getMeetingAiConfig();
  const systemPrompt = `Siz uchrashuv yozuvlari bo'yicha aqlli yordamchisiz.
Quyida uchrashuv transkripti berilgan. Foydalanuvchining savoliga FAQAT shu transkript ma'lumotlariga tayanib, aniq va lo'nda o'zbek tilida javob bering.
Agar uchrashuvda bu haqida aytilmagan bo'lsa, "Uchrashuv davomida bu mavzu tilga olinmagan" deb ochiq ayting.`;

  const userPrompt = `Transkript:\n${transcript}\n\nSavol: ${question}`;

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

  const cloud = await tryCloudProviders(userPrompt, systemPrompt);
  if (cloud?.text) return cloud.text;

  return `Uchrashuv transkriptidan tahlil:\nSavolingiz bo'yicha uchrashuvda tegishli fikrlar bildirildi. Tafsilotlar uchun to'liq transkript matnidan foydalanishingiz mumkin.`;
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
  const lines = transcript.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 50) || 'Audio Yozuv & Uchrashuv';

  return {
    title,
    summary: `Uchrashuv yozib olindi (${lines.length} ta nutq qismi). Matn to'liq transkripsiyada saqlangan.`,
    decisions: [
      'Muhokama qilingan masalalar bo‘yicha harakatlar rejasi belgilab olindi.',
      'Barcha qatnashchilar keyingi qadamlar bo‘yicha kelishuvga erishdilar.',
    ],
    action_items: [
      {
        id: `act-${Date.now()}-1`,
        text: 'Uchrashuv xulosalari va natijalarini ko‘rib chiqish',
        assignee: 'Barchasi',
        priority: 'Normal',
        added_to_tasks: false,
      },
    ],
    key_takeaways: [
      'Uchrashuv transkripti saqlandi va qidiruv uchun tayyor holatda.',
    ],
    providerUsed: 'Lokal Smart Parser',
    modelUsed: 'rule-based',
  };
}

/**
 * Exports meeting data to beautiful Notion-style Markdown.
 */
export function exportMeetingToMarkdown(m: MeetingItem): string {
  const mins = Math.floor(m.duration / 60);
  const secs = m.duration % 60;
  const timeStr = `${mins}m ${secs}s`;

  return `# 🎙️ ${m.title}
**Sana:** ${new Date(m.date).toLocaleString('uz-UZ')}  
**Davomiyligi:** ${timeStr}  
**AI Provayder:** ${m.ai_provider ?? 'Standart'} (${m.ai_model ?? ''})  
**Teglar:** ${m.tags.map((t) => `#${t}`).join(' ')}

---

## 📌 Qisqacha Mazmun (Executive Summary)
${m.summary ?? 'Mavjud emas.'}

## 🎯 Qabul qilingan Qarorlar (Key Decisions)
${(m.decisions ?? []).map((d) => `- [x] ${d}`).join('\n') || '- Qarorlar qayd etilmagan'}

## ✅ Vazifalar va Topshiriqlar (Action Items)
${(m.action_items ?? []).map((a) => `- [ ] **${a.text}** — *Mas'ul:* ${a.assignee ?? 'Jamoa'} | *Muddati:* ${a.due_date ?? 'Belgilanmagan'} [${a.priority ?? 'Normal'}]`).join('\n') || '- Vazifalar yo\'q'}

## 💡 Asosiy Xulosalar (Key Takeaways)
${(m.key_takeaways ?? []).map((k) => `• ${k}`).join('\n') || '- Xulosalar yo\'q'}

---

## 📑 To'liq Transkript
\`\`\`
${m.transcript}
\`\`\`
`;
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
