<script lang="ts" module>
	import type { ModelMeta } from '$lib/types';

	/**
	 * Per-model scores for a single task — used by the task detail page.
	 * Each row is one model with its rank + mean score across subsets +
	 * per-subset scores. Sort + heat-shading are local to this component.
	 */
	export interface ModelScore {
		model: ModelMeta;
		score: number | null;
		rank: number;
		benchmarkName: string;
		subsetScores: Record<string, number>;
		// Mirrors `TaskScoreRow.trainedOn` — three-state per-task signal
		// driving the Zero-shot column. See `src/lib/types.ts`.
		trainedOn: boolean | null;
	}
</script>

<script lang="ts">
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { createSortState } from '$lib/stores/sort.svelte';
	import { clampTooltipX } from '$lib/cell-hover';
	import HoverPortal from './HoverPortal.svelte';
	import InfoDot from './InfoDot.svelte';
	import ModelCellName from './ModelCellName.svelte';
	import SortHeader from './SortHeader.svelte';
	import { fmtPct, heat, maxOf, minOf } from '$lib/format';

	// Lightweight column-header tooltip — same shape as FilterContent's.
	// One trigger today (Zero-shot), but the data-tip / showTip wiring
	// stays generic so future columns can hook in.
	const ZS_TIP_MAX_WIDTH = 320;
	let tipState = $state({ visible: false, title: '', text: '', x: 0, y: 0 });
	function showTip(e: PointerEvent | FocusEvent) {
		const el = e.currentTarget as HTMLElement;
		const text = el.dataset.tip ?? '';
		if (!text) return;
		const r = el.getBoundingClientRect();
		tipState = {
			visible: true,
			title: el.dataset.tipTitle ?? '',
			text,
			x: clampTooltipX(r.left + r.width / 2, ZS_TIP_MAX_WIDTH),
			y: r.bottom
		};
	}
	function hideTip() {
		tipState = { ...tipState, visible: false };
	}

	interface Props {
		rows: ModelScore[];
		subsets: string[];
	}
	let { rows, subsets }: Props = $props();

	// Subset columns get a `subset:` prefix so the string union stays flat
	// and serialises to the URL without further encoding.
	type SortKey = 'rank' | 'model' | 'zeroShot' | 'score' | `subset:${string}`;
	const sort = createSortState<SortKey>({
		urlKeys: ['s.scores', 'd.scores'],
		ascKeys: ['rank', 'model'],
		defaultIcon: '↕'
	});

	let sortedRows = $derived.by<ModelScore[]>(() => {
		if (!sort.key) return rows;
		const dir = sort.dir === 'asc' ? 1 : -1;
		const k = sort.key;
		return [...rows].sort((a, b) => {
			if (k === 'rank') return (a.rank - b.rank) * dir;
			if (k === 'model') return a.model.name.localeCompare(b.model.name) * dir;
			if (k === 'zeroShot') {
				// Null (undeclared) always sorts to the bottom — same convention
				// as null scores below.
				if (a.trainedOn === null && b.trainedOn === null) return 0;
				if (a.trainedOn === null) return 1;
				if (b.trainedOn === null) return -1;
				return ((a.trainedOn ? 1 : 0) - (b.trainedOn ? 1 : 0)) * dir;
			}
			if (k === 'score') {
				// Null scores sort to the bottom regardless of direction
				// (missing data is never "best" or "worst", just missing).
				if (a.score == null && b.score == null) return 0;
				if (a.score == null) return 1;
				if (b.score == null) return -1;
				return (a.score - b.score) * dir;
			}
			const subset = k.slice(7);
			const av = a.subsetScores[subset];
			const bv = b.subsetScores[subset];
			if (av === undefined && bv === undefined) return 0;
			if (av === undefined) return 1;
			if (bv === undefined) return -1;
			return (av - bv) * dir;
		});
	});

	// Heat scales per-column over the [min, max] range so columns where
	// scores cluster tightly still show useful contrast.
	let bestScore = $derived(maxOf(rows.map((r) => r.score)));
	let worstScore = $derived(minOf(rows.map((r) => r.score)));
	let bestPerSubset = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const sub of subsets) {
			m[sub] = maxOf(rows.map((r) => r.subsetScores[sub]));
		}
		return m;
	});
	let worstPerSubset = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const sub of subsets) {
			m[sub] = minOf(rows.map((r) => r.subsetScores[sub]));
		}
		return m;
	});
</script>

