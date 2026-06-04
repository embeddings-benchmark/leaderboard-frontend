<script lang="ts">
	// Variant D: hybrid starter row + tabbed deeper categories.
	// Top row keeps 4 always-visible "where most people start" tiles so
	// the main entry points never get hidden. The lower panel uses tabs
	// to specialize into the deeper category sections — tabs are
	// appropriate here because the user is opting in to "show me more
	// in dimension X", they're not the primary navigation.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let activeTab = $state<string>('');

	$effect(() => {
		loadBenchmarkMenu().then((m) => {
			menu = m;
			loading = false;
		});
	});

	// 4 always-visible starter tiles — preferred names first, fall back
	// to the top of the flattened menu so the row is never empty.
	const STARTER_NAMES = ['MTEB(Multilingual, v2)', 'MTEB(eng, v2)', 'MIEB(eng)', 'MAEB(beta)'];

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

	let flat = $derived(flatten(menu));
	let starters = $derived.by(() => {
		const byName = new Map(flat.map((b) => [b.name, b]));
		const picked: Benchmark[] = [];
		for (const n of STARTER_NAMES) {
			const b = byName.get(n);
			if (b) picked.push(b);
		}
		if (picked.length === 4) return picked;
		// Fill the rest from the top of the flat list, skipping dupes.
		const seen = new Set(picked.map((b) => b.name));
		for (const b of flat) {
			if (picked.length >= 4) break;
			if (!seen.has(b.name)) {
				picked.push(b);
				seen.add(b.name);
			}
		}
		return picked;
	});

	// Each top-level menu entry becomes a tab. Skip empty entries.
	// Tab body keeps the entry's sub-tree (direct benchmarks +
	// sub-groups) so we can render variant-A-style nested sections
	// rather than a flat dump — the "Domain-specific" / "Language-
	// specific" tabs in particular have meaningful sub-categories
	// (one per domain, one per language) that the user wants visible.
	function countBenchmarks(e: MenuEntry): number {
		let n = 0;
		for (const c of e.children) n += isBenchmark(c) ? 1 : countBenchmarks(c);
		return n;
	}
	let tabs = $derived.by(() => {
		const out: { entry: MenuEntry; count: number }[] = [];
		for (const e of menu) {
			const n = countBenchmarks(e);
			if (n > 0) out.push({ entry: e, count: n });
		}
		return out;
	});
	$effect(() => {
		if (!activeTab && tabs.length > 0) activeTab = tabs[0].entry.name;
	});
	let activeTabData = $derived(tabs.find((t) => t.entry.name === activeTab) ?? tabs[0]);
</script>

<VariantSwitcher active="d" />

<div class="page">
	<header class="hero">
		<h1>Benchmark Overview</h1>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<!-- Top row: 4 always-visible starter tiles. Never collapses
		     behind a tab so the most likely entry points are always one
		     click away from the home page. -->
		<section class="starters" aria-label="Starter benchmarks">
			<div class="starter-grid">
				{#each starters as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
		</section>

		<!-- Lower panel: tabs across deeper categories. The tabbed
		     surface is bordered as a single visual unit so it reads as
		     "supporting" content, not parallel to the starter row above. -->
		<section class="tabs-panel" aria-label="Browse by category">
			<div class="tabbar" role="tablist">
				{#each tabs as t (t.entry.name)}
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === t.entry.name}
						class="tab"
						class:on={activeTab === t.entry.name}
						onclick={() => (activeTab = t.entry.name)}
					>
						{t.entry.name}
						<span class="tab-count">{t.count}</span>
					</button>
				{/each}
			</div>

			{#if activeTabData}
				{@const direct = activeTabData.entry.children.filter(isBenchmark) as Benchmark[]}
				{@const groups = activeTabData.entry.children.filter(
					(c) => !isBenchmark(c)
				) as MenuEntry[]}
				<div class="tab-body" role="tabpanel" aria-labelledby={`tab-${activeTabData.entry.name}`}>
					{#if direct.length > 0}
						<div class="card-grid">
							{#each direct as b (b.name)}
								<BenchmarkCard {b} />
							{/each}
						</div>
					{/if}
					{#each groups as g (g.name)}
						{@const gDirect = g.children.filter(isBenchmark) as Benchmark[]}
						{#if gDirect.length > 0}
							<h3 class="subhead">
								{g.name}<span class="subhead-count">{gDirect.length}</span>
							</h3>
							<div class="card-grid">
								{#each gDirect as b (b.name)}
									<BenchmarkCard {b} />
								{/each}
							</div>
						{/if}
					{/each}
					{#if activeTabData.count > 0}
						<a
							class="see-all"
							href={`${resolve('/benchmarks')}?category=${encodeURIComponent(activeTabData.entry.name)}`}
						>
							See all {activeTabData.count} {activeTabData.entry.name.toLowerCase()} benchmarks →
						</a>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin: 24px 0 24px;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 32px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0;
		color: var(--ink-strong);
	}
	.all-link {
		font-weight: 600;
		font-size: 14px;
	}
	.starters {
		margin-bottom: 28px;
	}
	.starter-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}
	.tabs-panel {
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		overflow: hidden;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.tabbar {
		display: flex;
		gap: 4px;
		padding: 10px 12px 0;
		border-bottom: 1px solid var(--border);
		background: var(--surface-muted);
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.tab {
		all: unset;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 10px 10px 0 0;
		white-space: nowrap;
		transition:
			background 0.1s,
			color 0.1s;
	}
	.tab:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--primary) 8%, transparent);
	}
	.tab.on {
		color: var(--primary-strong);
		background: var(--surface);
		border-color: var(--border);
		position: relative;
		z-index: 1;
		margin-bottom: -1px; /* cover the panel's top border for the "joined" look */
	}
	.tab-count {
		font-size: 11px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.tab.on .tab-count {
		background: color-mix(in srgb, var(--primary) 22%, transparent);
		color: var(--primary-strong);
	}
	.tab-body {
		padding: 20px;
	}
	.card-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	.subhead {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 24px 0 12px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border);
	}
	.subhead-count {
		font-size: 11px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		text-transform: none;
		letter-spacing: 0;
	}
	.see-all {
		display: inline-block;
		margin-top: 18px;
		font-weight: 600;
		font-size: 14px;
	}
	@media (max-width: 980px) {
		.starter-grid,
		.card-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 560px) {
		.starter-grid,
		.card-grid {
			grid-template-columns: 1fr;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
