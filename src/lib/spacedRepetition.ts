import type { FlashcardItem } from './types';
import { callAi } from './ai';
import type { CloudProviderId } from './providers';

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm.
 * Rating:
 * 1 = Qiyin (Again) - Review again tomorrow (1 day)
 * 2 = Yaxshi (Good) - Normal spaced progression
 * 3 = Oson (Easy) - Fast progression (longer interval)
 */
export function calculateNextReview(
  card: FlashcardItem,
  rating: 1 | 2 | 3,
  reviewDate: Date = new Date()
): {
  next_review_date: string;
  interval_days: number;
  repetition_count: number;
  ease_factor: number;
} {
  let interval = card.interval_days || 1;
  let repetition = card.repetition_count || 0;
  let ease = card.ease_factor || 2.5;

  if (rating === 1) {
    // Qiyin / Hard: reset interval back to 1 day
    interval = 1;
    repetition = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === 2) {
    // Yaxshi / Good
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * ease);
    }
    repetition += 1;
  } else if (rating === 3) {
    // Oson / Easy: bonus interval
    if (repetition === 0) {
      interval = 2;
    } else if (repetition === 1) {
      interval = 5;
    } else {
      interval = Math.round(interval * ease * 1.3);
    }
    repetition += 1;
    ease = Math.min(3.0, ease + 0.15);
  }

  // Calculate target date
  const nextDate = new Date(reviewDate);
  nextDate.setDate(nextDate.getDate() + interval);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  return {
    next_review_date: nextDateStr,
    interval_days: interval,
    repetition_count: repetition,
    ease_factor: Number(ease.toFixed(2)),
  };
}

/**
 * Returns cards that are due for review today or overdue.
 */
export function getDueFlashcards(cards: FlashcardItem[], targetDate: Date = new Date()): FlashcardItem[] {
  const todayStr = targetDate.toISOString().split('T')[0];
  return cards.filter((card) => card.next_review_date <= todayStr);
}

export interface GeneratedFlashcardDraft {
  topic_title: string;
  question: string;
  answer: string;
  explanation: string;
  code_snippet?: string;
}

/**
 * Generates 2-3 high-yield developer flashcards for a specific topic using AI.
 */
export async function generateFlashcardsWithAi(
  topicTitle: string,
  roadmapTitle = 'Dasturchi Yo‘l Xaritasi',
  stack = 'Backend / Software Engineering',
  provider?: CloudProviderId
): Promise<GeneratedFlashcardDraft[]> {
  const systemPrompt = `Siz professional Senior Software Engineer va texnik o'qituvchisiz.
Berilgan dasturlash mavzusi bo'yicha junior/middle dasturchining bilimini mustahkamlash uchun 2 yoki 3 ta sifatli texnik savol-javob (Spaced Repetition Flashcard) tuzing.

SAVOLLARNING USLUBI:
1. Shunchaki "Bu nima?" degan umumiy savol emas, balki real dasturlash amaliyoti, ishlash mexanizmi, qanday xatolar kelib chiqishi yoki arxitektura bo'yicha chuqur savol bo'lsin.
2. Aniq va lo'nda javob (1-3 jumla).
3. Kerak bo'lsa qisqa (2-5 qatorli) kod namunasi (code_snippet).
4. O'zbek tilida yozing.

JAVOB FORMATI:
Faqat va faqat toza JSON massiv (Array) qaytaring, boshqa hech qanday so'z yoki markdown bloklari yozmang:
[
  {
    "question": "...",
    "answer": "...",
    "explanation": "...",
    "code_snippet": "..."
  }
]`;

  const userPrompt = `Yo'l xaritasi: ${roadmapTitle}
Texnologiya steki: ${stack}
Mavzu: ${topicTitle}`;

  try {
    const res = await callAi(userPrompt, systemPrompt, provider);
    const text = res.text.trim();

    // Clean JSON markdown code blocks if wrapped
    const cleanJson = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => ({
        topic_title: topicTitle,
        question: String(item.question || topicTitle),
        answer: String(item.answer || ''),
        explanation: String(item.explanation || ''),
        code_snippet: item.code_snippet ? String(item.code_snippet) : undefined,
      }));
    }
  } catch (err) {
    console.warn('[Flashcards] AI generation fallback:', err);
  }

  // Robust analytical fallback cards if offline
  return [
    {
      topic_title: topicTitle,
      question: `"${topicTitle}" texnologiyasi qanday asosiy muammoni hal qiladi va uning ichki ishlash printsipi nima?`,
      answer: `${topicTitle} tizimning samaradorligi va arxitekturaviy barqarorligini ta'minlash uchun xizmat qiladi.`,
      explanation: `Dasturlashda bu tushunchani bilish xotira va asinxron resurslarni to'g'ri taqsimlashda muhim hisoblanadi.`,
      code_snippet: `// Misol: ${topicTitle}\n// Resurslarni to'g'ri boshqarish va xatolarni ushlash`,
    },
    {
      topic_title: topicTitle,
      question: `"${topicTitle}" bilan ishlashda junior dasturchilar eng ko'p yo'l qo'yadigan 2 ta xato nima?`,
      answer: `Ko'p uchraydigan xatolar: Resurslarni (ulanishlarni) vaqtida yopmaslik va xatoliklar (error handling)ni e'tiborsiz qoldirish.`,
      explanation: `Production muhitda bu keshning to'lib ketishiga yoki memory leak'ka olib keladi.`,
    },
  ];
}

export interface CuratedTopicResource {
  title: string;
  type: 'doc' | 'repo' | 'guide';
  url: string;
  description: string;
}

/**
 * Returns curated high-quality documentation links and references for a topic.
 */
export async function getCuratedTopicResources(
  topicTitle: string,
  stack = 'Backend'
): Promise<CuratedTopicResource[]> {
  const safeQuery = encodeURIComponent(`${topicTitle} ${stack}`);
  return [
    {
      title: `${topicTitle} — Rasmiy Dokumentatsiya`,
      type: 'doc',
      url: `https://devdocs.io/#q=${safeQuery}`,
      description: `Rasmiy API spetsifikatsiyasi va to'liq ma'lumotnoma`,
    },
    {
      title: `${topicTitle} — GitHub Eng Sara Namunalar`,
      type: 'repo',
      url: `https://github.com/search?q=${safeQuery}&type=repositories`,
      description: `Ochiq kodli loyihalar va amaliy arxitektura namunalari`,
    },
    {
      title: `${topicTitle} — Amaliy Cheat Sheet`,
      type: 'guide',
      url: `https://duckduckgo.com/?q=!ducky+cheat+sheet+${safeQuery}`,
      description: `Tezkor kod sintaksisi va eng muhim metodlar jamlanmasi`,
    },
  ];
}
