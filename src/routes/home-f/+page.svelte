<script lang="ts">
	// Variant F: sticky left sidebar lists every category (collapsible
	// into subgroups); right pane shows the active category's cards.
	// No tabs, no horizontal scroll, persistent nav context. Power-
	// user shape — closer to Notion / Linear than to a directory page.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let activeKey = $state<string>('');

	$effect(() => {
		loadBenchmarkMenu().then((m) => {
			menu = m;
			loading = false;
		});
	});

	// Flatten the menu into nav items. Each top-level entry becomes a
	// section header; sub-entries become indented child rows. Keys are
	// dot-joined paths so two unrelated "Image" entries don't collide.
	type NavItem = { key: string; label: string; depth: number; benches: Benchmark[] };
	let nav = $derived.by(() => {
		const out: NavItem[] = [];
		const visit = (e: MenuEntry, parentKey: string, depth: number) => {
			const key = parentKey ? `${parentKey}/${e.name}` : e.name;
			const direct = e.children.filter(isBenchmark) as Benchmark[];
			if (direct.length > 0 || depth === 0) {
				out.push({ key, label: e.name.trim(), depth, benches: direct });
			}
			for (const c of e.children) {
				if (!isBenchmark(c)) visit(c, key, depth + 1);
			}
		};
		menu.forEach((m) => visit(m, '', 0));
		return out;
	});
	$effect(() => {
		if (!activeKey && nav.length > 0) {
			activeKey = nav.find((n) => n.benches.length > 0)?.key ?? nav[0].key;
		}
	});
	let activeData = $derived(nav.find((n) => n.key === activeKey));
</script>

<VariantSwitcher active="f" />

<div class="page">
	<aside class="side" aria-label="Categories">
		<h1>Browse</h1>
		<nav>
			{#each nav as item (item.key)}
				<button
					type="button"
					class="nav-item depth-{item.depth}"
					class:on={activeKey === item.key}
					onclick={() => (activeKey = item.key)}
				>
					<span class="nav-label">{item.label}</span>
					{#if item.benches.length > 0}
						<span class="nav-count">{item.benches.length}</span>
					{/if}
				</button>
			{/each}
		</nav>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</aside>

	<main class="content">
		{#if loading}
			<p class="muted">Loading…</p>
		{:else if activeData}
			<header class="head">
				<h2>{activeData.label}</h2>
				<span class="kicker">{activeData.benches.length} benchmarks</span>
			</header>
			{#if activeData.benches.length === 0}
				<p class="muted">This category has no direct benchmarks — pick a sub-category in the sidebar.</p>
			{:else}
				<div class="grid">
					{#each activeData.benches as b (b.name)}
						<BenchmarkCard {b} />
					{/each}
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.page {
		display: grid;
		grid-template-columns: 260px 1fr;
		gap: 0;
		max-width: 1400px;
		margin: 0 auto;
		min-height: calc(100vh - var(--header-offset, 56px));
	}
	.side {
		position: sticky;
		top: var(--header-offset, 56px);
		align-self: start;
		height: calc(100vh - var(--header-offset, 56px) - 36px);
		overflow-y: auto;
		padding: 24px 16px 24px 28px;
		border-right: 1px solid var(--border);
	}
	.side h1 {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 0 0 12px;
	}
	nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-bottom: 16px;
	}
	.nav-item {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		border-radius: 6px;
	}
	.nav-item.depth-1 {
		padding-left: 22px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.nav-item.depth-2 {
		padding-left: 34px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.nav-item:hover {
		background: var(--surface-muted);
	}
	.nav-item.on {
		background: var(--primary-soft);
		color: var(--primary-strong);
		font-weight: 700;
	}
	.nav-count {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-subtle);
	}
	.nav-item.on .nav-count {
		color: var(--primary-strong);
	}
	.all-link {
		font-size: 12px;
		font-weight: 600;
	}
	.content {
		padding: 28px 28px 64px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}
	.head h2 {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
		color: var(--ink-strong);
	}
	.kicker {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	@media (max-width: 880px) {
		.page {
			grid-template-columns: 1fr;
		}
		.side {
			position: static;
			height: auto;
			border-right: none;
			border-bottom: 1px solid var(--border);
		}
	}
</style>
