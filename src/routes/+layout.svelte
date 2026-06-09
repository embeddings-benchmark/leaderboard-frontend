<script lang="ts">
	import '../app.css';
	import '$lib/styles/leaderboard-table.css';
	import '$lib/styles/sidebar.css';
	import '$lib/styles/detail-page.css';
	import { onMount } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { base, resolve } from '$app/paths';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ComparePinnedButton from '$lib/components/ComparePinnedButton.svelte';
	import { filters } from '$lib/stores/filters.svelte';

	let { children } = $props();

	// Name search is a per-page find-in-table gesture, not a sticky
	// filter — clear it on cross-page navigation so typing "octen" on
	// /models doesn't pre-populate the same query on /benchmark/BEIR.
	// A page that legitimately wants to restore a previous query carries
	// it via `?q=…` and the filters store reads that param itself on
	// mount; rebuilding from the URL keeps deep-link behaviour intact.
	afterNavigate(({ from, to }) => {
		if (!to) return;
		if (from?.url?.pathname === to.url.pathname) return;
		const urlQ = to.url.searchParams.get('q') ?? '';
		if (filters.nameQuery !== urlQ) filters.nameQuery = urlQ;
	});

	// $app/state's `updated.current` flips to true when the poll detects a new
	// deployed version (svelte.config.js `kit.version.pollInterval`). Force a
	// full reload on the next client-side navigation so the new build lands
	// without users needing to clear cache.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) {
			location.href = to.url.href;
		}
	});

	// As a belt-and-suspenders fallback: if no navigation happens but the page
	// is idle for a while after detecting an update, refresh once it goes
	// hidden so the next foreground visit is fresh.
	onMount(() => {
		function onVisibility() {
			if (document.visibilityState === 'hidden' && updated.current) {
				location.reload();
			}
		}
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});

	// `page.url.pathname` includes the base; strip it for nav matching.
	let path = $derived.by(() => {
		const p = page.url.pathname;
		return base && p.startsWith(base) ? p.slice(base.length) || '/' : p;
	});

	// `/` (home) and `/benchmarks` (all-list) are now separate top-nav
	// entries. `/benchmark/{name}` (the per-benchmark detail page) is owned
	// by Benchmarks so the detail view doesn't sit "outside" any nav tab.
	function isHomeRoute(p: string) {
		const trimmed = p.replace(/\/$/, '') || '/';
		return trimmed === '/';
	}
	function isBenchmarksRoute(p: string) {
		const trimmed = p.replace(/\/$/, '') || '/';
		if (trimmed === '/benchmarks' || trimmed.startsWith('/benchmarks/')) return true;
		if (trimmed === '/benchmark' || trimmed.startsWith('/benchmark/')) return true;
		return false;
	}
	const NAV = [
		{ label: 'Home', href: resolve('/'), match: isHomeRoute },
		{ label: 'Benchmarks', href: resolve('/benchmarks'), match: isBenchmarksRoute },
		{ label: 'Models', href: resolve('/models'), match: (p: string) => p.startsWith('/models') },
		{ label: 'Tasks', href: resolve('/tasks'), match: (p: string) => p.startsWith('/tasks') },
		{ label: 'Compare', href: resolve('/compare'), match: (p: string) => p.startsWith('/compare') }
	];
</script>

<svelte:head>
	<link rel="icon" href="{base}/dots-icon.ico" type="image/x-icon" />
</svelte:head>

<!-- ShareMeta is intentionally NOT rendered at the layout level. Every
     route renders its own (per-entity title/description + per-entity OG
     hero card). Slack picks the FIRST og:image it encounters in the head,
     while most other crawlers pick the last — keeping a layout-level
     default + a page-level override resulted in Slack always showing
     og-default.png even on routes with a proper hero. Pushing all
     ShareMeta into the page level eliminates the duplicate. -->

