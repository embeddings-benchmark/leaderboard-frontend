.PHONY: help install setup dev build deploy-build preview check check-watch lint format test test-ui clean kill-ports

.DEFAULT_GOAL := help

help: ## Show this help
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies (clean, lockfile-respecting)
	npm ci

setup: install ## First-time setup: install deps and sync SvelteKit types
	npx svelte-kit sync

dev: ## Start vite dev server (http://localhost:5173)
	npm run dev

build: ## Build for production (no base path — local serving)
	npm run build

deploy-build: ## Build for GitHub Pages with BASE_PATH=/leaderboardv2
	BASE_PATH=/leaderboardv2 npm run build

preview: ## Preview the most recent production build (http://localhost:4173)
	npm run preview

check: ## Run svelte-check (TypeScript + Svelte diagnostics)
	npm run check

check-watch: ## Run svelte-check in watch mode
	npm run check:watch

lint: ## Run prettier --check and eslint
	npm run lint

format: ## Auto-format with prettier
	npm run format

test: ## Build and run the Playwright e2e suite headless
	npm run test

test-ui: ## Open the Playwright UI runner
	npx playwright test --ui

clean: ## Remove build artifacts, caches, and node_modules
	rm -rf node_modules build .svelte-kit test-results playwright-report

kill-ports: ## Kill anything bound to the dev (5173/5174) and preview (4173) ports
	-@lsof -ti:5173,5174,4173 | xargs kill 2>/dev/null || true
	@echo "ports cleared"
