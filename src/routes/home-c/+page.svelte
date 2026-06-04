<script lang="ts">
	// Variant C: search-first power-user layout.
	// Sticky search input + modality pills filter a flat wall of cards
	// live. No accordions, no sections — one screen, fast to scan once
	// the user knows what they want.

	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let query = $state('');
	let activeModality = $state<'all' | 'text' | 'image' | 'audio' | 'video'>('all');

	$effect(() => {
		loadBenchmarkMenu().then((m) => {
			menu = m;
			loading = false;
		});
	});

	const MODALITIES: Array<typeof activeModality> = ['all', 'text', 'image', 'audio', 'video'];

	function flatten(entries: MenuEntry[]): Benchmark[] {
		const out: Benchmark[] = [];
		const walk = (e: MenuEntry) => {
			for (const c of e.children) {
				if (isBenchmark(c)) out.push(c);
				else walk(c);
			}
		};
		entries.forEach(walk);
		return out;
	}

	let allBenches = $derived(flatten(menu));
	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return allBenches.filter((b) => {
			if (activeModality !== 'all') {
				if (!b.modalities.includes(activeModality)) return false;
			}
			if (!q) return true;
			return (
				b.name.toLowerCase().includes(q) ||
				(b.description?.toLowerCase().includes(q) ?? false) ||
				b.taskTypes.some((t) => t.toLowerCase().includes(q)) ||
				b.languages.some((l) => l.toLowerCase().includes(q))
			);
		});
	});

	function counts(modality: typeof activeModality): number {
		if (modality === 'all') return allBenches.length;
		return allBenches.filter((b) => b.modalities.includes(modality)).length;
	}
</script>

<VariantSwitcher active="c" />

<div class="page">
	<header class="hero">
		<h1>Find an embedding benchmark.</h1>
		<p class="lead">Search across {allBenches.length} curated leaderboards in one place.</p>
	</header>

	<div class="search-strip">
		<label class="search">
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="M21 21l-4.3-4.3" />
			</svg>
			<input
				type="search"
				placeholder="Try “multilingual”, “code”, “image”, “Spanish”…"
				bind:value={query}
				aria-label="Search benchmarks"
			/>
			{#if query}
				<button type="button" class="clear" onclick={() => (query = '')} aria-label="Clear search">
					&times;
				</button>
			{/if}
		</label>
		<div class="pills" role="tablist" aria-label="Filter by modality">
			{#each MODALITIES as m (m)}
				<button
					type="button"
					role="tab"
					aria-selected={activeModality === m}
					class="pill"
					class:on={activeModality === m}
					data-modality={m === 'all' ? null : m}
					onclick={() => (activeModality = m)}
				>
					<span class="cap">{m}</span>
					<span class="cnt">{counts(m)}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else if filtered.length === 0}
		<p class="empty">No benchmarks match that search. Try a different query.</p>
	{:else}
		<div class="grid">
			{#each filtered as b (b.name)}
				<BenchmarkCard {b} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 16px 0 20px;
	}
	h1 {
		font-size: 36px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		color: var(--ink-strong);
	}
	.lead {
		color: var(--text-muted);
		margin: 0;
	}
	.search-strip {
		position: sticky;
		top: calc(var(--header-offset, 56px) + 36px);
		z-index: 3;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		margin: 12px 0 24px;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(14px) saturate(140%);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: var(--bg);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		color: var(--text-muted);
		transition: border-color 0.14s;
	}
	.search:focus-within {
		border-color: var(--primary);
		color: var(--text);
	}
	.search input {
		flex: 1;
		border: none;
		background: none;
		font: inherit;
		font-size: 15px;
		color: var(--text);
		outline: none;
	}
	.search .clear {
		all: unset;
		cursor: pointer;
		font-size: 18px;
		color: var(--text-muted);
		padding: 0 4px;
	}
	.search .clear:hover {
		color: var(--text);
	}
	.pills {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.pill {
		all: unset;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
	}
	.pill:hover {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.pill .cap {
		text-transform: capitalize;
	}
	.pill .cnt {
		font-size: 11px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.pill.on {
		color: var(--primary-strong);
		background: var(--primary-soft);
		border-color: var(--primary);
	}
	.pill.on .cnt {
		background: color-mix(in srgb, var(--primary) 22%, transparent);
		color: var(--primary-strong);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.empty {
		text-align: center;
		padding: 60px 0;
		color: var(--text-muted);
	}
	@media (max-width: 720px) {
		h1 {
			font-size: 28px;
		}
	}
</style>
