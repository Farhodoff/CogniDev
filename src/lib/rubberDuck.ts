/**
 * AI "Rubber Duck" Debugger & Error Explainer
 * Analyzes errors, stack traces, compiler errors, and logic bugs.
 * Identifies root causes, generates code patch diffs, and scans personal
 * second brain history to find if this problem occurred and was solved before.
 */

import { callAi } from './ai';
import type { Task, NoteDoc, LearningLog } from './types';
import type { CloudProviderId } from './providers';

export type RubberDuckMode = 'explain' | 'patch' | 'socratic' | 'security';

export interface HistoricalMatch {
  sourceType: 'task' | 'note' | 'learning_log';
  title: string;
  matchedSnippet: string;
  urlOrId: string;
  similarityScore: number;
}

export interface RubberDuckCodePatch {
  language: string;
  originalSnippet?: string;
  fixedSnippet: string;
  diffSummary: string;
}

export interface RubberDuckDiagnosticResult {
  errorType: string;
  summary: string;
  rootCause: string;
  recommendedFix: string;
  codePatch?: RubberDuckCodePatch;
  preventiveAdvice: string;
  tags: string[];
  historicalMatches: HistoricalMatch[];
  aiSource?: string;
  aiModel?: string;
}

export interface RubberDuckInput {
  errorMessage: string;
  codeSnippet?: string;
  techContext?: string;
  mode?: RubberDuckMode;
  preferredProvider?: CloudProviderId | 'ollama';
  tasks?: Task[];
  notesDocs?: NoteDoc[];
  learningLogs?: LearningLog[];
}

/**
 * Scan historical second-brain data for similar past errors
 */
