import { describe, it, expect } from 'vitest';
import {
  buildActivityMatrix,
  generateWeeklyInfographic,
} from '../lib/developerHealth';
import type { Task, LearningLog } from '../lib/types';

describe('📊 Developer Health & Growth Analytics', () => {
  describe('1. buildActivityMatrix (GitHub Heatmap Matrix)', () => {
    it('generates 52 weeks (364 days) of structured activity cells', () => {
      const summary = buildActivityMatrix([]);
      expect(summary.weeksCount).toBe(52);
      expect(summary.cells).toHaveLength(52 * 7);
      expect(summary.cells[0]).toHaveProperty('date');
      expect(summary.cells[0]).toHaveProperty('count');
      expect(summary.cells[0]).toHaveProperty('level');
    });

    it('aggregates completed tasks and assigns appropriate activity levels', () => {
      const today = new Date().toISOString();
      const mockTasks: Task[] = [
        {
          id: 't-1',
          title: 'Implement Redis Caching Layer',
          status: 'completed',
          priority: 'High Priority',
          tags: ['redis', 'backend'],
          created_at: today,
          updated_at: today,
          workspace_id: 'ws-1',
          group_id: null,
          space_id: null,
          git_branch: 'feat/redis',
          pr_url: null,
          ai_source: null,
          assignee_name: 'Farhod',
          assignee_avatar: 'F',
          assignee_name2: null,
          assignee_avatar2: null,
        },
        {
          id: 't-2',
          title: 'Setup gRPC Protobuf Definitions',
          status: 'completed',
          priority: 'Critical',
          tags: ['go', 'grpc'],
          created_at: today,
          updated_at: today,
          workspace_id: 'ws-1',
          group_id: null,
          space_id: null,
          git_branch: 'feat/grpc',
          pr_url: null,
          ai_source: null,
          assignee_name: 'Farhod',
          assignee_avatar: 'F',
          assignee_name2: null,
          assignee_avatar2: null,
        },
      ];

      const mockLogs: LearningLog[] = [
        {
          id: 'log-1',
          roadmap_id: 'rm-1',
          date: today.slice(0, 10),
          learned: 'Redis cache eviction policies (LRU/LFU)',
          created_at: today,
        },
      ];

      const summary = buildActivityMatrix(mockTasks, mockLogs);
      expect(summary.totalAnnualContributions).toBeGreaterThanOrEqual(3);
      expect(summary.currentStreakDays).toBeGreaterThanOrEqual(1);

      const todayKey = today.slice(0, 10);
      const todayCell = summary.cells.find((c) => c.date === todayKey);
      expect(todayCell).toBeDefined();
      expect(todayCell?.tasksCount).toBe(2);
      expect(todayCell?.learningCount).toBe(1);
      expect(todayCell?.level).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. generateWeeklyInfographic (Tech Stack & Peak Hours)', () => {
    it('accurately groups tasks into tech stacks with calculated hours', () => {
      const mockTasks: Task[] = [
        {
          id: 't-1',
          title: 'React UI component optimization',
          status: 'completed',
          priority: 'High Priority',
          tags: ['react', 'typescript'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'ws-1',
          group_id: null,
          space_id: null,
          git_branch: null,
          pr_url: null,
          ai_source: null,
          assignee_name: 'Farhod',
          assignee_avatar: 'F',
          assignee_name2: null,
          assignee_avatar2: null,
        },
        {
          id: 't-2',
          title: 'Rust Tauri tray integration',
          status: 'completed',
          priority: 'Critical',
          tags: ['rust', 'tauri'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workspace_id: 'ws-1',
          group_id: null,
          space_id: null,
          git_branch: 'feat/tauri-tray',
          pr_url: null,
          ai_source: null,
          assignee_name: 'Farhod',
          assignee_avatar: 'F',
          assignee_name2: null,
          assignee_avatar2: null,
        },
      ];

      const infographic = generateWeeklyInfographic(mockTasks, [], 120);

      expect(infographic.techStackBreakdown.length).toBeGreaterThan(0);
      const reactStack = infographic.techStackBreakdown.find((t) => t.tech.includes('TypeScript'));
      const rustStack = infographic.techStackBreakdown.find((t) => t.tech.includes('Rust'));

      expect(reactStack).toBeDefined();
      expect(rustStack).toBeDefined();
      expect(infographic.totalFocusedHours).toBeGreaterThan(0);
    });

    it('identifies 10:00-13:00 as the golden focus productivity window', () => {
      const infographic = generateWeeklyInfographic([], [], 0);

      expect(infographic.peakHoursRange).toBe('10:00 – 13:00');
      expect(infographic.hourlyStats).toHaveLength(24);

      const peak10 = infographic.hourlyStats.find((h) => h.hour === 10);
      const peak12 = infographic.hourlyStats.find((h) => h.hour === 12);
      expect(peak10?.isPeak).toBe(true);
      expect(peak12?.isPeak).toBe(true);

      expect(infographic.aiCoachAdvice).toContain('10:00 – 13:00');
      expect(infographic.aiCoachAdvice).toContain('Murabbiy');
    });
  });
});
