<script lang="ts">
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';
	import { BENCHMARK_MENU } from '$lib/data/mockBenchmarks';
	import BenchmarkPicker from '$lib/components/BenchmarkPicker.svelte';
	import FilterDrawer from '$lib/components/FilterDrawer.svelte';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import type { SummaryRow } from '$lib/types';

	$effect(() => {
		if (!leaderboard.benchmark && !leaderboard.loading) {
			leaderboard.select(leaderboard.selected);
		}
	});
	$effect(() => {
		filters.initFor(leaderboard.summary);
	});

	let filteredSummary = $derived(
		leaderboard.summary ? applyFilters(leaderboard.summary) : null
	);

	// Local search (acts on top of any sidebar filters).
	let query = $state('');
	let density = $state<'cozy' | 'compact'>('cozy');
	let drawerOpen = $state(false);

	type SortKey =
		| 'rank'
		| 'model'
		| 'modelType'
		| 'zeroShot'
		| 'totalParams'
		| 'embeddingDim'
		| 'maxTokens'
		| 'meanTask'
		| 'meanTaskType'
		| `tt:${string}`;
	let sortKey = $state<SortKey | null>(null);
	let sortDir = $state<'asc' | 'desc'>('desc');

	function defaultDir(k: SortKey): 'asc' | 'desc' {
		return k === 'rank' || k === 'model' || k === 'modelType' ? 'asc' : 'desc';
	}
	function clickSort(k: SortKey) {
		if (sortKey !== k) {
			sortKey = k;
			sortDir = defaultDir(k);
			return;
		}
		if (sortDir === defaultDir(k)) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else sortKey = null;
	}

	function getValue(row: SummaryRow, key: SortKey): { v: number | string; m: boolean } {
		switch (key) {
			case 'rank':
				return { v: row.rank, m: false };
			case 'model':
				return { v: row.model.displayName.toLowerCase(), m: false };
			case 'modelType':
				return { v: row.model.modelType, m: false };
			case 'zeroShot':
				return { v: row.zeroShotPct, m: row.zeroShotPct === -1 };
			case 'totalParams':
				return { v: row.totalParamsB, m: row.totalParamsB === 0 };
			case 'embeddingDim':
				return { v: row.embeddingDim, m: !row.embeddingDim };
			case 'maxTokens':
				return { v: row.maxTokens, m: !row.maxTokens };
			case 'meanTask':
				return { v: row.meanTask, m: false };
			case 'meanTaskType':
				return { v: row.meanTaskType, m: false };
		}
		if (key.startsWith('tt:')) {
			const tt = key.slice(3);
			const v = row.scoresByTaskType[tt];
			return { v: v ?? 0, m: v === undefined };
		}
		return { v: 0, m: true };
	}

	let visibleRows = $derived.by(() => {
		if (!filteredSummary) return [];
		const q = query.trim().toLowerCase();
		let rows = filteredSummary.rows;
		if (q) {
			rows = rows.filter(
				(r) =>
					r.model.name.toLowerCase().includes(q) ||
					r.model.displayName.toLowerCase().includes(q)
			);
		}
		if (sortKey) {
			const dir = sortDir === 'asc' ? 1 : -1;
			const key = sortKey;
			rows = [...rows].sort((a, b) => {
				const va = getValue(a, key);
				const vb = getValue(b, key);
				if (va.m && !vb.m) return 1;
				if (!va.m && vb.m) return -1;
				if (va.m && vb.m) return 0;
				if (typeof va.v === 'string') return (va.v as string).localeCompare(vb.v as string) * dir;
				return ((va.v as number) - (vb.v as number)) * dir;
			});
		}
		// Pinned rows float to the top, preserving sorted order within pinned and within rest.
		const isPinned = (r: SummaryRow) => pinnedModels.has(r.model.name);
		return [...rows.filter(isPinned), ...rows.filter((r) => !isPinned(r))];
	});

	function togglePin(name: string) {
		pinnedModels.toggle(name);
	}

	function sortIcon(k: SortKey): string {
		if (sortKey !== k) return '↕';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	// Heatmap: map a score (0..1) to a background opacity for an orange wash.
	function heat(score: number | undefined): string {
		if (score === undefined) return '';
		const t = Math.max(0, Math.min(1, score));
		// Stretch the range a bit so the visible variation is meaningful (0.45 .. 0.75 → 0 .. 1).
		const v = Math.max(0, Math.min(1, (t - 0.45) / 0.3));
		const alpha = (v * 0.55).toFixed(2);
		return `background-color: color-mix(in srgb, var(--primary) ${(+alpha * 100).toFixed(0)}%, transparent);`;
	}

	function fmtPct(s: number): string {
		return (s * 100).toFixed(2);
	}
	function fmtZeroShot(p: number): string {
		return p === -1 ? '⚠️' : `${p.toFixed(0)}%`;
	}
	function fmtParams(b: number): string {
		if (b === 0) return '—';
		return b >= 1 ? `${b.toFixed(1)}B` : `${(b * 1000).toFixed(0)}M`;
	}
	function fmtInt(n: number): string {
		return n ? n.toLocaleString() : '—';
	}
</script>

<div class="app">
	<header class="bar">
		<div class="brand">
			<span class="dot"></span>
			<span class="brand-name">mteb&nbsp;leaderboard</span>
			<span class="tag">Sheet</span>
		</div>
		<BenchmarkPicker menu={BENCHMARK_MENU} />
		<div class="controls">
			<div class="search">
				<input type="search" placeholder="Find model…" bind:value={query} />
			</div>
			<div class="density">
				<button
					type="button"
					class:on={density === 'cozy'}
					onclick={() => (density = 'cozy')}
					title="Cozy density"
				>
					Cozy
				</button>
				<button
					type="button"
					class:on={density === 'compact'}
					onclick={() => (density = 'compact')}
					title="Compact density"
				>
					Compact
				</button>
			</div>
			<button type="button" class="filter-btn" onclick={() => (drawerOpen = true)}>
				Filters
			</button>
		</div>
	</header>

	<main class="sheet-wrap" class:compact={density === 'compact'}>
		{#if !filteredSummary}
			<p class="loading">Loading…</p>
		{:else if visibleRows.length === 0}
			<p class="loading">No models match.</p>
		{:else}
			<div class="sheet">
				<table>
					<thead>
						<tr>
							<th class="pin sticky" aria-label="Pin"></th>
							<th class="num sticky">
								<button class="sort" onclick={() => clickSort('rank')}>#<span class="ind"
										class:on={sortKey === 'rank'}>{sortIcon('rank')}</span
									></button>
							</th>
							<th class="sticky-model">
								<button class="sort left" onclick={() => clickSort('model')}>
									Model
									<span class="ind" class:on={sortKey === 'model'}>{sortIcon('model')}</span>
								</button>
							</th>
							<th>
								<button class="sort left" onclick={() => clickSort('modelType')}>
									Type
									<span class="ind" class:on={sortKey === 'modelType'}
										>{sortIcon('modelType')}</span
									>
								</button>
							</th>
							<th class="num">
								<button class="sort" onclick={() => clickSort('zeroShot')}>
									Zero-shot
									<span class="ind" class:on={sortKey === 'zeroShot'}
										>{sortIcon('zeroShot')}</span
									>
								</button>
							</th>
							<th class="num">
								<button class="sort" onclick={() => clickSort('totalParams')}>
									Params
									<span class="ind" class:on={sortKey === 'totalParams'}
										>{sortIcon('totalParams')}</span
									>
								</button>
							</th>
							<th class="num">
								<button class="sort" onclick={() => clickSort('embeddingDim')}>
									Embed
									<span class="ind" class:on={sortKey === 'embeddingDim'}
										>{sortIcon('embeddingDim')}</span
									>
								</button>
							</th>
							<th class="num">
								<button class="sort" onclick={() => clickSort('maxTokens')}>
									Max tok
									<span class="ind" class:on={sortKey === 'maxTokens'}
										>{sortIcon('maxTokens')}</span
									>
								</button>
							</th>
							<th class="num">
								<button class="sort" onclick={() => clickSort('meanTask')}>
									Mean(T)
									<span class="ind" class:on={sortKey === 'meanTask'}
										>{sortIcon('meanTask')}</span
									>
								</button>
							</th>
							<th class="num">
								<button class="sort" onclick={() => clickSort('meanTaskType')}>
									Mean(TT)
									<span class="ind" class:on={sortKey === 'meanTaskType'}
										>{sortIcon('meanTaskType')}</span
									>
								</button>
							</th>
							{#each filteredSummary.taskTypes as tt (tt)}
								{@const k = `tt:${tt}` as SortKey}
								<th class="num">
									<button class="sort" onclick={() => clickSort(k)}>
										{tt.slice(0, 9)}
										<span class="ind" class:on={sortKey === k}>{sortIcon(k)}</span>
									</button>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each visibleRows as row (row.model.name)}
							{@const isPinned = pinnedModels.has(row.model.name)}
							<tr class:pinned={isPinned}>
								<td class="pin sticky">
									<button
										class="pin-btn"
										class:on={isPinned}
										onclick={() => togglePin(row.model.name)}
										title={isPinned ? 'Unpin row' : 'Pin row'}
										aria-label="Pin row"
									>
										●
									</button>
								</td>
								<td class="num sticky">{row.rank}</td>
								<td class="sticky-model">
									{#if row.model.url}
										<a href={row.model.url} target="_blank" rel="noreferrer">
											{row.model.displayName}
										</a>
									{:else}
										{row.model.displayName}
									{/if}
								</td>
								<td class="type">
									<span class="type-chip" data-type={row.model.modelType}
										>{row.model.modelType}</span
									>
								</td>
								<td class="num">{fmtZeroShot(row.zeroShotPct)}</td>
								<td class="num">{fmtParams(row.totalParamsB)}</td>
								<td class="num">{fmtInt(row.embeddingDim)}</td>
								<td class="num">{fmtInt(row.maxTokens)}</td>
								<td class="num heat" style={heat(row.meanTask)}>{fmtPct(row.meanTask)}</td>
								<td class="num heat" style={heat(row.meanTaskType)}
									>{fmtPct(row.meanTaskType)}</td
								>
								{#each filteredSummary.taskTypes as tt (tt)}
									{@const v = row.scoresByTaskType[tt]}
									<td class="num heat" style={heat(v)}>
										{v !== undefined ? fmtPct(v) : ''}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<footer class="status">
				<span>{visibleRows.length} rows</span>
				{#if pinnedModels.size > 0}<span>· {pinnedModels.size} pinned</span>{/if}
				<span class="hint">Tip: click a column to sort; click again to reverse; click again to clear.</span>
			</footer>
		{/if}
	</main>

	<FilterDrawer open={drawerOpen} onClose={() => (drawerOpen = false)} />
</div>

<style>
	.app {
		min-height: 100vh;
		background: #fafafb;
		display: flex;
		flex-direction: column;
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 24px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 0 4px var(--primary-soft);
	}
	.brand-name {
		font-weight: 700;
		font-size: 14px;
	}
	.tag {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--primary-strong);
		background: var(--primary-soft);
		padding: 3px 8px;
		border-radius: 999px;
	}
	.controls {
		margin-left: auto;
		display: inline-flex;
		gap: 10px;
		align-items: center;
	}
	.search input {
		padding: 7px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 12.5px;
		font-family: inherit;
		background: var(--surface);
		width: 220px;
	}
	.search input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	.density {
		display: inline-flex;
		padding: 3px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.density button {
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 600;
		background: none;
		border: none;
		border-radius: 5px;
		color: var(--text-muted);
		cursor: pointer;
	}
	.density button.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
	}
	.filter-btn {
		padding: 7px 14px;
		background: var(--primary);
		border: 1px solid var(--primary-strong);
		border-radius: 8px;
		color: #fff;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
	}
	.filter-btn:hover {
		background: var(--primary-strong);
	}

	.sheet-wrap {
		flex: 1;
		padding: 12px 24px 24px;
		min-width: 0;
	}
	.loading {
		color: var(--text-muted);
		padding: 24px;
	}
	.sheet {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: auto;
		max-height: calc(100vh - 140px);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}
	table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
		width: max-content;
		min-width: 100%;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		border-bottom: 1px solid var(--border);
		padding: 0;
		position: sticky;
		top: 0;
		z-index: 2;
	}
	.sort {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 5px;
		width: 100%;
		padding: 8px 10px;
		cursor: pointer;
		font-size: 11px;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--text-muted);
	}
	.sort.left {
		justify-content: flex-start;
	}
	.sort:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--primary-soft) 50%, transparent);
	}
	.sort:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}
	.ind {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-subtle);
		opacity: 0.4;
	}
	.ind.on {
		opacity: 1;
		color: var(--primary-strong);
	}

	tbody td {
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	.compact tbody td {
		padding: 3px 10px;
		font-size: 12px;
	}
	tbody tr:hover td {
		background: color-mix(in srgb, var(--primary-soft) 35%, transparent);
	}
	tbody tr.pinned td {
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
	}
	tbody tr.pinned + tr:not(.pinned) td {
		border-top: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border));
	}

	.num {
		text-align: right;
	}
	.heat {
		position: relative;
		font-variant-numeric: tabular-nums;
	}

	th.sticky,
	td.sticky {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 1;
	}
	th.sticky-model,
	td.sticky-model {
		position: sticky;
		left: 88px;
		background: var(--surface);
		min-width: 220px;
		z-index: 1;
	}
	thead th.sticky,
	thead th.sticky-model {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:hover td.sticky,
	tbody tr:hover td.sticky-model {
		background: color-mix(in srgb, var(--primary-soft) 35%, var(--surface));
	}
	tbody tr.pinned td.sticky,
	tbody tr.pinned td.sticky-model {
		background: color-mix(in srgb, var(--primary-soft) 60%, var(--surface));
	}

	.pin {
		width: 28px;
		text-align: center;
		padding: 0;
	}
	.pin-btn {
		background: none;
		border: none;
		font-size: 14px;
		color: var(--border-strong);
		cursor: pointer;
		padding: 4px;
		line-height: 1;
	}
	.pin-btn:hover {
		color: var(--text-muted);
	}
	.pin-btn.on {
		color: var(--primary);
	}

	.type-chip {
		display: inline-block;
		padding: 2px 6px;
		font-size: 10px;
		letter-spacing: 0.03em;
		font-weight: 700;
		text-transform: uppercase;
		border-radius: 4px;
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.type-chip[data-type='dense'] {
		background: #e8edff;
		color: #2740b8;
	}
	.type-chip[data-type='cross-encoder'] {
		background: #ffe6dc;
		color: #c0432e;
	}
	.type-chip[data-type='late-interaction'] {
		background: #def7e9;
		color: #1c7a4c;
	}
	.type-chip[data-type='sparse'] {
		background: #fff1d4;
		color: #a36100;
	}
	.type-chip[data-type='router'] {
		background: #f2e7ff;
		color: #6a32b1;
	}

	.status {
		margin-top: 8px;
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.status .hint {
		margin-left: auto;
		color: var(--text-subtle);
	}
</style>
