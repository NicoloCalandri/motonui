# 🏝️ motonui

> *Named after Motu Nui — the tiny, unreachable islet closest to Point Nemo, the most remote spot on Earth. Because the best trips are the ones that feel impossible until you take them.*

**motonui** is a personal travel companion app for couples. Plan trips together, track every expense and movement, publish beautiful blog posts, and generate Instagram-ready content — all in one place.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Trip Planner** | Itinerary builder with days, legs, accommodations |
| 💸 **Expense Tracker** | Split costs, categories, currency conversion |
| ✍️ **Travel Blog** | Rich-text posts, photo galleries, map embeds |
| 📸 **Instagram Generator** | Auto-layout reels & carousels from trip photos |
| 📊 **Trip Dashboard** | Stats, maps, spending breakdowns |
| 👫 **Couple Sync** | Shared trip workspace for two |

---

## 🏗️ Architecture

```
motonui/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Shared UI components
│   ├── lib/              # Utils, DB, API clients
│   └── styles/           # Global styles & design tokens
├── agents/               # AI agent prompts & specs
├── docs/                 # Architecture decisions
└── .github/workflows/    # CI/CD
```

## 🤖 Multi-Agent Build System

This project is designed to be built by a team of specialized AI agents. See [`agents/`](./agents/) for detailed prompts for each agent.

| Agent | Responsibility |
|---|---|
| `architect` | Tech stack, DB schema, API design |
| `backend` | Supabase, API routes, expense logic |
| `frontend` | Next.js UI, design system |
| `media` | Photo processing, Instagram export |
| `content` | Blog AI assistant, SEO |
| `devops` | GitHub Actions, Vercel deployment |

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (Postgres + Storage + Auth)
- **Styling**: Tailwind CSS + shadcn/ui
- **Maps**: Mapbox GL
- **Media**: Cloudinary / Supabase Storage
- **Deployment**: Vercel
- **Language**: TypeScript

## 🚀 Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/motonui
cd motonui
npm run setup
# Fill in your .env.local with Supabase + Mapbox keys
npm run db:start
npm run dev
```

## 📱 Debug Mobile App (VS Code)

### Prerequisiti

1. Installa l'estensione **[React Native Tools](https://marketplace.visualstudio.com/items?itemName=msjsdiag.vscode-react-native)** (`ms-vscode.vscode-react-native`) in VS Code.
2. Assicurati di avere **Node.js**, **Expo CLI** e un emulatore Android / simulatore iOS già configurati.

### Avviare il server Expo in modalità debug

```bash
cd mobile
npx expo start --dev-client   # oppure: npx expo start
```

Tieni il terminale aperto: il bundler Metro deve rimanere attivo durante il debug.

### Configurazione `launch.json`

Il file `.vscode/launch.json` nella root del progetto contiene già tre configurazioni pronte:

| Configurazione | Descrizione |
|---|---|
| `Debug Android (Expo)` | Avvia l'app su emulatore / dispositivo Android |
| `Debug iOS (Expo)` | Avvia l'app su simulatore / dispositivo iOS |
| `Attach to Expo packager` | Si aggancia a un packager già in esecuzione |

### Passi per il debug

1. Apri il progetto in VS Code dalla cartella radice `motonui/`.
2. Avvia il server Expo dal terminale (vedi sopra).
3. Apri il pannello **Run and Debug** (`Ctrl+Shift+D` / `⌘⇧D`).
4. Seleziona la configurazione desiderata dal menu a tendina (es. `Debug Android (Expo)`).
5. Premi **▶ Start Debugging** (o `F5`).
6. VS Code si connette al packager e i **breakpoint** nel codice TypeScript/TSX diventano attivi.

> **Tip – Attach**: se vuoi agganciarti a un'app già aperta su dispositivo fisico, usa `Attach to Expo packager` dopo aver avviato `npx expo start`.

> **Hermes DevTools**: con Expo SDK 52 il motore JS è Hermes. Puoi aprire i DevTools nativi premendo `j` nel terminale del packager oppure collegandoti a `chrome://inspect` nel browser.

---

## 📧 Email & Authentication

For the "Forgot Password" functionality, you need to configure an SMTP provider in your Supabase Dashboard. 

**Recommended: [Mailtrap](https://mailtrap.io/) (Sandbox)**

1.  In Supabase, go to `Settings > Auth > SMTP`.
2.  Set the following values:
    *   **Host**: `sandbox.smtp.mailtrap.io`
    *   **Port**: `2525`
    *   **User/Password**: (Copy from your Mailtrap Inbox SMTP Settings)
3.  Ensure **Sender email** is set (e.g., `noreply@motonui.com`).
4.  Save changes (if you get an API error, double-check the port is `2525`).

---

*Point Nemo coordinates: 48°52.6′S 123°23.6′W — the loneliest place on Earth.*
*Motu Nui distance to Point Nemo: ~2,688 km*
