# MTEB Leaderboard

SvelteKit + TypeScript + Svelte 5 (runes) frontend for the
[mteb](https://github.com/embeddings-benchmark/mteb) leaderboard. Talks to the
mteb FastAPI service (branch `api`, source under `mteb/api/`) at runtime;
deployed as a static bundle to a Hugging Face Space and to GitHub Pages.

## Live deployments

- **Hugging Face Space (canonical):** https://mteb-leaderboardv2.hf.space
- **GitHub Pages mirror:** https://embeddings-benchmark.github.io/leaderboardv2

## Develop

```sh
make dev              # vite dev on http://localhost:5173
make check            # svelte-kit sync && svelte-check
make lint             # prettier --check . && eslint . && stylelint
make format           # prettier --write .
make test             # build + Playwright e2e
make test-ui          # interactive Playwright UI
make build            # vite build for local serving
make deploy-build     # BASE_PATH=/leaderboardv2 build (matches CI)
make preview          # serve build/ on http://localhost:4173
```

### Environment

| Var               | When set                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_API_URL`  | Required for normal use. Points at the mteb FastAPI base (e.g. `http://localhost:8000`). Inlined at build time.                                    |
| `PUBLIC_USE_MOCK` | Opt-in offline fallback. When set to `1` AND `PUBLIC_API_URL` is empty, every loader returns deterministic mock data from `src/lib/data/mock*.ts`. |

```sh
# Normal dev — talk to a local mteb FastAPI
echo 'PUBLIC_API_URL=http://localhost:8000' > .env.local

# Offline UI work — no backend running
echo 'PUBLIC_USE_MOCK=1' > .env.local
```

Behaviour summary:

- `PUBLIC_API_URL` set → every fetch goes through `/v1/...` on that host. Mock
  modules are dynamic-imported only on the offline branch and tree-shake out
  of the prod build entirely.
- `PUBLIC_API_URL` empty + `PUBLIC_USE_MOCK=1` → loaders synthesise summaries,
  task lists, model lists, and per-benchmark menus from the seeded fixtures
  under `src/lib/data/mockBenchmarks.ts` + `mockSummary.ts`. A few endpoints
  have no offline analogue and return empty (notably `loadPerLanguage` —
  PerLanguageTab renders `'—'`).
- `PUBLIC_API_URL` empty + no `PUBLIC_USE_MOCK` → every loader throws a clear
  error so misconfiguration surfaces immediately instead of rendering blanks.

Both vars are `PUBLIC_*` so SvelteKit/Vite inline them at build time —
`USE_MOCK` is evaluated as a constant and the bundler eliminates the dead
branch in prod.

## Routes

| Route                        | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `/`                          | Home — category menu of benchmark cards                                   |
| `/benchmarks`                | Full benchmark catalog, sidebar filters (Modality / Task type / Domain)   |
| `/benchmark/[name]`          | Per-benchmark detail: hero + 6 tabs (Summary / Perf×Size / Perf×Time / …) |
| `/models` + `/models/[name]` | Model index + detail                                                      |
| `/tasks` + `/tasks/[name]`   | Task index + detail                                                       |
| `/compare`                   | Side-by-side comparison of up to 4 models                                 |

## Architecture

See [CLAUDE.md](./CLAUDE.md) for the data flow, store conventions, theme
system, sticky-shelf / floating-action patterns, and shared component
catalogue (`SearchInput`, `SortDirIcon`, `ScrollToTopButton`,
`ShareUrlButton`, `FilterSidebar`, `SummaryTable`, etc.).

## Deploy

- **Hugging Face Space** — `Dockerfile` at the repo root clones the
  `integration` branch, runs the SvelteKit build, and serves the static bundle
  via `nginx-unprivileged` on port 7860. `PUBLIC_API_URL` is set as a
  `Dockerfile` `ENV`.
- **GitHub Pages** — `.github/workflows/deploy.yml` runs `make deploy-build`
  (sets `BASE_PATH=/leaderboardv2`) and uploads `build/`.

## License

See [LICENSE](./LICENSE).
