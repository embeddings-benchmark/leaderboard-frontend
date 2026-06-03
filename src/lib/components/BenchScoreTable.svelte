<script lang="ts" module>
	/**
	 * Per-benchmark scores for a single model — used by the model detail
	 * page. Each row is one benchmark the model appears in, with the
	 * model's rank + Mean (Task) / Mean (TaskType) / Zero-shot on that
	 * benchmark. Sort + heat-shading are local to this component.
	 */
	export interface BenchScore {
		benchmarkName: string;
		benchmarkDisplay: string;
		rank: number;
		meanTask: number | null;
		meanTaskType: number | null;
		zeroShotPct: number;
		totalModels: number;
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { getParam, updateUrl } from '$lib/url-state';
	import {
		ariaSort as ariaSortFor,
		defaultDirFor,
		fmtPct,
		heat,
		maxOf,
		minOf,
		nextSort,
		slug,
		sortIcon as sortIconFor
	} from '$lib/format';

	interface Props {
		rows: BenchScore[];
	}
	let { rows }: Props = $props();

	type SortKey = 'benchmark' | 'rank' | 'meanTask' | 'meanTaskType' | 'zeroShot';
	const initialKey = getParam('s.bench');
	const initialDir = getParam('d.bench');
	let sortKey = $state<SortKey | null>((initialKey as SortKey | null) ?? null);
	let sortDir = $state<'asc' | 'desc'>(initialDir === 'desc' ? 'desc' : 'asc');
	$effect(() => {
		updateUrl({
			's.bench': sortKey,
			'd.bench': sortKey ? sortDir : null
		});
	});

	const ASC_KEYS: readonly SortKey[] = ['benchmark', 'rank'];
	const defaultDir = (k: SortKey) => defaultDirFor(k, ASC_KEYS);
	function clickSort(k: SortKey) {
		const next = nextSort(k, sortKey, sortDir, defaultDir);
		sortKey = next.key;
		sortDir = next.dir;
	}
	const sortIcon = (k: SortKey) => sortIconFor(k, sortKey, sortDir);
	const ariaSort = (k: SortKey) => ariaSortFor(k, sortKey, sortDir);

	let sortedRows = $derived.by<BenchScore[]>(() => {
		if (!sortKey) return rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		const k = sortKey;
		return [...rows].sort((a, b) => {
			if (k === 'benchmark') {
				return (
					a.benchmarkDisplay.toLowerCase().localeCompare(b.benchmarkDisplay.toLowerCase()) * dir
				);
			}
			if (k === 'rank') return (a.rank - b.rank) * dir;
			if (k === 'zeroShot') return (a.zeroShotPct - b.zeroShotPct) * dir;
			// Mean(Task) / Mean(TaskType) — push nulls to the bottom regardless of dir.
			const va = k === 'meanTask' ? a.meanTask : a.meanTaskType;
			const vb = k === 'meanTask' ? b.meanTask : b.meanTaskType;
			if (va == null && vb == null) return 0;
			if (va == null) return 1;
			if (vb == null) return -1;
			return (va - vb) * dir;
		});
	});

	// Heat scales per-column — strongest value gets full tint.
	let bestMeanTask = $derived(maxOf(rows.map((r) => r.meanTask)));
	let worstMeanTask = $derived(minOf(rows.map((r) => r.meanTask)));
	let bestMeanTaskType = $derived(maxOf(rows.map((r) => r.meanTaskType)));
	let worstMeanTaskType = $derived(minOf(rows.map((r) => r.meanTaskType)));

	function fmtZeroShot(p: number): string {
		return p === -1 ? '⚠️ NA' : `${p}%`;
	}
</script>

<div class="tbl-scroll">
	<table class="tbl bench-table" use:stickyHead>
		<thead>
			<tr>
				<th class="sticky" aria-sort={ariaSort('benchmark')}>
					<button
						type="button"
						class="tbl-sort tbl-sort-left"
						onclick={() => clickSort('benchmark')}
					>
						<span>Benchmark</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'benchmark'}
							>{sortIcon('benchmark')}</span
						>
					</button>
				</th>
				<th class="tbl-num" aria-sort={ariaSort('rank')}>
					<button type="button" class="tbl-sort" onclick={() => clickSort('rank')}>
						<span>Rank</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'rank'}>{sortIcon('rank')}</span>
					</button>
				</th>
				<th class="tbl-num" aria-sort={ariaSort('meanTask')}>
					<button type="button" class="tbl-sort" onclick={() => clickSort('meanTask')}>
						<span>Mean (Task)</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'meanTask'}
							>{sortIcon('meanTask')}</span
						>
					</button>
				</th>
				<th class="tbl-num" aria-sort={ariaSort('meanTaskType')}>
					<button type="button" class="tbl-sort" onclick={() => clickSort('meanTaskType')}>
						<span>Mean (TaskType)</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'meanTaskType'}
							>{sortIcon('meanTaskType')}</span
						>
					</button>
				</th>
				<th class="tbl-num" aria-sort={ariaSort('zeroShot')}>
					<button type="button" class="tbl-sort" onclick={() => clickSort('zeroShot')}>
						<span>Zero-shot</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'zeroShot'}
							>{sortIcon('zeroShot')}</span
						>
					</button>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedRows as s (s.benchmarkName)}
				<tr>
					<td class="sticky">
						<a
							class="bench-link"
							href={resolve('/benchmark/[name]', { name: slug(s.benchmarkName) })}
						>
							{s.benchmarkDisplay}
						</a>
					</td>
					<td class="tbl-num">
						<span class="rank-pill" class:top={s.rank === 1}>#{s.rank}</span>
						<span class="rank-total">/ {s.totalModels}</span>
					</td>
					<td class="tbl-num" style={heat(s.meanTask, worstMeanTask, bestMeanTask)}
						>{fmtPct(s.meanTask)}</td
					>
					<td class="tbl-num" style={heat(s.meanTaskType, worstMeanTaskType, bestMeanTaskType)}>
						{fmtPct(s.meanTaskType)}
					</td>
					<td class="tbl-num">{fmtZeroShot(s.zeroShotPct)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Stretch the table to the full content column. */
	.bench-table {
		width: 100%;
	}
	.sticky {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
		min-width: 240px;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky {
		background: var(--row-hover);
	}
	/* Mobile: drop the sticky column so every score reaches the viewport. */
	@media (max-width: 640px) {
		.sticky,
		thead th.sticky {
			position: static;
			left: auto;
			min-width: 160px;
		}
	}
	.bench-link {
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	.bench-link:hover {
		color: var(--link);
	}
	.rank-pill {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.rank-pill.top {
		background: var(--primary-soft);
		color: var(--primary-strong);
	}
	.rank-total {
		margin-left: 4px;
		font-size: 11px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
</style>
