import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMyStandupPayload,
  exportTeamStandupJson,
  importTeamStandupJson,
  synthesizeTeamStandupsWithAi,
  loadStoredTeamMembers,
  saveStoredTeamMembers,
  DEFAULT_SAMPLE_MEMBERS,
  type TeamMemberStandup,
} from '../lib/teamStandup';
import { callAi } from '../lib/ai';
import type { Task, UserProfile } from '../lib/types';

vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<any>('../lib/ai');
  return {
    ...actual,
    callAi: vi.fn(),
  };
});

describe('👥 Team P2P Standup Cockpit & Decentralized Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockProfile: UserProfile = {
    id: 'user-farhod-1',
    full_name: 'Farhod Developer',
    username: 'farhodoff',
    title: 'Lead Architect',
    email: 'farhod@cognidev.ai',
    github: 'https://github.com/Farhodoff',
    avatar_color: '#3b82f6',
    avatar_initials: 'FD',
    bio: 'Building developer tools',
    role: 'Lead',
    updated_at: '2026-10-25T00:00:00Z',
  };

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      workspace_id: 'ws-1',
      title: 'Setup Redis Cluster & In-memory caching',
      status: 'active',
      priority: 'High Priority',
      git_branch: 'feat/redis',
      pr_url: 'https://github.com/Farhodoff/CogniDev/pull/104',
      ai_source: null,
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['focus', 'backend'],
      created_at: '2026-10-25T01:00:00Z',
      updated_at: '2026-10-25T01:00:00Z',
    },
    {
      id: 'task-2',
      workspace_id: 'ws-1',
      title: 'Investigate gRPC connection timeout on macOS',
      status: 'blocker',
      priority: 'P0 Blocker',
      git_branch: 'fix/grpc',
      pr_url: null,
      ai_source: null,
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['network', 'grpc'],
      created_at: '2026-10-25T01:00:00Z',
      updated_at: '2026-10-25T01:00:00Z',
    },
  ];

  describe('1. generateMyStandupPayload', () => {
    it('generates structured standup with active focus and blockers', () => {
      const standup = generateMyStandupPayload(mockProfile, mockTasks);

      expect(standup.name).toContain('Farhod Developer');
      expect(standup.role).toBe('Lead Architect');
      expect(standup.todayFocus.length).toBeGreaterThan(0);
      expect(standup.todayFocus[0]).toContain('Redis Cluster');
      expect(standup.blockers.length).toBe(1);
      expect(standup.blockers[0]).toContain('gRPC connection timeout');
      expect(standup.currentStatus).toBe('blocked');
      expect(standup.prReviews.length).toBe(1);
      expect(standup.prReviews[0].url).toContain('pull/104');
    });

    it('sets status to in_flow when there are no blockers', () => {
      const activeOnlyTasks = mockTasks.filter((t) => t.status !== 'blocker');
      const standup = generateMyStandupPayload(mockProfile, activeOnlyTasks);

      expect(standup.currentStatus).toBe('in_flow');
      expect(standup.blockers).toEqual([]);
    });
  });

  describe('2. exportTeamStandupJson & importTeamStandupJson', () => {
    it('serializes team members to valid JSON string', () => {
      const jsonStr = exportTeamStandupJson(DEFAULT_SAMPLE_MEMBERS);
      expect(typeof jsonStr).toBe('string');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.membersCount).toBe(DEFAULT_SAMPLE_MEMBERS.length);
      expect(parsed.members[0]).toHaveProperty('todayFocus');
    });

    it('successfully imports and merges new team members', () => {
      const newMember: TeamMemberStandup = {
        id: 'member-new-4',
        name: 'Azizbek',
        avatarInitials: 'A',
        role: 'QA Automation',
        currentStatus: 'active',
        moodEmoji: '🎯',
        todayFocus: ['E2E Playwright tests', 'Regression suite'],
        blockers: [],
        prReviews: [],
        lastSyncedAt: new Date().toISOString(),
      };

      const payload = JSON.stringify({ members: [newMember] });
      const result = importTeamStandupJson(payload, DEFAULT_SAMPLE_MEMBERS);

      expect(result.success).toBe(true);
      expect(result.members.length).toBe(DEFAULT_SAMPLE_MEMBERS.length + 1);
      const found = result.members.find((m) => m.id === 'member-new-4');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Azizbek');
    });

    it('gracefully handles malformed JSON input', () => {
      const result = importTeamStandupJson('invalid { json', DEFAULT_SAMPLE_MEMBERS);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Xatolik');
      expect(result.members).toEqual(DEFAULT_SAMPLE_MEMBERS);
    });
  });

  describe('3. synthesizeTeamStandupsWithAi', () => {
    it('parses structured AI synthesis response', async () => {
      vi.mocked(callAi).mockResolvedValueOnce({
        text: JSON.stringify({
          summary: 'Jamoa bugun backend keshlash va mobil UI ustida ishlamoqda.',
          activeBlockersCount: 1,
          crossDependencies: [
            'Jasur Bek Farhodning gRPC backend xizmatiga bog‘langan.',
          ],
          suggestedPairings: [
            'Farhod va Jasur: gRPC protobuf spetsifikatsiyasi bo‘yicha 15 daqiqalik sinxronlashuv.',
          ],
          teamVelocityInsight: 'Blockerni ertalab hal qilish jamoa sprintini 30% tezlashtiradi.',
        }),
        source: 'gemini',
        model: 'gemini-2.5-flash',
      });

      const synthesis = await synthesizeTeamStandupsWithAi(DEFAULT_SAMPLE_MEMBERS);

      expect(synthesis.summary).toContain('backend keshlash');
      expect(synthesis.activeBlockersCount).toBe(1);
      expect(synthesis.crossDependencies.length).toBe(1);
      expect(synthesis.suggestedPairings.length).toBe(1);
      expect(synthesis.aiSource).toBe('gemini');
    });

    it('falls back to rule-based heuristics when AI call fails', async () => {
      vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline'));

      const synthesis = await synthesizeTeamStandupsWithAi(DEFAULT_SAMPLE_MEMBERS);

      expect(synthesis.summary).toContain('Jamoada');
      expect(synthesis.activeBlockersCount).toBeGreaterThanOrEqual(1);
      expect(synthesis.crossDependencies.length).toBeGreaterThan(0);
      expect(synthesis.suggestedPairings.length).toBeGreaterThan(0);
      expect(synthesis.aiSource).toContain('Heuristics');
    });
  });

  describe('4. LocalStorage persistence (load/save)', () => {
    it('loads default sample squad if storage is empty', () => {
      const loaded = loadStoredTeamMembers();
      expect(loaded).toEqual(DEFAULT_SAMPLE_MEMBERS);
    });

    it('persists and reloads updated squad', () => {
      const customSquad: TeamMemberStandup[] = [
        {
          id: 'custom-1',
          name: 'Rustam',
          avatarInitials: 'R',
          role: 'Fullstack',
          currentStatus: 'in_flow',
          moodEmoji: '⚡️',
          todayFocus: ['Feature X'],
          blockers: [],
          prReviews: [],
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      saveStoredTeamMembers(customSquad);
      const reloaded = loadStoredTeamMembers();
      expect(reloaded.length).toBe(1);
      expect(reloaded[0].name).toBe('Rustam');
    });
  });
});
