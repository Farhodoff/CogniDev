export interface StandupReport {
  yesterday: string[];
  today: string[];
  blockers: string[];
}

export function formatStandupMessage(report: StandupReport): string {
  const parts: string[] = ['*🚀 Kunlik Standup Hisoboti*'];
  
  parts.push('\n*Kecha bajarilgan ishlar:*');
  if (report.yesterday.length) {
    report.yesterday.forEach(item => parts.push(`• ${item}`));
  } else {
    parts.push('• Rejalashtirilgan vazifalar yakunlandi');
  }

  parts.push('\n*Bugungi asosiy rejalar:*');
  if (report.today.length) {
    report.today.forEach(item => parts.push(`• ${item}`));
  } else {
    parts.push('• Joriy sprint vazifalari davom ettiriladi');
  }

  if (report.blockers.length) {
    parts.push('\n*🚨 To\'siqlar (Blockers):*');
    report.blockers.forEach(b => parts.push(`⚠️ ${b}`));
  }

  return parts.join('\n');
}
