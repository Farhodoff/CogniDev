import type { RoadmapMilestone, RoadmapTopic, RoadmapItem } from './types';

/**
 * Parses any Markdown document (.md) into a structured Roadmap with Milestones & Checklist Topics.
 * Supports:
 * - Checkboxes: `- [ ] Topic`, `- [x] Completed topic`
 * - Bullets: `- Topic`, `* Topic`
 * - Headers: `# Title`, `## Stack`, `### Milestone`
 */
export function parseRoadmapMarkdown(markdown: string, fallbackTitle = 'Mening Yo‘l Xaritam'): {
  title: string;
  stack: string;
  description: string;
  milestones: RoadmapMilestone[];
} {
  const lines = markdown.split(/\r?\n/);
  let title = fallbackTitle;
  let stack = 'Backend / Software Engineering';
  let description = '';
  const milestones: RoadmapMilestone[] = [];

  let currentMilestone: RoadmapMilestone | null = null;
  let currentMajorHeader = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // 1. Top-level Title (# Title)
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match && milestones.length === 0 && (!currentMilestone || currentMilestone.topics.length === 0)) {
      const candidateTitle = h1Match[1].replace(/^[0-9.]+\s*/, '').trim();
      if (!candidateTitle.toLowerCase().startsWith('yo‘l xaritasi') && candidateTitle.length > 2) {
        title = candidateTitle;
        continue;
      }
    }

    // 2. Subtitle / Tech stack (## Python → Go → Rust)
    const h2StackMatch = line.match(/^##\s+(.+→.+)$/);
    if (h2StackMatch && milestones.length === 0) {
      stack = h2StackMatch[1].trim();
      continue;
    }

    // 3. Blockquote / Goal description (> Maqsad: ...)
    if (line.startsWith('>')) {
      const descPart = line.replace(/^>\s*/, '').replace(/\*\*/g, '').trim();
      if (descPart && !description) {
        description = descPart;
      }
      continue;
    }

    // 4. Headers
    const h1MajorMatch = line.match(/^#\s+([0-9]+\.\s*.+)$/);
    if (h1MajorMatch) {
      currentMajorHeader = h1MajorMatch[1].trim();
    }

    const headerMatch = line.match(/^(?:#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const hText = headerMatch[1].trim();
      // Skip meta sections
      const lower = hText.toLowerCase();
      if (
        lower.includes('prioritet') ||
        lower === 'yo‘l xaritasi' ||
        lower.includes('tavsiya etiladigan') ||
        lower === 'maqsad' ||
        lower === 'overview'
      ) {
        continue;
      }

      let fullTitle = hText;
      if (currentMajorHeader && !hText.startsWith(currentMajorHeader) && !hText.match(/^[0-9]+\./)) {
        const shortMajor = currentMajorHeader.split('—')[0].trim();
        fullTitle = `${shortMajor}: ${hText}`;
      }

      currentMilestone = {
        id: 'm-' + Math.random().toString(36).slice(2, 9),
        title: fullTitle,
        duration: '2–4 hafta',
        priority: 'Yuqori',
        topics: [],
      };
      milestones.push(currentMilestone);
      continue;
    }

    // 5. Checkbox List item: - [ ] Topic or - [x] Completed Topic
    const checkMatch = line.match(/^[-*]\s*\[([ xX])\]\s+(.+)$/);
    if (checkMatch) {
      const isDone = checkMatch[1].toLowerCase() === 'x';
      const topicText = checkMatch[2].replace(/^`+|`+$/g, '').trim();
      if (!topicText) continue;

      if (!currentMilestone) {
        currentMilestone = {
          id: 'm-' + Math.random().toString(36).slice(2, 9),
          title: '1-Bosqich: Boshlang‘ich Mavzular',
          duration: '1–2 hafta',
          priority: 'Yuqori',
          topics: [],
        };
        milestones.push(currentMilestone);
      }

      const topic: RoadmapTopic = {
        id: 't-' + Math.random().toString(36).slice(2, 9),
        title: topicText,
        done: isDone,
      };
      currentMilestone.topics.push(topic);
      continue;
    }

    // 6. Bullet List item: - Topic or * Topic (under milestone)
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      const topicText = bulletMatch[1].replace(/^`+|`+$/g, '').trim();
      // Skip markdown dividers or table rows
      if (topicText.startsWith('---') || topicText.startsWith('|') || topicText.length < 2) {
        continue;
      }

      if (!currentMilestone) {
        currentMilestone = {
          id: 'm-' + Math.random().toString(36).slice(2, 9),
          title: '1-Bosqich: Asosiy Mavzular',
          duration: '1–2 hafta',
          priority: 'Yuqori',
          topics: [],
        };
        milestones.push(currentMilestone);
      }

      const topic: RoadmapTopic = {
        id: 't-' + Math.random().toString(36).slice(2, 9),
        title: topicText,
        done: false,
      };
      currentMilestone.topics.push(topic);
      continue;
    }
  }

  // Filter out any milestones that have 0 topics
  const validMilestones = milestones.filter((m) => m.topics.length > 0);

  return {
    title: title || fallbackTitle,
    stack: stack || 'Backend / Software Engineering',
    description: description || 'Muhandislik o‘rganish yo‘l xaritasi',
    milestones: validMilestones.length > 0 ? validMilestones : [
      {
        id: 'm-1',
        title: '1-Bosqich: Boshlang‘ich Reja',
        duration: '1 hafta',
        priority: 'Yuqori',
        topics: [
          { id: 't-1', title: 'O‘rganish rejasini shakllantirish', done: false },
        ],
      },
    ],
  };
}

/**
 * Exports a RoadmapItem to clean Markdown format with interactive checkboxes.
 */
export function exportRoadmapToMarkdown(roadmap: RoadmapItem): string {
  let md = `# ${roadmap.title}\n`;
  if (roadmap.stack) {
    md += `## ${roadmap.stack}\n`;
  }
  if (roadmap.description) {
    md += `\n> ${roadmap.description}\n`;
  }
  md += '\n---\n\n';

  for (const m of roadmap.milestones) {
    md += `### ${m.title}${m.duration ? ` (${m.duration})` : ''}\n`;
    for (const t of m.topics) {
      md += `- [${t.done ? 'x' : ' '}] ${t.title}\n`;
    }
    md += '\n';
  }

  return md;
}
