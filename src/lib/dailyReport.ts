import type { Task, ScheduleBlock } from './types';
import { callAi } from './ai';
import { speakVoiceReminder } from './notifications';
import { sendTelegramMessage } from './telegramBot';

export interface DailyReportSummary {
  date: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: Task[];
  incompleteBlocks: ScheduleBlock[];
  completedBlocks: ScheduleBlock[];
  reportMarkdown: string;
  voiceSummary: string;
}

/**
 * Checks if a task is overdue or pending past its due date.
 */
export function isTaskOverdue(task: Task): boolean {
  if (task.status === 'completed') return false;

  // If task has explicit due_time in the past
  if (task.due_time) {
    const dueMs = new Date(task.due_time).getTime();
    if (!isNaN(dueMs) && dueMs < Date.now()) {
      return true;
    }
  }

  // Blocker or critical active tasks created earlier
  if (task.priority === 'P0 Blocker' || task.priority === 'Critical') {
    return true;
  }

  // Active tasks older than 24 hours
  if (task.status === 'active' || task.status === 'blocker') {
    const createdMs = new Date(task.created_at).getTime();
    if (!isNaN(createdMs) && Date.now() - createdMs > 24 * 3600 * 1000) {
      return true;
    }
  }

  return false;
}

/**
 * Generates an intelligent, AI-powered Daily Missed / Overdue Tasks Audit.
 */
