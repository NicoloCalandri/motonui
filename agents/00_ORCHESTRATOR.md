# 🎯 ORCHESTRATOR — motonui Build System

> Use this file as the **master prompt** to kick off the full project build with an AI coding agent (Claude Code, Cursor Agent, Copilot Workspace, etc.)

---

## Project Overview

Build **motonui** — a couples travel companion app with:
- Trip planning & itinerary management
- Expense tracking with split calculation
- Travel blog with public posts
- Instagram carousel/story/reel export
- AI writing assistant

Full specs are in the `agents/` directory. Read ALL agent spec files before writing any code.

---

## Execution Order

You MUST complete agents in this exact order. Each agent depends on the previous one.

```
Phase 1: Foundation
  └── 01_ARCHITECT.md  →  DB schema, types, project scaffold

Phase 2: Server
  └── 02_BACKEND.md    →  API routes, business logic

Phase 3: Client  
  └── 03_FRONTEND.md   →  Pages, components, UI

Phase 4: Media
  └── 04_MEDIA.md      →  Photo pipeline, Instagram export

Phase 5: Intelligence
  └── 05_CONTENT.md    →  AI assistant, captions, SEO

Phase 6: Infrastructure
  └── 06_DEVOPS.md     →  CI/CD, deployment, monitoring
```

---

## Before You Start

1. Read this file completely
2. Read all 6 agent spec files in `agents/`
3. Read `docs/ARCHITECTURE.md` once it's created by the Architect agent
4. Understand the full scope before writing the first line of code

---

## Global Rules (Apply to ALL Agents)

### Code Quality
- TypeScript strict mode — zero `any` types
- All functions documented with JSDoc
- No TODO comments in committed code — either implement it or create a GitHub Issue
- Max file length: 300 lines — split into modules if longer
- Consistent naming: `camelCase` for variables, `PascalCase` for components/types, `kebab-case` for files

### Testing
- Unit test all utility functions (expenses, image processing, AI prompts)
- Integration test all API routes
- Minimum 70% coverage on `src/lib/`
- Test files co-located: `expenses.ts` → `expenses.test.ts`
- Use `vitest` + `@testing-library/react`

### Git Discipline
- One commit per agent phase
- Commit message format: `feat(agent-name): description`
- Example: `feat(backend): implement expense API routes with currency conversion`

### Error Handling
- Every async function has try/catch
- User-facing errors are friendly (Italian if possible): "Ops! Qualcosa è andato storto 🏝️"
- Developer errors are descriptive with context

---

## Acceptance Criteria

The build is complete when:

- [ ] `npm run dev` starts without errors
- [ ] User can sign up and create a trip
- [ ] User can add days, legs, and accommodations to a trip
- [ ] User can add expenses and see balance summary
- [ ] User can upload photos and see them in the media grid
- [ ] User can generate an Instagram carousel ZIP
- [ ] User can write and publish a blog post
- [ ] Public blog at `/blog` works without authentication
- [ ] All CI checks pass
- [ ] Vercel deployment succeeds

---

## Key Files Reference

```
src/lib/types.ts          ← ALL domain types (created by Architect)
src/lib/supabase/         ← DB client setup
src/lib/expenses.ts       ← Expense business logic
src/lib/media/            ← Photo processing
src/lib/ai/               ← Claude API integrations
src/app/api/              ← All API routes
src/app/(app)/            ← Authenticated app pages
src/app/(public)/         ← Public blog pages
src/components/           ← Reusable UI components
supabase/migrations/      ← DB migrations (source of truth)
agents/                   ← This build system
docs/                     ← Architecture decisions
```

---

## Questions?

If anything is ambiguous in an agent spec, prefer:
1. The more explicit/typed solution
2. The simpler implementation
3. Ask for clarification before building something wrong

*Point Nemo is the loneliest place on Earth — but motonui makes every journey feel like home.*
