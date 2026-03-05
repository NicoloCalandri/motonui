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
npm install
cp .env.example .env.local
# Fill in your Supabase + Mapbox keys
npm run dev
```

---

*Point Nemo coordinates: 48°52.6′S 123°23.6′W — the loneliest place on Earth.*
*Motu Nui distance to Point Nemo: ~2,688 km*
