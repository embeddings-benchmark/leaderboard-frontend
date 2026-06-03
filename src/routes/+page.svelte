<script lang="ts">
	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		loadBenchmarkMenu()
			.then((m) => {
				menu = m;
				loading = false;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
	});

	function benchmarkCount(entry: MenuEntry): number {
		let n = 0;
		for (const c of entry.children) {
			if (isBenchmark(c)) n++;
			else n += benchmarkCount(c);
		}
		return n;
	}
</script>

<div class="explorer">
	<header class="hero">
		<h1>Pick a benchmark to explore.</h1>
		<p class="lead">
			Curated leaderboards across text, image, audio, and video embedding tasks. Browse the menu
			below or
			<a class="lead-link" href={resolve('/benchmarks')}>view all benchmarks →</a>
		</p>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else if error}
		<p class="muted">Failed to load benchmarks: {error}</p>
	{:else}
		{#each menu as section (section.name)}
			{@render menuNode(section, 0)}
		{/each}
	{/if}
</div>

{#snippet menuNode(entry: MenuEntry, depth: number)}
	{@const directBenches = entry.children.filter(isBenchmark) as Benchmark[]}
	{@const childGroups = entry.children.filter((c) => !isBenchmark(c)) as MenuEntry[]}
	{@const total = benchmarkCount(entry)}
	<details class="section depth-{depth}" open={entry.open}>
		<summary>
			<svg
				class="chev"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M9 6l6 6-6 6" />
			</svg>
			<h2>{entry.name}</h2>
			<span class="count">{total} benchmark{total === 1 ? '' : 's'}</span>
		</summary>
		{#if entry.description}
			<p class="section-desc"><MarkdownText text={entry.description} /></p>
		{/if}
		{#if directBenches.length > 0}
			<div class="grid">
				{#each directBenches as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
		{/if}
		{#each childGroups as child (child.name)}
			{@render menuNode(child, depth + 1)}
		{/each}
	</details>
{/snippet}

<style>
	.explorer {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 40px 0 28px;
	}
	h1 {
		font-size: 40px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 14px;
		color: var(--ink-strong);
	}
	/* Base `.lead` (color + margin) lives in src/app.css. */
	.lead {
		font-size: 16px;
	}
	.lead-link {
		color: var(--ink-strong);
		font-weight: 600;
		border-bottom: 1px solid var(--primary);
		padding-bottom: 1px;
		text-decoration: none;
	}
	.lead-link:hover {
		color: var(--primary-strong);
		background: var(--primary-soft);
		text-decoration: none;
	}

	/* Collapsible sections ---------------------------------------------------- */
	.section {
		margin: 14px 0;
	}
	.section.depth-0 > summary {
		border-bottom: 1px solid var(--border);
		padding-bottom: 10px;
	}
	.section.depth-0 > summary h2 {
		font-size: 18px;
	}
	.section.depth-1 {
		margin: 10px 0 10px 18px;
	}
	.section.depth-1 > summary h2 {
		font-size: 14px;
		color: var(--text-muted);
	}
	.section.depth-2 {
		margin: 6px 0 6px 16px;
	}
	.section.depth-2 > summary h2 {
		font-size: 13px;
		color: var(--text-subtle);
	}
	summary {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary h2 {
		flex: 1;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.005em;
	}
	.chev {
		flex-shrink: 0;
		color: var(--text-muted);
		transition: transform 0.16s cubic-bezier(0.6, 0.1, 0.2, 1);
		transform-origin: 50% 50%;
	}
	details[open] > summary .chev {
		transform: rotate(90deg);
	}
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
	.section-desc {
		margin: 4px 0 10px 24px;
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Card visuals live in $lib/components/BenchmarkCard.svelte. */
	.grid {
		margin: 8px 0 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.muted {
		padding: 20px 0;
	}
</style>
