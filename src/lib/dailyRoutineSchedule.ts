import { playNotificationSound, sendDesktopNotification, speakVoiceReminder } from './notifications';
import { sendTelegramMessage } from './telegramBot';
import { generateDailyMissedTasksReport } from './dailyReport';
import type { Task, RoadmapItem, ScheduleBlock, TelegramBotConfig, FlashcardItem } from './types';
import { getDueFlashcards } from './spacedRepetition';

export type DailyRoutineStage = 'morning_10' | 'midday_14' | 'evening_22';

export interface DailyRoutineStatus {
  date: string;
  morning_10: boolean;
  midday_14: boolean;
  evening_22: boolean;
  lastTriggered?: {
    stage: DailyRoutineStage;
    time: string;
    message: string;
  };
}

const STORAGE_KEY_PREFIX = 'cognidev_daily_routine_';

/**
 * Returns the status of the 3 daily checks for today's date.
 */
export function getDailyRoutineStatus(dateStr = new Date().toISOString().split('T')[0]): DailyRoutineStatus {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${dateStr}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  return {
    date: dateStr,
    morning_10: false,
    midday_14: false,
    evening_22: false,
  };
}

/**
 * Persists the updated status for today's routine.
 */
export function saveDailyRoutineStatus(status: DailyRoutineStatus): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${status.date}`, JSON.stringify(status));
  } catch {}
}

/**
 * Context provided to the routine trigger engine.
 */
export interface RoutineContext {
  tasks: Task[];
  roadmaps: RoadmapItem[];
  scheduleBlocks: ScheduleBlock[];
  flashcards?: FlashcardItem[];
  telegramConfig?: TelegramBotConfig | null;
  soundEnabled?: boolean;
  userName?: string;
  onAlertBanner?: (title: string, description: string, stage: DailyRoutineStage) => void;
  onSetHud?: (msg: string) => void;
}

/**
 * Triggers one of the 3 daily routine stages with voice, chime, desktop alert, and Telegram.
 */
export async function executeDailyRoutineStage(
  stage: DailyRoutineStage,
  ctx: RoutineContext,
  isManualTest = false
): Promise<{ success: boolean; voiceMessage: string }> {
  const {
    tasks,
    scheduleBlocks,
    telegramConfig,
    soundEnabled = true,
    userName = 'Muhandis',
    onAlertBanner,
    onSetHud,
  } = ctx;

  const todayStr = new Date().toISOString().split('T')[0];
  const routineStatus = getDailyRoutineStatus(todayStr);

  // Filter tasks relevant to today / focus
  const todayFocusTasks = tasks.filter((t) => t.tags?.includes('focus') || t.tags?.includes('roadmap') || t.status === 'active');
  const incompleteTasks = todayFocusTasks.filter((t) => t.status !== 'completed');
  const completedTasks = todayFocusTasks.filter((t) => t.status === 'completed');

  let title = '';
  let body = '';
  let voiceText = '';

  if (stage === 'morning_10') {
    title = '🌅 10:00 — Ertalabki Start va Bugungi Maqsadlar';
    const goalCount = todayFocusTasks.length;
    const taskNames = todayFocusTasks.slice(0, 3).map((t) => t.title.replace(/^\[.*?\]\s*/, '')).join(', ');

    if (goalCount > 0) {
      body = `Bugun ${goalCount} ta asosiy maqsad rejalashtirilgan. Diqqat markazida: ${taskNames}`;
      voiceText = `Xayrli tong, ${userName}! Soat 10:00. Bugungi kunlik vazifalaringiz boshlandi. Bugun sizda ${goalCount} ta asosiy maqsad rejalashtirilgan: ${taskNames}. Kunga kuchli va sermahsul start bering!`;
    } else {
      body = `Bugun uchun hali aniq vazifalar tanlanmagan. Yo'l xaritangizdan bugungi mavzularni tanlang!`;
      voiceText = `Xayrli tong, ${userName}! Soat 10:00. Yangi kun boshlandi. Bugungi o'rganish rejangizni va maqsadlaringizni tasdiqlang!`;
    }

    // Mention due flashcards if any
    const dueCards = ctx.flashcards ? getDueFlashcards(ctx.flashcards) : [];
    if (dueCards.length > 0) {
      body += ` | 🧠 ${dueCards.length} ta flashcard takrorlash kutilmoqda.`;
      voiceText += ` Shuningdek, bugun mustahkamlash uchun ${dueCards.length} ta bilim kartochkasi kutilmoqda.`;
    }
  } else if (stage === 'midday_14') {
    title = '⏱ 14:00 — Oraliq Nazorat (Kunning 2-yarmi)';
    const remainingCount = incompleteTasks.length;

    if (remainingCount > 0) {
      const topPending = incompleteTasks.slice(0, 2).map((t) => t.title.replace(/^\[.*?\]\s*/, '')).join(', ');
      body = `Bugungi rejalardan ${remainingCount} tasi hali bajarilmagan. Qolgan vazifalar: ${topPending}`;
      voiceText = `Diqqat, soat 14:00 bo'ldi. Oraliq nazorat vaqti! Bugungi rejalashtirilgan yo'l xaritasi maqsadlaringizdan hali ${remainingCount} tasi bajarilmagan. Vaqtni boy bermang, kunning ikkinchi yarmida diqqatni jamlang!`;
    } else {
      body = `Ajoyib natija! Bugungi barcha rejalashtirilgan maqsadlar yakunlangan!`;
      voiceText = `Tabriklaymiz, soat 14:00 gacha bugungi barcha rejalashtirilgan maqsadlaringiz muvaffaqiyatli yakunlandi! Zo'r sur'at!`;
    }
  } else if (stage === 'evening_22') {
    title = '🌙 22:00 — Kun Yakuni va Qilinmagan Ishlar Auditi';
    const remainingCount = incompleteTasks.length;

    if (remainingCount > 0) {
      const topMissed = incompleteTasks.slice(0, 3).map((t) => t.title.replace(/^\[.*?\]\s*/, '')).join('; ');
      body = `Bugungi qilinmagan ishlar: ${remainingCount} ta vazifa yakunlanmadi. Ertangi kunga qayta taqsimlang.`;
      voiceText = `Kechki soat 22:00. Bugungi kun yakuni: Sizda ${remainingCount} ta qilinmagan vazifa qoldi: ${topMissed}. Kechikkan ishlarni ertangi kunning boshiga qayta taqsimlash tavsiya etiladi.`;

      // Trigger detailed AI audit report in background
      generateDailyMissedTasksReport(tasks, scheduleBlocks, userName).catch(() => {});
    } else {
      body = `Kun yakuni: Bugungi barcha ${completedTasks.length} ta maqsad 100% bajarildi! 🏆`;
      voiceText = `Kechki soat 22:00. Ajoyib g'alaba, ${userName}! Bugungi barcha rejalashtirilgan vazifalar to'liq bajarildi! Kunning samarasi yuqori bo'ldi. Maroqli dam oling!`;
    }

    const eveningDueCards = ctx.flashcards ? getDueFlashcards(ctx.flashcards) : [];
    if (eveningDueCards.length > 0) {
      body += ` | 🧠 ${eveningDueCards.length} ta kartochka takrorlanmadi.`;
      voiceText += ` Takrorlanmagan ${eveningDueCards.length} ta bilim kartochkasi mavjud.`;
    }
  }

  // 1. Audio chime
  if (soundEnabled) {
    playNotificationSound();
  }

  // 2. Voice readout aloud
  await speakVoiceReminder(voiceText).catch(() => {});

  // 3. Desktop native notification
  await sendDesktopNotification(title, body).catch(() => {});

  // 4. In-app alert banner
  if (onAlertBanner) {
    onAlertBanner(title, body, stage);
  }

  // 5. Telegram notification if configured
  if (telegramConfig?.is_active && telegramConfig.bot_token && telegramConfig.allowed_user_ids) {
    const ids = telegramConfig.allowed_user_ids.split(',').map((u) => u.trim()).filter(Boolean);
    const tgMsg = `🔔 *CogniDev Kunlik Bildirishnoma*\n\n*${title}*\n\n${body}\n\n⏱ *Sana:* ${todayStr}`;
    for (const uid of ids) {
      sendTelegramMessage(telegramConfig.bot_token, uid, tgMsg).catch(() => {});
    }
  }

  // 6. Record that this stage ran today (unless manual test)
  if (!isManualTest) {
    routineStatus[stage] = true;
    routineStatus.lastTriggered = {
      stage,
      time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      message: body,
    };
    saveDailyRoutineStatus(routineStatus);
  }

  if (onSetHud) {
    onSetHud(`${title} ovozli bildirishnomasi yangradi 🔊`);
  }

  return { success: true, voiceMessage: voiceText };
}

/**
 * Checks current time and automatically fires 10:00, 14:00, or 22:00 if reached.
 * Called continuously by the background scheduler tick.
 */
export function checkAndTriggerDailyRoutines(ctx: RoutineContext): void {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const todayStr = now.toISOString().split('T')[0];

  const status = getDailyRoutineStatus(todayStr);

  // 1. Morning 10:00 (fires between 10:00 and 10:05 once per day)
  if (hours === 10 && minutes <= 5 && !status.morning_10) {
    executeDailyRoutineStage('morning_10', ctx, false).catch(() => {});
  }

  // 2. Midday 14:00 (fires between 14:00 and 14:05 once per day)
  if (hours === 14 && minutes <= 5 && !status.midday_14) {
    executeDailyRoutineStage('midday_14', ctx, false).catch(() => {});
  }

  // 3. Evening 22:00 (fires between 22:00 and 22:05 once per day)
  if (hours === 22 && minutes <= 5 && !status.evening_22) {
    executeDailyRoutineStage('evening_22', ctx, false).catch(() => {});
  }
}
