# ⚡️ CogniDev — AI-First Developer Operating System

> **A blazing-fast, distraction-free macOS desktop app for engineers. Centralize AI insights, track daily engineering flow, and manage agile squads without Jira bloat.**

---

## 🌟 Key Features

### 1. 🤖 Universal AI Prompt & Context Ingestion
- **1-Click AI Ingestion**: Directly paste or import raw chat logs and code snippets from **Gemini**, **Claude**, **ChatGPT**, or **Local Ollama**.
- **Auto-Parsing Engine**: Heuristically extracts problem statements, code blocks, and key learnings into structured task cards.
- **AI Prompt Vault**: Retain full AI conversation context and prompts linked to their corresponding engineering tasks.

### 2. 👥 Team Groups & Squad Management (Jira Alternative)
- **Zero-Bloat Agile**: No micromanaged hour trackers or complicated story point poker. Focus on shipping.
- **Squad Organization**: Segment tasks into distinct squads (`⚡️ Backend Core`, `🎨 UI Design`, `🤖 AI Models`, `🚀 DevOps & Infra`).
- **Live Blocker Radar**: Visual real-time constellation displaying cross-team blockers before they stall sprint velocity.

### 3. 🎯 macOS Spotlight HUD (`⌘K`)
- **Global Quick Capture**: Hit `⌘K` anywhere to instantly capture a task, problem solved, or AI prompt without switching mental context.
- **Git Commit Auto-Sync**: Reads local git commits via Rust backend and converts them into completed stream items in 1 click.
- **Rapid Navigation**: Switch between squads, run standups, and trigger retrospectives instantly.

### 4. 🧠 AI Weekly Coach & 1-Click Retrospectives
- **Automated Standups**: Generates executive engineering standups for your team.
- **Weekly Engineering Coach**: Analyzes completed vs. deferred tasks, identifies bottlenecks, and suggests actionable architectural improvements.

---

## 🛠 Tech Stack

- **Desktop Runtime**: [Tauri v2](https://tauri.app/) (Rust)
- **Frontend Framework**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Obsidian Dark macOS theme)
- **Database**: Local [SQLite](https://www.sqlite.org/) via Tauri SQL Plugin with zero cloud dependency
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) and Cargo
- macOS (macOS 12+ recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/Farhodoff/CogniDev.git
cd CogniDev

# Install frontend dependencies
npm install

# Run desktop app in development mode
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

---

## 📄 License
MIT © [Farhod](https://github.com/Farhodoff)
