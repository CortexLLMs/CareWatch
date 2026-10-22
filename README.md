# 🏥 CareWatch — AI Health Monitoring Platform

> Real-time health analysis powered by webcam AI. Detect stress, fatigue, anxiety, burnout, and monitor heart rate — all from your browser.

[![CI](https://github.com/CortexLLMs/CareWatch/actions/workflows/ci.yml/badge.svg)](https://github.com/CortexLLMs/CareWatch/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/CortexLLMs/CareWatch/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/CortexLLMs/CareWatch/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/Live%20demo-GitHub%20Pages-1b56ff?style=flat-square)](https://cortexllms.github.io/CareWatch/)

![CareWatch](https://img.shields.io/badge/CareWatch-v3.0-00d4ff?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMGQ0ZmYiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTIyIDEyaC00bC0zIDlMOSAzTDYgMTJIMiIvPjwvc3ZnPg==)
![React](https://img.shields.io/badge/React-19.2.6-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat-square&logo=sqlite)
![Novu](https://img.shields.io/badge/Novu-Notifications-4f46e5?style=flat-square)

---

## ✨ Features

- 📹 **Real-time Webcam Analysis** — rPPG heart rate (POS algorithm), stress, fatigue detection (MediaPipe FaceMesh)
- 🌍 **Trilingual UI** — Arabic (RTL), French, English with instant in-chat re-translation
- 🌓 **Light & Dark modes** — CareWatch blue/cyan branding, persisted per user
- 📲 **Multichannel alerts** — Novu Cloud (In-App Inbox) + **direct Telegram alerts** on critical anomalies
- 🤖 **AI Chatbot (Med·Check)** — onboarding assistant with graceful regex fallback
- 📊 **6 Health Metrics** — Stress, Fatigue, Heart Rate, SpO₂, Blink rate, Yawn level + HRV (RMSSD/SDNN)
- 🗄️ **Persistent Storage** — SQLite database + localStorage (demo works fully offline)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React 19 + Vite 8 (localhost:5173)             │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Camera   │  │  Gauges  │  │ Med·Check│      │
│  │  rPPG     │  │  SVG     │  │ Chatbot  │      │
│  └────┬─────┘  └──────────┘  └────┬─────┘      │
│       │                            │             │
│       ▼                            ▼             │
│  Canvas API              Claude API (Anthropic)  │
│  getUserMedia()          Resend API (Email)      │
└───────┬─────────────────────────────────────────┘
        │ axios (HTTP)
        ▼
┌─────────────────────────────────────────────────┐
│                   BACKEND                        │
│  Node.js + Express (localhost:5000)             │
│                                                  │
│  7 REST Endpoints                               │
│  ┌──────────────────────────────┐               │
│  │ POST /api/session/start      │               │
│  │ POST /api/metrics/save       │               │
│  │ POST /api/alerts/save        │               │
│  │ GET  /api/session/:id/history│               │
│  │ GET  /api/session/:id/alerts │               │
│  │ POST /api/session/:id/end    │               │
│  │ GET  /api/health             │               │
│  └──────────────┬───────────────┘               │
│                 │                                │
│                 ▼                                │
│  ┌──────────────────────────────┐               │
│  │  SQLite (health.db)          │               │
│  │  Tables: sessions, metrics,  │               │
│  │          alerts              │               │
│  └──────────────────────────────┘               │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/CareWatch.git
cd CareWatch
```

### 2. Install & run Backend
```bash
cd backend
npm install
node server.js
# ✓ CareWatch Backend running on http://localhost:5000
```

### 3. Install & run Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
# ✓ http://localhost:5173
```

### 4. Open in browser
Go to `http://localhost:5173` → Landing page with chatbot appears!

---

## 📦 Tech Stack

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.6 | UI framework (hooks: useState, useEffect, useRef, useCallback) |
| react-dom | 19.2.6 | DOM rendering |
| axios | 1.16.1 | HTTP client for backend API calls |
| recharts | 3.8.1 | Data visualization charts |
| vite | 8.0.12 | Dev server + build tool |

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.18.2 | REST API server (7 endpoints) |
| cors | 2.8.5 | Cross-origin requests (frontend ↔ backend) |
| sqlite3 | 5.1.6 | SQLite database driver |

### External APIs
| API | Purpose |
|-----|---------|
| Claude API (Anthropic) | AI chatbot for Med·Check medication assistant |
| Resend API | Email delivery for medication reminders |
| Novu (self-hosted) | Multi-channel alerting (Telegram, e-mail, in-app) for physiological alerts |

### Browser APIs (native, no install)
| API | Purpose |
|-----|---------|
| getUserMedia() | Webcam access |
| Canvas getImageData() | Pixel-level face analysis |
| requestAnimationFrame() | 30fps real-time analysis loop |
| localStorage | Persist Med·Check user data |

---

## 🧠 AI & ML Models

All analysis runs **client-side in the browser** using pure JavaScript — no external ML libraries.

| Metric | Method | Formula |
|--------|--------|---------|
| **Heart Rate** | rPPG (green channel peak detection) | HR = peaks × 12 (5s buffer) |
| **Stress** | Frame-to-frame motion analysis | stress = avgMotion × 3.5 + HR factor |
| **Fatigue** | Facial brightness analysis | fatigue = max(0, 100 - brightness × 0.35) |
| **Anxiety** | Stress derivative | anxiety = stress × 0.7 + random(0-5) |
| **Burnout** | Stress + fatigue composite | burnout = stress × 0.5 + fatigue × 0.5 |
| **SpO₂** | Red/green channel ratio | SpO₂ = 88 + (green - red + 50) / 5 |

**Scientific basis:** IEEE Trans. Biomedical Engineering (2019), Maslach Burnout Inventory

---

## 🗄️ Database Schema

SQLite database (`health.db`) — auto-created on first run.

### sessions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| sessionId | TEXT | Unique session identifier |
| startTime | DATETIME | Session start |
| endTime | DATETIME | Session end |
| status | TEXT | active / ended |

### metrics
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| sessionId | TEXT | FK → sessions |
| timestamp | DATETIME | Measurement time |
| stress | REAL | 0.0 – 1.0 |
| fatigue | REAL | 0.0 – 1.0 |
| anxiety | REAL | 0.0 – 1.0 |
| burnout | REAL | 0.0 – 1.0 |
| heartRate | INTEGER | BPM |
| oxygen | REAL | SpO₂ % |
| brightness | REAL | Face luminosity |
| motion | REAL | Movement level |

### alerts
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| sessionId | TEXT | FK → sessions |
| alertType | TEXT | stress/fatigue/anxiety/burnout/spo2/heartRate |
| severity | TEXT | critical/high/medium |
| message | TEXT | Alert description |

---

## 📁 Project Structure

```
CareWatch/
├── frontend/
│   ├── src/
│   │   ├── App.jsx          ← Main React component (all UI + analysis)
│   │   └── main.jsx         ← React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
│
├── backend/
│   ├── server.js            ← Express API server
│   ├── health.db            ← SQLite database (auto-created)
│   └── package.json
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## ⚙️ Configuration

Edit `frontend/src/App.jsx` lines 5-7:

```javascript
const RESEND_KEY = "re_YOUR_API_KEY";     // Get from resend.com (free)
const FROM_EMAIL = "onboarding@resend.dev"; // Or your custom domain
const FROM_NAME = "CareWatch";
```

---

## 🔔 Notifications multicanal (Novu)

Alertes et rappels peuvent être routés vers **Telegram**, l'**e-mail** ou l'**in-app** via
[Novu](https://github.com/novuhq/novu) auto-hébergé.

### Backend — configuration

```bash
cd backend
cp .env.example .env      # puis renseigner NOVU_API_KEY
npm start                 # node --env-file-if-exists=.env server.js
```

```ini
NOVU_API_URL=http://localhost:3000   # API Novu (dashboard : http://localhost:4000)
NOVU_API_KEY=novu_v1_xxxxxxxxxxxx     # Settings → API keys
NOVU_WORKFLOW=alerte-carewatch        # workflow créé dans le dashboard
NOVU_SUBSCRIBER=carewatch-user
NOVU_MOCK=0                           # 1 = simulation, sans appel réseau
```

### Novu en local (Docker)

```bash
curl -fsSL https://raw.githubusercontent.com/novuhq/novu/next/docker/community/setup.sh | bash
# ou : git clone https://github.com/novuhq/novu.git && cd novu/docker/community && cp .env.example .env && docker compose up -d
```

Puis, dans le dashboard (http://localhost:4000) : créer le workflow `alerte-carewatch`,
connecter un canal (Telegram d'abord, c'est le plus rapide et le plus fiable), et créer la clé API.

### Endpoints CareWatch

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/api/novu/status` | État du service, workflow, joignabilité, liste des workflows |
| `POST` | `/api/novu/test` | Notification de test (Telegram / e-mail) |
| `POST` | `/api/novu/notify` | Déclenchement générique d'un événement |

Les alertes `high` et `critical` déclenchent automatiquement une notification Novu
(asynchrone, non bloquant) ; le canal est tracé dans `alerts.notified_channels`.

Guide complet : [`docs/novu-carewatch.md`](docs/novu-carewatch.md).

---

## 🚨 Alert Thresholds

| Metric | Threshold | Severity | Recommendation |
|--------|-----------|----------|----------------|
| Stress | > 70% | Critical | 4-7-8 breathing, music |
| Fatigue | > 75% | High | 15-min break, walk |
| Anxiety | > 65% | Medium | Meditation, call friend |
| Burnout | > 70% | Critical | Stop, see professional |
| SpO₂ | < 92% | Critical | EMERGENCY — call help |
| Heart Rate | > 105 bpm | High | Breathe slowly, sit |

---

## 🌐 Live demo (GitHub Pages)

The frontend is automatically deployed on every push to `main`:
**https://cortexllms.github.io/CareWatch/**

On the hosted demo, backend features (SQLite history, Novu, Telegram) are disabled —
the app runs in **offline demo mode**: onboarding chat, webcam rPPG, metrics,
HRV (local fallback), alerts, trilingual UI and both themes all work in the browser.

---

## ⚙️ Environment configuration (optional)

Frontend (`frontend/.env`, build-time) :

| Variable | Rôle | Défaut |
|---|---|---|
| `VITE_API_URL` | URL du backend Express | `http://localhost:5000` |
| `VITE_RESEND_KEY` | E-mails de rappel envoyés depuis le navigateur | aucun (désactivé) |
| `VITE_ANTHROPIC_KEY` | Extraction IA du chatbot | aucun (repli regex) |

Backend (`backend/.env`) : voir `backend/.env.example`
(`NOVU_*` pour les notifications Novu, `TELEGRAM_*` pour les alertes Telegram sur anomalie,
`RESEND_KEY` pour `POST /api/send-reminder`). Détails dans [`docs/novu-carewatch.md`](docs/novu-carewatch.md).

---

## 🤝 Team

**MYTHON · Oujda · 2026**

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

CareWatch is designed for **wellness monitoring and research purposes only**. It is NOT a medical device. Always consult healthcare professionals for medical advice. rPPG accuracy is ±5-10 bpm under optimal lighting.
