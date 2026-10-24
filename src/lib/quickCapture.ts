import { isTauri } from './platform';
import { callAi } from './ai';
import type { Task, TaskPriority } from './types';

export type QuickCaptureType = 'focus' | 'idea' | 'bug' | 'auto';

export interface QuickCaptureParsed {
  type: 'focus' | 'idea' | 'bug';
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
  suggestedBranch?: string;
}

/**
 * Sync the top 3 focus tasks with macOS Menu Bar Tray
 */
export async function syncTrayFocusTasks(focusTasks: string[]): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_tray_focus', {
      focusTasks: focusTasks.slice(0, 3),
    });
  } catch (err) {
    console.warn('[syncTrayFocusTasks] error:', err);
  }
}

/**
 * Register global hotkey (Cmd + Shift + Space) and Tauri tray listener
 */
export function initGlobalQuickCaptureListener(
  onOpenQuickCapture: () => void,
  onOpenVoiceStandup?: () => void,
  onTrayFocusSelected?: (indexStr: string) => void
): () => void {
  let unlistenTauriCapture: (() => void) | null = null;
  let unlistenTauriVoice: (() => void) | null = null;
  let unlistenTauriFocus: (() => void) | null = null;

  // 1. Tauri native events & global shortcut
  if (isTauri) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('open_quick_capture', () => {
        onOpenQuickCapture();
      }).then((un) => {
        unlistenTauriCapture = un;
      });

      if (onOpenVoiceStandup) {
        listen('open_voice_standup', () => {
          onOpenVoiceStandup();
        }).then((un) => {
          unlistenTauriVoice = un;
        });
      }

      if (onTrayFocusSelected) {
        listen<string>('tray_focus_selected', (event) => {
          onTrayFocusSelected(event.payload);
        }).then((un) => {
          unlistenTauriFocus = un;
        });
      }
    }).catch((err) => {
      console.warn('[initGlobalQuickCaptureListener] Tauri event listen error:', err);
    });

    // Also register via @tauri-apps/plugin-global-shortcut if available in JS runtime
    import('@tauri-apps/plugin-global-shortcut').then(({ register }) => {
      register('CommandOrControl+Shift+Space', (event) => {
        if (event.state === 'Pressed') {
          onOpenQuickCapture();
        }
      }).catch(() => {
        // Rust main.rs already handles it; JS fallback is silent
      });
    }).catch(() => {});
  }

  // 2. In-window DOM keydown listener (works both in Tauri & browser)
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd + Shift + Space (or Ctrl + Shift + Space)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.code === 'Space' || e.key === ' ' || e.keyCode === 32)) {
      e.preventDefault();
      onOpenQuickCapture();
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    if (unlistenTauriCapture) unlistenTauriCapture();
    if (unlistenTauriVoice) unlistenTauriVoice();
    if (unlistenTauriFocus) unlistenTauriFocus();
  };
}

/**
 * Intelligent AI Quick Capture Classifier and Expander
 */
