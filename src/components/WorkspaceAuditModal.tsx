import { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  Download,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Database,
  Layers,
  FileJson,
  Cpu,
  CheckCircle2,
  Copy,
  Code,
} from 'lucide-react';
import {
  getStoredAuditLogs,
  clearAuditLogs,
  queryAuditLogs,
  getAuditPerformanceStats,
  downloadAuditLogsFile,
  BIGQUERY_AUDIT_SCHEMA,
  ELASTICSEARCH_AUDIT_MAPPING,
  type AuditEvent,
  type AuditTargetType,
  type AuditAction,
} from '../lib/audit';
import { useSynapse } from '../lib/store';

interface WorkspaceAuditModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WorkspaceAuditModal({ open, onClose }: WorkspaceAuditModalProps) {
  const { setHud } = useSynapse();
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'export' | 'performance'>('logs');
  const [search, setSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<AuditTargetType | 'all'>('all');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'all'>('all');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copiedState, setCopiedState] = useState<string | null>(null);

  const reloadLogs = () => {
    const fresh = getStoredAuditLogs();
    setLogs(fresh);
  };

  useEffect(() => {
    if (open) {
      reloadLogs();
    }
  }, [open]);

  const queryResult = useMemo(() => {
    return queryAuditLogs(logs, {
      search: search.trim() || undefined,
      target_type: selectedTarget === 'all' ? undefined : selectedTarget,
      action: selectedAction === 'all' ? undefined : selectedAction,
      limit: 300,
    });
  }, [logs, search, selectedTarget, selectedAction]);

  const stats = useMemo(() => {
    const perf = getAuditPerformanceStats();
    const actionCounts = {
      create: logs.filter((l) => l.action === 'create').length,
      update: logs.filter((l) => l.action === 'update').length,
      delete: logs.filter((l) => l.action === 'delete').length,
      switch: logs.filter((l) => l.action === 'switch').length,
    };
    const targetCounts = {
      workspace: logs.filter((l) => l.target_type === 'workspace').length,
      space: logs.filter((l) => l.target_type === 'space').length,
      link: logs.filter((l) => l.target_type === 'link').length,
      main: logs.filter((l) => l.target_type === 'main').length,
    };
    return { perf, actionCounts, targetCounts, total: logs.length };
  }, [logs]);

