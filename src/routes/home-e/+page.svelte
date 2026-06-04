<script lang="ts">
	// Variant E: like D, but the menu sub-sections are flattened into
	// first-class tabs instead of being nested under the top-level
	// entries. So instead of "General Purpose > {Image, Audio, ...}",
	// each sub-category (Image, Audio, Domain-Specific, Language-
	// specific, ...) becomes its own tab. Same name from different
	// parents (e.g. "Image" exists under both GP and Retrieval) merges
	// into a single tab so the user doesn't have to hunt twice.
	//
	// Retrieval pins to the first tab per request — it's the highest-
	// signal entry point so it deserves the default position.

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

	// Pin Retrieval to first, then the rest in menu order. Unknown
	// categories fall through to the end so adding a new top-level tab
	// is a no-op.
	const TAB_ORDER = [
		'Retrieval',
		'General Purpose',
		'Image',
		'Audio',
		'Domain-Specific',
		'Language-specific',
		'Other',
		'Miscellaneous'
	];

	function benchesUnder(entry: MenuEntry): Benchmark[] {
		// Direct benchmarks only — sub-categories become their own tabs
		// (via the same flattening at the parent level), so dumping
		// nested benchmarks into the parent's tab would double-count.
		return entry.children.filter(isBenchmark) as Benchmark[];
	}

	let tabs = $derived.by(() => {
		// Walk every node in the menu tree. A node contributes a tab if
		// it has at least one direct benchmark child. Same name across
		// branches merges (Retrieval's "Image" and GP's "Image" → one
		// tab) so the user doesn't have to hunt for variants of the
		// same category.
		const buckets = new Map<string, Benchmark[]>();
		const visit = (e: MenuEntry) => {
			// Some menu entries arrive with stray trailing whitespace
			// from upstream (e.g. "Domain-Specific " vs "Domain-Specific")
			// which would split into two tabs. Trim before bucketing.
			const key = e.name.trim();
			const direct = benchesUnder(e);
			if (direct.length > 0) {
				const arr = buckets.get(key) ?? [];
				const seen = new Set(arr.map((b) => b.name));
				for (const b of direct) {
					if (!seen.has(b.name)) {
						arr.push(b);
						seen.add(b.name);
					}
				}
				buckets.set(key, arr);
			}
			for (const c of e.children) {
				if (!isBenchmark(c)) visit(c);
			}
		};
		menu.forEach(visit);
		const orderIndex = (name: string) => {
			const i = TAB_ORDER.indexOf(name);
			return i === -1 ? TAB_ORDER.length : i;
		};
		const list = Array.from(buckets, ([name, benches]) => ({ name, benches }));
		list.sort((a, b) => orderIndex(a.name) - orderIndex(b.name) || a.name.localeCompare(b.name));
		return list;
	});

	$effect(() => {
		if (!activeTab && tabs.length > 0) activeTab = tabs[0].name;
	});
	let activeTabData = $derived(tabs.find((t) => t.name === activeTab) ?? tabs[0]);
</script>

<VariantSwitcher active="e" />

<div class="page">
	<header class="hero">
		<h1>Benchmark Overview</h1>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<section class="starters" aria-label="Starter benchmarks">
			<div class="starter-grid">
				{#each starters as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
		</section>

		<section class="tabs-panel" aria-label="Browse by category">
			<div class="tabbar" role="tablist">
				{#each tabs as t (t.name)}
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === t.name}
						class="tab"
						class:on={activeTab === t.name}
						onclick={() => (activeTab = t.name)}
					>
						{t.name}
						<span class="tab-count">{t.benches.length}</span>
					</button>
				{/each}
			</div>

			{#if activeTabData}
				<div class="tab-body" role="tabpanel">
					<div class="card-grid">
						{#each activeTabData.benches as b (b.name)}
							<BenchmarkCard {b} />
						{/each}
					</div>
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
