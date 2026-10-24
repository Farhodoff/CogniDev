import { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Bug,
  Check,
  Copy,
  FileCode,
  FileText,
  PlusCircle,
  HelpCircle,
  ShieldAlert,
  Zap,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import {
  diagnoseErrorWithRubberDuck,
  findSimilarHistoricalErrors,
  type RubberDuckDiagnosticResult,
  type RubberDuckMode,
} from '../lib/rubberDuck';

const SAMPLE_ERRORS = [
  {
    label: 'TypeScript Null Pointer',
    tech: 'TypeScript / React',
    error: `TypeError: Cannot read properties of undefined (reading 'map')
    at TaskList (TaskList.tsx:42:18)
    at renderWithHooks (react-dom.development.js:15486)
    at mountIndeterminateComponent (react-dom.development.js:20103)`,
    code: `export function TaskList({ tasks }: { tasks?: Task[] }) {
  return (
    <div>
      {tasks.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
}`,
  },
  {
    label: 'Rust Borrow Checker',
    tech: 'Rust / Tauri',
    error: `error[E0382]: borrow of moved value: \`config\`
  --> src/main.rs:24:19
   |
22 |     let config = load_config();
   |         ------ move occurs because \`config\` has type \`AppConfig\`, which does not implement \`Copy\`
23 |     spawn_worker(config);
   |                  ------ value moved here
24 |     println!("{:?}", config);
   |                      ^^^^^^ value borrowed here after move`,
    code: `fn main() {
    let config = load_config();
    spawn_worker(config);
    println!("{:?}", config);
}`,
  },
  {
    label: 'CORS Policy Error',
    tech: 'Web / REST API',
    error: `Access to fetch at 'https://api.cognidev.ai/v1/sync' from origin 'http://localhost:1420' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`,
    code: `// Fastify / Express Backend
app.get('/v1/sync', async (req, reply) => {
  return { status: 'ok', data: [] };
});`,
  },
];

export default function RubberDuckModal() {
  const {
    showRubberDuckModal,
    setRubberDuckModal,
    tasks,
    notesDocs,
    learningLogs,
    createNote,
    updateNoteDoc,
    addTask,
    setHud,
  } = useSynapse();

  const [mode, setMode] = useState<RubberDuckMode>('patch');
  const [techContext, setTechContext] = useState<string>('Auto-detect');
  const [errorMessage, setErrorMessage] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RubberDuckDiagnosticResult | null>(null);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [savedToNote, setSavedToNote] = useState(false);
  const [savedToTask, setSavedToTask] = useState(false);

  // Live historical matches count
  const liveHistoricalMatches = useMemo(() => {
    if (!errorMessage.trim()) return [];
    return findSimilarHistoricalErrors(errorMessage, tasks, notesDocs, learningLogs);
  }, [errorMessage, tasks, notesDocs, learningLogs]);

  if (!showRubberDuckModal) return null;

  const handleDiagnose = async () => {
    if (!errorMessage.trim()) return;
    setLoading(true);
    setCopiedPatch(false);
    setSavedToNote(false);
    setSavedToTask(false);

    try {
      const diag = await diagnoseErrorWithRubberDuck({
        errorMessage,
        codeSnippet,
        techContext,
        mode,
        tasks,
        notesDocs,
        learningLogs,
      });
      setResult(diag);
      setHud?.(`🦆 Rubber Duck: "${diag.errorType}" tahlili tayyor`);
    } catch (err) {
      console.error(err);
      setHud?.(`Xatolik tahlilida nosozlik yuz berdi`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPatch = () => {
    const textToCopy = result?.codePatch?.fixedSnippet || result?.recommendedFix || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedPatch(true);
      setTimeout(() => setCopiedPatch(false), 2000);
      setHud?.('📋 Tuzatilgan kod buferga nusxalandi');
    }
  };

  const handleSaveToNote = async () => {
    if (!result) return;
    const noteContent = `# 🦆 Xatolik Yechimi: ${result.errorType}

**Xulosa:** ${result.summary}

### 🔍 Asl Kelib Chiqish Sababi
${result.rootCause}

### 🛠 Tavsiya Etilgan Tuzatish
${result.recommendedFix}

${
  result.codePatch
    ? `### 💻 To'g'rilangan Kod (${result.codePatch.language})
\`\`\`${result.codePatch.language}
${result.codePatch.fixedSnippet}
\`\`\`
*O'zgarish:* ${result.codePatch.diffSummary}`
    : ''
}

### 🛡 Kelgusida Oldini Olish (Best Practice)
${result.preventiveAdvice}

---
*Manba:* CogniDev Rubber Duck Debugger (${result.aiSource || 'AI'})
`;

    const noteId = await createNote(`Bugfix: ${result.errorType}`);
    await updateNoteDoc(noteId, {
      content: noteContent,
      tags: ['debugging', 'bugfix', ...result.tags],
    });
    setSavedToNote(true);
    setHud?.('📝 Yechim Notion qaydlariga saqlandi');
    setTimeout(() => setSavedToNote(false), 2500);
  };

  const handleCreateBugfixTask = () => {
    if (!result) return;
    const nowIso = new Date().toISOString();
    addTask({
      id: `task-bug-${Date.now()}`,
      workspace_id: 'ws-1',
      title: `Fix: ${result.errorType}`,
      status: 'active',
      priority: 'High Priority',
      git_branch: null,
      pr_url: null,
      ai_source: result.aiSource || 'rubber-duck',
      assignee_name: 'Farhod',
      assignee_avatar: 'F',
      assignee_name2: null,
      assignee_avatar2: null,
      tags: ['bugfix', 'rubber-duck', ...result.tags.slice(0, 2)],
      created_at: nowIso,
      updated_at: nowIso,
    });
    setSavedToTask(true);
    setHud?.('📌 Bugfix vazifa ro‘yxatiga qo‘shildi');
    setTimeout(() => setSavedToTask(false), 2500);
  };

  const loadSample = (sample: typeof SAMPLE_ERRORS[0]) => {
    setErrorMessage(sample.error);
    setCodeSnippet(sample.code);
    setTechContext(sample.tech);
    setResult(null);
  };

  const handleReset = () => {
    setErrorMessage('');
    setCodeSnippet('');
    setResult(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Rubber Duck Debugger"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-amber-500/20 bg-[#121318]/95 text-zinc-100 shadow-2xl shadow-amber-500/10 overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-500/20 font-bold text-xl">
              🦆
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100 tracking-tight">AI Rubber Duck Debugger</h2>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-300">
                  v1.0 Live
                </span>
              </div>
              <p className="text-[12px] text-zinc-400">
                Jonli xatoliklar tahlili, kod patchlari va shaxsiy Second Brain o‘xshashlik qidiruvi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRubberDuckModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              title="Yopish (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/5 bg-black/30 text-xs">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/5">
            <button
              onClick={() => setMode('patch')}
              className={`flex items-center gap-1.5 px-3 py-1.2 rounded-xl font-medium transition ${
                mode === 'patch'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Zap size={13} />
              <span>⚡️ Tezkor Patch</span>
            </button>
            <button
              onClick={() => setMode('explain')}
              className={`flex items-center gap-1.5 px-3 py-1.2 rounded-xl font-medium transition ${
                mode === 'explain'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <HelpCircle size={13} />
              <span>💡 Tushuntirish</span>
            </button>
            <button
              onClick={() => setMode('socratic')}
              className={`flex items-center gap-1.5 px-3 py-1.2 rounded-xl font-medium transition ${
                mode === 'socratic'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen size={13} />
              <span>🦆 Sokratik Duck</span>
            </button>
            <button
              onClick={() => setMode('security')}
              className={`flex items-center gap-1.5 px-3 py-1.2 rounded-xl font-medium transition ${
                mode === 'security'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldAlert size={13} />
              <span>🛡 Xavfsizlik Auditi</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[11px] hidden sm:inline">Stack:</span>
            <select
              value={techContext}
              onChange={(e) => setTechContext(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="Auto-detect" className="bg-[#1a1b22]">Auto-detect</option>
              <option value="TypeScript / React" className="bg-[#1a1b22]">TypeScript / React</option>
              <option value="Rust / Tauri" className="bg-[#1a1b22]">Rust / Tauri</option>
              <option value="Go / Backend" className="bg-[#1a1b22]">Go / Backend</option>
              <option value="Python / FastAPI" className="bg-[#1a1b22]">Python / FastAPI</option>
              <option value="Web / REST API" className="bg-[#1a1b22]">Web / REST API</option>
              <option value="Docker / DevOps" className="bg-[#1a1b22]">Docker / DevOps</option>
            </select>
          </div>
        </div>

        {/* Main Content Area: Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Sample Triggers */}
          {!result && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500 text-[11px]">Tezkor namunalar:</span>
              {SAMPLE_ERRORS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => loadSample(s)}
                  className="rounded-full bg-white/[0.04] border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-white/10 hover:text-amber-300 transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Grid: Error Stack Trace & Optional Code Snippet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Error Message Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <Bug size={13} className="text-rose-400" />
                  <span>Xatolik matni yoki Stack Trace</span>
                </label>
                {liveHistoricalMatches.length > 0 && (
                  <span className="text-[10.5px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {liveHistoricalMatches.length} ta o‘xshash xotira topildi
                  </span>
                )}
              </div>
              <textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="Terminal, brauzer konsoli yoki kompilyator bergan xatolikni bu yerga tashlang (masalan: TypeError, borrow of moved value, CORS...)"
                rows={result ? 4 : 7}
                className="w-full font-mono text-xs rounded-2xl border border-white/10 bg-black/40 p-3.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none transition"
              />
            </div>

            {/* Code Snippet Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <FileCode size={13} className="text-amber-400" />
                  <span>Tegishli kod qismi (Ixtiyoriy)</span>
                </label>
                <span className="text-[10.5px] text-zinc-500">aniqroq patch uchun</span>
              </div>
              <textarea
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                placeholder="Xatolik berayotgan funksiya yoki kod blokini bu yerga joylashtiring..."
                rows={result ? 4 : 7}
                className="w-full font-mono text-xs rounded-2xl border border-white/10 bg-black/40 p-3.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none transition"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleReset}
              disabled={!errorMessage && !codeSnippet && !result}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition disabled:opacity-30"
            >
              <RotateCcw size={12} />
              <span>Tozalash</span>
            </button>

            <button
              onClick={handleDiagnose}
              disabled={!errorMessage.trim() || loading}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs font-semibold text-black hover:opacity-95 transition disabled:opacity-40 shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  <span>AI Duck Tahlil Qilmoqda...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>{result ? 'Qayta Tahlil Qilish' : 'Xatolikni Tahlil Qilish & Patch Yaratish'}</span>
                </>
              )}
            </button>
          </div>

          {/* Diagnostic Result View */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Result Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 font-bold">
                    <Bug size={15} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-200">{result.errorType}</h3>
                    <p className="text-[11.5px] text-zinc-400">{result.summary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {result.aiSource && (
                    <span className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                      <Cpu size={10} />
                      {result.aiModel || result.aiSource}
                    </span>
                  )}
                  {result.tags.map((t) => (
                    <span key={t} className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Root Cause & Recommended Fix Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                    <ShieldAlert size={14} />
                    <span>Asl Kelib Chiqish Sababi (Root Cause)</span>
                  </h4>
                  <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-line">
                    {result.rootCause}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <Check size={14} />
                    <span>Tavsiya Etilgan Tuzatish (Recommended Fix)</span>
                  </h4>
                  <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-line">
                    {result.recommendedFix}
                  </p>
                </div>
              </div>

              {/* Code Patch Diff Card */}
              {result.codePatch && (
                <div className="rounded-2xl border border-emerald-500/20 bg-black/50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-xs">
                    <div className="flex items-center gap-2">
                      <FileCode size={14} className="text-emerald-400" />
                      <span className="font-semibold text-emerald-200">
                        Taklif Etilgan Kod Patch ({result.codePatch.language})
                      </span>
                      <span className="text-[11px] text-zinc-400 italic">· {result.codePatch.diffSummary}</span>
                    </div>
                    <button
                      onClick={handleCopyPatch}
                      className="flex items-center gap-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30 transition"
                    >
                      {copiedPatch ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedPatch ? 'Nusxalandi!' : 'Kodni nusxalash'}</span>
                    </button>
                  </div>

                  <div className="p-4 font-mono text-xs overflow-x-auto text-emerald-300/90 bg-[#0d0e12]">
                    <pre className="whitespace-pre">{result.codePatch.fixedSnippet}</pre>
                  </div>
                </div>
              )}

              {/* Historical Second-Brain Matches */}
              {result.historicalMatches.length > 0 && (
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <h4 className="flex items-center gap-1.5 font-semibold text-blue-300">
                      <BookOpen size={14} />
                      <span>O‘tmishda Hal Qilingan O‘xshash Muammolaringiz (Second Brain)</span>
                    </h4>
                    <span className="text-[10px] text-blue-400 font-mono">
                      {result.historicalMatches.length} ta yozuv
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {result.historicalMatches.map((m, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1 hover:border-blue-500/30 transition"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-zinc-200 truncate">{m.title}</span>
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[9px] font-mono text-blue-300 uppercase">
                            {m.sourceType}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-zinc-400 line-clamp-2">{m.matchedSnippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preventive Advice */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5 text-xs">
                <span className="text-amber-400 text-sm">💡</span>
                <div>
                  <span className="font-semibold text-zinc-300">Oldini Olish Amaliyoti (Best Practice): </span>
                  <span className="text-zinc-400">{result.preventiveAdvice}</span>
                </div>
              </div>

              {/* 1-Click Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveToNote}
                    disabled={savedToNote}
                    className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition"
                  >
                    {savedToNote ? <Check size={13} className="text-emerald-400" /> : <FileText size={13} className="text-emerald-400" />}
                    <span>{savedToNote ? 'Qaydga saqlandi!' : 'Notion Qaydiga Saqlash'}</span>
                  </button>

                  <button
                    onClick={handleCreateBugfixTask}
                    disabled={savedToTask}
                    className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition"
                  >
                    {savedToTask ? <Check size={13} className="text-amber-400" /> : <PlusCircle size={13} className="text-amber-400" />}
                    <span>{savedToTask ? 'Vazifaga qo‘shildi!' : 'Bugfix Vazifa Yaratish'}</span>
                  </button>
                </div>

                <button
                  onClick={handleCopyPatch}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm"
                >
                  {copiedPatch ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedPatch ? 'Buferga nusxalandi' : 'Tuzatilgan Kodni Nusxalash'}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