export async function generateDailyMissedTasksReport(
  tasks: Task[],
  scheduleBlocks: ScheduleBlock[],
  userName = 'Muhandis'
): Promise<DailyReportSummary> {
  const todayStr = new Date().toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const overdueTasks = tasks.filter((t) => isTaskOverdue(t));
  const incompleteBlocks = scheduleBlocks.filter((b) => !b.done);
  const completedBlocks = scheduleBlocks.filter((b) => b.done);

  // Build structured prompt for AI
  const prompt = `Siz CogniDev AI Daily Coach va muhandislik maslahatchisisiz.
Foydalanuvchi: ${userName}
Bugungi sana: ${todayStr}

STATISTIKA:
- Jami vazifalar: ${tasks.length} ta
- Bajarilgan vazifalar: ${completedTasks.length} ta
- Bajarilgan vaqt bloklari: ${completedBlocks.length} ta
- O'tkazib yuborilgan / kechikkan vazifalar (${overdueTasks.length} ta):
${
  overdueTasks.length > 0
    ? overdueTasks.map((t) => `  * [${t.priority}] "${t.title}" (Holat: ${t.status}, Teglar: ${t.tags.join(', ') || 'yo‘q'})`).join('\n')
    : '  * Hozirda jiddiy kechikkan vazifalar yo‘q.'
}
- Kalendardagi bajarilmagan vaqt bloklari (${incompleteBlocks.length} ta):
${
  incompleteBlocks.length > 0
    ? incompleteBlocks.map((b) => `  * "${b.title}" (${b.time_range}, Kategoriya: ${b.category})`).join('\n')
    : '  * Barcha vaqt bloklari bajarilgan.'
}

VAZIFA:
Quyidagi aniq va tushunarli formatda o'zbek tilida qat'iy va motivatsion kundalik hisobot yozing:
# 📊 KUNLIK QILINMAGAN ISHLAR VA OVERDUE AUDITI
### ⚠️ 1. O‘tkazib yuborilgan va kechikkan vazifalar tahlili
(Nimalar qolib ketdi, ularning loyihaga ta'siri va xavf darajasi)

### 🔍 2. Nima sababdan kechikkan bo‘lishi mumkin?
(Konteks almashtirish, blockerlar, yoki vaqtni noto'g'ri baholash bo'yicha qisqa tahlil)

### 💡 3. AI Qayta taqsimlash tavsiyasi (Reschedule Plan)
(Qaysi vazifalarni ertaga ko'chirish, qaysilarini bekor qilish yoki delegatsiya qilish kerak)

### 🎯 4. Ertangi kun uchun TOP-3 muhim fokus
1. ...
2. ...
3. ...

Oxirida 1 jumla quvvatlovchi motivatsion xulosa yozing.`;

  let reportText = '';

  try {
    const aiResult = await callAi(prompt, 'professional');
    reportText = aiResult.text;
  } catch (err) {
    console.warn('[DailyReport] callAi error, generating analytical template:', err);
    // Intelligent fallback template if offline
    reportText = `# 📊 KUNLIK QILINMAGAN ISHLAR VA OVERDUE AUDITI
*Sana: ${todayStr} | Foydalanuvchi: ${userName}*

### ⚠️ 1. O‘tkazib yuborilgan va kechikkan vazifalar (${overdueTasks.length} ta)
${
  overdueTasks.length > 0
    ? overdueTasks.map((t) => `• **[${t.priority}]** ${t.title} — *${t.status}*`).join('\n')
    : '• Barcha asosiy vazifalar o‘z vaqtida yakunlangan! Zo‘r natija. 🚀'
}

### ⏱ 2. Kalendardagi bajarilmagan rejalar (${incompleteBlocks.length} ta)
${
  incompleteBlocks.length > 0
    ? incompleteBlocks.map((b) => `• **${b.time_range}**: ${b.title} (${b.category})`).join('\n')
    : '• Kalendar bo‘yicha barcha vaqt bloklari muvaffaqiyatli yakunlangan.'
}

### 💡 3. AI Qayta taqsimlash tavsiyasi
• **Prioritet 1:** Kechikkan Blocker va Critical vazifalarni ertaga ertalabki dastlabki 2 soatlik Deep Work blokiga joylashtiring.
• **Prioritet 2:** Kichik vazifalarni kechiktirmasdan 15 daqiqalik oraliqlarda yopish tavsiya etiladi.

### 🎯 4. Ertangi kun uchun TOP-3 muhim fokus
1. ${overdueTasks[0]?.title || 'Ertangi kun rejasini tasdiqlash va kod yozish'}
2. ${overdueTasks[1]?.title || 'Asosiy arxitektura yoki API integratsiyasi'}
3. ${incompleteBlocks[0]?.title || 'Yangi rejalarni kalendarga kiritish'}

🔥 *Esda tuting: To‘xtab qolish xato emas, rejasiz davom etish xato. Ertangi kun yangi imkoniyat!*`;
  }

  // Generate concise speech summary for voice readout
  const voiceSummary =
    `Bugungi kunlik audit: Sizda ${overdueTasks.length} ta o'tkazib yuborilgan vazifa va ` +
    `${incompleteBlocks.length} ta bajarilmagan vaqt bloki mavjud. ` +
    (overdueTasks[0] ? `Eng muhim kechikkan ish: "${overdueTasks[0].title}". ` : '') +
    `Ertaga ertalab birinchi navbatda shu ishlarni yakunlash tavsiya etiladi.`;

  return {
    date: todayStr,
    totalTasks: tasks.length,
    completedTasks: completedTasks.length,
    overdueTasks,
    incompleteBlocks,
    completedBlocks,
    reportMarkdown: reportText,
    voiceSummary,
  };
}

/**
 * Reads aloud the daily report summary using speech synthesis.
 */
export async function speakDailyReportVoice(summaryText: string): Promise<boolean> {
  return speakVoiceReminder(summaryText);
}

/**
 * Sends the daily missed tasks report to Telegram users.
 */
export async function dispatchDailyReportToTelegram(
  token: string,
  allowedUserIds: string,
  reportText: string
): Promise<number> {
  const ids = allowedUserIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  let sentCount = 0;

  for (const chatId of ids) {
    const success = await sendTelegramMessage(token, chatId, reportText);
    if (success) sentCount++;
  }

  return sentCount;
}
