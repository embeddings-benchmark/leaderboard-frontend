<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import { env } from '$env/dynamic/public';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import CopyableId from '$lib/components/CopyableId.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import { apiUrl, fmtCompact, isIconUrl, slug } from '$lib/format';
	import { getParam, updateUrl } from '$lib/url-state';

	// `/benchmarks` returns *every* benchmark, even those not on the curated
	// menu. We compare against the menu to call out which ones aren't reachable
	// from the explorer home.
	const API = env.PUBLIC_API_URL?.trim() ?? '';

	let allBenchmarks = $state<Benchmark[]>([]);
	const menuNames = new SvelteSet<string>();
	let loading = $state(true);
	let error = $state<string | null>(null);
	// Hydrate the search query from `?q=` so refresh / share keeps the
	// filtered view, and mirror every keystroke back to the URL.
	let query = $state(getParam('q') ?? '');
	$effect(() => {
		updateUrl({ q: query.trim() || null });
	});

	function fillFromMenu(entries: MenuEntry[]) {
		menuNames.clear();
		const walk = (m: MenuEntry) => {
			for (const c of m.children) {
				if (isBenchmark(c)) menuNames.add(c.name);
				else walk(c);
			}
		};
		entries.forEach(walk);
	}

	async function loadAll(): Promise<Benchmark[]> {
		if (!API) return []; // offline build — no all-list endpoint
		// include_hidden surfaces benchmarks with display_on_leaderboard=False
		// so the "Not on the menu" section is non-empty.
		const res = await fetch(`${API}/benchmarks?include_hidden=true`);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return (await res.json()) as Benchmark[];
	}

	$effect(() => {
		Promise.all([loadAll(), loadBenchmarkMenu()])
			.then(([list, menu]) => {
				allBenchmarks = list.sort((a, b) => a.displayName.localeCompare(b.displayName));
				fillFromMenu(menu);
				loading = false;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
	});

	// Single unified list: featured (on the curated explorer menu) first,
	// then non-menu benchmarks (older versions, specialised drops). The
	// `.card.other` styling still distinguishes them visually so users
	// can tell which ones are off-menu without a separate section.
	let filteredAll = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const matches = (b: Benchmark) =>
			!q || b.name.toLowerCase().includes(q) || b.displayName.toLowerCase().includes(q);
		const featured = allBenchmarks.filter((b) => menuNames.has(b.name) && matches(b));
		const other = allBenchmarks.filter((b) => !menuNames.has(b.name) && matches(b));
		return [...featured, ...other];
	});
</script>

