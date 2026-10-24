import { callAi } from './ai';
import type { CloudProviderId } from './providers';
import type { Task } from './types';

export interface MorningVoiceStandupResult {
  tasks: Array<{
    title: string;
    priority: Task['priority'];
    tags: string[];
    description?: string;
  }>;
  spokenReply: string;
  rawTranscript: string;
}

export interface MiddayVoiceStandupResult {
  statusSummary: string;
  blockers: string[];
  spokenReply: string;
  rawTranscript: string;
}

export interface EveningVoiceStandupResult {
  blockerTitle: string;
  reasoning: string;
  dailyLog: {
    learned: string;
    solvedProblem: string;
    nextGoal: string;
    aiFeedback: string;
  };
  retroBlock: {
    title: string;
    content: string;
    blockersSummary: string;
  };
  spokenReply: string;
  rawTranscript: string;
}

/**
 * 🌅 10:00 Ertalabki Ovozli Standup tahlili
 * Ovozli xabarni (masalan: "Bugun Redis kesh va gRPC xizmatini yozaman")
 * tahlil qilib, to'g'ridan-to'g'ri Joriy Fokusga vazifalar sifatida ajratadi.
 */
export async function processMorningVoiceStandup(
  rawTranscript: string,
  preferredProvider?: CloudProviderId
): Promise<MorningVoiceStandupResult> {
  const clean = rawTranscript.trim();
  if (!clean) {
    return {
      tasks: [],
      spokenReply: "Ovozli xabar eshitilmadi. Iltimos, qaytadan gapirib ko'ring.",
      rawTranscript: '',
    };
  }

  const system = `Siz dasturchilar uchun ertalabki ovozli standup qabul qiluvchi aqlli tech leadsiz.
Foydalanuvchi bugun bajarmoqchi bo'lgan ishlarini ovoz bilan aytdi (masalan: "Bugun Redis kesh va gRPC xizmatini yozaman").
Vazifangiz:
1. Ushbu gapdan 1 yoki bir nechta aniq, professional dasturchi vazifalarini ajratib oling.
2. Har bir vazifaga 'focus' tegini va mos texnologiya teglarini bering (masalan: ["focus", "backend", "cache"]).
3. Prioritetni belgilang ("High Priority" yoki "Critical").
4. Foydalanuvchiga ovoz bilan aytiladigan qisqa, xushmuomala va ruhlantiruvchi tasdiq javobini (spokenReply, 1-2 jumla) tayyorlang.

JAVOBNI FAQAT STRICT JSON FORMATIDA QAYTARING (hech qanday markdown, backtick yoki izohlarsiz):
{
  "tasks": [
    {
      "title": "Redis kesh mexanizmini joriy qilish",
      "priority": "High Priority",
      "tags": ["focus", "backend"],
      "description": "Bugungi ertalabki ovozli standup orqali kiritildi."
    }
  ],
  "spokenReply": "Qabul qilindi! Redis kesh va gRPC xizmati Joriy Fokusga kiritildi. Sermahsul kun tilayman!"
}`;

  try {
    const res = await callAi(clean, system, preferredProvider);
    const m = res.text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const tasks = parsed.tasks.map((t: any) => ({
          title: String(t.title || 'Yangi fokus vazifa').trim(),
          priority: (t.priority || 'High Priority') as Task['priority'],
          tags: Array.isArray(t.tags)
            ? Array.from(new Set(['focus', ...t.tags]))
            : ['focus'],
          description: t.description || `Ovozli standupdan kiritildi: "${clean}"`,
        }));

        return {
          tasks,
          spokenReply: parsed.spokenReply || `Qabul qilindi! ${tasks.length} ta vazifa Joriy Fokusga kiritildi. Omad!`,
          rawTranscript: clean,
        };
      }
    }
  } catch (err) {
    console.warn('[processMorningVoiceStandup] AI parse failed, using smart fallback:', err);
  }

  // Deterministic smart offline fallback
  return fallbackMorningVoiceStandup(clean);
}

