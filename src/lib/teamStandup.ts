/**
/**
 * Team P2P Standup Cockpit & Decentralized Sync
 * Manages team member standups, focus tasks, blockers, PR review queues,
 * and AI cross-dependency synthesis without requiring heavy central servers.
 */

import { callAi } from './ai';
import type { Task, UserProfile } from './types';
import type { CloudProviderId } from './providers';

export type TeamMemberStatus = 'active' | 'in_flow' | 'blocked' | 'offline';

export interface PrReviewItem {
  id: string;
  title: string;
  url: string;
  repo?: string;
  author: string;
}

export interface TeamMemberStandup {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarInitials: string;
  role: string;
  currentStatus: TeamMemberStatus;
  moodEmoji: string;
  todayFocus: string[];
  blockers: string[];
  prReviews: PrReviewItem[];
  lastSyncedAt: string;
}

export interface TeamAiSynthesis {
  summary: string;
  activeBlockersCount: number;
  crossDependencies: string[];
  suggestedPairings: string[];
  teamVelocityInsight: string;
  synthesizedAt: string;
  aiSource?: string;
}

export interface TeamSyncChannel {
  id: string;
  name: string;
  syncMode: 'gist' | 'lan' | 'manual';
  gistId?: string;
  members: TeamMemberStandup[];
  lastSyncedAt: string;
}

const STORAGE_KEY = 'cognidev_team_standups';

export const DEFAULT_SAMPLE_MEMBERS: TeamMemberStandup[] = [
  {
    id: 'member-1',
    name: 'Farhod (Siz)',
    avatarInitials: 'F',
    role: 'Lead Fullstack & Systems',
    currentStatus: 'in_flow',
    moodEmoji: '🚀',
    todayFocus: [
      'Redis kesh va gRPC xizmati integratsiyasi',
      'Tauri 2.0 Rust native IPC optimizatsiyasi',
      'AI Rubber Duck Debugger sinovlari',
    ],
    blockers: [],
    prReviews: [
      {
        id: 'pr-104',
        title: 'feat: add distributed redis caching layer',
        url: 'https://github.com/Farhodoff/CogniDev/pull/104',
        repo: 'CogniDev',
        author: 'Farhod',
      },
    ],
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'member-2',
    name: 'Jasur Bek',
    avatarInitials: 'J',
    role: 'Frontend & UI/UX Engineer',
    currentStatus: 'blocked',
    moodEmoji: '☕️',
    todayFocus: [
      'Tailwind CSS v4 migratsiyasi',
      'Mobile responsive sidebar layout',
      'WebSockets orqali jonli audio oqimini ulash',
    ],
    blockers: [
      'Backend gRPC endpointlari protokoli tasdiqlanishi kutilmoqda (Farhodga bog‘liq)',
    ],
    prReviews: [
      {
        id: 'pr-102',
        title: 'fix: mobile drawer animation stuttering on iOS',
        url: 'https://github.com/Farhodoff/CogniDev/pull/102',
        repo: 'CogniDev',
        author: 'Jasur Bek',
      },
    ],
    lastSyncedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'member-3',
    name: 'Nilufar Rahimova',
    avatarInitials: 'N',
    role: 'DevOps & Cloud Architect',
    currentStatus: 'active',
    moodEmoji: '⚡️',
    todayFocus: [
      'GitHub Actions CI/CD universal cross-platform relizlari',
      'Docker Compose va PostgreSQL backup cron jobi',
      'Monitoring & OpenTelemetry prometheus metriklari',
    ],
    blockers: [],
    prReviews: [
      {
        id: 'pr-99',
        title: 'ci: optimize multi-arch docker builds with cache mount',
        url: 'https://github.com/Farhodoff/CogniDev/pull/99',
        repo: 'CogniDev-Infra',
        author: 'Nilufar Rahimova',
      },
    ],
    lastSyncedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
  },
];

/**
 * Load saved team members from LocalStorage with fallback to sample squad
 */
export function loadStoredTeamMembers(): TeamMemberStandup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAMPLE_MEMBERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SAMPLE_MEMBERS;
  } catch {
    return DEFAULT_SAMPLE_MEMBERS;
  }
}

/**
 * Save team members to LocalStorage
 */
export function saveStoredTeamMembers(members: TeamMemberStandup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch (err) {
    console.warn('[TeamStandup] Failed to save team members:', err);
  }
}

