import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleMetricsPushEndpoint,
  handleMetricsHttpRequest,
  registerSseClient,
  subscribeToRealtimeMetrics,
  getRealtimeMetricsSnapshot,
  getActiveSessionCount,
  resetRealtimeMetricsStore,
  useRealtimeMetricsStore,
  type SseResponseLike,
  type DashboardMetricsPayload,
} from '../lib/realtimeMetrics';

describe('Real-Time Metrics Push API Engine', () => {
  beforeEach(() => {
    resetRealtimeMetricsStore();
  });

  describe('PUT /api/v1/metrics/:id endpoint routing & validation', () => {
    it('successfully processes weeklyOverview updates via HTTP router with sub-90ms latency', async () => {
      const payload: DashboardMetricsPayload = {
        weeklyOverview: {
          dateRangeStr: '20 Okt - 26 Okt',
          completedCount: 18,
          notesCount: 7,
          totalHours: 34.5,
          projectsCount: 4,
          days: [
            { name: 'Du', heightPercent: 60, totalActivity: 6, isToday: false },
            { name: 'Se', heightPercent: 80, totalActivity: 8, isToday: true },
          ],
        },
      };

      const start = performance.now();
      const response = await handleMetricsHttpRequest('PUT', '/api/v1/metrics/default', payload);
      const elapsed = performance.now() - start;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('default');
      expect(response.body.latency_ms).toBeLessThan(90);
      expect(elapsed).toBeLessThan(90);

      const snapshot = getRealtimeMetricsSnapshot();
      expect(snapshot.weeklyOverview?.completedCount).toBe(18);
      expect(snapshot.weeklyOverview?.totalHours).toBe(34.5);
    });

    it('successfully processes currentFocus updates and broadcasts them', async () => {
      const payload: DashboardMetricsPayload = {
        currentFocus: {
          items: [
            { id: 'focus-1', title: 'Complete Real-time SSE Push API', status: 'completed' },
            { id: 'focus-2', title: 'Verify 10k session benchmark', status: 'in_progress', priority: 'urgent' },
          ],
        },
      };

      const response = await handleMetricsHttpRequest('PUT', '/api/v1/metrics/session-user-1', payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metrics.currentFocus.items).toHaveLength(2);

      const snapshot = getRealtimeMetricsSnapshot();
      expect(snapshot.currentFocus?.items).toHaveLength(2);
      expect(snapshot.currentFocus?.items[0].title).toBe('Complete Real-time SSE Push API');
      expect(snapshot.currentFocus?.items[0].status).toBe('completed');
    });

    it('successfully processes progressBar updates with percentage clamping', async () => {
      const payload: DashboardMetricsPayload = {
        progressBar: {
          percentage: 85,
          label: 'Q4 Frontend Roadmap Milestones',
          roadmapProgress: 85,
        },
      };

      const response = await handleMetricsHttpRequest('PUT', '/api/v1/metrics/roadmap-progress', payload);

      expect(response.status).toBe(200);
      expect(response.body.metrics.progressBar.percentage).toBe(85);

      const snapshot = getRealtimeMetricsSnapshot();
      expect(snapshot.progressBar?.percentage).toBe(85);
      expect(snapshot.progressBar?.label).toBe('Q4 Frontend Roadmap Milestones');
    });

    it('handles combined metrics payload simultaneously with strict sub-90ms latency', async () => {
      const payload: DashboardMetricsPayload = {
        weeklyOverview: {
          completedCount: 25,
          notesCount: 10,
          totalHours: 42,
          projectsCount: 5,
          days: [],
        },
        currentFocus: {
          items: [
            { id: 'f-1', title: 'Deliver Sprint Release', status: 'in_progress' },
          ],
        },
        progressBar: {
          percentage: 92,
          label: 'Overall Sprint Progress',
        },
      };

      const start = performance.now();
      const response = await handleMetricsHttpRequest('PUT', '/api/v1/metrics/sprint-overview', payload);
      const elapsed = performance.now() - start;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metrics.weeklyOverview.completedCount).toBe(25);
      expect(response.body.metrics.progressBar.percentage).toBe(92);
      expect(elapsed).toBeLessThan(90);
    });

    it('rejects empty payloads with 400 Bad Request', async () => {
      const response = await handleMetricsHttpRequest('PUT', '/api/v1/metrics/default', {});
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No valid metric payload');
    });

    it('clamps invalid progressBar percentage to valid 0-100 range', async () => {
      await handleMetricsPushEndpoint('default', {
        progressBar: {
          percentage: 150,
          label: 'Over 100%',
        },
      });

      const snapshot = getRealtimeMetricsSnapshot();
      expect(snapshot.progressBar?.percentage).toBe(100);

      await handleMetricsPushEndpoint('default', {
        progressBar: {
          percentage: -20,
          label: 'Under 0%',
        },
      });

      const snapshot2 = getRealtimeMetricsSnapshot();
      expect(snapshot2.progressBar?.percentage).toBe(0);
    });

    it('serves GET /api/v1/metrics snapshot correctly', async () => {
      await handleMetricsPushEndpoint('seed', {
        progressBar: { percentage: 40, label: 'Initial' },
      });

      const getResponse = await handleMetricsHttpRequest('GET', '/api/v1/metrics');
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.metrics.progressBar.percentage).toBe(40);
    });
  });

  describe('High-concurrency session scalability (10 000+ sessions)', () => {
    it('supports 10 000 concurrent subscriber listeners with broadcast latency well under 90ms', async () => {
      const SESSION_COUNT = 10_000;
      let totalReceivedEvents = 0;

      // Register 10,000 in-memory subscriber sessions
      const unsubs: Array<() => void> = [];
      for (let i = 0; i < SESSION_COUNT; i++) {
        unsubs.push(
          subscribeToRealtimeMetrics(() => {
            totalReceivedEvents++;
          })
        );
      }

      // Check registered subscriber count
      expect(getActiveSessionCount()).toBeGreaterThanOrEqual(SESSION_COUNT);

      // Perform a push to all 10,000 active sessions and measure latency
      const start = performance.now();
      const result = await handleMetricsPushEndpoint('bulk-test', {
        progressBar: {
          percentage: 50,
          label: 'Broadcast to 10k sessions',
        },
      });
      const broadcastDurationMs = performance.now() - start;

      // Verify acceptance criteria:
      // 1. 10 000 sessions received the metric
      // 2. Completed well within 90ms limit
      expect(result.success).toBe(true);
      expect(totalReceivedEvents).toBe(SESSION_COUNT);
      expect(broadcastDurationMs).toBeLessThan(90);
      expect(result.broadcast_count).toBeGreaterThanOrEqual(SESSION_COUNT);

      // Clean up subscriptions
      for (const unsub of unsubs) {
        unsub();
      }

      // Store listener may remain, so check that we decremented by 10,000
      expect(getActiveSessionCount()).toBeLessThan(5);
    });

    it('supports 1 000 concurrent SSE HTTP client streams simultaneously', async () => {
      const SSE_CLIENTS_COUNT = 1000;
      const mockClients: SseResponseLike[] = [];
      const writtenChunks: string[] = [];

      for (let i = 0; i < SSE_CLIENTS_COUNT; i++) {
        const client: SseResponseLike = {
          write: vi.fn((chunk: string) => {
            writtenChunks.push(chunk);
            return true;
          }),
          end: vi.fn(),
          on: vi.fn(),
        };
        mockClients.push(client);
        registerSseClient(client);
      }

      // Verify initial sync event was written to each client upon connection
      expect(mockClients[0].write).toHaveBeenCalled();

      // Clear chunk count before broadcast
      writtenChunks.length = 0;

      // Push real-time metric
      const start = performance.now();
      await handleMetricsPushEndpoint('sse-broadcast', {
        weeklyOverview: {
          completedCount: 99,
          notesCount: 20,
          totalHours: 15,
          projectsCount: 3,
          days: [],
        },
      });
      const broadcastTime = performance.now() - start;

      expect(broadcastTime).toBeLessThan(90);
      // All 1,000 SSE clients should have received the formatted event
      expect(writtenChunks.length).toBe(SSE_CLIENTS_COUNT);
      expect(writtenChunks[0]).toContain('event: metrics\n');
      expect(writtenChunks[0]).toContain('"completedCount":99');
    });
  });

  describe('Zustand Reactive Store integration', () => {
    it('updates client store reactively when metric is pushed', async () => {
      expect(useRealtimeMetricsStore.getState().metrics.weeklyOverview).toBeNull();

      await handleMetricsPushEndpoint('test', {
        weeklyOverview: {
          dateRangeStr: 'Custom Range',
          completedCount: 12,
          notesCount: 4,
          totalHours: 16,
          projectsCount: 2,
          days: [],
        },
      });

      const storeState = useRealtimeMetricsStore.getState();
      expect(storeState.metrics.weeklyOverview?.dateRangeStr).toBe('Custom Range');
      expect(storeState.metrics.weeklyOverview?.completedCount).toBe(12);
      expect(storeState.isConnected).toBe(true);
    });
  });
});
