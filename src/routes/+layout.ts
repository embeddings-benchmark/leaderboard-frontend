// Set `BUILD_NO_PRERENDER=1` locally to skip prerender for fast iteration
// (e.g. `BUILD_NO_PRERENDER=1 npm run build` against a slow backend). CI
// never sets this var, so production / Pages / Docker builds always
// prerender. Read at build time only; the client bundle strips this export.
export const prerender = !process.env.BUILD_NO_PRERENDER;
// `'ignore'` accepts both `/foo` and `/foo/` so external links + browser
// auto-appended trailing slashes resolve cleanly on every route — including
// the runtime-only `prerender = false` pages where SvelteKit's redirect
// dance can silently 404 on adapter-static + the dev server.
export const trailingSlash = 'ignore';