<div class="shell">
	<!-- Skip link — targets each route's `#main-content` (WCAG 2.4.1). -->
	<a class="skip-link" href="#main-content">Skip to content</a>

	<header class="bar">
		<a class="brand" href={resolve('/')}>
			<img class="brand-icon" src="{base}/dots-icon.png" alt="MTEB logo" width="22" height="22" />
			<span class="name">MTEB</span>
		</a>
		<nav class="subnav" aria-label="Sections">
			{#each NAV as item (item.href)}
				<!-- `preload-code="eager"` parses the route module on first paint.
				     `preload-data="hover"` keeps the data fetch on hover (SvelteKit
				     only accepts hover/tap/off/false for data preload). Combined
				     with `cachedHttp` the data cost is still amortised — the data
				     fetch on hover populates the cache; subsequent SPA nav clicks
				     find it warm. -->
				<a
					href={item.href}
					class:active={item.match(path)}
					data-sveltekit-preload-code="eager"
					data-sveltekit-preload-data="hover"
				>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
		<div class="ext-links" aria-label="External resources">
			<ThemeToggle />
			<a
				class="icon-link"
				href="https://github.com/embeddings-benchmark/mteb/"
				target="_blank"
				rel="noreferrer"
				title="MTEB source on GitHub"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path
						fill="currentColor"
						d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.13 0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
					/>
				</svg>
				<span>MTEB</span>
			</a>
			<a
				class="icon-link"
				href="https://embeddings-benchmark.github.io/mteb/"
				target="_blank"
				rel="noreferrer"
				title="Documentation site"
			>
				<svg
					viewBox="0 0 24 24"
					width="16"
					height="16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
					<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
					<path d="M9 7h7" />
					<path d="M9 11h7" />
				</svg>
				<span>Documentation</span>
			</a>
		</div>
	</header>

	{@render children()}

	<!-- Floating "compare X pinned" chip — appears at bottom-center
	     whenever ≥2 models are pinned in any table. Self-hides on the
	     /compare route. Mounted once globally so every page benefits
	     without per-page wiring. -->
	<ComparePinnedButton />

	<footer class="page-footer" aria-label="Site footer">
		<a
			class="footer-link"
			href="https://github.com/embeddings-benchmark/leaderboardv2"
			target="_blank"
			rel="noreferrer"
		>
			<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
				<path
					fill="currentColor"
					d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.13 0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
				/>
			</svg>
			<span>Leaderboard source on GitHub</span>
		</a>
	</footer>
</div>

<style>
	/* Reusable noise-grain mask as a CSS var so the three .shell rules below
	   share the same `url(...)`. The browser caches each unique data: URI
	   once, but inlining the same string three times forces a re-parse on
	   every layout build. */
	:root {
		--grain-dark: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.025 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
		--grain-light: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.025 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
	}
	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		/* Light-mode: a barely-there dark-noise grain over the cool
		   off-white --bg. Dark mode swaps the grain mask below. */
		background: var(--grain-dark), var(--bg);
	}
	@media (prefers-color-scheme: dark) {
		:root:not([data-theme='light']) .shell {
			background: var(--grain-light), var(--bg);
		}
	}
	:root[data-theme='dark'] .shell {
		background: var(--grain-light), var(--bg);
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		/* Three-column grid keeps the center nav optically centered regardless
		   of how wide the brand or the icon group grow. */
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		padding: 10px 28px;
		background: var(--bar-bg);
		border-bottom: 1px solid var(--border);
		/* `min-height` (not `height`) so content growth can still push
		   the bar taller — sidebar/toolbar still dock cleanly because
		   they read the same token. */
		min-height: var(--header-height);
		box-sizing: border-box;
	}
	.subnav {
		justify-self: center;
	}
	.ext-links {
		justify-self: end;
	}
	/* Hairline accent under the bar — a pencil mark in the masthead. */
	.bar::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--primary) 18%,
			var(--primary) 22%,
			transparent 24%
		);
		opacity: 0.7;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--ink-strong);
	}
	.brand:hover {
		text-decoration: none;
	}
	.brand-icon {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		object-fit: contain;
	}
	.name {
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 15px;
		color: var(--ink-strong);
		letter-spacing: 0.04em;
	}
	.subnav {
		display: inline-flex;
		gap: 4px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.subnav a {
		position: relative;
		padding: 10px 14px;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.16s ease;
	}
	.subnav a::after {
		content: '';
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: 4px;
		height: 2px;
		background: var(--primary);
		border-radius: 1px;
		transform: scaleX(0);
		transform-origin: left center;
		transition: transform 0.22s cubic-bezier(0.6, 0.1, 0.2, 1);
	}
	.subnav a:hover {
		color: var(--ink-strong);
	}
	.subnav a:hover::after {
		transform: scaleX(0.35);
	}
	.subnav a.active {
		color: var(--ink-strong);
	}
	.subnav a.active::after {
		transform: scaleX(1);
	}

	/* External resource icons on the right side of the bar. */
	.ext-links {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.icon-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		color: var(--text-muted);
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-decoration: none;
		transition:
			color 0.16s ease,
			background 0.16s ease;
	}
	.icon-link:hover {
		color: var(--ink-strong);
		background: var(--surface-muted);
		text-decoration: none;
	}
	.icon-link:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	@media (max-width: 920px) {
		/* Drop the labels (icons + `title=` remain). 920, not 900: the
		   bar with labels is ~913 px wide, so 901-919 would overflow and
		   trigger a Firefox horizontal scrollbar that shifts every
		   bottom-anchored fixed element up by ~15 px. */
		.icon-link span {
			display: none;
		}
		.icon-link {
			padding: 6px 8px;
		}
	}
	@media (max-width: 800px) {
		/* Compact grid: brand | scrolling nav | ext-links, all one row.
		   `minmax(0, 1fr)` lets the nav scroll inside its cell instead
		   of pushing ext-links offscreen. 800, not 720: same Firefox-
		   scrollbar reason as the 920 breakpoint — bar with icon-only
		   ext-links is ~763 px, so 721-799 would overflow. */
		.bar {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}
		.subnav {
			/* `display: inline-flex` (the default) sizes to content and
			   ignores the cell width, so the nav was painting over the
			   ext-links column. Block-level flex + width:100% forces it
			   to honour the `minmax(0, 1fr)` track and scroll within. */
			display: flex;
			width: 100%;
			justify-self: start;
			min-width: 0;
			overflow-x: auto;
			/* Hide the scrollbar (paints under labels on a one-row strip);
			   the right-edge mask fade is the affordance instead. */
			scrollbar-width: none;
			mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
		}
		.subnav::-webkit-scrollbar {
			display: none;
		}
	}

	@media (max-width: 640px) {
		/* Trim the header's vertical footprint on phones — the previous
		   stacked layout took ~100 px before any content rendered. Shrink
		   padding, fonts, and the brand block; drop the wordmark so just
		   the icon represents the brand on the narrowest screens. */
		.bar {
			padding: 6px 10px;
			gap: 8px;
		}
		.brand {
			gap: 6px;
		}
		.brand-icon {
			width: 20px;
			height: 20px;
		}
		.name {
			font-size: 13px;
		}
		.subnav {
			font-size: 10px;
			letter-spacing: 0.1em;
		}
		.subnav a {
			padding: 6px 8px;
		}
		.subnav a::after {
			left: 8px;
			right: 8px;
			bottom: 2px;
		}
		.ext-links {
			gap: 2px;
		}
		/* Drop the GitHub / Documentation / Leaderboard icon links on
		   phones — they take precious header width and duplicate links
		   that live in the footer. The theme toggle stays. */
		.ext-links .icon-link {
			display: none;
		}
	}

	@media (max-width: 380px) {
		/* Drop the wordmark at the very smallest widths; the icon alone
		   identifies the brand. */
		.name {
			display: none;
		}
	}

	.page-footer {
		/* Push to the bottom of the flex column so short pages still pin
		   the footer at the viewport floor instead of floating mid-screen. */
		margin-top: auto;
		display: flex;
		justify-content: center;
		gap: 16px;
		padding: 18px 28px;
		border-top: 1px solid var(--border);
		background: var(--bar-bg);
		font-size: 12.5px;
	}
	.footer-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		text-decoration: none;
	}
	.footer-link:hover {
		color: var(--text);
	}
</style>
