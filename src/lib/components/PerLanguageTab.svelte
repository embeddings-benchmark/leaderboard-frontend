<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { type CsvCell } from '$lib/csv';
	import { getParam, updateUrl } from '$lib/url-state';
	import {
		ariaSort as ariaSortFor,
		defaultDirFor,
		heat as heatBase,
		nextSort,
		sortIcon as sortIconFor
	} from '$lib/format';
	import ModelHoverPortal from './ModelHoverPortal.svelte';
	import ModelTypeIcon from './ModelTypeIcon.svelte';

	type Tip = {
		showFor: (t: HTMLElement, row: SummaryRow) => void;
		hide: () => void;
	};
	let tipPortal = $state<Tip | undefined>(undefined);

	function onCellEnter(e: PointerEvent | FocusEvent, row: SummaryRow) {
		tipPortal?.showFor(e.currentTarget as HTMLElement, row);
	}
	function onCellLeave() {
		tipPortal?.hide();
	}

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	const LANGUAGES = ['English', 'Chinese', 'French', 'German', 'Spanish', 'Arabic'];

	// Returns null when the row has no overall mean (partial benchmark coverage);
	// downstream renders that as '—' so missing data doesn't masquerade as 0.00.
	function fakeLangScore(row: SummaryRow, langIdx: number): number | null {
		if (row.meanTask == null) return null;
		const base = row.meanTask * 100;
		const shift = ((langIdx + row.rank) % 7) - 3;
		const firstType = summary.taskTypes[0];
		const delta = firstType ? (row.scoresByTaskType[firstType] ?? 0) * 5 : 0;
		return Math.max(0, Math.min(99, base + shift + delta - 4));
	}

	function rowMean(row: SummaryRow): number | null {
		const vals: number[] = [];
		for (let i = 0; i < LANGUAGES.length; i++) {
			const v = fakeLangScore(row, i);
			if (v != null) vals.push(v);
		}
		if (vals.length === 0) return null;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	}

	function extremaPerLang(): { best: Record<string, number>; worst: Record<string, number> } {
		const best: Record<string, number> = {};
		const worst: Record<string, number> = {};
		LANGUAGES.forEach((lang, idx) => {
			let max = -Infinity;
			let min = Infinity;
			for (const r of summary.rows) {
				const v = fakeLangScore(r, idx);
				if (v == null) continue;
				if (v > max) max = v;
				if (v < min) min = v;
			}
			best[lang] = max;
			worst[lang] = min;
		});
		return { best, worst };
	}
	let langExtrema = $derived(extremaPerLang());
	let best = $derived(langExtrema.best);
	let worst = $derived(langExtrema.worst);
	let meanExtrema = $derived.by(() => {
		let max = -Infinity;
		let min = Infinity;
		for (const r of summary.rows) {
			const v = rowMean(r);
			if (v == null) continue;
			if (v > max) max = v;
			if (v < min) min = v;
		}
		return { max, min };
	});
	let bestMean = $derived(meanExtrema.max);
	let worstMean = $derived(meanExtrema.min);

	type SortKey = 'model' | 'mean' | `lang:${string}`;
	const initialKey = getParam('s.lang');
	const initialDir = getParam('d.lang');
	let sortKey = $state<SortKey | null>((initialKey as SortKey | null) ?? null);
	let sortDir = $state<'asc' | 'desc'>(initialDir === 'asc' ? 'asc' : 'desc');
	$effect(() => {
		updateUrl({
			's.lang': sortKey,
			'd.lang': sortKey ? sortDir : null
		});
	});

	const ASC_KEYS: readonly SortKey[] = ['model'];
	const defaultDir = (k: SortKey) => defaultDirFor(k, ASC_KEYS);
	function clickSort(k: SortKey) {
		const next = nextSort(k, sortKey, sortDir, defaultDir);
		sortKey = next.key;
		sortDir = next.dir;
	}
	const sortIcon = (k: SortKey) => sortIconFor(k, sortKey, sortDir);
	const ariaSort = (k: SortKey) => ariaSortFor(k, sortKey, sortDir);

	let sortedRows = $derived.by(() => {
		let rows = summary.rows;
		if (sortKey) {
			const dir = sortDir === 'asc' ? 1 : -1;
			const key = sortKey;
			rows = [...rows].sort((a, b) => {
				if (key === 'model') {
					return (
						a.model.displayName.toLowerCase().localeCompare(b.model.displayName.toLowerCase()) * dir
					);
				}
				const va: number | null =
					key === 'mean' ? rowMean(a) : fakeLangScore(a, LANGUAGES.indexOf(key.slice(5)));
				const vb: number | null =
					key === 'mean' ? rowMean(b) : fakeLangScore(b, LANGUAGES.indexOf(key.slice(5)));
				// Push nulls to the bottom regardless of direction.
				if (va == null && vb == null) return 0;
				if (va == null) return 1;
				if (vb == null) return -1;
				return (va - vb) * dir;
			});
		}
		if (pinnedModels.size === 0) return rows;
		const isPinned = (r: SummaryRow) => pinnedModels.has(r.model.name);
		return [...rows.filter(isPinned), ...rows.filter((r) => !isPinned(r))];
	});

	function fmt(n: number | null): string {
		if (n == null) return '—';
		return n.toFixed(2);
	}
	// Exported as an instance method (Svelte 5) so the parent page can
	// render its DownloadButton in the shared `.toolbar-row` next to
	// the search bar — same layout as the Summary and Per-task tabs —
	// instead of letting this component show its own download button
	// on a second row.
	export function buildCsv() {
		const headers = ['Rank', 'Model', 'Mean', ...LANGUAGES];
		const round = (n: number | null) => (n == null ? null : Number(n.toFixed(2)));
		const rows: CsvCell[][] = summary.rows.map((row) => [
			row.rank,
			row.model.name,
			round(rowMean(row)),
			...LANGUAGES.map((_, i) => round(fakeLangScore(row, i)))
		]);
		return { headers, rows };
	}

	// Heat scales per-column: the strongest mean / per-language cell
	// gets full tint, others shade down proportionally. Both score and
	// `max` are on the same 0–100 scale so ratio works directly.
	const heat = heatBase;
