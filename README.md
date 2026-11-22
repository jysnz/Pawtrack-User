# 🐾 PawTrack - Universal NFC Pet Recovery Portal

[![Vercel Deployment Ready](https://img.shields.io/badge/Deployment-Vercel%20Ready-black?style=flat&logo=vercel)](https://vercel.com)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=flat&logo=github)](https://github.com/Dariush0801/pawtrack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

PawTrack is a modern, unified pet recovery system featuring **Smartphone NFC collar tag tap-to-report**, municipal NFC reader integration, AI pet image identification, 72-hour municipal shelter holding workflows, and interactive community recovery maps.

---

## 🚀 Key Features

- 📱 **Standardized Smartphone NFC Collar Tag**: Passive 13.56 MHz NFC Type 2 tag. Any finder can tap their iPhone or Android phone to instantly open the pet's profile and file a sighting report without installing any app.
- 📡 **NFC Support**: Tap-to-report from any NFC-enabled smartphone, plus municipal readers for NFC collar tags and 134.2 kHz FDX-B microchips.
- 🏢 **Municipal Shelter & Pound Portal**: 72-hour legal holding window tracker, kennel intake logging, and statutory claim verification workflows.
- 🗺️ **Interactive Pet Radar & Maps**: Live incident pins, filter by species/status, and one-touch turn-by-turn navigation.
- 🌐 **Real-Time Cross-Tab & Multi-Role Sync**: Synchronized data stream with BroadcastChannel, Server-Sent Events (SSE), and LocalStorage fallback.
- ⚡ **Zero-Config Vercel Deployment**: Configured with `vercel.json` and serverless API endpoints ready to deploy in seconds.

---

## 🛠️ Getting Started Locally

### 1. Clone the repository
```bash
git clone https://github.com/Dariush0801/pawtrack.git
cd pawtrack
```

### 2. Run the local server
```bash
npm start
# or double click start-server.bat
```
Open `http://localhost:3000` in your web browser.

### 3. Run Automated Verification Tests
```bash
npm test
```

---

## ☁️ Deploying to Vercel

PawTrack is fully configured for zero-configuration deployment on **[Vercel](https://vercel.com)**:

1. Go to **[vercel.com](https://vercel.com)** and log in with your GitHub account.
2. Click **Add New...** → **Project**.
3. Import the repository: `Dariush0801/pawtrack`.
4. Keep the default settings (Framework Preset: **Other**) and click **Deploy**.
5. Once deployed, Vercel will provide a live production URL (e.g. `https://pawtrack.vercel.app`).

Every commit pushed to the `main` branch will automatically trigger a new deployment on Vercel!

---

## 🚨 Error Monitoring (Sentry)

Errors thrown in a visitor's browser (guardian app and admin console), unhandled promise rejections and failed database loads are sent to [Sentry](https://sentry.io), so you hear about a production break without waiting for a user report.

1. Create a **Browser JavaScript** project in Sentry and copy its **DSN** (Project Settings -> Client Keys).
2. Paste it into `js/sentry-config.js` (`dsn: '...'`) and deploy. The DSN is public by design; it can only send events.
3. In Sentry: **Alerts -> Create Alert -> Issues**, "A new issue is created" -> notify by email (or Slack). Add a second rule for "issue changes state to regressed".

The SDK is self-hosted in `js/vendor/` (no third-party CDN), runs only on non-localhost hosts, sends no cookies, emails or typed text, and reports the same failure at most once a minute. `window.pawSentry.report(err)` sends a handled error.

## 📈 Running with many users

- The app is static files on Vercel's CDN (cached at the edge, see `vercel.json`) plus Supabase, so page loads scale with the CDN.
- Every device refreshes its data on a jittered 30 s timer that backs off (up to 5 min) when the database struggles, and pauses in hidden tabs.
- Large admin lists are read in pages (Supabase returns at most 1000 rows per request).
- Run `supabase/migrations/20261134_scale_indexes.sql` so those refresh queries stay fast as tables grow.

---

## 🔄 Automatic Git Commit & Cloud Sync

To have your local edits automatically committed and pushed to GitHub as you code:

- **Windows**: Double-click `auto-sync.bat` or run:
  ```bash
  npm run sync
  ```
- **Instant 1-Click Push**: Double-click `sync-now.bat` to immediately push all changes.

---

## 📁 Project Architecture

```
PawTrack/
├── api/                   # Vercel serverless API handlers (/api/sync, /api/health)
├── css/                   # Design system tokens and UI components
│   ├── main.css
│   └── components.css
├── js/                    # Application logic, store, views, and controllers
│   ├── app.js
│   ├── i18n.js
│   ├── notifications.js
│   ├── report-manager.js
│   ├── nfc-scanner.js
│   ├── store.js
│   └── views/             # Role-based views (Owner, Shelter, Map, Cases, Hardware)
├── scripts/               # Auto-sync watcher & tooling
├── tests/                 # Automated unit and integration test suites
├── index.html             # Application entry point
├── server.js              # Local Node.js HTTP & SSE server
├── vercel.json            # Vercel routing & serverless configuration
├── auto-sync.bat          # 1-click auto-sync watcher
└── sync-now.bat           # 1-click instant commit & push
```

---

## 📄 License

MIT License © 2026 PawTrack Team.
