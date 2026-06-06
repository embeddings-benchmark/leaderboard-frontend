// Prerender the catalog so ShareMeta's `<title>` + `<meta og:…>` land in
// the static HTML. The page fetches its own live list on mount via
// `$effect`; the prerendered snapshot is just the shell + meta, never
// read for content.
export const prerender = true;
