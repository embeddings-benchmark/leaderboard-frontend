// Prerender every benchmark detail page at build time so the per-entity
// `ShareMeta` tags land in the static HTML where social-media crawlers
// can read them. The SPA fallback at `404.html` doesn't carry route-
// specific `<title>` / `<meta og:…>` — anything not prerendered shows
// up as a blank card. The build hits the API to enumerate names; this
// requires `PUBLIC_API_URL` to be reachable during `vite build`.
import type { EntryGenerator } from './$types';
import { loadBenchmarks } from '$lib/data/service';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const benches = await loadBenchmarks(true);
	return benches.map((b) => ({ name: b.name }));
};