export async function classifyQuickCaptureWithAi(
  rawInput: string,
  userSelectedMode: QuickCaptureType = 'auto'
): Promise<QuickCaptureParsed> {
  const clean = rawInput.trim();
  if (!clean) {
    return {
      type: 'focus',
      title: 'Yangi vazifa',
      description: '',
      priority: 'Normal',
      tags: ['quick-capture'],
    };
  }

  // AI Prompt for Raycast / Spotlight quick capture classification
  const prompt = `Siz CogniDev tizimidagi Senior Tech Lead AI Quick Capture yordamchisisiz.
Dasturchi tezkor klavish orqali quyidagi qisqa qaydni yozdi:
"${clean}"
Tanlangan rejim: ${userSelectedMode}

Iltimos, ushbu qaydni tahlil qilib, JSON formatida toza obyekt qaytaring:
{
  "type": "focus" | "idea" | "bug",
  "title": "Aniq va professional texnik sarlavha (o'zbek tilida)",
  "description": "Amaliy qisqa tavsif yoki yechim yo'li (1-2 gap)",
  "priority": "P0 Blocker" | "Critical" | "High Priority" | "Normal",
  "tags": ["teg1", "teg2"],
  "suggestedBranch": "feat/... yoki fix/... (faqat inglizcha harflar bilan)"
}

QOIDALAR:
- Agar xato, crash yoki muammo bo'lsa -> type: "bug", priority: "Critical" yoki "P0 Blocker", branch: "fix/..."
- Agar bugungi kun rejasi yoki vazifa bo'lsa -> type: "focus", priority: "High Priority", branch: "feat/..."
- Agar yangi arxitektura yoki loyiha g'oyasi bo'lsa -> type: "idea", tags ga 'idea' qo'shilsin
- Agar foydalanuvchi aniq rejim tanlagan bo'lsa (${userSelectedMode !== 'auto' ? userSelectedMode : 'auto'}), o'sha rejimni saqlang
- Faqat JSON formatida javob bering, markdown yo'q.`;

  try {
    const res = await callAi(prompt, 'Faqat toza JSON qaytaring.');
    const jsonMatch = res.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validTypes: Array<'focus' | 'idea' | 'bug'> = ['focus', 'idea', 'bug'];
      const finalType = userSelectedMode !== 'auto'
        ? userSelectedMode
        : validTypes.includes(parsed.type)
        ? parsed.type
        : 'focus';

      const validPriorities: TaskPriority[] = ['P0 Blocker', 'Critical', 'High Priority', 'Normal'];
      const finalPriority = validPriorities.includes(parsed.priority) ? parsed.priority : 'Normal';

      return {
        type: finalType,
        title: parsed.title || clean,
        description: parsed.description || clean,
        priority: finalPriority,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['quick-capture'],
        suggestedBranch: parsed.suggestedBranch || undefined,
      };
    }
  } catch (err) {
    console.warn('[classifyQuickCaptureWithAi] AI parse fallback:', err);
  }

  // Deterministic local heuristic fallback (instant 0ms)
  const lower = clean.toLowerCase();
  let type: 'focus' | 'idea' | 'bug' = 'focus';
  let priority: TaskPriority = 'Normal';
  let branchPrefix = 'feat';

  if (userSelectedMode !== 'auto') {
    type = userSelectedMode;
  } else if (
    lower.startsWith('bug') ||
    lower.startsWith('fix') ||
    lower.includes('xato') ||
    lower.includes('muammo') ||
    lower.includes('crash') ||
    lower.includes('leak')
  ) {
    type = 'bug';
    priority = 'Critical';
    branchPrefix = 'fix';
  } else if (
    lower.startsWith('idea') ||
    lower.startsWith('goya') ||
    lower.startsWith("g'oya") ||
    lower.includes('fikr')
  ) {
    type = 'idea';
    priority = 'Normal';
    branchPrefix = 'idea';
  } else {
    type = 'focus';
    priority = 'High Priority';
    branchPrefix = 'feat';
  }

  const cleanTitle = clean.replace(/^(?:bug|fix|idea|focus|g'oya|goya):\s*/i, '');
  const branchSlug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)
    .replace(/^-|-$/g, '');

  return {
    type,
    title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
    description: `Quick Capture orqali kiritildi: ${clean}`,
    priority,
    tags: [type, 'quick-capture'],
    suggestedBranch: `${branchPrefix}/${branchSlug || 'update'}`,
  };
}

/**
 * Extracts the top 3 focus task titles from the current task list
 */
export function extractTop3FocusTasks(tasks: Task[]): string[] {
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  // 1. Tagged with 'focus'
  const tagged = pendingTasks.filter(
    (t) => t.tags?.some((tag) => tag.toLowerCase() === 'focus')
  );
  if (tagged.length >= 3) {
    return tagged.slice(0, 3).map((t) => t.title);
  }

  // 2. High priority or active tasks
  const activeOrHigh = pendingTasks.filter(
    (t) =>
      t.status === 'active' ||
      t.priority === 'P0 Blocker' ||
      t.priority === 'Critical' ||
      t.priority === 'High Priority'
  );
  const combined = [...tagged];
  for (const t of activeOrHigh) {
    if (!combined.some((c) => c.id === t.id)) {
      combined.push(t);
    }
    if (combined.length >= 3) break;
  }

  if (combined.length < 3) {
    const remaining = pendingTasks.filter((t) => !combined.some((c) => c.id === t.id));
    for (const r of remaining) {
      combined.push(r);
      if (combined.length >= 3) break;
    }
  }

  return combined.slice(0, 3).map((t) => t.title);
}