</script>

<div class="wrap">
	<p class="muted head-note">
		Example per-language scores for the visible models. Click any column header to sort. Values are
		simulated until the backend exposes the real per-language breakdown.
	</p>
	<div class="tbl-scroll" use:stickyHScroll>
		<table class="tbl lang-table" use:stickyHead>
			<thead>
				<tr>
					<th class="tbl-pin-col tbl-sticky-pin" aria-label="Pinned"></th>
					<th class="tbl-sticky-col" aria-sort={ariaSort('model')}>
						<button class="tbl-sort tbl-sort-left" onclick={() => clickSort('model')}>
							<span>Model</span>
							<span class="tbl-sort-ind" class:on={sortKey === 'model'}>{sortIcon('model')}</span>
						</button>
					</th>
					<th class="tbl-num" aria-sort={ariaSort('mean')}>
						<button class="tbl-sort" onclick={() => clickSort('mean')}>
							<span>Mean</span>
							<span class="tbl-sort-ind" class:on={sortKey === 'mean'}>{sortIcon('mean')}</span>
						</button>
					</th>
					{#each LANGUAGES as lang (lang)}
						{@const k = `lang:${lang}` as SortKey}
						<th class="tbl-num" aria-sort={ariaSort(k)}>
							<button class="tbl-sort" onclick={() => clickSort(k)}>
								<span>{lang}</span>
								<span class="tbl-sort-ind" class:on={sortKey === k}>{sortIcon(k)}</span>
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedRows as row (row.model.name)}
					{@const mean = rowMean(row)}
					<tr class:pinned={pinnedModels.has(row.model.name)}>
						<td class="tbl-pin-col tbl-sticky-pin">
							<button
								type="button"
								class="tbl-pin-btn"
								class:on={pinnedModels.has(row.model.name)}
								onclick={() => pinnedModels.toggle(row.model.name)}
								aria-label={pinnedModels.has(row.model.name) ? 'Unpin row' : 'Pin row'}
								title={pinnedModels.has(row.model.name) ? 'Unpin row' : 'Pin row'}
							>
								<svg
									viewBox="0 0 24 24"
									width="12"
									height="12"
									fill="none"
									stroke="currentColor"
									stroke-width="2.4"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M12 17v5" />
									<path d="M9 10.76V6h6v4.76l3 2.59V17H6v-3.65l3-2.59z" />
								</svg>
							</button>
						</td>
						<td
							class="tbl-sticky-col"
							data-model-type={row.model.modelType}
							onpointerenter={(e) => onCellEnter(e, row)}
							onpointerleave={onCellLeave}
							onfocusin={(e) => onCellEnter(e, row)}
							onfocusout={onCellLeave}
						>
							<span class="type-icon" title={row.model.modelType}>
								<ModelTypeIcon type={row.model.modelType} size={13} />
							</span>
							{#if row.model.url}
								<!-- External model URL (HuggingFace etc.) -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={row.model.url} target="_blank" rel="noreferrer" class="tbl-model-link">
									<span class="tbl-model-org">{row.model.org}</span><span class="tbl-model-sep"
										>/</span
									><span class="tbl-model-name">{row.model.displayName}</span>
								</a>
							{:else}
								<span class="tbl-model-link">
									<span class="tbl-model-org">{row.model.org}</span><span class="tbl-model-sep"
										>/</span
									><span class="tbl-model-name">{row.model.displayName}</span>
								</span>
							{/if}
						</td>
						<td
							class="tbl-num"
							class:tbl-best={mean != null && mean === bestMean}
							style={heat(mean, worstMean, bestMean)}
						>
							{fmt(mean)}
						</td>
						{#each LANGUAGES as lang, idx (lang)}
							{@const score = fakeLangScore(row, idx)}
							<td
								class="tbl-num"
								class:tbl-best={score != null && score === best[lang]}
								style={heat(score, worst[lang], best[lang])}
							>
								{fmt(score)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<ModelHoverPortal bind:this={tipPortal} />
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	/* `.muted` (color + margin: 0) lives in src/app.css. */
	.head-note {
		margin: 0 0 12px;
	}
	/* Per-language table always fits the main column; stretch to fill it. */
	.lang-table {
		width: 100%;
	}
</style>
