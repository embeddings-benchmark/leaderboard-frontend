// Dynamic detail pages are rendered client-side at runtime — the static
// adapter's `fallback: '404.html'` SPA fallback serves these deep links.
// We cannot enumerate entries() at build time once data lives on a live API.
export const prerender = false;
