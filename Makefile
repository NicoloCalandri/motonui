# Makefile for motonui local development

.PHONY: dev build test lint typecheck db-start db-stop db-reset db-migrate db-seed setup help

# ─── Development ──────────────────────────────────────────────────────────────

dev: ## Start Next.js dev server
	npm run dev

build: ## Build for production
	npm run build

test: ## Run unit tests
	npm test

test-watch: ## Run unit tests in watch mode
	npm run test -- --watch

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint -- --fix

typecheck: ## Run TypeScript type check
	npx tsc --noEmit

# ─── Database ─────────────────────────────────────────────────────────────────

db-start: ## Start local Supabase
	npx supabase start

db-stop: ## Stop local Supabase
	npx supabase stop

db-reset: ## Reset local DB (drops all data!)
	npx supabase db reset

db-migrate: ## Apply pending migrations
	npx supabase db push

db-seed: ## Seed local DB with sample data
	npx supabase db push --local
	psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/seed.sql

db-diff: ## Show diff between local and remote schema
	npx supabase db diff

db-types: ## Regenerate TypeScript types from DB schema
	npx supabase gen types typescript --local > src/lib/supabase/database.types.ts

# ─── Setup ────────────────────────────────────────────────────────────────────

setup: ## Initial project setup
	@echo "Setting up motonui..."
	cp .env.example .env.local
	npm ci
	@echo ""
	@echo "✅ Done! Next steps:"
	@echo "  1. Fill in .env.local with your credentials"
	@echo "  2. Run: make db-start"
	@echo "  3. Run: make db-migrate"
	@echo "  4. Run: make dev"

# ─── Utilities ────────────────────────────────────────────────────────────────

clean: ## Clean build artifacts
	rm -rf .next out node_modules/.cache

update-deps: ## Update dependencies interactively
	npx npm-check-updates -i

# ─── Help ─────────────────────────────────────────────────────────────────────

help: ## Show this help
	@echo ""
	@echo "motonui Makefile commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help
