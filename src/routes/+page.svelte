<script lang="ts">
	// Home page: featured size-bucket leaderboards over a tabbed
	// category browser. Promoted from the home-l mockup after
	// user feedback across several iterations.
	//
	// Top: three big primary tiles (Multilingual / Retrieval /
	// English). Each tile shows a top-by-model-size mini-ranking so
	// smaller models also get glory rather than always rewarding
	// the biggest. Beneath the primaries, a modality strip
	// surfaces Image + Audio + Video so non-text affordances
	// aren't hidden. Lower section is a nested tabbed category
	// browser.

	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu, loadLeaders } from '$lib/data/service';
	import {
		isBenchmark,
		type Benchmark,
		type BenchmarkLeaders,
		type LeaderRow,
		type MenuEntry
	} from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import ModelTypeIcon from '$lib/components/ModelTypeIcon.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';

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
	// the framing label ("General" / "Retrieval") is decoupled from
	// whichever benchmark is the current canonical pick. Two tiles
	// carry the "General" eyebrow because both MTEB(Multilingual)
	// and MTEB(eng) are general-purpose benchmarks — distinguishing
	// them by audience (multi-language vs English-only) rather than
	// by category. The middle tile is the dedicated retrieval suite.
	type Primary = { key: 'multilingual' | 'retrieval' | 'english'; label: string; preferred: string };
	const PRIMARIES: Primary[] = [
		{ key: 'multilingual', label: 'General', preferred: 'MTEB(Multilingual, v2)' },
		{ key: 'retrieval', label: 'Retrieval', preferred: 'RTEB(beta)' },
		{ key: 'english', label: 'General', preferred: 'MTEB(eng, v2)' }
	];
	type ModalityTile = {
		modality: 'image' | 'audio' | 'video';
		label: string;
		preferred?: string;
		comingSoon?: boolean;
	};
	const MODALITY_TILES: ModalityTile[] = [
		// MIEB and MAEB are both the general-purpose suites for
		// their modality (vs a future retrieval-specialised one),
		// so the eyebrow mirrors the "General" framing used by the
		// primary tiles. The icon + tint colour carries the modality
		// hint on its own.
		{ modality: 'image', label: 'General', preferred: 'MIEB(eng)' },
		{ modality: 'audio', label: 'General', preferred: 'MAEB(beta)' },
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

	// TODO(new-feed): a "Recently added" section is planned for the
	// gap between the modality strip and the tabbed catalogue. The
	// markup, kind-colour map (benchmark / model / task) and a
	// hand-curated NEW_ENTRIES mock previously lived here. Re-add
	// once the backend exposes a `createdAt` / `dateAdded` field
	// (or a dedicated `/whats-new` endpoint) so the feed reflects
	// real activity instead of a static list. Place the new section
	// directly above the `<section class="tabs-panel">` in the
	// template below.
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

	// Size buckets in MILLIONS of parameters (matches the
	// `/benchmarks/{name}/leaders?buckets=…` wire format). Numbers
	// read more naturally for the small-model cuts — `<500` vs
	// `<0.5`. `null` as the second element marks the open-ended top
	// bucket. The chip label formatter switches units automatically
	// (≥1000 M renders as "B").
	const SIZE_BUCKETS: ReadonlyArray<readonly [number, number | null]> = [
		[0, 500],
		[500, 1000],
		[1000, 5000],
		[5000, null]
	];

	function fmtParams(m: number): string {
		if (m >= 1000) {
			const b = m / 1000;
			return `${Number.isInteger(b) ? b : b.toFixed(1)}B`;
		}
		return `${Math.round(m)}M`;
	}
	function bucketLabel(min: number, max: number | null): string {
		if (min === 0 && max != null) return `<${fmtParams(max)}`;
		if (max == null) return `>${fmtParams(min)}`;
		return `${fmtParams(min)}–${fmtParams(max)}`;
	}

	// Per-benchmark leaders cache. Same lazy pattern as before — a
	// slow benchmark doesn't block others; each card transitions from
	// loading → ready or error independently. Primaries fetch all
	// four size buckets; modality tiles only need the overall top
	// (single open-ended bucket).
	let primaryLeaders = $state<Record<string, BenchmarkLeaders | 'loading' | 'error'>>({});
	let modalityLeaders = $state<Record<string, LeaderRow | null | 'loading' | 'error'>>({});

	// Reads `primaries` / `modalityTiles` reactively so the fetch
	// kicks off as soon as the menu lands. All writes into the
	// `primaryLeaders` / `modalityLeaders` caches happen inside
	// `untrack(...)` so the effect doesn't re-fire on its own writes
	// — without that guard the `[name] = 'loading'` assignment
	// retriggers this effect, which then tries to start fetches for
	// every other name, etc., until the runtime aborts. Same pattern
	// the filters store uses (see filters.svelte.ts `initFor`).
	$effect(() => {
		const ps = primaries;
		const ms = modalityTiles;
		untrack(() => {
			for (const p of ps) {
				if (primaryLeaders[p.b.name]) continue;
				primaryLeaders[p.b.name] = 'loading';
				loadLeaders(p.b.name, SIZE_BUCKETS)
					.then((r) => {
						primaryLeaders[p.b.name] = r;
					})
					.catch(() => {
						primaryLeaders[p.b.name] = 'error';
					});
			}
			for (const m of ms) {
				const b = m.b;
				if (!b || modalityLeaders[b.name]) continue;
				modalityLeaders[b.name] = 'loading';
				loadLeaders(b.name, [[0, null]])
					.then((r) => {
						modalityLeaders[b.name] = r.buckets[0]?.leader ?? null;
					})
					.catch(() => {
						modalityLeaders[b.name] = 'error';
					});
			}
		});
	});
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
			</div>
			<div class="primary-grid">
				{#each primaries as p (p.key)}
					{@const ld = primaryLeaders[p.b.name]}
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
						{#if ld === 'loading' || ld === undefined}
							<div class="prim-state">Loading…</div>
						{:else if ld === 'error'}
							<div class="prim-state error">Couldn't load.</div>
						{:else if ld.buckets.every((bk) => !bk.leader)}
							<div class="prim-state">No size-bucketed data yet.</div>
						{:else}
							<ul class="prim-buckets">
								{#each ld.buckets as bk (`${bk.min}-${bk.max ?? 'inf'}`)}
									{@const r = bk.leader}
									{#if r}
										<li class="bucket">
											<span class="bk-chip">{bucketLabel(bk.min, bk.max)}</span>
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
								<span class="mod-eyebrow">{m.label}</span>
								<span class="mod-title">Coming soon</span>
								<span class="mod-meta">Benchmark in development</span>
							</div>
						</div>
					{:else}
						{@const benchmark = m.b}
						{@const leader = modalityLeaders[benchmark.name]}
						{@const top = leader && leader !== 'loading' && leader !== 'error' ? leader : null}
						<a class="mod-tile" data-modality={m.modality} href={resolve('/benchmark/[name]', { name: benchmark.name })}>
							<span class="mod-icon"><ModalityIcon modality={m.modality} size={16} /></span>
							<div class="mod-text">
								<span class="mod-eyebrow">{m.label}</span>
								<span class="mod-title">{benchmark.displayName}</span>
								{#if top}
									<span class="mod-meta">
										Leader: {top.model.displayName} · {fmtScore(top.meanTask)}
									</span>
								{:else}
									<span class="mod-meta">{benchmark.numModels ?? 0} models</span>
								{/if}
							</div>
							<span class="mod-arrow">→</span>
						</a>
					{/if}
				{/each}
			</div>
		</section>

		<!-- TODO(new-feed): mount the "Recently added" cards here once
		     the backend exposes a `createdAt` field — see the TODO at
		     the top of the script block for the markup shape. -->

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

	/* `.new-*` styles for the planned "Recently added" feed were
	   removed alongside the section — see the TODO at the top of the
	   script block. Re-add them when the section is re-mounted. */

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
		.primary-grid {
			grid-template-columns: 1fr;
		}
		.card-grid {
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
