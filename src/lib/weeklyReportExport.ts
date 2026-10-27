import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { Task, WeeklyCoachInsight } from './types';
import { isBlocker } from './ai';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface WeeklyReportExportOptions {
  userName?: string;
  daysCount?: number;
  startDate?: string;
  endDate?: string;
  includeAllTasks?: boolean;
}

export interface WeeklyReportData {
  userName: string;
  startDateStr: string;
  endDateStr: string;
  periodLabel: string;
  generatedAt: string;
  completedTasks: (Task & { note?: string })[];
  inProgressTasks: (Task & { note?: string })[];
  blockerTasks: (Task & { note?: string })[];
  totalTasks: number;
  completedCount: number;
  inProgressCount: number;
  blockersCount: number;
  completionRate: number;
  aiSummary: string;
  bottlenecks: string[];
  recommendations: string[];
}

/**
 * Filter tasks and compile weekly report dataset.
 */
export function buildWeeklyReportData(
  tasks: Task[],
  notes: Record<string, string> = {},
  weeklyCoach: WeeklyCoachInsight | null = null,
  options: WeeklyReportExportOptions = {}
): WeeklyReportData {
  const days = options.daysCount ?? 7;
  const now = new Date();
  const pastMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  const pastDate = new Date(pastMs);

  const startFormatted = pastDate.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  const endFormatted = now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  const periodLabel = `${startFormatted} – ${endFormatted}`;
  const generatedAt = now.toLocaleString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isRelevant = (t: Task) => {
    if (options.includeAllTasks) return true;
    const taskTime = new Date(t.updated_at || t.created_at).getTime();
    if (isNaN(taskTime)) return true;
    return taskTime >= pastMs;
  };

  const scopedTasks = tasks.filter(isRelevant);
  // If no tasks in the 7-day window, fall back to all tasks so the report is never completely empty
  const workingTasks = scopedTasks.length > 0 ? scopedTasks : tasks;

  const completedTasks: (Task & { note?: string })[] = [];
  const inProgressTasks: (Task & { note?: string })[] = [];
  const blockerTasks: (Task & { note?: string })[] = [];

  for (const t of workingTasks) {
    const note = notes[t.id]?.trim();
    const item = { ...t, note: note || undefined };

    if (t.status === 'completed') {
      completedTasks.push(item);
    } else if (isBlocker(t)) {
      blockerTasks.push(item);
    } else {
      inProgressTasks.push(item);
    }
  }

  const totalTasks = workingTasks.length;
  const completedCount = completedTasks.length;
  const inProgressCount = inProgressTasks.length;
  const blockersCount = blockerTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const aiSummary =
    weeklyCoach?.summary ||
    `Ushbu hafta davomida jami ${totalTasks} ta vazifadan ${completedCount} tasi muvaffaqiyatli yakunlandi (${completionRate}%). ` +
    (blockersCount > 0 ? `${blockersCount} ta to'siq mavjud.` : "To'siqlar aniqlanmagan, rivojlanish sur'ati barqaror.");

  const bottlenecks =
    weeklyCoach?.bottlenecks && weeklyCoach.bottlenecks.length > 0
      ? weeklyCoach.bottlenecks
      : blockersCount > 0
        ? blockerTasks.map((b) => `[${b.id}] ${b.title}`)
        : ["Jiddiy to'siqlar aniqlanmadi"];

  const recommendations =
    weeklyCoach?.recommendations && weeklyCoach.recommendations.length > 0
      ? weeklyCoach.recommendations
      : [
          "Bajarilgan vazifalarning yechimlarini qaydlar (notes) bo'limida saqlab boring",
          "Kechikayotgan yoki faol vazifalarni ertalabki Deep Work blokiga rejalashtiring",
          "Keyingi hafta uchun prioritetlarni sprint boshida belgilab oling",
        ];

  return {
    userName: options.userName || 'Dasturchi',
    startDateStr: startFormatted,
    endDateStr: endFormatted,
    periodLabel,
    generatedAt,
    completedTasks,
    inProgressTasks,
    blockerTasks,
    totalTasks,
    completedCount,
    inProgressCount,
    blockersCount,
    completionRate,
    aiSummary,
    bottlenecks,
    recommendations,
  };
}

