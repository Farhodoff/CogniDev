import { describe, it, expect } from 'vitest';
import {
  buildWeeklyReportData,
  generateWeeklyReportCsv,
  generateWeeklyReportText,
  exportWeeklyReportToFile,
} from '../lib/weeklyReportExport';
import type { Task, WeeklyCoachInsight } from '../lib/types';

describe('Weekly Report Export Module', () => {
  const sampleTasks: Task[] = [
    {
      id: 'TSK-1',
      workspace_id: 'default',
      title: 'OAuth2 autentifikatsiyani sozlash',
      status: 'completed',
      priority: 'High Priority',
      git_branch: 'feat/auth',
      pr_url: 'https://github.com/test/repo/pull/1',
      ai_source: 'AI Synced',
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['auth', 'backend'],
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'TSK-2',
      workspace_id: 'default',
      title: 'Veb-soket ulanishidagi xatolikni tuzatish',
      status: 'blocker',
      priority: 'P0 Blocker',
      git_branch: 'fix/ws-reconnect',
      pr_url: null,
      ai_source: 'User Manual',
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['websocket', 'bug'],
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'TSK-3',
      workspace_id: 'default',
      title: 'Haftalik hisobot eksporti UI dizayni',
      status: 'active',
      priority: 'Normal',
      git_branch: null,
      pr_url: null,
      ai_source: 'AI Synced',
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['ui', 'export'],
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const sampleNotes = {
    'TSK-1': 'JWT token muddati uzaytirildi va refresh token mexanizmi o‘rnatildi.',
    'TSK-2': 'Server tomonida ping-pong heartbeat qo‘shilishi kerak.',
  };

  const sampleCoach: WeeklyCoachInsight = {
    completedCount: 1,
    deferredCount: 1,
    blockersCount: 1,
    bottlenecks: ['Websocket connection timeout'],
    recommendations: ['TSK-2 blocker ustida ertalab ishlang'],
    summary: 'Hafta davomida auth tizimi yakunlandi, lekin bitta to‘siq mavjud.',
    generatedAt: '27-oktabr, 11:30',
    aiPowered: true,
    aiSource: 'gemini',
  };

  it('buildWeeklyReportData correctly aggregates tasks and metrics', () => {
    const data = buildWeeklyReportData(sampleTasks, sampleNotes, sampleCoach, {
      userName: 'Farhod Muhandis',
    });

    expect(data.userName).toBe('Farhod Muhandis');
    expect(data.totalTasks).toBe(3);
    expect(data.completedCount).toBe(1);
    expect(data.blockersCount).toBe(1);
    expect(data.inProgressCount).toBe(1);
    expect(data.completionRate).toBe(33);
    expect(data.completedTasks[0].note).toContain('JWT token');
    expect(data.aiSummary).toContain('auth tizimi yakunlandi');
  });

  it('generateWeeklyReportCsv formats valid RFC4180 CSV with BOM for Excel', () => {
    const data = buildWeeklyReportData(sampleTasks, sampleNotes, sampleCoach);
    const csv = generateWeeklyReportCsv(data);

    // Checks UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Checks sections
    expect(csv).toContain('COGNIDEV — HAFTALIK HISOBOT');
    expect(csv).toContain('"OAuth2 autentifikatsiyani sozlash"');
    expect(csv).toContain('"TSK-1"');
    expect(csv).toContain('JWT token muddati');
    expect(csv).toContain('P0 Blocker');
  });

  it('generateWeeklyReportText formats readable structured text', () => {
    const data = buildWeeklyReportData(sampleTasks, sampleNotes, sampleCoach);
    const text = generateWeeklyReportText(data);

    expect(text).toContain('COGNIDEV — DASTURCHI HAFTALIK HISOBOTI');
    expect(text).toContain('1. 📊 ASOSIY KO‘RSATKICHLAR & METRIKALAR');
    expect(text).toContain('TSK-1');
    expect(text).toContain('OAuth2 autentifikatsiyani sozlash');
    expect(text).toContain('Problem Solved / Qayd');
    expect(text).toContain('Websocket connection timeout');
  });

  it('exportWeeklyReportToFile triggers browser blob download when not in Tauri', async () => {
    const data = buildWeeklyReportData(sampleTasks, sampleNotes, sampleCoach);
    const resultCsv = await exportWeeklyReportToFile('csv', data, 'Test_Report');
    expect(resultCsv.success).toBe(true);
    expect(resultCsv.filename).toContain('Test_Report_');
    expect(resultCsv.filename).toContain('.csv');

    const resultTxt = await exportWeeklyReportToFile('txt', data, 'Test_Report');
    expect(resultTxt.success).toBe(true);
    expect(resultTxt.filename).toContain('.txt');
  });
});