export function findSimilarHistoricalErrors(
  errorText: string,
  tasks: Task[] = [],
  notesDocs: NoteDoc[] = [],
  learningLogs: LearningLog[] = []
): HistoricalMatch[] {
  if (!errorText.trim()) return [];

  const cleanQuery = errorText
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  const keywords = Array.from(new Set(cleanQuery)).slice(0, 10);
  if (!keywords.length) return [];

  const matches: HistoricalMatch[] = [];

  // 1. Search Tasks (especially completed or blockers)
  tasks.forEach((t) => {
    const text = `${t.title} ${t.tags.join(' ')}`.toLowerCase();
    const hits = keywords.filter((k) => text.includes(k));
    if (hits.length > 0) {
      matches.push({
        sourceType: 'task',
        title: t.title,
        matchedSnippet: `Vazifa holati: ${t.status} · Teglar: ${t.tags.join(', ')}`,
        urlOrId: t.id,
        similarityScore: hits.length / keywords.length,
      });
    }
  });

  // 2. Search Notion Notes
  notesDocs.forEach((n) => {
    const text = `${n.title} ${n.tags.join(' ')} ${n.content.slice(0, 300)}`.toLowerCase();
    const hits = keywords.filter((k) => text.includes(k));
    if (hits.length > 0) {
      matches.push({
        sourceType: 'note',
        title: n.title,
        matchedSnippet: n.content.slice(0, 120).replace(/[#*`]/g, '') + '...',
        urlOrId: n.id,
        similarityScore: hits.length / keywords.length,
      });
    }
  });

  // 3. Search Learning Logs (solved problems)
  learningLogs.forEach((l) => {
    const text = `${l.learned} ${l.solved_problem || ''}`.toLowerCase();
    const hits = keywords.filter((k) => text.includes(k));
    if (hits.length > 0) {
      matches.push({
        sourceType: 'learning_log',
        title: `O‘rganish kundaligi (${l.date})`,
        matchedSnippet: l.solved_problem || l.learned.slice(0, 120),
        urlOrId: l.id,
        similarityScore: hits.length / keywords.length,
      });
    }
  });

  // Sort descending by similarity score
  return matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 4);
}

/**
 * Intelligent AI Diagnostic with Rubber Duck Socratic & Patching Engine
 */
export async function diagnoseErrorWithRubberDuck({
  errorMessage,
  codeSnippet = '',
  techContext = 'Auto-detect',
  mode = 'patch',
  preferredProvider,
  tasks = [],
  notesDocs = [],
  learningLogs = [],
}: RubberDuckInput): Promise<RubberDuckDiagnosticResult> {
  const historicalMatches = findSimilarHistoricalErrors(
    errorMessage,
    tasks,
    notesDocs,
    learningLogs
  );

  const historyContextText = historicalMatches.length
    ? `\nO'tmishda foydalanuvchi hal qilgan o'xshash xatolar:\n` +
      historicalMatches
        .map((m) => `- [${m.sourceType.toUpperCase()}] "${m.title}": ${m.matchedSnippet}`)
        .join('\n')
    : '';

  const systemPrompt = `Siz professional dasturiy ta'minot muhandisi va o'ta zukko "AI Rubber Duck" (Rezina o'rdak) debaggerisiz.
Dasturchi sizga kod xatoligi (stack trace, runtime error, Rust borrow checker, TypeScript types, Go panic, Docker/CORS xatolik) haqida ma'lumot beradi.

Vazifangiz o'zbek tilida, texnik jihatdan eng aniq va amaliy tarzda tahlil qilib, quyidagi formatda JSON qaytarish:
{
  "errorType": "Xatolikning qisqa texnik nomi (masalan: NullPointerException, CORS Policy Disallow, Rust Lifetime Borrow, TypeScript Type Mismatch)",
  "summary": "1-2 jumlada nima ro'y bergani",
  "rootCause": "Xatolikning asl kelib chiqish tub sababi (oddiy, londa va tushunarli tilda)",
  "recommendedFix": "Qadamma-qadam to'g'rilash ko'rsatmasi",
  "codePatch": {
    "language": "typescript / rust / go / python / bash / etc",
    "originalSnippet": "xatoli kod qismi (agar mavjud bo'lsa)",
    "fixedSnippet": "to'g'rilangan aniq kod",
    "diffSummary": "kodda nima o'zgargani haqida qisqa izoh"
  },
  "preventiveAdvice": "Kelgusida bunday xatoni oldini olish uchun eng yaxshi amaliyot (Best Practice)",
  "tags": ["tag1", "tag2", "tag3"]
}

Rejim: ${mode}
${mode === 'socratic' ? 'Eslatma: Sokratik rejimdasiz. Yechim berish bilan birga, dasturchini to‘g‘ri fikrlashga undovchi 1 ta o‘rinli savol qoldiring.' : ''}
Faqat JSON qaytaring, boshqa ortiqcha matn yozmang.`;

  const userPrompt = `Texnologiya konteksti: ${techContext}
Xatolik / Stack Trace:
\`\`\`
${errorMessage}
\`\`\`

${codeSnippet.trim() ? `Tegishli kod qismi:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}
${historyContextText}`;

  try {
    const aiResponse = await callAi(userPrompt, systemPrompt, preferredProvider);
    const text = aiResponse.text.trim();

    // Extract JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        errorType: parsed.errorType || 'Aniqlangan Xatolik',
        summary: parsed.summary || 'Xatolik tahlili tayyor.',
        rootCause: parsed.rootCause || 'Koddagi parametr yoki ulanish uzilishi.',
        recommendedFix: parsed.recommendedFix || 'Tegishli parametrni tekshirib qayta ishga tushiring.',
        codePatch: parsed.codePatch
          ? {
              language: parsed.codePatch.language || 'typescript',
              originalSnippet: parsed.codePatch.originalSnippet || codeSnippet,
              fixedSnippet: parsed.codePatch.fixedSnippet || codeSnippet,
              diffSummary: parsed.codePatch.diffSummary || 'Xatolik to‘g‘rilandi.',
            }
          : undefined,
        preventiveAdvice: parsed.preventiveAdvice || 'Kodni yozishdan oldin tiplarni qatʼiy tekshiring.',
        tags: parsed.tags || ['bugfix', 'debugging'],
        historicalMatches,
        aiSource: aiResponse.source,
        aiModel: aiResponse.model,
      };
    }

    // Fallback if AI didn't output pure JSON
    return {
      errorType: 'AI Tahlil Xulosasi',
      summary: text.slice(0, 160) + '...',
      rootCause: text.slice(0, 300),
      recommendedFix: text,
      codePatch: codeSnippet.trim()
        ? {
            language: 'typescript',
            fixedSnippet: codeSnippet,
            diffSummary: 'Tavsiya etilgan tuzatish.',
          }
        : undefined,
      preventiveAdvice: 'Unit testlar yozish va xatoliklarni oldindan tutish tavsiya etiladi.',
      tags: ['debugging', 'patch'],
      historicalMatches,
      aiSource: aiResponse.source,
      aiModel: aiResponse.model,
    };
  } catch (err) {
    console.warn('[RubberDuck] AI call error, generating offline heuristic analysis:', err);

    // High quality offline fallback
    const inferredType = errorMessage.toLowerCase().includes('null') || errorMessage.toLowerCase().includes('undefined')
      ? 'Null / Undefined Pointer Xatoligi'
      : errorMessage.toLowerCase().includes('cors')
      ? 'CORS Xavfsizlik Siyosati Xatosi'
      : errorMessage.toLowerCase().includes('borrow') || errorMessage.toLowerCase().includes('lifetime')
      ? 'Rust Borrow Checker & Xotira Bog‘lanishi'
      : 'Runtime / Compiler Istisnosi';

    return {
      errorType: inferredType,
      summary: `Xatolik matnidan kelib chiqib birlamchi tahlil o‘tkazildi: ${inferredType}`,
      rootCause: `Xatolik obʼyektning kutilmagan holatda bo‘lishi yoki ruxsat etilmagan resursga murojaat qilishdan kelib chiqqan.`,
      recommendedFix: `1. O‘zgaruvchining qiymatini null/undefined ga tekshiring (optional chaining ?.).\n2. Loglarni va stack trace ko‘rsatgan qatorni qayta ko‘rib chiqing.`,
      codePatch: codeSnippet.trim()
        ? {
            language: 'typescript',
            originalSnippet: codeSnippet,
            fixedSnippet: `// Tekshiruv bilan himoyalangan kod:\nif (data) {\n  ${codeSnippet.trim()}\n}`,
            diffSummary: 'Null-safe tekshiruv qo‘shildi.',
          }
        : undefined,
      preventiveAdvice: 'TypeScript strict rejimini yoqish yoki mudofaa dasturlash (defensive coding) qoidalariga rioya qilish.',
      tags: ['offline-diagnostic', 'safe-check'],
      historicalMatches,
      aiSource: 'fallback',
    };
  }
}
