<script lang="ts">
	// Variant K: like D, but the 4 "starter" tiles on top become 4
	// mini-leaderboards — each card shows the top 5 models on that
	// benchmark with their Mean (Task) score, so the user sees ranked
	// results before any click. The lower tabbed panel is the same
	// nested category layout as variant D.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu, loadSummary } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type BenchmarkSummary, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import ModelTypeIcon from '$lib/components/ModelTypeIcon.svelte';
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

	// Pick the 4 starter benchmarks (preferred names first; backfill
	// from the top of the menu). Re-used by the leaderboard fetch
	// effect below.
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

	// Map benchmark name → its summary (top rows). Populated lazily by
	// the effect below. Indexed lookup so each card can re-render
	// independently as its summary arrives.
	let summaries = $state<Record<string, BenchmarkSummary | 'loading' | 'error'>>({});
	$effect(() => {
		// Re-run only when the starter set changes (e.g. menu loads).
		// Loop over names, kick a fetch for each that isn't already
		// recorded. Errors are stored so the UI shows a "no data" tile
		// rather than spinning forever.
		for (const b of starters) {
			if (summaries[b.name]) continue;
			summaries[b.name] = 'loading';
			loadSummary(b.name)
				.then((s) => {
					summaries[b.name] = s;
				})
				.catch(() => {
					summaries[b.name] = 'error';
				});
		}
	});

	const TAB_ORDER = [
		'General Purpose',
		'Retrieval',
		'Image',
		'Audio',
		'Domain-Specific',
		'Language-specific',
		'Other',
		'Miscellaneous'
	];
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
			const ai = TAB_ORDER.indexOf(a.entry.name.trim());
			const bi = TAB_ORDER.indexOf(b.entry.name.trim());
			const aRank = ai === -1 ? TAB_ORDER.length : ai;
			const bRank = bi === -1 ? TAB_ORDER.length : bi;
			return aRank - bRank;
		});
		return out;
	});
	$effect(() => {
		if (!activeTab && tabs.length > 0) activeTab = tabs[0].entry.name;
	});
	let activeTabData = $derived(tabs.find((t) => t.entry.name === activeTab) ?? tabs[0]);

	function topRows(s: BenchmarkSummary | 'loading' | 'error' | undefined, n = 5) {
		if (!s || s === 'loading' || s === 'error') return [];
		return s.rows.slice(0, n);
	}
	function pickScore(row: { meanTask: number | null; scoresByTaskType?: Record<string, number> }) {
		// Most benchmarks expose meanTask; for ones without (rare), fall
		// back to the first per-type score so the mini-table isn't empty.
		if (row.meanTask != null) return row.meanTask;
		const first = Object.values(row.scoresByTaskType ?? {})[0];
		return first ?? null;
	}
	function fmtScore(v: number | null): string {
		if (v == null) return '—';
		return (v * 100).toFixed(1);
	}
</script>

<VariantSwitcher active="k" />

<div class="page">
	<header class="hero">
		<h1>Benchmark Overview</h1>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<section class="leaderboards" aria-label="Featured leaderboards">
			<div class="leader-grid">
				{#each starters as b (b.name)}
					{@const sum = summaries[b.name]}
					{@const rows = topRows(sum, 5)}
					<article class="lb-card" data-modality={b.modalities[0] ?? 'text'}>
						<header class="lb-head">
							<div class="lb-titles">
								<a class="lb-title" href={resolve('/benchmark/[name]', { name: b.name })}>
									{b.displayName}
								</a>
								<span class="lb-sub">{b.numModels ?? 0} models · {b.tasks.length} tasks</span>
							</div>
							<a class="lb-open" href={resolve('/benchmark/[name]', { name: b.name })}>Open →</a>
						</header>
						{#if sum === 'loading' || sum === undefined}
							<div class="lb-state">Loading top models…</div>
						{:else if sum === 'error'}
							<div class="lb-state error">Couldn't load this leaderboard.</div>
						{:else if rows.length === 0}
							<div class="lb-state">No results yet.</div>
						{:else}
							<ol class="lb-list">
								{#each rows as r (r.model.name)}
									<li class="lb-row">
										<span class="lb-rank">{r.rank}</span>
										<span class="lb-model" data-model-type={r.model.modelType}>
											<span class="lb-icon" title={r.model.modelType}>
												<ModelTypeIcon type={r.model.modelType} size={11} />
											</span>
											<span class="lb-name">
												<span class="lb-org">{r.model.org}</span><span class="lb-sep">/</span><span class="lb-display"
													>{r.model.displayName}</span
												>
											</span>
										</span>
										<span class="lb-score">{fmtScore(pickScore(r))}</span>
									</li>
								{/each}
							</ol>
							<a class="lb-foot" href={resolve('/benchmark/[name]', { name: b.name })}>
								See full leaderboard →
							</a>
						{/if}
					</article>
				{/each}
			</div>
		</section>

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
				{@const groups = activeTabData.entry.children.filter(
					(c) => !isBenchmark(c)
				) as MenuEntry[]}
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
	.leaderboards {
		margin-bottom: 32px;
	}
	.leader-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}
	.lb-card {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 18px 18px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
		position: relative;
		overflow: hidden;
	}
	.lb-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--tint-fg);
	}
	.lb-card[data-modality='image'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.lb-card[data-modality='audio'] {
		--tint: var(--tint-amber);
		--tint-fg: var(--tint-amber-fg);
	}
	.lb-card[data-modality='video'] {
		--tint: var(--tint-pink);
		--tint-fg: var(--tint-pink-fg);
	}
	.lb-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}
	.lb-titles {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.lb-title {
		font-size: 17px;
		font-weight: 700;
		color: var(--ink-strong);
		text-decoration: none;
	}
	.lb-title:hover {
		color: var(--tint-fg);
	}
	.lb-sub {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}
	.lb-open {
		flex-shrink: 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--tint-fg);
		text-decoration: none;
	}
	.lb-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.lb-row {
		display: grid;
		grid-template-columns: 22px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 6px 4px;
		font-size: 13px;
	}
	.lb-row + .lb-row {
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.lb-rank {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-subtle);
		text-align: right;
	}
	.lb-model {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.lb-icon {
		display: inline-flex;
		width: 18px;
		height: 18px;
		align-items: center;
		justify-content: center;
		border-radius: 5px;
		background: var(--surface-muted);
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.lb-name {
		display: inline-flex;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lb-org {
		color: var(--text-muted);
	}
	.lb-sep {
		color: var(--text-subtle);
		margin: 0 1px;
	}
	.lb-display {
		font-weight: 600;
		color: var(--text);
	}
	.lb-score {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--tint-fg);
	}
	.lb-state {
		padding: 16px 4px;
		font-size: 13px;
		color: var(--text-muted);
	}
	.lb-state.error {
		color: var(--tint-orange-fg, #c0432e);
	}
	.lb-foot {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-decoration: none;
		padding-top: 4px;
	}
	.lb-foot:hover {
		color: var(--tint-fg);
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
		.leader-grid,
		.card-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		h1 {
			font-size: 24px;
		}
	}
</style>
