import { describe, it, expect, beforeEach } from 'vitest';
import {
  logAuditEvent,
  getStoredAuditLogs,
  clearAuditLogs,
  queryAuditLogs,
  aggregateAuditLogs,
  formatAuditLogsForBigQuery,
  formatAuditLogsForElasticSearch,
  getAuditPerformanceStats,
  handleAuditApiEndpoint,
  BIGQUERY_AUDIT_SCHEMA,
  ELASTICSEARCH_AUDIT_MAPPING,
  flushAuditQueueSync,
} from '../lib/audit';
import { useSynapse } from '../lib/store';

describe('Workspace Audit & Audit Logging System', () => {
  beforeEach(() => {
    clearAuditLogs();
    localStorage.clear();
  });

  describe('Core Logging & Schema Compliance', () => {
    it('logs create, update, delete, and switch operations on space, link, and workspace', () => {
      // 1. Space CREATE
      const spaceCreate = logAuditEvent({
        target_type: 'space',
        action: 'create',
        target_id: 'sp-test-1',
        target_name: 'Backend Microservices',
        workspace_id: 'ws-personal',
        details: { icon: 'Code', color: '#3b82f6' },
      });
      expect(spaceCreate.id).toMatch(/^aud-/);
      expect(spaceCreate.target_type).toBe('space');
      expect(spaceCreate.action).toBe('create');
      expect(spaceCreate.status).toBe('success');
      expect(spaceCreate['@timestamp']).toBeDefined();
      expect(spaceCreate.ecs?.version).toBe('8.11.0');
      expect(spaceCreate.event?.action).toBe('space:create');

      // 2. Space UPDATE
      const spaceUpdate = logAuditEvent({
        target_type: 'space',
        action: 'update',
        target_id: 'sp-test-1',
        target_name: 'Backend & Cloud Services',
        workspace_id: 'ws-personal',
        details: { patch: { name: 'Backend & Cloud Services' } },
      });
      expect(spaceUpdate.action).toBe('update');
      expect(spaceUpdate.details.patch.name).toBe('Backend & Cloud Services');

      // 3. Space DELETE
      const spaceDelete = logAuditEvent({
        target_type: 'space',
        action: 'delete',
        target_id: 'sp-test-1',
        target_name: 'Backend & Cloud Services',
        workspace_id: 'ws-personal',
      });
      expect(spaceDelete.action).toBe('delete');

      // 4. Link CREATE, UPDATE, DELETE
      const linkCreate = logAuditEvent({
        target_type: 'link',
        action: 'create',
        target_id: 'link-101',
        target_name: 'GitHub Repository',
        workspace_id: 'ws-personal',
        details: { url: 'https://github.com/Farhodoff/CogniDev', category: 'repo' },
      });
      expect(linkCreate.target_type).toBe('link');
      expect(linkCreate.action).toBe('create');

      const linkUpdate = logAuditEvent({
        target_type: 'link',
        action: 'update',
        target_id: 'link-101',
        target_name: 'GitHub Repository',
        workspace_id: 'ws-personal',
        details: { field: 'pinned', pinned: true },
      });
      expect(linkUpdate.action).toBe('update');

      const linkDelete = logAuditEvent({
        target_type: 'link',
        action: 'delete',
        target_id: 'link-101',
        target_name: 'GitHub Repository',
        workspace_id: 'ws-personal',
      });
      expect(linkDelete.action).toBe('delete');

      // 5. Main View SWITCH
      const mainSwitch = logAuditEvent({
        target_type: 'main',
        action: 'switch',
        target_id: 'space',
        target_name: 'Main View: space',
        workspace_id: 'ws-personal',
        details: { previous_view: 'dashboard', next_view: 'space' },
      });
      expect(mainSwitch.target_type).toBe('main');
      expect(mainSwitch.action).toBe('switch');

      // 6. Workspace CREATE & SWITCH
      const wsCreate = logAuditEvent({
        target_type: 'workspace',
        action: 'create',
        target_id: 'ws-team-alpha',
        target_name: 'Alpha Team Workspace',
        workspace_id: 'ws-team-alpha',
        details: { name: 'Alpha Team Workspace', type: 'team' },
      });
      expect(wsCreate.target_type).toBe('workspace');
      expect(wsCreate.action).toBe('create');

      flushAuditQueueSync();

      const stored = getStoredAuditLogs();
      expect(stored.length).toBe(8);
    });

    it('contains full actor context and timestamp metadata', () => {
      const event = logAuditEvent({
        target_type: 'space',
        action: 'create',
        target_id: 'sp-123',
        target_name: 'AI Engineering',
        actor: {
          id: 'usr-admin',
          username: 'farhod',
          name: 'Farhod Developer',
          role: 'Tech Lead',
          email: 'farhod@cognidev.io',
        },
      });

      expect(event.actor.username).toBe('farhod');
      expect(event.actor.role).toBe('Tech Lead');
      expect(event.user?.id).toBe('usr-admin');
      expect(typeof event.event_timestamp_ms).toBe('number');
      expect(event.event_timestamp_ms).toBeGreaterThan(0);
    });
  });

  describe('Zustand Store Integration', () => {
    it('automatically records audit events when interacting with Zustand store spaces, links, and views', () => {
      const store = useSynapse.getState();

      // Test Space Add
      store.addSpace({
        name: 'DevOps & CI/CD',
        icon: 'Activity',
        color: '#10b981',
      });

      // Test Space Select
      const spaces = useSynapse.getState().spaces;
      const createdSpace = spaces.find((s) => s.name === 'DevOps & CI/CD');
      expect(createdSpace).toBeDefined();

      store.selectSpace(createdSpace!.id);

      // Test Link Add
      store.addLink({
        title: 'CI/CD Pipelines Dashboard',
        url: 'https://ci.cognidev.io',
        category: 'tools',
        tags: ['ci', 'devops'],
        space_id: createdSpace!.id,
        pinned: false,
      });

      const links = useSynapse.getState().links;
      const createdLink = links.find((l) => l.title === 'CI/CD Pipelines Dashboard');
      expect(createdLink).toBeDefined();

      // Test Link Toggle Pin
      store.togglePinLink(createdLink!.id);

      // Test Main View Switch
      store.setMainView('calendar');

      flushAuditQueueSync();
      const logs = getStoredAuditLogs();

      // Verify each store action recorded an audit event
      const spaceCreateLog = logs.find((l) => l.target_type === 'space' && l.action === 'create');
      expect(spaceCreateLog).toBeDefined();
      expect(spaceCreateLog?.target_name).toBe('DevOps & CI/CD');

      const spaceSwitchLog = logs.find((l) => l.target_type === 'space' && l.action === 'switch');
      expect(spaceSwitchLog).toBeDefined();

      const linkCreateLog = logs.find((l) => l.target_type === 'link' && l.action === 'create');
      expect(linkCreateLog).toBeDefined();
      expect(linkCreateLog?.target_name).toBe('CI/CD Pipelines Dashboard');

      const linkUpdateLog = logs.find((l) => l.target_type === 'link' && l.action === 'update');
      expect(linkUpdateLog).toBeDefined();

      const mainViewLog = logs.find((l) => l.target_type === 'main' && l.action === 'switch');
      expect(mainViewLog).toBeDefined();
      expect(mainViewLog?.target_id).toBe('calendar');
    });
  });

  describe('BigQuery & ElasticSearch Compatibility', () => {
    it('formats audit logs into BigQuery-ready NDJSON and verifies schema validity', () => {
      logAuditEvent({
        target_type: 'space',
        action: 'create',
        target_id: 'sp-bq',
        target_name: 'BigQuery Analytics Space',
        details: { dataset: 'audit_vault' },
      });
      logAuditEvent({
        target_type: 'link',
        action: 'create',
        target_id: 'link-bq',
        target_name: 'BigQuery Console',
        details: { url: 'https://console.cloud.google.com/bigquery' },
      });

      flushAuditQueueSync();
      const logs = getStoredAuditLogs();
      const ndjson = formatAuditLogsForBigQuery(logs);

      expect(typeof ndjson).toBe('string');
      const lines = ndjson.trim().split('\n');
      expect(lines.length).toBe(2);

      // Verify each line is valid JSON conforming to BigQuery NDJSON requirements
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed.id).toBeDefined();
        expect(parsed.timestamp).toBeDefined();
        expect(parsed.event_timestamp_ms).toBeTypeOf('number');
        expect(parsed.actor).toBeTypeOf('object');
        expect(parsed.details).toBeTypeOf('object');
      }

      // Verify schema declaration
      expect(BIGQUERY_AUDIT_SCHEMA.length).toBeGreaterThan(5);
      expect(BIGQUERY_AUDIT_SCHEMA.find((f) => f.name === 'id')?.type).toBe('STRING');
      expect(BIGQUERY_AUDIT_SCHEMA.find((f) => f.name === 'event_timestamp_ms')?.type).toBe('INT64');
    });

    it('formats audit logs into Elasticsearch ECS 8.11.0 _bulk ingestion format', () => {
      logAuditEvent({
        target_type: 'space',
        action: 'create',
        target_id: 'sp-es',
        target_name: 'ElasticSearch Cluster Space',
      });
      logAuditEvent({
        target_type: 'workspace',
        action: 'create',
        target_id: 'ws-es',
        target_name: 'Enterprise Observability',
      });

      flushAuditQueueSync();
      const logs = getStoredAuditLogs();
      const bulkPayload = formatAuditLogsForElasticSearch(logs, 'custom-audit-logs');

      expect(typeof bulkPayload).toBe('string');
      const lines = bulkPayload.trim().split('\n');
      expect(lines.length).toBe(4); // 2 action metadata lines + 2 document lines

      const actionLine = JSON.parse(lines[0]);
      expect(actionLine.index._index).toBe('custom-audit-logs');
      expect(actionLine.index._id).toBeDefined();

      const docLine = JSON.parse(lines[1]);
      expect(docLine['@timestamp']).toBeDefined();
      expect(docLine.ecs.version).toBe('8.11.0');
      expect(docLine.event.category).toContain('configuration');

      // Verify mapping
      expect(ELASTICSEARCH_AUDIT_MAPPING.mappings.properties['@timestamp'].type).toBe('date');
      expect(ELASTICSEARCH_AUDIT_MAPPING.mappings.properties.target_type.type).toBe('keyword');
    });
  });

  describe('Performance Overhead Verification (< 5%)', () => {
    it('maintains performance overhead strictly under 5% across high-frequency operations', () => {
      const iterations = 250;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        logAuditEvent({
          target_type: i % 2 === 0 ? 'space' : 'link',
          action: i % 3 === 0 ? 'create' : 'update',
          target_id: `obj-${i}`,
          target_name: `Performance Benchmark Target ${i}`,
          workspace_id: 'ws-perf',
          details: { iteration: i, payload: 'benchmarking non-blocking microtask queue' },
        });
      }

      const totalBenchmarkTime = performance.now() - startTime;
      flushAuditQueueSync();

      const stats = getAuditPerformanceStats();
      expect(stats.totalLoggedEvents).toBeGreaterThanOrEqual(iterations);
      expect(stats.avgOverheadMs).toBeLessThan(1.0); // Sub-millisecond execution!
      expect(stats.overheadPercentage).toBeLessThan(5.0); // Strictly satisfies the < 5% requirement

      // Total time for 250 log events should typically be well under 100ms
      expect(totalBenchmarkTime).toBeLessThan(200);
    });
  });

  describe('Query, Filtering, and Audit API Handler', () => {
    beforeEach(() => {
      // Seed audit entries
      logAuditEvent({ target_type: 'space', action: 'create', target_id: 'sp-1', target_name: 'Frontend Web' });
      logAuditEvent({ target_type: 'space', action: 'update', target_id: 'sp-1', target_name: 'Frontend Web & PWA' });
      logAuditEvent({ target_type: 'space', action: 'delete', target_id: 'sp-1', target_name: 'Frontend Web & PWA' });
      logAuditEvent({ target_type: 'link', action: 'create', target_id: 'lk-1', target_name: 'Vite Docs' });
      logAuditEvent({ target_type: 'workspace', action: 'switch', target_id: 'ws-prod', target_name: 'Production' });
      flushAuditQueueSync();
    });

    it('filters audit logs by target_type, action, and text search', () => {
      const allLogs = getStoredAuditLogs();

      // Filter by target_type: 'space'
      const spaceQuery = queryAuditLogs(allLogs, { target_type: 'space' });
      expect(spaceQuery.total).toBe(3);
      expect(spaceQuery.items.every((i) => i.target_type === 'space')).toBe(true);

      // Filter by action: 'create'
      const createQuery = queryAuditLogs(allLogs, { action: 'create' });
      expect(createQuery.total).toBe(2);

      // Search keyword
      const searchResult = queryAuditLogs(allLogs, { search: 'Vite' });
      expect(searchResult.total).toBe(1);
      expect(searchResult.items[0].target_name).toBe('Vite Docs');
    });

    it('aggregates statistics accurately for audit observability', () => {
      const allLogs = getStoredAuditLogs();
      const aggr = aggregateAuditLogs(allLogs);

      expect(aggr.totalCount).toBe(5);
      expect(aggr.byTargetType.space).toBe(3);
      expect(aggr.byTargetType.link).toBe(1);
      expect(aggr.byTargetType.workspace).toBe(1);
      expect(aggr.byAction.create).toBe(2);
      expect(aggr.byAction.update).toBe(1);
      expect(aggr.byAction.delete).toBe(1);
      expect(aggr.byAction.switch).toBe(1);
    });

    it('handles /api/audit API requests for query, stats, ingest, and clear', async () => {
      // 1. API Query
      const queryRes = await handleAuditApiEndpoint({
        action: 'query',
        options: { target_type: 'link' },
      });
      expect(queryRes.success).toBe(true);
      expect(queryRes.result?.total).toBe(1);

      // 2. API Stats
      const statsRes = await handleAuditApiEndpoint({
        action: 'stats',
      });
      expect(statsRes.success).toBe(true);
      expect(statsRes.stats?.totalCount).toBe(5);

      // 3. API Ingest
      const ingestRes = await handleAuditApiEndpoint({
        action: 'ingest',
        event: {
          target_type: 'link',
          action: 'create',
          target_id: 'link-api',
          target_name: 'API Ingested Bookmark',
        },
      });
      expect(ingestRes.success).toBe(true);
      expect(ingestRes.data.target_name).toBe('API Ingested Bookmark');

      // 4. API Clear
      const clearRes = await handleAuditApiEndpoint({ action: 'clear' });
      expect(clearRes.success).toBe(true);
      expect(getStoredAuditLogs().length).toBe(0);
    });
  });
});