<div class="page">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href={resolve('/')}>Home</a>
		<span class="sep">/</span>
		<span class="current">All benchmarks</span>
	</nav>

	<header class="hero">
		<h1>All benchmarks</h1>
		<p class="lead">
			Every benchmark registered in mteb — including ones that aren't on the curated explorer menu.
			Use the search box to find a benchmark by name.
		</p>
		<p class="contribute-note">
			To add your benchmark, follow our
			<a
				href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_benchmark/"
				target="_blank"
				rel="noreferrer">contributor guide</a
			>.
		</p>
	</header>

	<div class="toolbar">
		<div class="search">
			<input type="search" placeholder="Search benchmarks…" bind:value={query} />
			{#if query}
				<button type="button" class="clear" onclick={() => (query = '')} aria-label="Clear"
					>×</button
				>
			{/if}
		</div>
		<span class="count">
			{filteredAll.length} / {allBenchmarks.length}
		</span>
	</div>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else if error}
		<p class="muted">Failed to load: {error}</p>
	{:else if filteredAll.length === 0}
		<p class="muted">No benchmark matches that search.</p>
	{:else}
		<section class="block">
			<header class="block-head">
				<h2>Benchmarks</h2>
				<span class="count">{filteredAll.length}</span>
				<span class="hint">
					— faded cards aren't on the curated explorer menu (older versions or specialised drops).
					The "Newer version" tag links to the current replacement when there is one.
				</span>
			</header>
			<div class="grid">
				{#each filteredAll as b (b.name)}
					{@render benchmarkCard(b, !menuNames.has(b.name))}
				{/each}
			</div>
		</section>
	{/if}
</div>

{#snippet benchmarkCard(b: Benchmark, other: boolean)}
	<a class="card" class:other href={resolve('/benchmark/[name]', { name: slug(b.name) })}>
		<div class="card-head">
			{#if b.icon}
				{#if isIconUrl(b.icon)}
					<img class="card-icon" src={apiUrl(b.icon)} alt="" loading="lazy" />
				{:else}
					<span class="card-icon card-icon-text" aria-hidden="true">{b.icon}</span>
				{/if}
			{/if}
			<div class="card-titles">
				<span class="card-name">{b.displayName}</span>
				<CopyableId value={b.name} ariaLabel="Copy benchmark id" />
			</div>
		</div>
		<p class="card-desc"><MarkdownText text={b.description} /></p>
		<div class="card-foot">
			{#if b.newVersion && b.newVersion.length > 0}
				<!-- Whole note is clickable; navigates to the first newer version. -->
				<button
					type="button"
					class="newer-note"
					title="Open {b.newVersion[0]}"
					onclick={(e) => {
						e.stopPropagation();
						e.preventDefault();
						goto(resolve('/benchmark/[name]', { name: slug(b.newVersion![0]) }));
					}}
				>
					<span class="newer-label">Newer version</span>
					{#each b.newVersion as nv (nv)}
						<code class="newer-link">{nv}</code>
					{/each}
				</button>
			{/if}
			<div class="stats-line">
				{#if b.numModels && b.numModels > 0}
					<span title="{b.numModels} models"><strong>{fmtCompact(b.numModels)}</strong> models</span
					>
					<span class="dot">·</span>
				{/if}
				<span title="{b.tasks.length} tasks"
					><strong>{fmtCompact(b.tasks.length)}</strong> tasks</span
				>
				<span class="dot">·</span>
				<span title="{b.languages.length} languages"
					><strong>{fmtCompact(b.languages.length)}</strong> langs</span
				>
				<span class="dot">·</span>
				<span title="{b.taskTypes.length} task types"
					><strong>{fmtCompact(b.taskTypes.length)}</strong> types</span
				>
			</div>
		</div>
	</a>
{/snippet}

<ShareUrlButton />

<style>
	/* Base `.page` (1280 px centred, 18/28/56 padding) is in app.css —
	   only the bottom padding differs here. */
	.page {
		padding-bottom: 64px;
	}
	/* `.breadcrumb`, `.breadcrumb a`, `.breadcrumb .sep`,
	   `.breadcrumb .current` live in src/app.css. */
	.hero {
		padding: 28px 0 18px;
		position: relative;
	}
	h1 {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.08;
		margin: 0 0 10px;
		color: var(--ink-strong);
	}
	.hero::before {
		content: '';
		position: absolute;
		top: 18px;
		left: 0;
		width: 32px;
		height: 3px;
		background: var(--primary);
		border-radius: 2px;
	}
	/* Base `.lead` (color + margin) lives in src/app.css. */
	.lead {
		font-size: 15px;
		line-height: 1.55;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 18px 0;
	}
	.search {
		position: relative;
		flex: 1;
		max-width: 420px;
	}
	.search input {
		width: 100%;
		padding: 8px 28px 8px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 13px;
		font-family: inherit;
		background: var(--surface);
	}
	.search input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	.clear {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		border: none;
		background: none;
		color: var(--text-subtle);
		font-size: 16px;
		cursor: pointer;
	}
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.block {
		margin: 22px 0;
	}
	.block-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}
	.block-head h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.hint {
		font-size: 12px;
		color: var(--text-subtle);
		font-weight: 400;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-decoration: none;
		color: var(--text);
		transition:
			transform 0.12s ease,
			border-color 0.12s ease,
			box-shadow 0.12s ease;
		max-height: 220px;
		overflow: hidden;
	}
	.card:hover {
		border-color: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 10px 24px rgb(15, 23, 42, 0.06);
	}
	.card.other {
		background: var(--surface-muted);
	}
	.card-head {
		display: flex;
		/* Top-align the icon so it sits next to the display-name row,
		   not vertically centred between the name and the id pill. */
		align-items: flex-start;
		gap: 10px;
	}
	.card-icon {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 4px;
		object-fit: contain;
		background: var(--surface-muted);
		margin-top: 1px;
	}
	/* Text/emoji icons centered in the same 28px square as the image variant. */
	.card-icon-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		line-height: 1;
	}
	.card-titles {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	.card-name {
		font-size: 15px;
		font-weight: 700;
	}
	.card-foot {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.newer-note {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		padding: 5px 9px;
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
		border-radius: 8px;
		font-size: 11px;
		color: var(--primary-strong);
		align-self: flex-start;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition:
			background 0.12s,
			border-color 0.12s;
	}
	.newer-note:hover {
		background: color-mix(in srgb, var(--primary) 18%, var(--surface));
		border-color: var(--primary);
	}
	.newer-note:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.newer-label {
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		font-size: 10px;
	}
	.newer-link {
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 1px 6px;
		background: var(--surface);
		border-radius: 4px;
		color: var(--primary-strong);
	}
	.stats-line {
		display: flex;
		flex-wrap: wrap;
		column-gap: 4px;
		row-gap: 2px;
		align-items: baseline;
		font-size: 11.5px;
		color: var(--text-muted);
	}
	.stats-line > span:not(.dot) {
		white-space: nowrap;
	}
	.stats-line strong {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.stats-line .dot {
		color: var(--border-strong);
	}
	.card-desc {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		padding: 20px 0;
	}
</style>