<div class="tbl-scroll" use:stickyHScroll>
	<table class="tbl task-table" use:stickyHead>
		<caption class="sr-only">Models scored on this task</caption>
		<thead>
			<tr>
				<th scope="col" class="tbl-num sticky-rank" aria-sort={sort.aria('rank')}>
					<SortHeader {sort} field="rank" label="Rank" />
				</th>
				<th scope="col" class="sticky" aria-sort={sort.aria('model')}>
					<SortHeader {sort} field="model" label="Model" align="left" />
				</th>
				<th
					scope="col"
					class="tbl-num"
					aria-sort={sort.aria('zeroShot')}
					data-tip-title="Zero-shot"
					data-tip="True when the model declared its training data and this task isn't in it (score is zero-shot). ⚠️ when the model declared this task in its training datasets (score is not zero-shot — matches the ⚠️ in PerTaskTab). NA when the model didn't declare its training datasets at all."
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
				>
					<SortHeader {sort} field="zeroShot" label="Zero-shot" infoAfter>
						{#snippet info()}
							<InfoDot ariaLabel="Zero-shot info" />
						{/snippet}
					</SortHeader>
				</th>
				<th
					scope="col"
					class="tbl-num mean-head"
					aria-sort={sort.aria('score')}
					title="Mean of per-subset scores for this task"
				>
					<SortHeader {sort} field="score" label="Mean scores" />
				</th>
				{#each subsets as sub (sub)}
					{@const k = `subset:${sub}` as SortKey}
					<th scope="col" class="tbl-num sub" aria-sort={sort.aria(k)} title={sub}>
						<SortHeader {sort} field={k} label={sub} />
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sortedRows as s (s.model.name + s.benchmarkName)}
				<tr>
					<td class="tbl-num sticky-rank">
						<span class="rank-pill">#{s.rank}</span>
					</td>
					<th scope="row" class="sticky" data-model-type={s.model.modelType}>
						<ModelCellName model={s.model} />
					</th>
					<td class="tbl-num zs-cell">
						{#if s.trainedOn === null}
							<span class="zs-na">NA</span>
						{:else if s.trainedOn}
							<button
								type="button"
								class="trained-warn"
								data-tip-title="Trained on this task"
								data-tip="Model lists this task in its training datasets — score is not zero-shot."
								aria-label="Trained on this task"
								onpointerenter={showTip}
								onpointerleave={hideTip}
								onfocusin={showTip}
								onfocusout={hideTip}>⚠️</button
							>
						{:else}
							<span class="zs-clean">True</span>
						{/if}
					</td>
					<td
						class="tbl-num mean-cell {s.score == null ? '' : heat(s.score, worstScore, bestScore)}"
						class:partial={s.score == null}
						title={s.score == null ? 'Not evaluated on every subset' : undefined}
						>{fmtPct(s.score)}</td
					>
					{#each subsets as sub (sub)}
						{@const v = s.subsetScores[sub]}
						<td
							class="tbl-num sub {v !== undefined
								? heat(v, worstPerSubset[sub], bestPerSubset[sub])
								: ''}"
						>
							{v !== undefined ? fmtPct(v) : '—'}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<HoverPortal visible={tipState.visible} title={tipState.title} x={tipState.x} y={tipState.y}>
	{tipState.text}
</HoverPortal>

<style>
	.task-table {
		width: 100%;
	}
	/* Two sticky columns: Rank (70 px) pinned to the viewport edge, then
	   Model (240 px) butted up against it. Without pinning Rank too, the
	   #N pill scrolled out of view as soon as the user panned right —
	   leaving anonymous model rows next to the floating sticky scrollbar.
	   `--rank-w` keeps the Rank width and Model's left offset in sync. */
	.task-table {
		--rank-w: 70px;
	}
	.sticky-rank {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
		min-width: var(--rank-w);
		width: var(--rank-w);
		/* Hard cap so a 4-digit rank pill can't push the cell wider than
		   `--rank-w` and slip under the Model column anchored at the
		   same offset. */
		max-width: var(--rank-w);
	}
	thead th.sticky-rank {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky-rank {
		background: var(--row-alt);
	}
	.sticky {
		position: sticky;
		left: var(--rank-w);
		background: var(--surface);
		z-index: 2;
		min-width: 240px;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) th.sticky {
		background: var(--row-alt);
	}
	/* Mobile: the sticky pair hides almost every score column behind it
	   on a 375 px viewport. Drop the stickyness so columns scroll
	   together. */
	@media (max-width: 640px) {
		.sticky,
		.sticky-rank,
		thead th.sticky,
		thead th.sticky-rank {
			position: static;
			left: auto;
			min-width: 0;
			width: auto;
		}
		.sticky {
			min-width: 160px;
		}
	}
	/* `.tbl-model-link` styling + `.type-icon` per-model-type tints
	   live in src/lib/styles/leaderboard-table.css — shared with
	   SummaryTable, PerTaskTab, and PerLanguageTab. */
	.mean-cell.partial {
		color: var(--text-subtle);
		font-weight: 500;
	}
	/* `.rank-pill` lives in src/lib/styles/leaderboard-table.css — shared
	   with SummaryTable so both views render the rank identically. */
	/* Zero-shot column — three-state cell: ⚠️ (trained on, rendered
	   via `.trained-warn` in leaderboard-table.css), False (clean),
	   NA (undeclared). */
	.zs-cell {
		font-variant-numeric: tabular-nums;
	}
	.zs-clean,
	.zs-na {
		color: var(--text-subtle);
	}
	thead th.sub {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-subtle);
	}
	tbody td.sub {
		color: var(--text-muted);
	}
	thead th.mean-head {
		color: var(--text);
		font-weight: 700;
		border-right: 1px solid var(--border);
	}
	tbody td.mean-cell {
		font-weight: 700;
		color: var(--text);
		border-right: 1px solid var(--border);
	}
</style>
