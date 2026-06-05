<script lang="ts">
	// Tabbed nested-category browser. Each top-level menu entry becomes
	// a tab; the active tab body renders direct benchmark children as a
	// grid plus each sub-group as a subhead + grid (variant-D shape).
	// Reusable across home + future catalogue pages.

	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';

	interface Props {
		menu: MenuEntry[];
		// Tabs in this order first; anything else falls to the end in
		// menu order.
		tabOrder?: readonly string[];
	}
	let { menu, tabOrder = [] }: Props = $props();

	let activeTab = $state<string>('');

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
		out.sort((a, b) => {
			const ai = tabOrder.indexOf(a.entry.name.trim());
			const bi = tabOrder.indexOf(b.entry.name.trim());
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
		return out;
	});
	$effect(() => {
		if (!activeTab && tabs.length > 0) activeTab = tabs[0].entry.name;
	});
	let activeTabData = $derived(tabs.find((t) => t.entry.name === activeTab) ?? tabs[0]);
</script>

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
				{t.entry.name.trim()}
				<span class="tab-count">{t.count}</span>
			</button>
		{/each}
	</div>

	{#if activeTabData}
		{@const direct = activeTabData.entry.children.filter(isBenchmark) as Benchmark[]}
		{@const groups = activeTabData.entry.children.filter((c) => !isBenchmark(c)) as MenuEntry[]}
		<div class="tab-body" role="tabpanel">
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
		</div>
	{/if}
</section>

<style>
	.tabs-panel {
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		overflow: hidden;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.tabbar {
		display: flex;
		flex-wrap: wrap;
		row-gap: 6px;
		column-gap: 4px;
		padding: 10px 12px 0;
		border-bottom: 1px solid var(--border);
		background: var(--surface-muted);
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
		margin-bottom: -1px;
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
	@media (max-width: 980px) {
		.card-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