/**
 * Escape string for RFC 4180 CSV format.
 */
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generate Excel-compatible CSV string with UTF-8 BOM.
 */
export function generateWeeklyReportCsv(data: WeeklyReportData): string {
  const rows: string[] = [];

  // Section 1: Report Title & Period
  rows.push([escapeCsvCell('COGNIDEV — HAFTALIK HISOBOT'), escapeCsvCell('')].join(','));
  rows.push([escapeCsvCell('Foydalanuvchi'), escapeCsvCell(data.userName)].join(','));
  rows.push([escapeCsvCell('Hisobot Davri'), escapeCsvCell(data.periodLabel)].join(','));
  rows.push([escapeCsvCell('Yaratilgan Vaqt'), escapeCsvCell(data.generatedAt)].join(','));
  rows.push('');

  // Section 2: Metrics Summary
  rows.push([escapeCsvCell('KO‘RSATKICHLAR'), escapeCsvCell('QIYMAT')].join(','));
  rows.push([escapeCsvCell('Jami vazifalar'), escapeCsvCell(data.totalTasks)].join(','));
  rows.push([escapeCsvCell('Muvaffaqiyatli yakunlandi'), escapeCsvCell(data.completedCount)].join(','));
  rows.push([escapeCsvCell('Jarayonda / Qoldirilgan'), escapeCsvCell(data.inProgressCount)].join(','));
  rows.push([escapeCsvCell('To‘siqlar (Blockers)'), escapeCsvCell(data.blockersCount)].join(','));
  rows.push([escapeCsvCell('Bajarilish foizi'), escapeCsvCell(`${data.completionRate}%`)].join(','));
  rows.push('');

  // Section 3: AI Review
  rows.push([escapeCsvCell('AI MURABBIY XULOSASI'), escapeCsvCell(data.aiSummary)].join(','));
  if (data.bottlenecks.length > 0) {
    rows.push([escapeCsvCell('Aniqlangan to‘siqlar'), escapeCsvCell(data.bottlenecks.join('; '))].join(','));
  }
  if (data.recommendations.length > 0) {
    rows.push([escapeCsvCell('AI Tavsiyalari'), escapeCsvCell(data.recommendations.join('; '))].join(','));
  }
  rows.push('');

  // Section 4: Completed Tasks Table
  rows.push([escapeCsvCell('--- 1. BAJARILGAN VAZIFALAR RO‘YXATI ---')].join(','));
  rows.push(
    [
      escapeCsvCell('Vazifa ID'),
      escapeCsvCell('Nomi'),
      escapeCsvCell('Holati'),
      escapeCsvCell('Prioritet'),
      escapeCsvCell('Teglar'),
      escapeCsvCell('Git Branch / PR'),
      escapeCsvCell('Bajarilgan / Yangilangan Sana'),
      escapeCsvCell('Yechim / Qaydlar (Notes)'),
    ].join(',')
  );

  if (data.completedTasks.length === 0) {
    rows.push([escapeCsvCell('-'), escapeCsvCell('Bu davrda yakunlangan vazifalar yo‘q'), escapeCsvCell('')].join(','));
  } else {
    for (const t of data.completedTasks) {
      rows.push(
        [
          escapeCsvCell(t.id),
          escapeCsvCell(t.title),
          escapeCsvCell(t.status),
          escapeCsvCell(t.priority),
          escapeCsvCell(t.tags.join(', ')),
          escapeCsvCell(t.git_branch || t.pr_url || ''),
          escapeCsvCell(t.updated_at ? t.updated_at.slice(0, 10) : ''),
          escapeCsvCell(t.note || ''),
        ].join(',')
      );
    }
  }
  rows.push('');

  // Section 5: In-Progress / Deferred Tasks Table
  rows.push([escapeCsvCell('--- 2. JARAYONDA VA QOLDIRILGAN ISHLAR ---')].join(','));
  rows.push(
    [
      escapeCsvCell('Vazifa ID'),
      escapeCsvCell('Nomi'),
      escapeCsvCell('Holati'),
      escapeCsvCell('Prioritet'),
      escapeCsvCell('Teglar'),
      escapeCsvCell('Git Branch'),
      escapeCsvCell('Yaratilgan Sana'),
      escapeCsvCell('Izohlar'),
    ].join(',')
  );

  if (data.inProgressTasks.length === 0) {
    rows.push([escapeCsvCell('-'), escapeCsvCell('Qoldirilgan yoki faol vazifalar yo‘q'), escapeCsvCell('')].join(','));
  } else {
    for (const t of data.inProgressTasks) {
      rows.push(
        [
          escapeCsvCell(t.id),
          escapeCsvCell(t.title),
          escapeCsvCell(t.status),
          escapeCsvCell(t.priority),
          escapeCsvCell(t.tags.join(', ')),
          escapeCsvCell(t.git_branch || ''),
          escapeCsvCell(t.created_at ? t.created_at.slice(0, 10) : ''),
          escapeCsvCell(t.note || ''),
        ].join(',')
      );
    }
  }
  rows.push('');

  // Section 6: Active Blockers
  if (data.blockerTasks.length > 0) {
    rows.push([escapeCsvCell('--- 3. HAL QILINISHI KERAK BO‘LGAN TO‘SIQLAR (BLOCKERS) ---')].join(','));
    rows.push(
      [
        escapeCsvCell('Vazifa ID'),
        escapeCsvCell('Nomi'),
        escapeCsvCell('Prioritet'),
        escapeCsvCell('Teglar'),
        escapeCsvCell('Izohlar'),
      ].join(',')
    );
    for (const t of data.blockerTasks) {
      rows.push(
        [
          escapeCsvCell(t.id),
          escapeCsvCell(t.title),
          escapeCsvCell(t.priority),
          escapeCsvCell(t.tags.join(', ')),
          escapeCsvCell(t.note || ''),
        ].join(',')
      );
    }
    rows.push('');
  }

  // Prepend UTF-8 Byte Order Mark (BOM) so Excel respects UTF-8 (Cyrillic, Uzbek Latin, etc.)
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Generate formatted Plaintext / Markdown report.
 */
export function generateWeeklyReportText(data: WeeklyReportData): string {
  const line = '='.repeat(78);
  const subline = '-'.repeat(78);

  const lines: string[] = [];

  lines.push(line);
  lines.push('             COGNIDEV — DASTURCHI HAFTALIK HISOBOTI (WEEKLY REPORT)');
  lines.push(line);
  lines.push(`Muhandis: ${data.userName}`);
  lines.push(`Davr:     ${data.periodLabel}`);
  lines.push(`Sana:     ${data.generatedAt}`);
  lines.push('');

  lines.push(subline);
  lines.push('1. 📊 ASOSIY KO‘RSATKICHLAR & METRIKALAR');
  lines.push(subline);
  lines.push(`• Jami ko‘rib chiqilgan vazifalar: ${data.totalTasks} ta`);
  lines.push(`• Muvaffaqiyatli yakunlandi:        ${data.completedCount} ta (${data.completionRate}%)`);
  lines.push(`• Jarayonda / Qoldirilgan:          ${data.inProgressCount} ta`);
  lines.push(`• Aniqlangan to‘siqlar (Blockers):  ${data.blockersCount} ta`);
  lines.push('');

  lines.push(subline);
  lines.push('2. 🧠 AI MURABBIY TAHLILI VA RETROSPEKTIV');
  lines.push(subline);
  lines.push(data.aiSummary);
  lines.push('');

  if (data.bottlenecks.length > 0) {
    lines.push('Aniqlangan to‘siqlar va qiyinchiliklar:');
    data.bottlenecks.forEach((b) => lines.push(`  * ${b}`));
    lines.push('');
  }

  if (data.recommendations.length > 0) {
    lines.push('Keyingi hafta uchun AI tavsiyalari:');
    data.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    lines.push('');
  }

  lines.push(subline);
  lines.push(`3. ✅ YAKUNLANGAN VAZIFALAR VA YECHILGAN MUAMMOLAR (${data.completedCount} ta)`);
  lines.push(subline);
  if (data.completedTasks.length === 0) {
    lines.push("Ushbu davrda yakunlangan vazifalar qayd etilmagan.");
  } else {
    data.completedTasks.forEach((t, idx) => {
      lines.push(`${idx + 1}. [${t.id}] ${t.title}`);
      lines.push(`   - Prioritet: ${t.priority} | Holati: ${t.status}`);
      if (t.tags.length > 0) lines.push(`   - Teglar: #${t.tags.join(' #')}`);
      if (t.git_branch) lines.push(`   - Git branch: ${t.git_branch}`);
      if (t.note) {
        // Indent notes
        const noteSummary = t.note.split('\n').slice(0, 4).join('\n     ');
        lines.push(`   - Problem Solved / Qayd:\n     ${noteSummary}`);
      }
      lines.push('');
    });
  }

  lines.push(subline);
  lines.push(`4. ⏳ JARAYONDA VA KEYINGI BOSQICHGA O‘TADIGAN ISHLAR (${data.inProgressCount} ta)`);
  lines.push(subline);
  if (data.inProgressTasks.length === 0) {
    lines.push("Faol yoki qoldirilgan vazifalar yo‘q.");
  } else {
    data.inProgressTasks.forEach((t, idx) => {
      lines.push(`${idx + 1}. [${t.id}] ${t.title} (${t.priority})`);
      if (t.tags.length > 0) lines.push(`   - Teglar: #${t.tags.join(' #')}`);
    });
  }
  lines.push('');

  if (data.blockerTasks.length > 0) {
    lines.push(subline);
    lines.push(`5. ⚠️ HAL QILINISHI SHART BO‘LGAN TO‘SIQLAR (${data.blockersCount} ta)`);
    lines.push(subline);
    data.blockerTasks.forEach((t, idx) => {
      lines.push(`${idx + 1}. [${t.id}] ${t.title} (${t.priority})`);
      if (t.note) lines.push(`   - Sabab/Qayd: ${t.note}`);
    });
    lines.push('');
  }

  lines.push(line);
  lines.push('Hisobot CogniDev mahalliy tizimi tomonidan avtomatik tuzildi.');
  lines.push(line);

  return lines.join('\n');
}

/**
 * Downloads or saves the weekly report as CSV (Excel) or TXT.
 * Native file dialog in Tauri, standard download in browser.
 */
export async function exportWeeklyReportToFile(
  format: 'csv' | 'txt',
  data: WeeklyReportData,
  filenamePrefix = 'CogniDev_Haftalik_Hisobot'
): Promise<{ success: boolean; filename: string }> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const extension = format === 'csv' ? 'csv' : 'txt';
  const defaultName = `${filenamePrefix}_${dateStr}.${extension}`;

  const content = format === 'csv' ? generateWeeklyReportCsv(data) : generateWeeklyReportText(data);

  if (isTauri) {
    try {
      const filters =
        format === 'csv'
          ? [{ name: 'Excel CSV', extensions: ['csv'] }]
          : [{ name: 'Matn Hujjat', extensions: ['txt', 'md'] }];

      const filePath = await save({
        defaultPath: defaultName,
        filters,
      });

      if (!filePath) {
        return { success: false, filename: defaultName };
      }

      await writeTextFile(filePath, content);
      return { success: true, filename: filePath };
    } catch (err) {
      console.warn('[WeeklyReportExport] Tauri save error, falling back to blob:', err);
    }
  }

  // Browser Blob fallback
  const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return { success: true, filename: defaultName };
}
