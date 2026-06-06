<script lang="ts">
	// Emits the `<title>` + Open Graph + Twitter Card meta block for a route.
	// Picked up by Slack / Discord / Twitter (X) / iMessage / LinkedIn / etc.
	// when someone pastes the URL, and by search engines for the SERP snippet.
	//
	// Detail pages (per-benchmark, per-task, per-model) call this with their
	// loaded entity once it's in scope so the card title + description reflect
	// the actual page. The root layout sets sane defaults so /, /benchmarks,
	// /compare, etc. still get *some* preview when shared.

	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { PUBLIC_API_URL } from '$env/static/public';

	interface Props {
		// Card title. Will be suffixed with " · MTEB Leaderboard" so the brand
		// is always visible. Pass the entity name (benchmark / task / model)
		// for detail pages, the section name for catalogs.
		title: string;
		// 1-2 sentence summary. Truncated to 200 chars at render time — most
		// preview cards cap at 180-200 anyway. Markdown stripping is the
		// caller's responsibility (description fields can contain inline
		// emphasis we don't want in the OG text).
		description: string;
		// Absolute or root-relative image URL. The catalog / index pages
		// usually pass undefined and the default dots-icon kicks in.
		image?: string;
		// Per-entity hero variant. When set, ShareMeta points the OG image
		// at the backend's pre-rendered card:
		// `${PUBLIC_API_URL}/og/{kind}/{encodeURIComponent(name)}.png`.
		// The backend's `generate.mjs` renders one per entity, so any
		// benchmark / task / model gets a custom hero — no top-N cut.
		// Falls back to `image` then `og-default.png` when no API URL is
		// configured (offline mock builds).
		entity?: { kind: 'benchmark' | 'task' | 'model'; name: string };
		// Twitter card style. `summary_large_image` displays a wide hero card
		// (recommended for the benchmark / task / model detail pages so the
		// MTEB brand reads at a glance). `summary` is a smaller square card.
		twitterCard?: 'summary' | 'summary_large_image';
	}
	let {
		title,
		description,
		image,
		entity,
		twitterCard = 'summary_large_image'
	}: Props = $props();

	let fullTitle = $derived(`${title} · MTEB Leaderboard`);
	// Cap to 200 chars — every major social card truncates around there, and
	// the per-call slice keeps the meta tag short. Strips newlines too because
	// some readers (Slack) treat newlines as <br> inside the card body.
	let desc = $derived(
		description.replace(/\s+/g, ' ').trim().slice(0, 200)
	);
	// Absolute origin needed for OG / Twitter — relative URLs don't resolve in
	// the crawler. `page.url` is available during SSR / prerender and after
	// client hydration; on the SSR pass with no host (vite dev), origin is
	// `http://localhost:5173`, which is fine for local sharing tests.
	let origin = $derived(page.url.origin);
	let canonicalUrl = $derived(page.url.href);
	// Per-entity hero takes precedence when the caller declares one. The
	// PNG is served by the mteb FastAPI backend out of its persistent
	// /data/og volume (see `mteb/api/og/generate.mjs`). When PUBLIC_API_URL
	// isn't set (offline mock build), `entityImage` resolves to null and
	// the fallback chain below kicks in.
	let apiBase = $derived(PUBLIC_API_URL?.trim().replace(/\/$/, '') || '');
	// Encode each path segment individually so model names like
	// `microsoft/harrier-oss-v1-27b` stay nested in the URL — Starlette's
	// StaticFiles decodes `%2F` to `/` before file lookup, so a single
	// encoded slug always 404s. Per-segment encoding mirrors the
	// frontend route layout (`/models/[...name]`).
	let entityImage = $derived(
		entity && apiBase
			? `${apiBase}/og/${entity.kind}/${entity.name
					.split('/')
					.map(encodeURIComponent)
					.join('/')}.png`
			: null
	);
	// No fallback to a static default — pages without an entity hero (home,
	// /compare, the catalog index pages) simply omit the image meta tags.
	// Most readers fall back to a generic site card; the alternative
	// (shipping a hand-built og-default.png in /static) would break
	// prerender every time the file went missing and adds another asset
	// the team has to keep in sync with the brand.
	let absImage = $derived<string | null>(
		entityImage ??
			(image
				? image.startsWith('http')
					? image
					: `${origin}${image.startsWith('/') ? image : `/${image}`}`
				: null)
	);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={desc} />
	<!-- Viewport is normally set once in app.html, but emitting it here too
	     guarantees every prerendered page declares it without us needing to
	     remember on a per-route basis. Duplicates collapse to the last value
	     in browsers — the value is the same, so it's a no-op. -->
	<meta name="viewport" content="width=device-width, initial-scale=1" />

	<!-- Open Graph: drives the rich preview on Slack, Discord, Facebook,
	     LinkedIn, iMessage, and most chat clients. `og:type=website` is the
	     generic catch-all; we don't need `article` since these are catalog
	     pages, not blog posts. -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="MTEB Leaderboard" />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={canonicalUrl} />
	{#if absImage}
		<!-- Image dimensions + MIME help crawlers (LinkedIn especially)
		     lay the card out without having to download + inspect the PNG.
		     Every hero we ship is the standard 1200 × 630 OG box. -->
		<meta property="og:image" content={absImage} />
		<meta property="og:image:type" content="image/png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}

	<!-- Twitter Card: Twitter (X) reads its own namespace alongside OG. We
	     mirror the same image + text; `summary_large_image` shows a wide
	     hero, `summary` shows a square thumb next to text. -->
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={desc} />
	{#if absImage}
		<meta name="twitter:image" content={absImage} />
		<meta name="twitter:image:type" content="image/png" />
		<meta name="twitter:image:width" content="1200" />
		<meta name="twitter:image:height" content="630" />
	{/if}
</svelte:head>
