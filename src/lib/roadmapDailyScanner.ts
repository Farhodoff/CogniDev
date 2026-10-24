import type { RoadmapItem, Task } from './types';

export interface DailyRoadmapGoal {
  roadmapId: string;
  roadmapTitle: string;
  roadmapStack: string;
  milestoneId: string;
  milestoneTitle: string;
  topicId: string;
  topicTitle: string;
  done: boolean;
  matchedDateText?: string;
  isDateMatched: boolean;
}

/**
 * Extracts month names in Uzbek and Russian for date matching
 */
const MONTH_NAMES_UZ = [
  ['yanvar', 'yan'],
  ['fevral', 'fev'],
  ['mart', 'mar'],
  ['aprel', 'apr'],
  ['may', 'may'],
  ['iyun', 'iyn'],
  ['iyul', 'iyl'],
  ['avgust', 'avg'],
  ['sentabr', 'sent', 'sentyabr'],
  ['oktabr', 'okt', 'oktyabr'],
  ['noyabr', 'noy'],
  ['dekabr', 'dek'],
];

/**
 * Checks if a given text string matches a target date.
 * Supports:
 * - "2026-10-24", "2026/10/24"
 * - "24.10", "24.10.2026", "24/10"
 * - "24-oktabr", "24-oktyabr", "24 oktabr", "24 oktyabr"
 * - "24-sana", "24-kun", "Kun 24", "Day 24", "24th"
 */
export function matchesDateInText(text: string, targetDate: Date = new Date()): { matched: boolean; matchSnippet?: string } {
  if (!text) return { matched: false };
  const lower = text.toLowerCase();

  const day = targetDate.getDate();
  const month = targetDate.getMonth() + 1; // 1-indexed
  const year = targetDate.getFullYear();

  const dayPadded = String(day).padStart(2, '0');
  const monthPadded = String(month).padStart(2, '0');
  const yearStr = String(year);
  const shortYear = String(year).slice(-2); // "26"

  // 1. ISO style: 2026-10-24 or 2026/10/24 or 26-10-24
  const isoPattern = new RegExp(`(?:${yearStr}|${shortYear})[-/.](?:${month}|${monthPadded})[-/.](?:${day}|${dayPadded})\\b`);
  const isoMatch = lower.match(isoPattern);
  if (isoMatch) return { matched: true, matchSnippet: isoMatch[0] };

  // 2. European style: 24.10.2026 or 24.10 or 24/10/2026
  const euroPattern = new RegExp(`\\b(?:${day}|${dayPadded})[./-](?:${month}|${monthPadded})(?:[./-](?:${yearStr}|${shortYear}))?\\b`);
  const euroMatch = lower.match(euroPattern);
  if (euroMatch) return { matched: true, matchSnippet: euroMatch[0] };

  // 3. Named month in Uzbek/Russian: "24-oktabr", "24 oktyabr", "24 okt"
  const monthKeywords = MONTH_NAMES_UZ[month - 1] || [];
  for (const mWord of monthKeywords) {
    const namedPattern = new RegExp(`\\b(?:${day}|${dayPadded})[- ]?${mWord}\\b`);
    const namedMatch = lower.match(namedPattern);
    if (namedMatch) return { matched: true, matchSnippet: namedMatch[0] };
  }

  // 4. Day / Sana keywords: "24-sana", "24-kun", "kun 24", "day 24"
  const dayKeywordPattern = new RegExp(`\\b(?:(?:${day}|${dayPadded})[- ]?(?:sana|kun)|(?:kun|day|kuni)[- ]?(?:${day}|${dayPadded}))\\b`);
  const dayMatch = lower.match(dayKeywordPattern);
  if (dayMatch) return { matched: true, matchSnippet: dayMatch[0] };

  return { matched: false };
}

/**
 * Scans all roadmaps (all 10+ roadmaps) to discover today's targets.
 * Matches explicit dates first, then fallbacks to the current active uncompleted topic
 * in active milestones so the user gets a comprehensive daily focus across their roadmaps.
 */
