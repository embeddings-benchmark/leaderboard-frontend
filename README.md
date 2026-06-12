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

| Var                  | When set                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_API_URL`     | **Required.** Points at the mteb FastAPI base (e.g. `http://localhost:8000`). Inlined at build time. Loaders throw a clear error when unset.               |
| `PUBLIC_SITE_URL`    | Canonical origin baked into prerendered OG / canonical-link tags. Without it, SvelteKit's prerender placeholder ends up in the HTML.                       |
| `BASE_PATH`          | Path prefix for the build. Empty for the Space, `/leaderboardv2` for GitHub Pages.                                                                         |
| `BUILD_NO_PRERENDER` | Opt-out for local fast builds. `BUILD_NO_PRERENDER=1 npm run build` skips the prerender phase entirely. CI never sets this — production always prerenders. |

```sh
# Normal dev — talk to a local mteb FastAPI
echo 'PUBLIC_API_URL=http://localhost:8000' > .env.local

# Fast local build, no backend hit during prerender
BUILD_NO_PRERENDER=1 npm run build
```

There is no offline mock mode — `PUBLIC_API_URL` is mandatory and every
loader fails loudly when the backend is unreachable.

## Routes

| Route                                     | Purpose                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `/`                                       | Home — category menu of benchmark cards                                   |
| `/benchmarks`                             | Full benchmark catalog, sidebar filters (Modality / Task type / Domain)   |
| `/benchmark/[name]`                       | Per-benchmark detail: hero + 6 tabs (Summary / Perf×Size / Perf×Time / …) |
| `/models` + `/models/[...name=modelName]` | Model index + detail. The matcher enforces the HF `org/name` shape.       |
| `/tasks` + `/tasks/[name]`                | Task index + detail                                                       |
| `/compare`                                | Side-by-side comparison of up to 4 models                                 |

Detail routes prerender the hero card eagerly and fetch the heavy scores
table client-side after hydration, so the build stays fast and HTML files
stay small. A miss on any detail slug throws `error(404, ...)`; the root
`+error.svelte` renders the message.

## Architecture

See [CLAUDE.md](./CLAUDE.md) for the data flow, store conventions, theme
system, sticky-shelf / floating-action patterns, and shared component
catalogue (`SearchInput`, `SortDirIcon`, `ScrollToTopButton`,
`ShareUrlButton`, `FilterSidebar`, `SummaryTable`, etc.).

## Deploy

- **Hugging Face Space** — `Dockerfile` at the repo root runs the SvelteKit
  build and serves the static bundle via `nginx-unprivileged` on port 7860.
  `PUBLIC_API_URL` / `PUBLIC_SITE_URL` are set as `Dockerfile` `ENV`.
- **GitHub Pages** — `.github/workflows/deploy.yml` runs `make deploy-build`
  (sets `BASE_PATH=/leaderboardv2`) and uploads `build/`. PR builds run the
  same prerender (no `BUILD_NO_PRERENDER`) so the live data path is exercised.

## License

See [LICENSE](./LICENSE).