function fallbackMorningVoiceStandup(transcript: string): MorningVoiceStandupResult {
  let text = transcript.trim();

  // Strip common conversational prefixes/suffixes
  text = text
    .replace(/^(bugun\s+|men\s+bugun\s+|ertalab\s+|rejam\s+)/i, '')
    .replace(/(yozmoqchiman|qilmoqchiman|yozaman|bajaraman|qilaman|ishlayman|kerak)[\.\!]?$/i, '')
    .trim();

  // Split multiple tasks by 'va', 'hamda', ',', ';', 'keyin'
  const rawParts = text
    .split(/\s+(?:va|hamda|keyin|so['‘`]?ng)\s+|[;,]/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);

  const parts = rawParts.length > 0 ? rawParts : [text || transcript];

  const tasks = parts.map((part) => {
    let title = part.charAt(0).toUpperCase() + part.slice(1);
    if (!title.toLowerCase().includes('qilish') && !title.toLowerCase().includes('yozish') && !title.toLowerCase().includes('tuzish')) {
      title = `${title} ustida ishlash`;
    }

    const tags = ['focus'];
    const lower = part.toLowerCase();
    if (lower.includes('redis') || lower.includes('grpc') || lower.includes('api') || lower.includes('backend') || lower.includes('sql') || lower.includes('kesh')) {
      tags.push('backend');
    }
    if (lower.includes('ui') || lower.includes('frontend') || lower.includes('react') || lower.includes('css')) {
      tags.push('frontend');
    }

    return {
      title,
      priority: 'High Priority' as Task['priority'],
      tags,
      description: `Ovozli standup: "${transcript}"`,
    };
  });

  const taskNames = tasks.map((t) => t.title.replace(/\s+ustida ishlash$/i, '')).join(' va ');
  const spokenReply = `Qabul qilindi! ${taskNames} bugungi Joriy Fokusga muvaffaqiyatli kiritildi. Sermahsul kun tilayman!`;

  return {
    tasks,
    spokenReply,
    rawTranscript: transcript,
  };
}

/**
 * 🌙 22:00 Kechki Ovozli Standup & Xulosa tahlili
 * "Bugun nima uchun ulgurmadingiz?" savoliga foydalanuvchining javobini olib,
 * AI orqali Daily Log va Retro sahifasiga blok sifatida tayyorlaydi.
 */
export async function processEveningVoiceStandup(
  rawTranscript: string,
  incompleteTasks: Task[] = [],
  preferredProvider?: CloudProviderId
): Promise<EveningVoiceStandupResult> {
  const clean = rawTranscript.trim();
  if (!clean) {
    return {
      blockerTitle: 'Kechki tahlil',
      reasoning: 'Ovozli sabab kiritilmadi',
      dailyLog: {
        learned: 'Kunlik xulosa olingan.',
        solvedProblem: "Aniq sabab aytilmadi.",
        nextGoal: "Ertangi kun vazifalarini rejalashtirish.",
        aiFeedback: "Vazifalarni vaqtida taqsimlash tavsiya etiladi.",
      },
      retroBlock: {
        title: '🌙 22:00 Kechki Standup Xulosasi',
        content: 'Foydalanuvchi tomonidan kechki xulosa berildi.',
        blockersSummary: "To'siqlar kiritilmadi.",
      },
      spokenReply: "Ovoz eshitilmadi. Qayta urinib ko'ring.",
      rawTranscript: '',
    };
  }

  const missedTitles = incompleteTasks.slice(0, 3).map((t) => t.title).join(', ') || "rejalashtirilgan ishlar";

  const system = `Siz dasturchilar uchun kechki (22:00) retrospektiv va kun yakuni tahlilchisisiz.
Foydalanuvchidan "Bugun nima uchun ba'zi rejalarga ulgurmadingiz? Qanday to'siq yoki texnik muammo bo'ldi?" deb so'raldi.
Yakunlanmagan vazifalar: ${missedTitles}.
Foydalanuvchining ovozli javobi: "${clean}".

Vazifangiz:
1. "blockerTitle": Texnik muammoni ifodalovchi lo'nda sarlavha (3-6 so'z).
2. "dailyLog": Daily Log (Kunlik jurnal) uchun 4 ta maydon:
   - "learned": Bu vaziyatdan qanday xulosa yoki bilim olindi.
   - "solvedProblem": Duch kelingan to'siq va qilingan harakat.
   - "nextGoal": Ertangi kunga aniq maqsad (kechiktirilgan ishlarni yakunlash).
   - "aiFeedback": Tech Lead sifatida 1-2 jumlalik konstruktiv amaliy maslahat.
3. "retroBlock": Retro sahifasiga saqlanadigan blok:
   - "title": "🌙 22:00 Kechki Retro — Aniqlangan Sabab va To'siq"
   - "content": To'liq tahlil va kelgusida bunday holat takrorlanmasligi uchun amaliy tavsiya.
   - "blockersSummary": Asosiy to'siqning 1 jumlalik xulosasi.
4. "spokenReply": Foydalanuvchiga ovoz bilan aytiladigan samimiy, tushunuvchi va motivatsion javob (1-2 jumla).

JAVOBNI FAQAT STRICT JSON FORMATIDA QAYTARING:
{
  "blockerTitle": "Docker tarmoq xatosi va nosozlik",
  "reasoning": "Foydalanuvchi aytgan sababning texnik tahlili",
  "dailyLog": {
    "learned": "Konteynerlararo DNS va bridge tarmoq sozlamalari chuqurroq o'rganildi",
    "solvedProblem": "Docker tarmoq ulanishidagi nosozlik sababli 3 soat sarflandi",
    "nextGoal": "Qoldirilgan vazifalarni ertangi kunning birinchi yarmida yakunlash",
    "aiFeedback": "Infrastruktura to'siqlari vaqt olsa-da, ildiz sababni hujjatlashtirish kelgusida katta vaqtni tejaydi."
  },
  "retroBlock": {
    "title": "🌙 22:00 Kechki Retro — Sabab & To'siq",
    "content": "Bugungi kun auditi: Foydalanuvchi kechikish sababi sifatida quyidagilarni bildirdi: \\"${clean}\\". AI tavsiyasi: Ertaga diqqatni dastlab ushbu to'siqni to'liq bartaraf etishga qaratish.",
    "blockersSummary": "Docker tarmoq xatosi va texnik konfiguratsiya muammosi"
  },
  "spokenReply": "Sabab qayd etildi. Daily Log va Retro sahifangizga muammo bloki sifatida saqlandi. Maroqli dam oling!"
}`;

  try {
    const res = await callAi(clean, system, preferredProvider);
    const m = res.text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed.dailyLog && parsed.retroBlock) {
        return {
          blockerTitle: parsed.blockerTitle || 'Kechki to‘siq tahlili',
          reasoning: parsed.reasoning || clean,
          dailyLog: {
            learned: parsed.dailyLog.learned || `To‘siq sabablari tahlil qilindi: ${clean}`,
            solvedProblem: parsed.dailyLog.solvedProblem || clean,
            nextGoal: parsed.dailyLog.nextGoal || 'Kechiktirilgan vazifalarni ertaga birinchi navbatda yakunlash',
            aiFeedback: parsed.dailyLog.aiFeedback || 'To‘siqlar kelgusi tajriba uchun qimmatli bilim beradi.',
          },
          retroBlock: {
            title: parsed.retroBlock.title || '🌙 22:00 Kechki Retro — Aniqlangan Sabab va To‘siq',
            content: parsed.retroBlock.content || `Kechki audit: "${clean}". Rejalarni qayta taqsimlash tavsiya etiladi.`,
            blockersSummary: parsed.retroBlock.blockersSummary || clean,
          },
          spokenReply: parsed.spokenReply || 'Sabab qayd etildi. Daily Log va Retro sahifasiga muammo bloki sifatida saqlandi. Maroqli dam oling!',
          rawTranscript: clean,
        };
      }
    }
  } catch (err) {
    console.warn('[processEveningVoiceStandup] AI parse failed, using smart fallback:', err);
  }

  // Deterministic fallback
  return fallbackEveningVoiceStandup(clean, incompleteTasks);
}

function fallbackEveningVoiceStandup(transcript: string, incompleteTasks: Task[]): EveningVoiceStandupResult {
  const missedList = incompleteTasks.slice(0, 3).map((t) => t.title).join(', ');
  const title = transcript.length > 50 ? `${transcript.slice(0, 50)}...` : transcript;

  return {
    blockerTitle: `To'siq: ${title}`,
    reasoning: transcript,
    dailyLog: {
      learned: `Vaziyat tahlili: ${transcript}`,
      solvedProblem: `Vazifalar kechikish sababi: ${transcript}`,
      nextGoal: missedList
        ? `Qoldirilgan vazifalarni yakunlash: ${missedList}`
        : 'Ertangi kun rejasini boshlash va kechikkan ishlarni yopish',
      aiFeedback:
        "Kechikish sababini aniq ko'rish — uni kelgusida oldini olishning birinchi qadamidir. Dam oling va ertaga yangi kuch bilan start bering.",
    },
    retroBlock: {
      title: '🌙 22:00 Kechki Retro — Aniqlangan Sabab va To‘siq',
      content: `Kechki audit: "${transcript}".\n\nQoldirilgan vazifalar: ${missedList || "Umumiy maqsadlar"}.\n\nAI tavsiyasi: Ertaga 10:00 startida ushbu to'siqni birinchi bo'lib yopishni rejalashtiring.`,
      blockersSummary: transcript.slice(0, 120),
    },
    spokenReply:
      'Sabab qayd etildi. Daily Log va Retro sahifangizga muammo bloki sifatida saqlandi. Maroqli dam oling!',
    rawTranscript: transcript,
  };
}
