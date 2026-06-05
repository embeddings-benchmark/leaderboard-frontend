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
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { createSortState } from '$lib/stores/sort.svelte';
	import { fmtPct, fmtZeroShot, heat, maxOf, minOf, slug } from '$lib/format';
	import SortHeader from './SortHeader.svelte';

	interface Props {
		rows: BenchScore[];
	}
	let { rows }: Props = $props();

	type SortKey = 'benchmark' | 'rank' | 'meanTask' | 'meanTaskType' | 'zeroShot';
	const sort = createSortState<SortKey>({
		urlKeys: ['s.bench', 'd.bench'],
		ascKeys: ['benchmark', 'rank']
	});

	let sortedRows = $derived.by<BenchScore[]>(() => {
		if (!sort.key) return rows;
		const dir = sort.dir === 'asc' ? 1 : -1;
		const k = sort.key;
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
</script>

<div class="tbl-scroll" use:stickyHScroll>
	<table class="tbl bench-table" use:stickyHead>
		<thead>
			<tr>
				<th class="sticky" aria-sort={sort.aria('benchmark')}>
					<SortHeader {sort} field="benchmark" label="Benchmark" align="left" />
				</th>
				<th class="tbl-num" aria-sort={sort.aria('rank')}>
					<SortHeader {sort} field="rank" label="Rank" />
				</th>
				<th class="tbl-num" aria-sort={sort.aria('meanTask')}>
					<SortHeader {sort} field="meanTask" label="Mean (Task)" />
				</th>
				<th class="tbl-num" aria-sort={sort.aria('meanTaskType')}>
					<SortHeader {sort} field="meanTaskType" label="Mean (TaskType)" />
				</th>
				<th class="tbl-num" aria-sort={sort.aria('zeroShot')}>
					<SortHeader {sort} field="zeroShot" label="Zero-shot" />
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
					<td class="tbl-num {heat(s.meanTask, worstMeanTask, bestMeanTask)}"
						>{fmtPct(s.meanTask)}</td
					>
					<td class="tbl-num {heat(s.meanTaskType, worstMeanTaskType, bestMeanTaskType)}">
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
