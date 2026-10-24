import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processMorningVoiceStandup,
  processEveningVoiceStandup,
} from '../lib/voiceStandup';
import { useSynapse } from '../lib/store';
import { callAi } from '../lib/ai';

vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<any>('../lib/ai');
  return {
    ...actual,
    callAi: vi.fn(),
  };
});

describe('🎙 Interactive Voice Standup (Ikki tomonlama Ovozli Standup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSynapse.setState({
      tasks: [],
      learningLogs: [],
      retrospectives: [],
      activeVoiceStandup: null,
    });
  });

  describe('🌅 10:00 Morning Voice Standup -> Joriy Fokus Tasks', () => {
    it('successfully parses multiple goals with AI into focus tasks', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          tasks: [
            {
              title: 'Redis kesh mexanizmini joriy qilish',
              priority: 'High Priority',
              tags: ['focus', 'backend', 'cache'],
              description: 'Standupdan kiritildi',
            },
            {
              title: 'gRPC servisini yozish',
              priority: 'High Priority',
              tags: ['focus', 'backend', 'grpc'],
              description: 'Standupdan kiritildi',
            },
          ],
          spokenReply: 'Qabul qilindi! Redis kesh va gRPC xizmati Joriy Fokusga kiritildi. Sermahsul kun tilayman!',
        }),
        source: 'gemini',
        model: 'gemini-1.5-flash',
      });

      const transcript = 'Bugun Redis kesh va gRPC xizmatini yozaman';
      const result = await processMorningVoiceStandup(transcript);

      expect(result.tasks.length).toBe(2);
      expect(result.tasks[0].title).toBe('Redis kesh mexanizmini joriy qilish');
      expect(result.tasks[1].title).toBe('gRPC servisini yozish');
      expect(result.tasks[0].tags).toContain('focus');
      expect(result.tasks[1].tags).toContain('focus');
      expect(result.spokenReply).toContain('Qabul qilindi');
    });

    it('uses smart offline fallback when AI fails or is offline', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline in unit test'));

      const transcript = 'Bugun Redis kesh va gRPC xizmatini yozaman';
      const result = await processMorningVoiceStandup(transcript);

      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
      const allTitles = result.tasks.map((t) => t.title.toLowerCase()).join(' ');
      expect(allTitles).toContain('redis');
      expect(allTitles).toContain('grpc');
      result.tasks.forEach((t) => {
        expect(t.tags).toContain('focus');
        expect(t.priority).toBe('High Priority');
      });
      expect(result.spokenReply.toLowerCase()).toContain('qabul qilindi');
    });

    it('submits morning voice standup directly to Joriy Fokus in Synapse store', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          tasks: [
            {
              title: 'Redis kesh mexanizmini joriy qilish',
              priority: 'High Priority',
              tags: ['focus', 'backend'],
            },
            {
              title: 'gRPC servisini yozish',
              priority: 'High Priority',
              tags: ['focus', 'backend'],
            },
          ],
          spokenReply: 'Qabul qilindi! Redis kesh va gRPC xizmati Joriy Fokusga kiritildi.',
        }),
        source: 'gemini',
        model: 'gemini-1.5-flash',
      });

      const transcript = 'Bugun Redis kesh va gRPC xizmatini yozaman';
      const { submitMorningVoiceStandup } = useSynapse.getState();

      const res = await submitMorningVoiceStandup(transcript);
      expect(res.tasks.length).toBe(2);

      const stateTasks = useSynapse.getState().tasks;
      expect(stateTasks.length).toBe(2);

      // Verify that tasks in state are tagged with 'focus' and active
      const focusTasks = stateTasks.filter((t) => t.tags?.includes('focus'));
      expect(focusTasks.length).toBe(2);
      expect(focusTasks[0].status).toBe('active');
      expect(focusTasks[0].ai_source).toBe('morning_voice_standup');
    });
  });

  describe('🌙 22:00 Evening Voice Standup -> Daily Log & Retro Blocks', () => {
    it('parses reasons for missed tasks into Daily Log and Retro block with AI', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          blockerTitle: 'Docker tarmoq xatosi va nosozlik',
          reasoning: 'Konteynerlararo tarmoq ulanishidagi xatolik',
          dailyLog: {
            learned: 'Konteynerlararo bridge tarmoq sozlamalari chuqurroq o‘rganildi',
            solvedProblem: 'Docker tarmoq ulanishidagi nosozlik sababli 3 soat sarflandi',
            nextGoal: 'Qoldirilgan vazifalarni ertangi kunning birinchi yarmida yakunlash',
            aiFeedback: 'Infrastruktura to‘siqlari vaqt olsa-da, ildiz sababni hujjatlashtirish vaqtni tejaydi.',
          },
          retroBlock: {
            title: '🌙 22:00 Kechki Retro — Sabab & To‘siq',
            content: 'Docker tarmoq xatosi bo‘yicha 3 soat ketdi.',
            blockersSummary: 'Docker tarmoq xatosi va texnik konfiguratsiya muammosi',
          },
          spokenReply: 'Sabab qayd etildi. Daily Log va Retro sahifangizga muammo bloki sifatida saqlandi. Maroqli dam oling!',
        }),
        source: 'gemini',
        model: 'gemini-1.5-flash',
      });

      const transcript = 'Docker tarmoq xatosi bo‘yicha 3 soat ketdi, konfiguratsiyada xatolik bor edi';
      const res = await processEveningVoiceStandup(transcript, []);

      // Verify Daily Log structure
      expect(res.dailyLog.solvedProblem).toContain('Docker');
      expect(res.dailyLog.nextGoal.length).toBeGreaterThan(0);
      expect(res.dailyLog.aiFeedback.length).toBeGreaterThan(0);

      // Verify Retro block structure
      expect(res.retroBlock.title).toContain('Kechki Retro');
      expect(res.retroBlock.content).toContain('Docker');
      expect(res.retroBlock.blockersSummary).toBeDefined();

      // Verify spoken reply
      expect(res.spokenReply.toLowerCase()).toContain('sabab');
      expect(res.spokenReply.toLowerCase()).toContain('retro');
    });

    it('submits evening voice standup directly saving to Daily Log and Retro in Synapse store', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          blockerTitle: 'Docker tarmoq xatosi',
          reasoning: 'Docker konfiguratsiya xatosi',
          dailyLog: {
            learned: 'Docker networking',
            solvedProblem: 'Docker tarmoq ulanishidagi xato sabab bo‘ldi',
            nextGoal: 'Ertaga qoldirilgan ishlarni yopish',
            aiFeedback: 'Yaxshi xulosa.',
          },
          retroBlock: {
            title: '🌙 22:00 Kechki Retro — Sabab & To‘siq',
            content: 'Docker tarmoq xatosi bo‘yicha audit xulosasi.',
            blockersSummary: 'Docker konfiguratsiyasi',
          },
          spokenReply: 'Sabab qayd etildi. Daily Log va Retro sahifangizga saqlandi.',
        }),
        source: 'gemini',
        model: 'gemini-1.5-flash',
      });

      const transcript = 'Docker tarmoq xatosi bo‘yicha 3 soat ketdi, konfiguratsiyada xatolik bor edi';
      const { submitEveningVoiceStandup } = useSynapse.getState();

      const res = await submitEveningVoiceStandup(transcript);
      expect(res.spokenReply).toBeDefined();

      // Verify Daily Log in store
      const logs = useSynapse.getState().learningLogs;
      expect(logs.length).toBe(1);
      expect(logs[0].solved_problem).toContain('Docker');

      // Verify Retro block in store
      const retros = useSynapse.getState().retrospectives;
      expect(retros.length).toBe(1);
      expect(retros[0].type).toBe('standup');
      expect(retros[0].stage).toBe('evening_22');
      expect(retros[0].raw_transcript).toBe(transcript);
      expect(retros[0].content).toContain('Docker');
    });
  });

  describe('🎙 Voice Standup Session State Management', () => {
    it('opens and closes voice standup sessions with correct stage', () => {
      const { openVoiceStandup, closeVoiceStandup } = useSynapse.getState();

      openVoiceStandup('morning_10', 'Ertalabki Start');
      let session = useSynapse.getState().activeVoiceStandup;
      expect(session?.open).toBe(true);
      expect(session?.stage).toBe('morning_10');
      expect(session?.promptMessage).toBe('Ertalabki Start');

      closeVoiceStandup();
      session = useSynapse.getState().activeVoiceStandup;
      expect(session).toBeNull();

      openVoiceStandup('evening_22', 'Kechki Audit');
      session = useSynapse.getState().activeVoiceStandup;
      expect(session?.open).toBe(true);
      expect(session?.stage).toBe('evening_22');
    });
  });
});
