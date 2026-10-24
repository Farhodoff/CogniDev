import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchesDateInText,
  scanRoadmapsForDate,
  buildFocusTasksFromRoadmapGoals,
} from '../lib/roadmapDailyScanner';
import {
  getDailyRoutineStatus,
  saveDailyRoutineStatus,
  executeDailyRoutineStage,
} from '../lib/dailyRoutineSchedule';
import type { RoadmapItem, Task } from '../lib/types';

describe('Roadmap Daily Scanner & Date Matching', () => {
  it('correctly matches dates in various formats', () => {
    const targetDate = new Date('2026-10-24T12:00:00Z');

    // ISO format
    expect(matchesDateInText('Mavzu: 2026-10-24 Redis Pub/Sub', targetDate).matched).toBe(true);

    // European format
    expect(matchesDateInText('24.10.2026 - Go goroutines & channels', targetDate).matched).toBe(true);
    expect(matchesDateInText('24.10 Docker compose', targetDate).matched).toBe(true);

    // Uzbek named month
    expect(matchesDateInText('24-oktabr: PostgreSQL query optimization', targetDate).matched).toBe(true);
    expect(matchesDateInText('24-oktyabr kuni kesh tahlili', targetDate).matched).toBe(true);

    // Day keywords
    expect(matchesDateInText('24-kun: Microservices arch', targetDate).matched).toBe(true);
    expect(matchesDateInText('Kun 24: Distributed tracing', targetDate).matched).toBe(true);

    // Non-matching date
    expect(matchesDateInText('25-oktabr: Kelgusi reja', targetDate).matched).toBe(false);
  });

  it('scans multiple roadmaps and finds today goals', () => {
    const targetDate = new Date('2026-10-24T12:00:00Z');

    const sampleRoadmaps: RoadmapItem[] = [
      {
        id: 'rd-1',
        title: 'Backend Go Track (2026)',
        stack: 'Go → Gin → gRPC',
        description: 'Go muhandislik yo‘li',
        milestones: [
          {
            id: 'm-1',
            title: '1-Bosqich: Asoslar',
            topics: [
              { id: 't-1', title: '24-oktabr: Go goroutine va mutexlar', done: false },
              { id: 't-2', title: '25-oktabr: Channels va select', done: false },
            ],
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'rd-2',
        title: 'Database Architecture (2026)',
        stack: 'PostgreSQL → Redis',
        description: 'DB optimizatsiya',
        milestones: [
          {
            id: 'm-2',
            title: '2-Bosqich: Kesh',
            topics: [
              { id: 't-3', title: 'Redis cluster sozlash', done: false },
            ],
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const results = scanRoadmapsForDate(sampleRoadmaps, targetDate, { includeNextPendingIfNoDate: true });
    expect(results.length).toBeGreaterThanOrEqual(1);

    // First roadmap matches date explicitly
    const goMatch = results.find((r) => r.topicId === 't-1');
    expect(goMatch).toBeDefined();
    expect(goMatch?.isDateMatched).toBe(true);

    // Second roadmap falls back to current pending topic
    const dbMatch = results.find((r) => r.topicId === 't-3');
    expect(dbMatch).toBeDefined();
  });

  it('builds synchronized focus tasks from roadmap goals', () => {
    const goals = [
      {
        roadmapId: 'rd-1',
        roadmapTitle: 'Python Senior Track',
        roadmapStack: 'Python / FastAPI',
        milestoneId: 'm-1',
        milestoneTitle: 'AsyncIO',
        topicId: 't-101',
        topicTitle: 'Event Loop va coroutinelar',
        done: false,
        isDateMatched: true,
      },
    ];

    const existingTasks: Task[] = [];
    const { tasksToAdd } = buildFocusTasksFromRoadmapGoals(goals, existingTasks);

    expect(tasksToAdd.length).toBe(1);
    expect(tasksToAdd[0].tags).toContain('focus');
    expect(tasksToAdd[0].tags).toContain('roadmap');
    expect(tasksToAdd[0].ai_source).toBe('roadmap_topic:t-101');
    expect(tasksToAdd[0].status).toBe('active');
  });
});

describe('3-Stage Daily Routine Voice Notifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly tracks daily routine status', () => {
    const status = getDailyRoutineStatus('2026-10-24');
    expect(status.morning_10).toBe(false);
    expect(status.midday_14).toBe(false);
    expect(status.evening_22).toBe(false);

    saveDailyRoutineStatus({
      ...status,
      morning_10: true,
    });

    const updated = getDailyRoutineStatus('2026-10-24');
    expect(updated.morning_10).toBe(true);
  });

  it('executes morning 10:00 stage and formats voice reminder', async () => {
    const dummyTasks: Task[] = [
      {
        id: 'task-1',
        workspace_id: 'personal',
        group_id: null,
        space_id: null,
        title: '[FastAPI] Event Loop tahlili',
        status: 'active',
        priority: 'High Priority',
        git_branch: null,
        pr_url: null,
        ai_source: 'roadmap_topic:t-1',
        assignee_name: 'Farhod',
        assignee_avatar: 'FA',
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ['focus', 'roadmap'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    let bannerFired = false;

    const res = await executeDailyRoutineStage(
      'morning_10',
      {
        tasks: dummyTasks,
        roadmaps: [],
        scheduleBlocks: [],
        soundEnabled: false,
        userName: 'Farhod',
        onAlertBanner: () => {
          bannerFired = true;
        },
      },
      true
    );

    expect(res.success).toBe(true);
    expect(res.voiceMessage).toContain('10:00');
    expect(res.voiceMessage).toContain('Farhod');
    expect(bannerFired).toBe(true);
  });

  it('executes midday 14:00 stage and reports pending tasks', async () => {
    const dummyTasks: Task[] = [
      {
        id: 'task-1',
        workspace_id: 'personal',
        group_id: null,
        space_id: null,
        title: 'Redis Cluster sozlash',
        status: 'active', // not completed
        priority: 'High Priority',
        git_branch: null,
        pr_url: null,
        ai_source: 'roadmap_topic:t-2',
        assignee_name: 'Farhod',
        assignee_avatar: 'FA',
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ['focus', 'roadmap'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const res = await executeDailyRoutineStage(
      'midday_14',
      {
        tasks: dummyTasks,
        roadmaps: [],
        scheduleBlocks: [],
        soundEnabled: false,
        userName: 'Farhod',
      },
      true
    );

    expect(res.success).toBe(true);
    expect(res.voiceMessage).toContain('14:00');
    expect(res.voiceMessage).toContain('bajarilmagan');
  });

  it('executes evening 22:00 stage and audits missed tasks', async () => {
    const dummyTasks: Task[] = [
      {
        id: 'task-1',
        workspace_id: 'personal',
        group_id: null,
        space_id: null,
        title: 'Kafka Partitions test',
        status: 'active',
        priority: 'High Priority',
        git_branch: null,
        pr_url: null,
        ai_source: 'roadmap_topic:t-3',
        assignee_name: 'Farhod',
        assignee_avatar: 'FA',
        assignee_name2: null,
        assignee_avatar2: null,
        tags: ['focus', 'roadmap'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const res = await executeDailyRoutineStage(
      'evening_22',
      {
        tasks: dummyTasks,
        roadmaps: [],
        scheduleBlocks: [],
        soundEnabled: false,
        userName: 'Farhod',
      },
      true
    );

    expect(res.success).toBe(true);
    expect(res.voiceMessage).toContain('22:00');
    expect(res.voiceMessage).toContain('qilinmagan vazifa qoldi');
  });
});
