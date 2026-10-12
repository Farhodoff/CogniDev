/**
 * Jev (TypeSafe System One) — matn YOZMAYDIGAN qaror modeli.
 * Vazifalarni klassifikatsiya / skorlash / triage qilish uchun:
 * state + typed questions → structured answers + confidence.
 * Docs: https://docs.typesafe.ai · Key: https://console.typesafe.ai/keys
 */
import type { Task } from './types';

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const LS_KEY = 'cognidev.ai.jev.v1';

export function getJevKey(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setJevKey(key: string) {
  try {
    localStorage.setItem(LS_KEY, key);
  } catch {
    /* ignore */
  }
}

export type JevQuestionType = 'noul' | 'choice' | 'score';

export interface JevQuestion {
  type: JevQuestionType;
  instructions: string;
  criteria?: Record<string, string> | string[];
}

interface JevAnswer {
  type: string;
  choice?: string;
  score?: number;
  noul?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
}

interface JevResponse {
  model?: string;
  answers?: Record<string, JevAnswer>;
  error?: string;
}

/** Single SystemOne call: state + N questions evaluated in parallel. */
export async function jevDecide(
  state: string,
  questions: Record<string, JevQuestion>,
  apiKey?: string,
  model = 'jev-latest',
): Promise<Record<string, JevAnswer>> {
  const key = (apiKey ?? getJevKey()).trim();
  if (!key) throw new Error('Jev API kaliti kiritilmagan');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(JEV_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ state, model, questions }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Jev xatosi: HTTP ${res.status}`);
    const data = (await res.json()) as JevResponse;
    if (data.error) throw new Error(`Jev xatosi: ${data.error}`);
    return data.answers ?? {};
  } finally {
    clearTimeout(timer);
  }
}

export interface JevTriageItem {
  taskId: string;
  title: string;
  isBlocker: number;
  priority: string;
  priorityConf: number;
  urgency: number;
}

function taskState(t: Task): string {
  return `${t.id}: ${t.title} [status=${t.status}, priority=${t.priority}]`;
}

/** Triage one task: blocker? priority? urgency? — one API call, 3 questions. */
export async function jevTriageOne(t: Task, apiKey: string): Promise<JevTriageItem> {
  const answers = await jevDecide(
    taskState(t),
    {
      is_blocker: { type: 'noul', instructions: 'This task is blocked or blocks other work and needs immediate attention' },
      priority: {
        type: 'choice',
        instructions: 'What priority fits this engineering task',
        criteria: {
          'P0 Blocker': 'Production down or hard-blocked work',
          Critical: 'Serious risk, fix within a day',
          'High Priority': 'Important, fix this sprint',
          Normal: 'Routine work',
        },
      },
      urgency: {
        type: 'score',
        instructions: 'How urgent this task is right now',
        criteria: ['Not urgent', 'Should be handled soon', 'Drop everything, handle now'],
      },
    },
    apiKey,
  );
  const pri = answers.priority;
  return {
    taskId: t.id,
    title: t.title,
    isBlocker: answers.is_blocker?.noul ?? 0,
    priority: pri?.choice ?? t.priority,
    priorityConf: pri?.confidence ?? 0,
    urgency: answers.urgency?.score ?? 0,
  };
}

/** Triage open tasks with limited concurrency. Throws on failure (caller falls back). */
export async function jevTriage(tasks: Task[], apiKey?: string): Promise<JevTriageItem[]> {
  const key = (apiKey ?? getJevKey()).trim();
  if (!key) throw new Error('Jev API kaliti kiritilmagan');
  const open = tasks.filter((t) => t.status !== 'completed').slice(0, 12);
  const out: JevTriageItem[] = [];
  const CONC = 4;
  for (let i = 0; i < open.length; i += CONC) {
    const batch = await Promise.all(open.slice(i, i + CONC).map((t) => jevTriageOne(t, key).catch(() => null)));
    for (const r of batch) if (r) out.push(r);
  }
  return out.sort((a, b) => b.isBlocker * 2 + b.urgency - (a.isBlocker * 2 + a.urgency));
}

/** Render triage as markdown for the analysis modal. */
export function triageToMarkdown(items: JevTriageItem[]): string {
  const hot = items.filter((r) => r.isBlocker > 0.6 || r.urgency >= 1.5);
  if (!hot.length) return '\n\n**Jev triage:** yuqori xavfli vazifa topilmadi — oqim barqaror.';
  const lines = hot.map((r) => {
    const conf = Math.round((r.priorityConf || r.isBlocker) * 100);
    return `• ${r.taskId} → **${r.priority}** (${conf}% ishonch) — ${r.title}`;
  });
  return `\n\n**Jev triage (System One, ishonch bilan):**\n${lines.join('\n')}`;
}

export async function testJev(): Promise<{ ok: boolean; detail: string }> {
  const key = getJevKey().trim();
  if (!key) return { ok: false, detail: 'API kalit kiritilmagan' };
  try {
    const a = await jevDecide('DEV-1: test task [status=active, priority=Normal]', {
      is_blocker: { type: 'noul', instructions: 'This task is blocked' },
    });
    return typeof a.is_blocker?.noul === 'number'
      ? { ok: true, detail: 'Ulandi ✓ (jev-latest)' }
      : { ok: false, detail: 'Kutilmagan javob formati' };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Ulanmadi' };
  }
}
