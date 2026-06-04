<script lang="ts">
	// Variant L: synthesises the user's feedback across A–K.
	// Above-the-fold: a "Featured" eyebrow over three big primary tiles
	// (Multilingual / Retrieval / English) with the canonical "where
	// most people start" benchmark for each. Each tile shows top-by-
	// model-size mini-rankings so smaller models also get glory instead
	// of always rewarding the biggest. Beneath the primaries, a small
	// modality strip surfaces Image + Audio so non-text affordances
	// aren't hidden. A "Discover" slot shuffles two lesser-known
	// benchmarks on each load to drive exposure. Lower section reuses
	// D's tabbed nested-category browser.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu, loadSummary } from '$lib/data/service';
	import {
		isBenchmark,
		type Benchmark,
		type BenchmarkSummary,
		type SummaryRow,
		type MenuEntry
	} from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import ModelTypeIcon from '$lib/components/ModelTypeIcon.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
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

	// Primary tiles. Each entry pins to a specific benchmark name so
	// the framing ("Retrieval") is decoupled from whichever benchmark
	// is the current canonical pick. Fallback: first benchmark whose
	// task type list includes the framing keyword.
	type Primary = { key: 'multilingual' | 'retrieval' | 'english'; label: string; preferred: string };
	const PRIMARIES: Primary[] = [
		{ key: 'multilingual', label: 'Multilingual', preferred: 'MTEB(Multilingual, v2)' },
		{ key: 'retrieval', label: 'Retrieval', preferred: 'RTEB(beta)' },
		{ key: 'english', label: 'English', preferred: 'MTEB(eng, v2)' }
	];
	type ModalityTile = {
		modality: 'image' | 'audio' | 'video';
		label: string;
		preferred?: string;
		comingSoon?: boolean;
	};
	const MODALITY_TILES: ModalityTile[] = [
		{ modality: 'image', label: 'Image', preferred: 'MIEB(eng)' },
		{ modality: 'audio', label: 'Audio', preferred: 'MAEB(beta)' },
		// Placeholder slot so the layout already shows where Video will
		// slot in. The tile renders as a non-clickable "Coming soon"
		// card until a benchmark name is set.
		{ modality: 'video', label: 'Video', comingSoon: true }
	];

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
	let byName = $derived(new Map(flat.map((b) => [b.name, b])));
	function pick(name: string): Benchmark | undefined {
		return byName.get(name);
	}

	// Resolve the 3 primary + 2 modality benchmarks lazily so the
	// layout still renders if a preferred name isn't in the menu.
	let primaries = $derived(
		PRIMARIES.map((p) => ({ ...p, b: pick(p.preferred) })).filter((p) => !!p.b) as Array<
			Primary & { b: Benchmark }
		>
	);

	// "New" feed — hand-curated mock since the API doesn't yet expose
	// `createdAt` / `dateAdded` on benchmarks, models, or tasks. The
	// shape's already final; swap the hardcoded list for an
	// `/whats-new` endpoint once one exists. Keep entries trimmed to
	// 4-5 so the row stays one screen height.
	type NewKind = 'benchmark' | 'model' | 'task';
	type NewEntry = {
		kind: NewKind;
		name: string;
		title: string;
		blurb: string;
		// Relative label (e.g. "Yesterday", "3 days ago", "Nov 4") —
		// pre-rendered so the layout doesn't depend on the user's
		// timezone or a date-fns import.
		when: string;
	};
	const NEW_ENTRIES: NewEntry[] = [
		{
			kind: 'benchmark',
			name: 'MAEB(beta)',
			title: 'MAEB (Audio)',
			blurb: 'Mass-scale Audio Embedding Benchmark — beta rollout.',
			when: '2 days ago'
		},
		{
			kind: 'model',
			name: 'Qwen/Qwen3-Embedding-8B',
			title: 'Qwen3-Embedding-8B',
			blurb: 'Open-weights 8B leader on MTEB(Multilingual) 1–10B bucket.',
			when: '5 days ago'
		},
		{
			kind: 'task',
			name: 'AmazonReviewsClassification',
			title: 'AmazonReviewsClassification',
			blurb: 'Refreshed task metadata + new language coverage.',
			when: '1 week ago'
		},
		{
			kind: 'benchmark',
			name: 'MIEB(eng)',
			title: 'MIEB (Image)',
			blurb: 'Image-text leaderboard — top model: jina-omni-small.',
			when: 'Nov 27'
		},
		{
			kind: 'model',
			name: 'infgrad/Jasper-Token-Compression-600M',
			title: 'Jasper-Token-Compression-600M',
			blurb: 'New 600M leader on MTEB(eng, v2) — beats every <1B model.',
			when: 'Nov 24'
		},
		{
			kind: 'task',
			name: 'CodeSearchNetRetrieval',
			title: 'CodeSearchNetRetrieval',
			blurb: 'Code-language retrieval task added to MTEB(Code, v1).',
			when: 'Nov 19'
		}
	];
	function newHref(e: NewEntry): string {
		switch (e.kind) {
			case 'benchmark':
				return resolve('/benchmark/[name]', { name: e.name });
			case 'model':
				return resolve('/models/[name]', { name: e.name });
			case 'task':
				return resolve('/tasks/[name]', { name: e.name });
		}
	}
	type ResolvedModalityTile = {
		modality: 'image' | 'audio' | 'video';
		label: string;
		b: Benchmark | null;
		comingSoon: boolean;
	};
	let modalityTiles = $derived.by<ResolvedModalityTile[]>(() => {
		const out: ResolvedModalityTile[] = [];
		for (const m of MODALITY_TILES) {
			if (m.comingSoon) {
				out.push({ modality: m.modality, label: m.label, b: null, comingSoon: true });
				continue;
			}
			const b = m.preferred ? pick(m.preferred) : undefined;
			if (b) out.push({ modality: m.modality, label: m.label, b, comingSoon: false });
		}
		return out;
	});

	// Summary fetch cache. Same lazy-per-name pattern used in K — a
	// slow benchmark doesn't block others, and each card transitions
	// from loading → ready or error on its own.
	let summaries = $state<Record<string, BenchmarkSummary | 'loading' | 'error'>>({});
	$effect(() => {
		const all = [
			...primaries.map((p) => p.b),
			...modalityTiles.map((m) => m.b).filter((b): b is Benchmark => !!b)
		];
		for (const b of all) {
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

	// Top-by-size: assign each row to a size bucket by total params,
	// pick the highest-ranked row in each bucket. Buckets cover the
	// full embedding-model range; a bucket with no entries is hidden
	// rather than padded with placeholders so the tile stays honest.
	type Bucket = { label: string; min: number; max: number; row: SummaryRow | null };
	function topBySize(s: BenchmarkSummary | 'loading' | 'error' | undefined): Bucket[] {
		// Labels deliberately mix M / B units rather than the "0.1B"
		// fractional form — small models read "M" much faster than a
		// decimal of a billion. < / – / > stay single-char so the
		// resulting chip is compact.
		const buckets: Bucket[] = [
			{ label: '<100M', min: 0, max: 0.1, row: null },
			{ label: '100M–1B', min: 0.1, max: 1, row: null },
			{ label: '1–10B', min: 1, max: 10, row: null },
			{ label: '>10B', min: 10, max: Infinity, row: null }
		];
		if (!s || s === 'loading' || s === 'error') return buckets;
		// Sort by Mean (Task) so the first row matching a bucket is the
		// top model in that bucket. The summary's `rank` field may use
		// a different ordering (Borda etc.) — sort here just to be
		// safe regardless of which builder produced the rows.
		const sorted = [...s.rows]
			.filter((r) => r.totalParamsB > 0 && r.meanTask != null)
			.sort((a, b) => (b.meanTask ?? 0) - (a.meanTask ?? 0));
		for (const r of sorted) {
			const p = r.totalParamsB;
			const bucket = buckets.find((bk) => p >= bk.min && p < bk.max);
			if (bucket && !bucket.row) bucket.row = r;
		}
		return buckets.filter((bk) => bk.row != null);
	}
	function fmtScore(v: number | null | undefined): string {
		if (v == null) return '—';
		return (v * 100).toFixed(1);
	}

	// Lower tabbed panel — same structure as variant D.
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
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
		return out;
	});
	$effect(() => {
		if (!activeTab && tabs.length > 0) activeTab = tabs[0].entry.name;
	});
	let activeTabData = $derived(tabs.find((t) => t.entry.name === activeTab) ?? tabs[0]);
</script>

<VariantSwitcher active="l" />

<div class="page">
	<header class="hero">
		<h1>Benchmark Overview</h1>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<section class="primary" aria-label="Featured leaderboards">
			<div class="section-head">
				<span class="eyebrow">Featured</span>
				<span class="kicker">Where most people start — top model per size, so small models get glory too</span>
			</div>
			<div class="primary-grid">
				{#each primaries as p (p.key)}
					{@const sum = summaries[p.b.name]}
					{@const buckets = topBySize(sum)}
					<article class="prim" data-key={p.key}>
						<header class="prim-head">
							<span class="prim-label">{p.label}</span>
							<a class="prim-open" href={resolve('/benchmark/[name]', { name: p.b.name })}>
								Open →
							</a>
						</header>
						<a class="prim-title" href={resolve('/benchmark/[name]', { name: p.b.name })}>
							{p.b.displayName}
						</a>
						<span class="prim-sub">{p.b.numModels ?? 0} models · {p.b.tasks.length} tasks</span>
						{#if sum === 'loading' || sum === undefined}
							<div class="prim-state">Loading…</div>
						{:else if sum === 'error'}
							<div class="prim-state error">Couldn't load.</div>
						{:else if buckets.length === 0}
							<div class="prim-state">No size-bucketed data yet.</div>
						{:else}
							<ul class="prim-buckets">
								{#each buckets as bk (bk.label)}
									{@const r = bk.row}
									{#if r}
										<li class="bucket">
											<span class="bk-chip">{bk.label}</span>
											<span class="bk-model" data-model-type={r.model.modelType}>
												<span class="bk-icon">
													<ModelTypeIcon type={r.model.modelType} size={11} />
												</span>
												<span class="bk-name">
													<span class="bk-org">{r.model.org}</span>/<span class="bk-display"
														>{r.model.displayName}</span
													>
												</span>
											</span>
											<span class="bk-score">{fmtScore(r.meanTask)}</span>
										</li>
									{/if}
								{/each}
							</ul>
						{/if}
					</article>
				{/each}
			</div>
		</section>

		<section class="modality" aria-label="Other modalities">
			<div class="mod-grid">
				{#each modalityTiles as m (m.modality)}
					{#if m.comingSoon || !m.b}
						<div class="mod-tile soon" data-modality={m.modality}>
							<span class="mod-icon"><ModalityIcon modality={m.modality} size={16} /></span>
							<div class="mod-text">
								<span class="mod-eyebrow">{m.label} models</span>
								<span class="mod-title">Coming soon</span>
								<span class="mod-meta">Benchmark in development</span>
							</div>
						</div>
					{:else}
						{@const benchmark = m.b}
						{@const sum = summaries[benchmark.name]}
						{@const top = sum !== undefined && sum !== 'loading' && sum !== 'error' ? sum.rows[0] : null}
						<a class="mod-tile" data-modality={m.modality} href={resolve('/benchmark/[name]', { name: benchmark.name })}>
							<span class="mod-icon"><ModalityIcon modality={m.modality} size={16} /></span>
							<div class="mod-text">
								<span class="mod-eyebrow">{m.label} models</span>
								<span class="mod-title">{benchmark.displayName}</span>
								{#if top}
									<span class="mod-meta">
										Leader: {top.model.displayName} · {fmtScore(top.meanTask)}
									</span>
								{:else}
									<span class="mod-meta">{benchmark.numModels ?? 0} models · {benchmark.tasks.length} tasks</span>
								{/if}
							</div>
							<span class="mod-arrow">→</span>
						</a>
					{/if}
				{/each}
			</div>
		</section>

		<section class="new" aria-label="Recently added">
			<div class="section-head">
				<span class="eyebrow new-eyebrow">New</span>
				<span class="kicker">Benchmarks, models, and tasks added recently</span>
			</div>
			<ul class="new-grid">
				{#each NEW_ENTRIES as e (e.kind + e.name)}
					<li>
						<a class="new-card" href={newHref(e)} data-kind={e.kind}>
							<div class="new-head">
								<span class="new-kind">{e.kind}</span>
								<span class="new-when">{e.when}</span>
							</div>
							<span class="new-title">{e.title}</span>
							<span class="new-blurb">{e.blurb}</span>
						</a>
					</li>
				{/each}
			</ul>
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
	.section-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--primary-strong);
		padding: 3px 8px;
		background: var(--primary-soft);
		border-radius: 999px;
	}
	.kicker {
		font-size: 12px;
		color: var(--text-muted);
	}
	.primary {
		margin-bottom: 22px;
	}
	.primary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}
	.prim {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 18px 14px;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint) 50%, var(--surface)),
			var(--surface) 60%
		);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-radius: 14px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.prim[data-key='retrieval'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.prim[data-key='english'] {
		--tint: var(--tint-green);
		--tint-fg: var(--tint-green-fg);
	}
	.prim-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.prim-label {
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--tint-fg);
	}
	.prim-open {
		font-size: 12px;
		font-weight: 700;
		color: var(--tint-fg);
		text-decoration: none;
	}
	.prim-title {
		font-size: 19px;
		font-weight: 700;
		color: var(--ink-strong);
		text-decoration: none;
		margin-top: 2px;
	}
	.prim-title:hover {
		color: var(--tint-fg);
	}
	.prim-sub {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 10px;
	}
	.prim-state {
		padding: 18px 4px;
		font-size: 13px;
		color: var(--text-muted);
	}
	.prim-state.error {
		color: var(--tint-orange-fg, #c0432e);
	}
	/* Size-bucket list: pill chip on the left with the size range,
	   model in the middle, score on the right. Bigger chip + tabular
	   numerals so the size step is easier to scan than the cramped
	   12.5 px table cell it replaces. */
	.prim-buckets {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.bucket {
		display: grid;
		grid-template-columns: 80px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 7px 4px;
		font-size: 13px;
	}
	.bucket + .bucket {
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.bk-chip {
		justify-self: start;
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--tint-fg);
		background: color-mix(in srgb, var(--tint-fg) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 28%, transparent);
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bk-model {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.bk-icon {
		display: inline-flex;
		width: 16px;
		height: 16px;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		background: var(--surface-muted);
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.bk-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.bk-org {
		color: var(--text-muted);
	}
	.bk-display {
		font-weight: 600;
		color: var(--text);
	}
	.bk-score {
		font-weight: 700;
		color: var(--tint-fg);
		font-variant-numeric: tabular-nums;
	}

	.modality {
		margin-bottom: 24px;
	}
	.mod-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	.mod-tile {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tint) 55%, var(--surface)),
			var(--surface) 75%
		);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.14s,
			border-color 0.14s;
	}
	.mod-tile:hover {
		transform: translateY(-1px);
		border-color: var(--tint-fg);
	}
	.mod-tile[data-modality='audio'] {
		--tint: var(--tint-amber);
		--tint-fg: var(--tint-amber-fg);
	}
	.mod-tile[data-modality='video'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.mod-tile.soon {
		cursor: default;
		opacity: 0.75;
		background: var(--surface);
		border-style: dashed;
	}
	.mod-tile.soon:hover {
		transform: none;
	}
	.mod-icon {
		display: inline-flex;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: var(--surface);
		color: var(--tint-fg);
		flex-shrink: 0;
	}
	.mod-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.mod-eyebrow {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--tint-fg);
	}
	.mod-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--ink-strong);
	}
	.mod-meta {
		font-size: 12px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mod-arrow {
		font-size: 18px;
		color: var(--tint-fg);
		flex-shrink: 0;
	}

	/* "New" section — kind-coloured chip on each card so the user can
	   tell at a glance whether a row is a benchmark, model, or task.
	   Sits between the modality strip and Discover so it reads as a
	   regular update channel rather than a hero element. */
	.new {
		margin-bottom: 26px;
	}
	.new-eyebrow {
		color: var(--tint-pink-fg);
		background: var(--tint-pink);
	}
	.new-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}
	.new-card {
		--kind-tint: var(--tint-blue);
		--kind-fg: var(--tint-blue-fg);
		display: flex;
		flex-direction: column;
		gap: 6px;
		height: 100%;
		padding: 18px 20px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.14s,
			border-color 0.14s;
	}
	.new-card:hover {
		transform: translateY(-1px);
		border-color: var(--kind-fg);
	}
	.new-card[data-kind='benchmark'] {
		--kind-tint: var(--tint-blue);
		--kind-fg: var(--tint-blue-fg);
	}
	.new-card[data-kind='model'] {
		--kind-tint: var(--tint-green);
		--kind-fg: var(--tint-green-fg);
	}
	.new-card[data-kind='task'] {
		--kind-tint: var(--tint-amber);
		--kind-fg: var(--tint-amber-fg);
	}
	.new-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.new-kind {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--kind-fg);
		padding: 2px 8px;
		background: var(--kind-tint);
		border-radius: 999px;
	}
	.new-when {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.new-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--ink-strong);
		margin-top: 2px;
	}
	.new-blurb {
		font-size: 13px;
		color: var(--text-muted);
		line-height: 1.45;
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
		.primary-grid {
			grid-template-columns: 1fr;
		}
		.new-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.card-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.new-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 760px) {
		.mod-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		h1 {
			font-size: 24px;
		}
	}
</style>
