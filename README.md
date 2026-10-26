<div align="center">

<img src="./docs/images/cognidev-logo.png" width="110" height="110" alt="CogniDev Logo" style="border-radius: 26px; box-shadow: 0 16px 40px rgba(56, 189, 248, 0.25);" />

# ⚡️ CogniDev
### AI-Powered Developer Command Center & Cockpit for macOS

<p align="center">
  <strong>Dasturchilar uchun chalg'itmaydigan, mahalliy (local-first) boshqaruv markazi: o'zbekcha ovozli AI standup, loyihalar va vazifalar oqimi, Git tahlili hamda chuqur fokus vositalari.</strong>
</p>

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-Backend-DEA584?style=flat-square&logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Local-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20Native-000000?style=flat-square&logo=apple&logoColor=white)](https://apple.com/)
[![CI](https://github.com/Farhodoff/CogniDev/actions/workflows/ci.yml/badge.svg)](https://github.com/Farhodoff/CogniDev/actions/workflows/ci.yml)
[![Website](https://img.shields.io/badge/Website-Live%20Showcase-38bdf8?style=flat-square&logo=safari&logoColor=white)](https://farhodoff.github.io/CogniDev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

<br />

<img src="./docs/images/cognidev-hero-showcase.png" alt="CogniDev macOS Desktop Interface" width="100%" style="border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);" />

<br />
</div>

---

## 🎙️ O'zbek Tili STT Modelini O'rnatish (2 xil usul)

CogniDev mahalliy ovozli yozuv va nutqni matnga aylantirish (STT) uchun **whisper.cpp** dvigateli hamda o'zbek tiliga moslashtirilgan **`rubaiSTT v2 medium`** modelidan (`ggml-rubaistt.bin` — ~785 MB) foydalanadi.

Har bir foydalanuvchi o'ziga qulay usulni tanlashi mumkin:

### 1-usul: GitHub Releases orqali tayyor ilovani yuklab olish (Tavsiya etiladi)
Eng oson yo'li — loyihaning Releases bo'limidan tayyor macOS paketini (`.dmg`) yuklab olish. Bunda barcha modellar va sozlamalar tayyor holda biriktirilgan bo'ladi:
* 📦 **[CogniDev GitHub Releases Sahifasi](https://github.com/Farhodoff/CogniDev/releases)**

---

### 2-usul: Modelni alohida yuklab olish (Mustaqil o'rnatish yoki Development)
Agar loyihani manba kodidan (`git clone`) ishlatayotgan bo'lsangiz yoki model faylini alohida yuklab olmoqchi bo'lsangiz:

* **⚡️ To'g'ridan-to'g'ri yuklab olish havolasi (Direct Download):**  
  [ggml-rubaistt.bin (GitHub Release - 785 MB)](https://github.com/MuhammadMirrr/uzbek-dictation/releases/download/v1.0/ggml-rubaistt.bin)
* **🤗 Hugging Face sahifasi (Asl model):**  
  [islomov/rubaistt_v2_medium](https://huggingface.co/islomov/rubaistt_v2_medium)

**Terminal orqali 1 qatorlik tezkor yuklab olish buyrug'i:**
```bash
mkdir -p ~/.cognidev/models
curl -L -o ~/.cognidev/models/ggml-rubaistt.bin \
  https://github.com/MuhammadMirrr/uzbek-dictation/releases/download/v1.0/ggml-rubaistt.bin
```

> **Eslatma:** Ilova modelni avtomatik ravishda `~/.cognidev/models/ggml-rubaistt.bin` yoki `~/rubai-stt/models/ggml-rubaistt.bin` yo'llaridan topib ishga tushiradi.

---

## ✨ Asosiy Imkoniyatlar (Core Features)

### 1. 🎙️ Mahalliy O'zbekcha Ovozli Standup & Diktovka
Ovoz bilan fikrlarni, rejalarni va kundalik hisobotlarni yozish. Ma'lumotlar tashqi bulutga yuborilmaydi — barchasi kompyuteringizning o'zida (Apple Silicon / Metal) tez va xavfsiz transkripsiya qilinadi.

<div align="center">
  <img src="./docs/images/cognidev-voice-standup.png" alt="CogniDev Ovozli Standup Modali" width="94%" style="border-radius: 12px; margin: 16px 0;" />
</div>

* **Kunlik 3 bosqichli standup**: Ertalabki rejalar (10:00), oraliq nazorat (14:00) va kechki retro auditi (22:00).
* **AI Murabbiy bilan ovozli muloqot**: Gapirishingiz bilan ovoz matnga aylanadi va joriy kunlik fokus vazifalariga biriktiriladi.
* **AI Meetings & Konspektlar**: Uchrashuvlar audio yozuvlarini matnga aylantirish va xulosalar chiqarish.

---

### 2. 📂 Loyihalar Portfeli & AI Git Inspector
Barcha faol dasturiy ta'minot loyihalarini bir joyda monitoring qilish va rivojlanish progressini kuzatish.

<div align="center">
  <img src="./docs/images/cognidev-projects-showcase.png" alt="Loyihalar Portfeli" width="94%" style="border-radius: 12px; margin: 16px 0;" />
</div>

* **Loyihalar boshqaruvi**: Har bir loyiha bo'yicha progress (foizlarda), texnologik steklar teglari (#Rust, #Tauri, #React, #Go va h.k.).
* **Git Inspector & AI Commit Generator (`⌘J`)**: Mahalliy repozitoriy o'zgarishlari (diff) tahlili asosida xalqaro `feat(...)`, `fix(...)` standarti bo'yicha aniq commit xabarlarini bir bosishda generatsiya qilish.

<div align="center">
  <img src="./docs/images/cognidev-git-inspector.png" alt="Git Repozitoriy & AI Commit Generator" width="94%" style="border-radius: 12px; margin: 16px 0;" />
</div>

---

### 3. 🎯 Kundalik Fokus (Deep Work) & Tezkor Qidiruv (`⌘K`)
Dasturchini chalg'itmaydigan qulay interfeys:

* **Spotlight HUD (`⌘K`)**: Raycast/Alfred uslubidagi tezkor qidiruv, vazifalar ochish va buyruqlar paneli.
* **Pomodoro & Fokus taymeri (`⌘P`)**: Deep work sessiyalarini boshqarish, sarflangan vaqt statistikasi.
* **Spaces (Mavzuiy maydonlar)**: Personal, Education, Work/Backend, AI & ML, Finance bo'limlari bo'yicha tartiblash.

---

## ⌨️ Asosiy Klaviatura Yorliqlari (Hotkeys)

| Tugmalar | Vazifasi | Qayerda ishlaydi |
|---|---|---|
| `⌘K` / `Ctrl+K` | Spotlight buyruqlar paneli va tezkor qidiruv | Global |
| `⌘P` | Pomodoro & Deep Work fokus taymeri oynasi | Asosiy oyna |
| `⌘J` | Git Repozitoriy inspektori va AI Commit generator | Asosiy oyna |
| `⌘D` | AI Rubber Duck Debugger (Muammolarni tahlil qilish) | Asosiy oyna |
| `Esc` | Ochiq modal yoki panelni yopish | Global |

---

## 🛠 Texnologik Stek

| Qism | Texnologiya | Izoh |
|---|---|---|
| **Platforma** | [Tauri v2](https://tauri.app/) (Rust) | Xavfsiz, yengil (~15MB) va mahalliy macOS konteyneri |
| **Frontend** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Zamonaviy va qat'iy turlashtirilgan interfeys |
| **Holat boshqaruvi** | [Zustand](https://github.com/pmndrs/zustand) | Tezkor, reaktiv holat menejmenti |
| **STT Dvigateli** | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) + [rubaiSTT v2](https://huggingface.co/islomov/rubaistt_v2_medium) | O'zbek tili uchun 100% oflayn nutqni matnga aylantirish |
| **Ma'lumotlar bazasi** | [SQLite](https://www.sqlite.org/) (WAL mode) | Barcha ma'lumotlar faqat kompyuteringizda saqlanadi |
| **Dizayn** | [Tailwind CSS](https://tailwindcss.com/) | macOS Obsidian Dark mavzusi va mikro-animatsiyalar |

---

## 🚀 Ishga Tushirish (Development)

### Talablar:
* **Node.js** (v18.0 yoki undan yangi)
* **Rust** & Cargo (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
* **macOS** 12 Monterey yoki undan yangi

```bash
# 1. Repozitoriyni klonlash
git clone https://github.com/Farhodoff/CogniDev.git
cd CogniDev

# 2. Bog'liqliklarni o'rnatish
npm install

# 3. Modelni yuklab olish
mkdir -p ~/.cognidev/models
curl -L -o ~/.cognidev/models/ggml-rubaistt.bin \
  https://github.com/MuhammadMirrr/uzbek-dictation/releases/download/v1.0/ggml-rubaistt.bin

# 4. Desktop ilovani dev rejimida ishga tushirish
npm run tauri dev
```

### Production Build:
Native macOS `.dmg` paketini yaratish uchun:
```bash
npm run tauri build
```

---

## 📄 Litsenziya

**MIT License** asosida tarqatiladi. Yaratuvchi: [Farhod](https://github.com/Farhodoff).
