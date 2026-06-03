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

`PUBLIC_API_URL` (the mteb FastAPI base, e.g. `http://localhost:8000`) is
required at build time. Set it in `.env.local` for local dev, or pass
`PUBLIC_USE_MOCK=1` to fall back to the deterministic mock generators under
`src/lib/data/mock*.ts` for offline UI work.

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
