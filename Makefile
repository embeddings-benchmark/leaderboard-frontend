.PHONY: help install setup dev dev-mock mock-api build deploy-build preview check check-watch lint format test test-visual update-visual test-ui clean kill-ports

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

dev: ## Start vite dev server (http://localhost:5173). Requires PUBLIC_API_URL.
	npm run dev

mock-api: ## Run only the e2e mock API on http://localhost:8787
	npx tsx tests/mock-api.ts

dev-mock: ## Start vite dev + the mock API (no live backend needed)
	@# Boots the mock API in the background, waits for the port, then
	@# runs vite dev with PUBLIC_API_URL pointed at it. `trap … EXIT`
	@# kills the mock when vite exits (Ctrl-C or natural).
	@trap 'kill $$MOCK_PID 2>/dev/null' INT TERM EXIT; \
		npx tsx tests/mock-api.ts & \
		MOCK_PID=$$!; \
		npx wait-on -t 30s tcp:8787 && \
		PUBLIC_API_URL=http://localhost:8787 npm run dev

build: ## Build for production (no base path — local serving)
	npm run build

deploy-build: ## Build for GitHub Pages (custom domain, no base path — matches CI)
	BASE_PATH= npm run build

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

# Screenshot tests run in the official Playwright Linux image, the same one CI
# uses, so baselines match. The tag follows @playwright/test in
# package-lock.json. node_modules lives in a named volume so the Linux install
# never touches the host's. Runs natively (arm64 on Apple silicon): Chromium
# crashes under amd64 emulation. `--engine-strict=false`: the image's Node may
# be older than engines.node; it doesn't affect rendering.
PW_VERSION := $(shell node -p "require('./package-lock.json').packages['node_modules/@playwright/test'].version")
PW_IMAGE := mcr.microsoft.com/playwright:v$(PW_VERSION)-noble
DOCKER_ARCH := $(shell uname -m | sed -e s/x86_64/amd64/ -e s/aarch64/arm64/)
PW_DOCKER := docker run --rm --platform linux/$(DOCKER_ARCH) --ipc=host -v "$(CURDIR)":/work \
	-v leaderboard-linux-node-modules:/work/node_modules -w /work $(PW_IMAGE)

test-visual: ## Run the screenshot tests in the Playwright Linux image (needs Docker)
	$(PW_DOCKER) sh -c 'npm ci --engine-strict=false --no-audit --no-fund && npx playwright test --project=visual'

update-visual: ## Regenerate screenshot baselines in the Playwright Linux image (needs Docker)
	$(PW_DOCKER) sh -c 'npm ci --engine-strict=false --no-audit --no-fund && npx playwright test --project=visual --update-snapshots'

test-ui: ## Open the Playwright UI runner
	npx playwright test --ui

clean: ## Remove build artifacts, caches, and node_modules
	rm -rf node_modules build .svelte-kit test-results playwright-report

kill-ports: ## Kill anything bound to dev (5173/5174), preview (4173), or mock API (8787)
	@# `-sTCP:LISTEN` so we only target the actual server processes —
	@# without it, lsof also returns PIDs of CLIENTS connected to those
	@# ports (e.g. the browser tab holding vite's HMR websocket) and
	@# `kill` would SIGTERM the browser too.
	-@lsof -ti:5173,5174,4173,8787 -sTCP:LISTEN | xargs kill 2>/dev/null || true
	@echo "ports cleared"