/**
 * Build my personal standup payload from current tasks & profile
 */
export function generateMyStandupPayload(
  userProfile: UserProfile,
  tasks: Task[] = [],
  myBlockers: string[] = []
): TeamMemberStandup {
  // Extract active & high priority focus tasks (up to 3)
  const activeFocus = tasks
    .filter((t) => t.status === 'active' || t.tags.includes('focus'))
    .slice(0, 3)
    .map((t) => t.title);

  // Extract explicit blocker tasks if any
  const blockerTasks = tasks
    .filter((t) => t.status === 'blocker' || t.priority === 'P0 Blocker')
    .map((t) => t.title);

  const combinedBlockers = Array.from(new Set([...myBlockers, ...blockerTasks]));

  // Extract PR reviews if any
  const prReviews: PrReviewItem[] = tasks
    .filter((t) => t.pr_url)
    .map((t, idx) => ({
      id: `pr-${idx}-${Date.now()}`,
      title: t.title,
      url: t.pr_url || '#',
      author: userProfile.full_name || 'Men',
    }));

  return {
    id: userProfile.id || 'my-user-id',
    name: `${userProfile.full_name || 'Farhod'} (Siz)`,
    avatarInitials: userProfile.avatar_initials || 'F',
    role: userProfile.title || 'Senior Software Engineer',
    currentStatus: combinedBlockers.length > 0 ? 'blocked' : 'in_flow',
    moodEmoji: combinedBlockers.length > 0 ? '🚧' : '🚀',
    todayFocus: activeFocus.length > 0 ? activeFocus : ['Asosiy arxitektura va kod refaktoringi'],
    blockers: combinedBlockers,
    prReviews,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Export entire team standup or single member as clean JSON string
 */
export function exportTeamStandupJson(members: TeamMemberStandup[]): string {
  return JSON.stringify(
    {
      version: '1.0',
      syncedAt: new Date().toISOString(),
      membersCount: members.length,
      members,
    },
    null,
    2
  );
}

/**
 * Import and merge team standup JSON string
 */
export function importTeamStandupJson(
  jsonText: string,
  existingMembers: TeamMemberStandup[]
): { success: boolean; members: TeamMemberStandup[]; message: string } {
  try {
    const parsed = JSON.parse(jsonText);
    const newMembers: TeamMemberStandup[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.members)
      ? parsed.members
      : null;

    if (!newMembers || newMembers.length === 0) {
      return { success: false, members: existingMembers, message: "Noto'g'ri JSON formati: a'zolar ro'yxati topilmadi." };
    }

    // Merge by id
    const memberMap = new Map<string, TeamMemberStandup>();
    existingMembers.forEach((m) => memberMap.set(m.id, m));
    newMembers.forEach((m) => memberMap.set(m.id, { ...m, lastSyncedAt: new Date().toISOString() }));

    const merged = Array.from(memberMap.values());
    saveStoredTeamMembers(merged);

    return {
      success: true,
      members: merged,
      message: `${newMembers.length} ta a'zoning standupi muvaffaqiyatli sinxronlandi!`,
    };
  } catch (err: any) {
    return {
      success: false,
      members: existingMembers,
      message: `Xatolik: JSON parse qilib bo'lmadi (${err?.message || 'xato'})`,
    };
  }
}

/**
 * AI Team Standup Synthesizer:
 * Analyzes team focus items, identifies cross-dependencies, alerts on bottlenecks,
 * and suggests optimal pairing between developers.
 */
export async function synthesizeTeamStandupsWithAi(
  members: TeamMemberStandup[],
  preferredProvider?: CloudProviderId | 'ollama'
): Promise<TeamAiSynthesis> {
  const allBlockers = members.flatMap((m) => m.blockers.map((b) => `[${m.name}]: ${b}`));

  const promptMembersText = members
    .map(
      (m) =>
        `A'zo: ${m.name} (${m.role}) - Holat: ${m.currentStatus}\n` +
        `  Bugungi Fokus:\n${m.todayFocus.map((f) => `    - ${f}`).join('\n') || '    - Aniqlanmagan'}\n` +
        `  Blockerlar: ${m.blockers.join('; ') || 'Yo‘q'}\n` +
        `  PR Review so‘rovlari: ${m.prReviews.map((p) => p.title).join(', ') || 'Yo‘q'}`
    )
    .join('\n\n');

  const systemPrompt = `Siz yuqori darajadagi dasturiy ta'minot bo'yicha Agile Tech Lead va AI Team Synthesizersiz.
Kichik IT jamoasining kundalik Daily Standup ma'lumotlarini tahlil qilib, o'zbek tilida, londa, professional va konstruktiv JSON qaytaring:

Format:
{
  "summary": "1-2 jumlada jamoaning umumiy bugungi yo'nalishi va tayyorlik darajasi",
  "activeBlockersCount": soni,
  "crossDependencies": [
    "Kim kimgadir qaram yoki bir-biriga bog'liq vazifalar ro'yxati"
  ],
  "suggestedPairings": [
    "Qaysi 2 ta dasturchi qaysi masala bo'yicha juftlikda (pair programming) ishlashi kerakligi bo'yicha tavsiya"
  ],
  "teamVelocityInsight": "Jamoa sprint tezligi va kunlik samaradorlik bo'yicha qisqa maslahat"
}

Faqat JSON qaytaring, boshqa kirish yoki xulosa so'zlar yozmang.`;

  const userPrompt = `Jamoa a'zolari standupi:\n\n${promptMembersText}`;

  try {
    const aiRes = await callAi(userPrompt, systemPrompt, preferredProvider);
    const text = aiRes.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "Jamoa bugun asosiy texnik yo'nalishlar bo'yicha faol ish olib bormoqda.",
        activeBlockersCount: parsed.activeBlockersCount ?? allBlockers.length,
        crossDependencies: Array.isArray(parsed.crossDependencies) ? parsed.crossDependencies : [],
        suggestedPairings: Array.isArray(parsed.suggestedPairings) ? parsed.suggestedPairings : [],
        teamVelocityInsight: parsed.teamVelocityInsight || "Blockerlarni kunning birinchi yarmida hal qilish tavsiya etiladi.",
        synthesizedAt: new Date().toISOString(),
        aiSource: aiRes.source,
      };
    }

    return {
      summary: text.slice(0, 180) + '...',
      activeBlockersCount: allBlockers.length,
      crossDependencies: allBlockers.length > 0 ? ['Blockerlarni zudlik bilan ko‘rib chiqish kerak.'] : [],
      suggestedPairings: ['Frontend va Backend aʼzolari API kontraktlarini erta kelishib olishi lozim.'],
      teamVelocityInsight: 'Kunlik diqqatni 3 ta asosiy vazifaga qarating.',
      synthesizedAt: new Date().toISOString(),
      aiSource: aiRes.source,
    };
  } catch (err) {
    console.warn('[TeamStandup] AI synthesis failed, using local rule-based heuristics:', err);

    const crossDeps: string[] = [];
    if (members.some((m) => m.name.toLowerCase().includes('jasur') && m.blockers.length > 0)) {
      crossDeps.push("Jasur Bek (Frontend) Farhodning gRPC backend xizmati tayyor bo‘lishiga bog‘liq.");
    }

    const pairings: string[] = [];
    if (allBlockers.length > 0) {
      pairings.push("Farhod va Jasur Bek: gRPC API protokoli va ma'lumotlar sxemasi bo‘yicha 15 daqiqalik sinxronlashuv.");
    }
    if (members.some((m) => m.prReviews.length > 0)) {
      pairings.push("Nilufar va Farhod: CI/CD Docker cache PR #99 reviewini erta yakunlash.");
    }

    return {
      summary: `Jamoada ${members.length} ta faol a'zo bor. ${allBlockers.length} ta faol blocker aniqlangan.`,
      activeBlockersCount: allBlockers.length,
      crossDependencies: crossDeps.length ? crossDeps : ['Aniq ochiq bloklanishlar yo‘q.'],
      suggestedPairings: pairings.length ? pairings : ['Har bir aʼzo o‘zining bugungi 3 ta asosiy fokusiga eʼtibor qaratishi yetarli.'],
      teamVelocityInsight: 'Kun davomida jamoaviy context-switchingni kamaytirish va blockerlarni erta echish tavsiya etiladi.',
      synthesizedAt: new Date().toISOString(),
      aiSource: 'Local Heuristics Engine',
    };
  }
}
