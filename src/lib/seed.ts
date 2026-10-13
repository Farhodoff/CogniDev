import type {
  ChecklistItem,
  PromptEntry,
  Task,
  TeamGroup,
  Workspace,
  RoadmapItem,
  NoteDoc,
  ProjectIdea,
  ScheduleBlock,
} from './types';

/** Default initial workspace for a clean production setup. */
export const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'ws-personal',
  name: 'Personal Dev Hub',
  type: 'personal',
  created_at: new Date().toISOString(),
};

export const DEFAULT_GROUPS: TeamGroup[] = [];

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'DEV-1',
    workspace_id: 'ws-personal',
    title: 'Zoovita API ni serverda ishga tushirish va test qilish',
    status: 'completed',
    priority: 'High Priority',
    git_branch: 'feature/api-deploy',
    pr_url: null,
    ai_source: 'gemini',
    assignee_name: 'Farhod',
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['zoovita', 'backend', 'api'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'DEV-2',
    workspace_id: 'ws-personal',
    title: 'Admin panelni build qilish va deploy',
    status: 'completed',
    priority: 'High Priority',
    git_branch: 'feature/admin-build',
    pr_url: null,
    ai_source: 'claude',
    assignee_name: 'Farhod',
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['zoovita', 'admin', 'deploy'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'DEV-3',
    workspace_id: 'ws-personal',
    title: 'iOS Google OAuth test (Development Build muammosi)',
    status: 'blocker',
    priority: 'P0 Blocker',
    git_branch: 'fix/ios-oauth',
    pr_url: null,
    ai_source: 'chatgpt',
    assignee_name: 'Farhod',
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['mobile', 'auth', 'oauth'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'DEV-4',
    workspace_id: 'ws-personal',
    title: 'PostgreSQL Indekslar (B-Tree vs GIN) amaliy tahlili',
    status: 'active',
    priority: 'High Priority',
    git_branch: 'study/postgres-indexes',
    pr_url: null,
    ai_source: 'gemini',
    assignee_name: 'Farhod',
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['study', 'database', 'postgres'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'DEV-5',
    workspace_id: 'ws-personal',
    title: 'Go (Golang) Goroutines va Concurrency patternlari',
    status: 'active',
    priority: 'High Priority',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['study', 'golang', 'concurrency'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'DEV-6',
    workspace_id: 'ws-personal',
    title: 'Portfolioda yangi loyihalar sahifasini yangilash',
    status: 'backlog',
    priority: 'Normal',
    git_branch: null,
    pr_url: null,
    ai_source: null,
    assignee_name: 'Farhod',
    assignee_avatar: null,
    assignee_name2: null,
    assignee_avatar2: null,
    tags: ['portfolio', 'frontend'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_NOTES: Record<string, string> = {
  'DEV-1': '### Natija\nZoovita API Docker orqali serverda ishga tushirildi. Healthcheck 200 OK qaytardi.',
  'DEV-3': '### Muammo\nDevelopment buildda redirect_uri xatosi bermoqda. Google Cloud Console da scheme URI qo‘shilishi kerak.',
};

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'DEV-1': [
    { id: 'c1', text: 'Docker container up', done: true },
    { id: 'c2', text: 'Nginx reverse proxy', done: true },
    { id: 'c3', text: 'SSL sertifikat tekshiruvi', done: true },
  ],
  'DEV-3': [
    { id: 'c1', text: 'Google Console URI sozlash', done: false },
    { id: 'c2', text: 'iOS plist da URL Scheme tekshirish', done: false },
  ],
};

export const DEFAULT_PROMPTS: PromptEntry[] = [];

/** Daily schedule timeline blocks */
export const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  {
    id: 'sch-1',
    time_range: '09:00 - 11:00',
    title: 'Zoovita backend (Server setup, API test)',
    category: 'work',
    tag: 'Zoovita',
    color: '#10b981', // emerald
    done: true,
  },
  {
    id: 'sch-2',
    time_range: '11:00 - 13:00',
    title: 'Admin panel build & deploy',
    category: 'work',
    tag: 'Admin',
    color: '#0ea5e9', // sky
    done: true,
  },
  {
    id: 'sch-3',
    time_range: '13:00 - 15:00',
    title: 'iOS Google OAuth (Testing on device)',
    category: 'work',
    tag: 'Mobile App',
    color: '#f43f5e', // rose
    done: false,
  },
  {
    id: 'sch-4',
    time_range: '16:00 - 17:30',
    title: 'Sport & Gym (Mashg‘ulot)',
    category: 'health',
    tag: 'Sport',
    color: '#22c55e', // green
    done: false,
  },
  {
    id: 'sch-5',
    time_range: '19:00 - 20:30',
    title: 'Go / Rust Concurrency & Goroutines o‘rganish',
    category: 'study',
    tag: 'Study',
    color: '#a855f7', // purple
    done: false,
  },
  {
    id: 'sch-6',
    time_range: '21:00 - 22:00',
    title: 'Portfolio update & Kunlik reja tekshiruvi',
    category: 'personal',
    tag: 'Portfolio',
    color: '#3b82f6', // blue
    done: false,
  },
];

/** Pre-loaded Backend Software Engineering Roadmap matching Farhod's roadmap */
export const DEFAULT_ROADMAPS: RoadmapItem[] = [
  {
    id: 'rd-backend-core',
    title: 'Backend & Software Engineering Roadmap',
    stack: 'Python → SQL/PostgreSQL → JS/TS → Docker/Linux → Go → C → Rust',
    description: 'Kuchli backend dasturchi bo‘lish, tizimlar, yuqori yuklama (high-load) va unumdorlik (performance) yo‘nalishlariga chiqish.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    milestones: [
      {
        id: 'ms-python',
        title: '1. Python Chuqurlashtirish + Django/DRF',
        duration: '6–8 hafta',
        priority: 'Yuqori',
        topics: [
          { id: 'p1', title: 'Python Object modeli (Mutable vs Immutable, Memory references)', done: true },
          { id: 'p2', title: 'OOP: Inheritance, Composition, Magic methods, dataclasses', done: true },
          { id: 'p3', title: 'Generators, Iterators va Context Managers (__enter__, __exit__)', done: false },
          { id: 'p4', title: 'Decorators va Function Wrappers chuqur tahlili', done: false },
          { id: 'p5', title: 'AsyncIO va Asinxron dasturlash (event loop, coroutines, aiohttp)', done: false },
          { id: 'p6', title: 'Multiprocessing vs Threading vs GIL', done: false },
          { id: 'p7', title: 'Unit testing (pytest, mocks, fixtures, test coverage)', done: false },
          { id: 'p8', title: 'Django & DRF: ViewSets, Serializers, QuerySet optimization', done: false },
        ],
      },
      {
        id: 'ms-postgres',
        title: '2. SQL + PostgreSQL Optimallashtirish',
        duration: '4–6 hafta',
        priority: 'Yuqori',
        topics: [
          { id: 'db1', title: 'B-Tree, GIN, GiST va Hash Indexlar qanday ishlaydi', done: false },
          { id: 'db2', title: 'EXPLAIN va EXPLAIN ANALYZE orqali Query Plan o‘qish', done: false },
          { id: 'db3', title: 'ACID va Tranzaksiya izolyatsiya darajalari (Dirty read, Phantom read)', done: false },
          { id: 'db4', title: 'N+1 so‘rov muammosi va uni select_related/prefetch_related bilan yechish', done: false },
          { id: 'db5', title: 'PostgreSQL Connection Pooling (PgBouncer, max_connections)', done: false },
        ],
      },
      {
        id: 'ms-ts',
        title: '3. JavaScript & TypeScript Backend',
        duration: '4–5 hafta',
        priority: 'O‘rta',
        topics: [
          { id: 'ts1', title: 'Event Loop, Microtasks va Macrotasks tushunchasi', done: false },
          { id: 'ts2', title: 'TypeScript Types vs Interfaces, Generics, Type Narrowing', done: false },
          { id: 'ts3', title: 'Node.js & Fastify / Express bilan typed REST API qurish', done: false },
        ],
      },
      {
        id: 'ms-docker',
        title: '4. Linux & Docker Konteynerizatsiya',
        duration: '4–5 hafta',
        priority: 'Yuqori',
        topics: [
          { id: 'd1', title: 'Linux processlar, permissions, signals (SIGTERM, SIGINT)', done: false },
          { id: 'd2', title: 'Multi-stage Dockerfile yozish (kichik va xavfsiz image)', done: false },
          { id: 'd3', title: 'Docker Compose bilan lokal dev-muhit (App + Postgres + Redis)', done: false },
          { id: 'd4', title: 'CI/CD pipeline asoslari (GitHub Actions avtomatizatsiyasi)', done: false },
        ],
      },
      {
        id: 'ms-go',
        title: '5. Go (Golang) — Yuqori Yuklama & Concurrency',
        duration: '5–7 hafta',
        priority: 'Yuqori',
        topics: [
          { id: 'g1', title: 'Goroutines va Channels (CSP concurrency modeli)', done: false },
          { id: 'g2', title: 'Mutex, atomic operatsiyalar va Race Detector (-race)', done: false },
          { id: 'g3', title: 'Standard library: net/http va context paketi', done: false },
          { id: 'g4', title: 'Microservices: gRPC va Protocol Buffers (protobuf)', done: false },
        ],
      },
      {
        id: 'ms-rust',
        title: '6. C & Rust — Xotira Xavfsizligi va Tizim Dasturlash',
        duration: '5–7 hafta',
        priority: 'Kelajak',
        topics: [
          { id: 'r1', title: 'C: Pointers, Memory Allocation (malloc, free), Stack vs Heap', done: false },
          { id: 'r2', title: 'Rust: Ownership, Borrowing va Lifetimes tamoyili', done: false },
          { id: 'r3', title: 'Fearless Concurrency va Zero-cost abstractions', done: false },
        ],
      },
    ],
  },
];

/** Default Notion-style Technical Notes */
export const DEFAULT_NOTION_NOTES: NoteDoc[] = [
  {
    id: 'note-postgres-index',
    workspace_id: 'ws-personal',
    title: 'PostgreSQL Index Optimallashtirish va N+1 Muammosi',
    icon: '🐘',
    tags: ['postgresql', 'database', 'performance'],
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
    content: `# PostgreSQL Index Optimallashtirish va N+1 Muammosi

> **Asosiy qoida:** Agar so'rov \`Seq Scan\` (to'liq jadvalni ketma-ket o'qish) qilayotgan bo'lsa va jadvalda millionlab qator bo'lsa, indeks zarur. Lekin har bir indeks yozish (\`INSERT\`, \`UPDATE\`) tezligini sekinlashtiradi.

### 💡 1. N+1 Muammosi Nima?
Agar siz 50 ta buyurtmani yuklab, har bir buyurtma uchun alohida so'rov bilan uning foydalanuvchisini yuklasangiz:
- 1 ta so'rov: \`SELECT * FROM orders LIMIT 50;\`
- 50 ta so'rov: \`SELECT * FROM users WHERE id = ...;\`
Jami: **51 ta so'rov!**

\`\`\`python
# Yomon usul (N+1 muammosi):
orders = Order.objects.all()[:50]
for order in orders:
    print(order.user.email) # Har safar DB ga so'rov ketadi!

# Yechim (1 ta SQL so'rov bilan JOIN qilish):
orders = Order.objects.select_related('user').all()[:50]
\`\`\`

### ⚡ 2. B-Tree Indeks Qachon Ishlaydi?
B-Tree indeksi tenglik (\`=\`) va oraliq (\`>\`, \`<\`, \`BETWEEN\`) amallari uchun juda tez ishlaydi.
\`\`\`sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
\`\`\`
- Indeks tartibi muhim: Avval eng ko'p filtrlangan ustun, keyin tartiblash ustuni.
`,
  },
  {
    id: 'note-python-async',
    workspace_id: 'ws-personal',
    title: 'Python AsyncIO vs Threading: Qachon Qaysi Biri Tanlanadi?',
    icon: '🐍',
    tags: ['python', 'async', 'architecture'],
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date().toISOString(),
    content: `# Python AsyncIO vs Threading

> **Xulosa:** I/O-bound vazifalar (API so'rovlar, DB kutish, fayl o'qish) uchun **AsyncIO** eng kam resurs yeydi va eng yuqori unumdorlik beradi. CPU-bound (og'ir hisob-kitoblar, tasvir/video tahlil) uchun esa **Multiprocessing** kerak.

### 📌 Concurrency taqqoslash
- **AsyncIO:** 1 ta oqimda (single-threaded) koperativ rejimda ishlaydi. 10 000 ta parallel ulanishni yengil ko'tara oladi.
- **Threading:** OS iplari ishlatiladi. Python'ning **GIL (Global Interpreter Lock)** tufayli bitta vaqtda faqat bitta ip Python baytkodini bajaradi.
- **Multiprocessing:** Alohida Python jarayonlari ochiladi, har birining o'z GIL'i bor. Xotirani ko'proq sarflaydi.

\`\`\`python
import asyncio
import aiohttp

async def fetch_status(session, url):
    async with session.get(url) as response:
        return url, response.status

async def main():
    urls = ["https://api.github.com", "https://httpbin.org/get"]
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_status(session, u) for u in urls]
        results = await asyncio.gather(*tasks)
        for url, status in results:
            print(f"{url} -> {status}")

asyncio.run(main())
\`\`\`
`,
  },
];

/** Default Project Ideas */
export const DEFAULT_PROJECT_IDEAS: ProjectIdea[] = [
  {
    id: 'idea-zoovita',
    workspace_id: 'ws-personal',
    title: 'Zoovita — Mobile App, Backend & Admin Panel',
    stack: 'React Native + FastAPI + PostgreSQL',
    status: 'in_progress',
    description: 'Veterinariya va uy hayvonlari uchun to‘liq ekotizim: mobil ilova, admin boshqaruv paneli va yuqori tezlikdagi backend API.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tasks: [
      { id: 't1', title: 'Server sozlash va FastAPI backend ni dockerize qilish', priority: 'High Priority', done: true },
      { id: 't2', title: 'Admin panel build qilish va production serverga deploy', priority: 'High Priority', done: true },
      { id: 't3', title: 'iOS Google OAuth redirect URI konfiguratsiyasi', priority: 'P0 Blocker', done: false },
      { id: 't4', title: 'Push bildirishnomalar va FCM integratsiyasi', priority: 'Normal', done: false },
    ],
  },
  {
    id: 'idea-nihongo-talk',
    workspace_id: 'ws-personal',
    title: 'Nihongo Talk — AI Speaking Coach & JLPT Platform',
    stack: 'Next.js + OpenAI / Gemini + WebSocket',
    status: 'in_progress',
    description: 'Yapon tili JLPT N2 imtihoniga tayyorlovchi real-vaqtdagi AI nutq suhbatdoshi va grammatika tahlil platformasi.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tasks: [
      { id: 't1', title: 'WebRTC va WebSocket orqali audio oqimini uzatish', priority: 'High Priority', done: true },
      { id: 't2', title: 'AI nutq tahlilchisi va real-vaqtda grammatika xatolarini tuzatish', priority: 'High Priority', done: true },
      { id: 't3', title: 'Audio scheduler kechikishini (latency) 200ms gacha tushirish', priority: 'P0 Blocker', done: false },
    ],
  },
  {
    id: 'idea-rate-limiter',
    workspace_id: 'ws-personal',
    title: 'Yuqori Yuklamali Taqsimlangan Rate Limiter (Token Bucket)',
    stack: 'Go + Redis',
    status: 'planning',
    description: 'Mikroxizmatlar uchun soniyasiga 100 000+ so‘rovni ushlab qoluvchi va DDoS/Spam himoyasini ta’minlovchi Token Bucket & Sliding Window rate limiter.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tasks: [
      { id: 't1', title: 'Token Bucket algoritmini Go strukturalari va sync.Mutex bilan yozish', priority: 'P0 Blocker', done: true },
      { id: 't2', title: 'Redis Lua script yordamida atomik taqsimlangan sanagich yaratish', priority: 'High Priority', done: false },
      { id: 't3', title: 'HTTP Middleware (Chi / Gin) sifatida ulash', priority: 'High Priority', done: false },
      { id: 't4', title: 'Apache Bench / wrk orqali 100k RPS yuklama testi o‘tkazish', priority: 'Normal', done: false },
    ],
  },
  {
    id: 'idea-event-bus',
    workspace_id: 'ws-personal',
    title: 'Asinxron Tadbirlar Qatnami (Async Event Bus & Worker Pool)',
    stack: 'Python + PostgreSQL',
    status: 'idea',
    description: 'Celery/RabbitMQ o‘rniga PostgreSQL LISTEN/NOTIFY va Python AsyncIO asosidagi yengil, ishonchli foniy vazifalar menejeri.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tasks: [
      { id: 't1', title: 'PostgreSQL SKIP LOCKED yordamida tranzaksiyaviy navbat sxemasini tuzish', priority: 'P0 Blocker', done: false },
      { id: 't2', title: 'Asyncpg orqali LISTEN/NOTIFY hodisa tinglovchisini yozish', priority: 'High Priority', done: false },
      { id: 't3', title: 'Xatolik yuz berganda exponential backoff bilan qayta urinish (retry) mantiqi', priority: 'Normal', done: false },
    ],
  },
  {
    id: 'idea-cli-rust',
    workspace_id: 'ws-personal',
    title: 'Mahalliy Git & Docker Status Monitor CLI',
    stack: 'Rust',
    status: 'idea',
    description: 'Terminalda tezkor ishlovchi, barcha git repozitoriyalardagi branch holatlari va Docker konteynerlar resurslarini real-vaqtda chizuvchi TUI dasturi.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tasks: [
      { id: 't1', title: 'Ratatui va Crossterm bilan terminal TUI interfeysini loyihalash', priority: 'P0 Blocker', done: false },
      { id: 't2', title: 'Git status va o‘zgarishlarni tekshiruvchi parallel worker yaratish', priority: 'High Priority', done: false },
    ],
  },
];