export function scanRoadmapsForDate(
  roadmaps: RoadmapItem[],
  targetDate: Date = new Date(),
  options: { includeNextPendingIfNoDate?: boolean; maxPerRoadmap?: number } = {}
): DailyRoadmapGoal[] {
  const { includeNextPendingIfNoDate = true, maxPerRoadmap = 2 } = options;
  const results: DailyRoadmapGoal[] = [];

  for (const roadmap of roadmaps) {
    let roadmapMatches: DailyRoadmapGoal[] = [];

    // Scan all milestones and topics
    for (const milestone of roadmap.milestones) {
      const msDateMatch = matchesDateInText(milestone.title, targetDate) || matchesDateInText(milestone.duration || '', targetDate);

      for (const topic of milestone.topics) {
        const topicDateMatch = matchesDateInText(topic.title, targetDate);

        if (topicDateMatch.matched || msDateMatch.matched) {
          roadmapMatches.push({
            roadmapId: roadmap.id,
            roadmapTitle: roadmap.title,
            roadmapStack: roadmap.stack,
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            topicId: topic.id,
            topicTitle: topic.title,
            done: topic.done,
            matchedDateText: topicDateMatch.matchSnippet || msDateMatch.matchSnippet,
            isDateMatched: true,
          });
        }
      }
    }

    // If no explicit date match was found in this roadmap, pick the next pending topic
    if (roadmapMatches.length === 0 && includeNextPendingIfNoDate) {
      for (const milestone of roadmap.milestones) {
        const pendingTopics = milestone.topics.filter((t) => !t.done);
        if (pendingTopics.length > 0) {
          const chosen = pendingTopics.slice(0, maxPerRoadmap);
          for (const topic of chosen) {
            roadmapMatches.push({
              roadmapId: roadmap.id,
              roadmapTitle: roadmap.title,
              roadmapStack: roadmap.stack,
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              topicId: topic.id,
              topicTitle: topic.title,
              done: false,
              isDateMatched: false,
            });
          }
          break; // take from first active milestone
        }
      }
    }

    results.push(...roadmapMatches.slice(0, maxPerRoadmap));
  }

  return results;
}

/**
 * Creates or synchronizes Daily Roadmap Goals into the real Task list.
 * Ensures tasks are tagged with 'focus' and 'roadmap' so they appear in:
 * - Home (Dashboard Joriy Fokus)
 * - Inbox (Vazifalar & Bildirishnomalar)
 * - Calendar (Bugungi kun rejalari)
 */
export function buildFocusTasksFromRoadmapGoals(
  goals: DailyRoadmapGoal[],
  existingTasks: Task[],
  workspaceId = 'personal',
  userName = 'Men',
  userInitials = 'ME'
): { tasksToAdd: Task[]; tasksToUpdate: Task[] } {
  const tasksToAdd: Task[] = [];
  const tasksToUpdate: Task[] = [];
  const now = new Date();

  // Target due time: 22:00 of today (deadline for daily check)
  const dueTarget = new Date(now);
  dueTarget.setHours(22, 0, 0, 0);
  const dueTimeIso = dueTarget.toISOString();

  for (const goal of goals) {
    // Check if task already exists by source_id or matching topic id tag
    const existing = existingTasks.find(
      (t) =>
        t.ai_source === `roadmap_topic:${goal.topicId}` ||
        (t.tags?.includes('roadmap') && t.title.toLowerCase().includes(goal.topicTitle.toLowerCase()))
    );

    if (existing) {
      // Sync completion status if different
      const shouldBeCompleted = goal.done;
      const isCurrentlyCompleted = existing.status === 'completed';
      if (shouldBeCompleted !== isCurrentlyCompleted) {
        tasksToUpdate.push({
          ...existing,
          status: shouldBeCompleted ? 'completed' : 'active',
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      // Create new synchronized Focus task
      const shortStack = goal.roadmapStack.split('/')[0].split('→')[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const newTask: Task = {
        id: `task-roadmap-${goal.topicId.replace(/^t-/, '')}`,
        workspace_id: workspaceId,
        group_id: null,
        space_id: null,
        title: `[${goal.roadmapTitle.slice(0, 18)}] ${goal.topicTitle}`,
        status: goal.done ? 'completed' : 'active',
        priority: 'High Priority',
        git_branch: null,
        pr_url: null,
        ai_source: `roadmap_topic:${goal.topicId}`,
        assignee_name: userName,
        assignee_avatar: userInitials,
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ['focus', 'roadmap', shortStack || 'learning'],
        due_time: dueTimeIso,
        reminder_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      tasksToAdd.push(newTask);
    }
  }

  return { tasksToAdd, tasksToUpdate };
}
