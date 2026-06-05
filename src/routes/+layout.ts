export const prerender = true;
// `'ignore'` accepts both `/foo` and `/foo/` so external links + browser
// auto-appended trailing slashes resolve cleanly on every route — including
// the runtime-only `prerender = false` pages where SvelteKit's redirect
// dance can silently 404 on adapter-static + the dev server.
export const trailingSlash = 'ignore';