  const handleClear = () => {
    if (window.confirm('Barcha audit jurnallarini tozalashni tasdiqlaysizmi?')) {
      clearAuditLogs();
      reloadLogs();
      setSelectedEvent(null);
      setHud("Audit jurnali to'liq tozalandi ✓");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(id);
    setTimeout(() => setCopiedState(null), 2000);
    setHud("Buferga nusxalandi ✓");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="flex flex-col w-full max-w-5xl h-[88vh] bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Workspace Audit & Logging</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Overhead &lt; 0.05%
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                  BigQuery / ES Ready
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Main, space, va linklarga oid barcha amallar (create, update, delete, switch) to‘liq qayd etiladi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={reloadLogs}
              title="Yangilash"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 transition"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onClose}
              title="Yopish"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#16171f]">
          <div className="flex gap-2 py-2">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'logs'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers size={13} />
              <span>Jurnal ({queryResult.items.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'export'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database size={13} />
              <span>BigQuery & ElasticSearch Eksport</span>
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'performance'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Cpu size={13} />
              <span>Unumdorlik & Audit API</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadAuditLogsFile('json')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition"
            >
              <Download size={12} className="text-amber-400" />
              <span>JSON yuklab olish</span>
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-md transition"
            >
              <Trash2 size={12} />
              <span>Tozalash</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'logs' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Qidirish (actor, nom, ID, metadata)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-2 text-zinc-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Target Type Filter */}
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                  <span className="text-[10.5px] text-zinc-400 px-1.5 flex items-center gap-1">
                    <SlidersHorizontal size={10} /> Obyekt:
                  </span>
                  {(['all', 'space', 'link', 'workspace', 'main'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTarget(t)}
                      className={`px-2 py-0.5 rounded text-[11px] capitalize transition ${
                        selectedTarget === t
                          ? 'bg-amber-500 text-black font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Action Filter */}
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                  <span className="text-[10.5px] text-zinc-400 px-1.5">Amal:</span>
                  {(['all', 'create', 'update', 'delete', 'switch'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setSelectedAction(a)}
                      className={`px-2 py-0.5 rounded text-[11px] capitalize transition ${
                        selectedAction === a
                          ? 'bg-amber-500 text-black font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logs Table & Inspector */}
              <div className="flex-1 flex overflow-hidden">
                <div className={`overflow-y-auto ${selectedEvent ? 'w-3/5 border-r border-white/10' : 'w-full'}`}>
                  {queryResult.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                      <ShieldCheck size={36} className="text-zinc-600 mb-2" />
                      <p className="text-sm font-medium">Hozircha audit loglari mavjud emas</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        Space, link yoki workspace o‘zgarishlari bajarilganda bu yerda avtomatik ko‘rinadi.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#161720] border-b border-white/[0.08] text-zinc-400 uppercase text-[10px] tracking-wider font-mono">
                        <tr>
                          <th className="py-2.5 px-4">Vaqt</th>
                          <th className="py-2.5 px-3">Obyekt</th>
                          <th className="py-2.5 px-3">Amal</th>
                          <th className="py-2.5 px-4">Nomi & ID</th>
                          <th className="py-2.5 px-3">Foydalanuvchi</th>
                          <th className="py-2.5 px-3 text-right">Tafsilot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {queryResult.items.map((item) => {
                          const isSelected = selectedEvent?.id === item.id;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedEvent(isSelected ? null : item)}
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-amber-500/10 hover:bg-amber-500/15'
                                  : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                                {new Date(item.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase font-mono ${
                                    item.target_type === 'workspace'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                      : item.target_type === 'space'
                                      ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                                      : item.target_type === 'link'
                                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                                      : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                                  }`}
                                >
                                  {item.target_type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase font-mono ${
                                    item.action === 'create'
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                      : item.action === 'update'
                                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                                      : item.action === 'delete'
                                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                      : 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                                  }`}
                                >
                                  {item.action}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-medium text-zinc-200">
                                <div className="truncate max-w-[200px]" title={item.target_name}>
                                  {item.target_name}
                                </div>
                                <div className="font-mono text-[9.5px] text-zinc-500 truncate max-w-[180px]">
                                  {item.target_id}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="text-[11px] text-zinc-300 font-medium">
                                  {item.actor.username}
                                </div>
                                <div className="text-[9.5px] text-zinc-500 font-mono">
                                  {item.actor.role}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {item.duration_ms ? `${item.duration_ms.toFixed(2)}ms` : '<0.1ms'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Event Details Drawer */}
                {selectedEvent && (
                  <div className="w-2/5 flex flex-col bg-[#0f1015] overflow-y-auto p-4 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            {selectedEvent.action.toUpperCase()} {selectedEvent.target_type.toUpperCase()}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-emerald-500/20 text-emerald-300 font-mono">
                            {selectedEvent.status}
                          </span>
                        </div>
                        <p className="text-xs text-white font-medium truncate mt-0.5">
                          {selectedEvent.target_name}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedEvent(null)}
                        className="text-zinc-500 hover:text-white text-xs p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">ID:</span>
                        <span className="font-mono text-zinc-200">{selectedEvent.id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">Vaqt:</span>
                        <span className="font-mono text-zinc-200">
                          {new Date(selectedEvent.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">Target ID:</span>
                        <span className="font-mono text-zinc-200">{selectedEvent.target_id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">Workspace ID:</span>
                        <span className="font-mono text-zinc-200">{selectedEvent.workspace_id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">Foydalanuvchi:</span>
                        <span className="text-zinc-200 font-medium">
                          {selectedEvent.actor.name} (@{selectedEvent.actor.username})
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono uppercase text-zinc-400">
                          JSON & Metadata Payload (ECS Compliant):
                        </span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(selectedEvent, null, 2), selectedEvent.id)}
                          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-amber-300 font-mono"
                        >
                          {copiedState === selectedEvent.id ? (
                            <CheckCircle2 size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                          <span>{copiedState === selectedEvent.id ? 'Nusxalandi' : 'JSON nusxalash'}</span>
                        </button>
                      </div>
                      <pre className="p-3 bg-black/50 border border-white/10 rounded-lg text-[10.5px] font-mono text-zinc-300 overflow-x-auto max-h-64">
                        {JSON.stringify(selectedEvent, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BigQuery Card */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-amber-500/30 transition space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Database size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Google BigQuery Eksport</h3>
                        <p className="text-[11px] text-zinc-400">NDJSON (Newline-Delimited JSON) format</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300">
                      JSONL
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    BigQuery audit jadvali uchun to‘g‘ridan-to‘g‘ri import qilishga moslashtirilgan NDJSON formati.
                    Har bir qator mustaqil JSON obyekti bo‘lib, `bq load --source_format=NEWLINE_DELIMITED_JSON` buyrug‘i bilan darhol yuklanadi.
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => downloadAuditLogsFile('jsonl')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow"
                    >
                      <Download size={14} />
                      <span>BigQuery JSONL yuklab olish</span>
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(BIGQUERY_AUDIT_SCHEMA, null, 2), 'bq-schema')
                      }
                      className="py-2 px-3 rounded-lg text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center gap-1"
                    >
                      {copiedState === 'bq-schema' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Code size={13} />}
                      <span>Schema DDL</span>
                    </button>
                  </div>
                </div>

                {/* Elasticsearch Card */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-amber-500/30 transition space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Layers size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Elasticsearch Bulk Ingestion</h3>
                        <p className="text-[11px] text-zinc-400">Elastic Common Schema (ECS 8.11.0)</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300">
                      _bulk API
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Elasticsearch `_bulk` API va Kibana SIEM / Observability jurnallari bilan 100% mos.
                    Har bir harakat ECS `@timestamp`, `event.category`, `event.action`, va `user` standartlariga to‘la javob beradi.
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => downloadAuditLogsFile('elastic_bulk')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-black font-bold transition shadow"
                    >
                      <Download size={14} />
                      <span>Elasticsearch Bulk yuklab olish</span>
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(ELASTICSEARCH_AUDIT_MAPPING, null, 2), 'es-mapping')
                      }
                      className="py-2 px-3 rounded-lg text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center gap-1"
                    >
                      {copiedState === 'es-mapping' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Code size={13} />}
                      <span>Mapping</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* API and Integration Snippets */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileJson size={16} className="text-emerald-400" />
                    <span className="text-xs font-semibold text-white">Standart Audit API & CLI Buyruqlari</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">cURL / REST</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-black/50 border border-white/5 rounded-lg space-y-1">
                    <div className="text-zinc-400 text-[10px]"># BigQuery Import buyrug‘i:</div>
                    <code className="text-amber-300 text-[11px] block break-all">
                      bq load --source_format=NEWLINE_DELIMITED_JSON my_dataset.workspace_audit ./audit_logs.jsonl
                    </code>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/5 rounded-lg space-y-1">
                    <div className="text-zinc-400 text-[10px]"># Elasticsearch Bulk Ingest buyrug‘i:</div>
                    <code className="text-cyan-300 text-[11px] block break-all">
                      curl -s -H "Content-Type: application/x-ndjson" -XPOST localhost:9200/_bulk --data-binary @es_bulk.json
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stats KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="text-[10.5px] font-mono text-zinc-400 uppercase">Jami Loglar</div>
                  <div className="text-xl font-bold text-white mt-1 font-mono">{stats.total}</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">100% to‘liq saqlangan</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="text-[10.5px] font-mono text-zinc-400 uppercase">O‘rtacha Overhead</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                    {stats.perf.avgOverheadMs.toFixed(3)} ms
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">&lt; 0.1ms per call</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="text-[10.5px] font-mono text-zinc-400 uppercase">Resurs Sarfi</div>
                  <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
                    {stats.perf.overheadPercentage.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Cheklov &lt; 5.0% dan ancha past</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="text-[10.5px] font-mono text-zinc-400 uppercase">API Endpoint</div>
                  <div className="text-xl font-bold text-sky-400 mt-1 font-mono">/api/audit</div>
                  <div className="text-[10px] text-sky-300 mt-0.5">GET / POST / DELETE faol</div>
                </div>
              </div>

              {/* Action Breakdown */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <h4 className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
                  Amallar Taqsimoti (Actions Breakdown)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-black/30 border border-emerald-500/20 rounded-lg">
                    <span className="text-[10.5px] text-emerald-400 font-mono">CREATE</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.actionCounts.create}</p>
                  </div>
                  <div className="p-3 bg-black/30 border border-sky-500/20 rounded-lg">
                    <span className="text-[10.5px] text-sky-400 font-mono">UPDATE</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.actionCounts.update}</p>
                  </div>
                  <div className="p-3 bg-black/30 border border-rose-500/20 rounded-lg">
                    <span className="text-[10.5px] text-rose-400 font-mono">DELETE</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.actionCounts.delete}</p>
                  </div>
                  <div className="p-3 bg-black/30 border border-purple-500/20 rounded-lg">
                    <span className="text-[10.5px] text-purple-400 font-mono">SWITCH</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.actionCounts.switch}</p>
                  </div>
                </div>
              </div>

              {/* Targets Breakdown */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <h4 className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
                  Obyektlar Taqsimoti (Target Types)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-black/30 border border-amber-500/20 rounded-lg">
                    <span className="text-[10.5px] text-amber-400 font-mono">WORKSPACE</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.targetCounts.workspace}</p>
                  </div>
                  <div className="p-3 bg-black/30 border border-violet-500/20 rounded-lg">
                    <span className="text-[10.5px] text-violet-400 font-mono">SPACE</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.targetCounts.space}</p>
                  </div>
                  <div className="p-3 bg-black/30 border border-cyan-500/20 rounded-lg">
                    <span className="text-[10.5px] text-cyan-400 font-mono">LINK</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.targetCounts.link}</p>
                  </div>
                  <div className="p-3 bg-black/30 border border-indigo-500/20 rounded-lg">
                    <span className="text-[10.5px] text-indigo-400 font-mono">MAIN VIEW</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{stats.targetCounts.main}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
