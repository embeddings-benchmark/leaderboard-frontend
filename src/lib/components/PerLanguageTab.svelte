<script lang="ts">
	import type { BenchmarkPerLanguage, BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import { isBoundaryCross } from '$lib/cell-hover';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { type CsvCell } from '$lib/csv';
	import { heat as heatBase, rowId } from '$lib/format';
	import { createSortState } from '$lib/stores/sort.svelte';
	import { loadPerLanguage } from '$lib/data/service';
	import ModelCellName from './ModelCellName.svelte';
	import ModelHoverPortal from './ModelHoverPortal.svelte';
	import PinButton from './PinButton.svelte';
	import SortHeader from './SortHeader.svelte';
	import { onMount } from 'svelte';

	// Real per-(model, language) scores from
	// `/v1/benchmarks/{name}/per-language`. Lazy-fetched on tab mount so
	// the Summary tab doesn't pay the explode + group_by cost. Until the
	// fetch resolves the table renders `'—'` placeholders; once `data`
	// is set the derived blocks rebuild against real scores.
	let data = $state<BenchmarkPerLanguage | null>(null);
	let scoresByModel = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const m = new Map<string, Record<string, number>>();
		if (data) for (const r of data.rows) m.set(r.modelName, r.scoresByLanguage);
		return m;
	});
	onMount(() => {
		loadPerLanguage(summary.benchmarkName).then((d) => {
			data = d;
		});
	});
	function langScore(row: SummaryRow, lang: string): number | null {
		const v = scoresByModel.get(row.model.name)?.[lang];
		return typeof v === 'number' ? v * 100 : null;
	}

	type Tip = {
		showFor: (t: HTMLElement, row: SummaryRow) => void;
		hide: () => void;
	};
	let tipPortal = $state<Tip | undefined>(undefined);

	function onCellEnter(e: PointerEvent | FocusEvent, row: SummaryRow) {
		if (!isBoundaryCross(e)) return;
		tipPortal?.showFor(e.currentTarget as HTMLElement, row);
	}
	function onCellLeave(e?: PointerEvent | FocusEvent) {
		if (e && !isBoundaryCross(e)) return;
		tipPortal?.hide();
	}

	interface Props {
		summary: BenchmarkSummary;
		// Mirrors `Benchmark.language_view`. `'all'` = union of every
		// task's languages. Parent hides the tab when not set.
		languageView: string[] | 'all';
	}
	let { summary, languageView }: Props = $props();

	let LANGUAGES = $derived.by(() => {
		if (languageView === 'all') {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const seen = new Set<string>();
			const cols: string[] = [];
			for (const t of summary.tasksMeta ?? []) {
				for (const lang of t.languages ?? []) {
					if (!seen.has(lang)) {
						seen.add(lang);
						cols.push(lang);
					}
				}
			}
			cols.sort();
			return cols;
		}
		return [...languageView];
	});

	function rowMean(row: SummaryRow): number | null {
		const vals: number[] = [];
		for (const lang of LANGUAGES) {
			const v = langScore(row, lang);
			if (v != null) vals.push(v);
		}
		if (vals.length === 0) return null;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	}

	function extremaPerLang(): { best: Record<string, number>; worst: Record<string, number> } {
		const best: Record<string, number> = {};
		const worst: Record<string, number> = {};
		for (const lang of LANGUAGES) {
			let max = -Infinity;
			let min = Infinity;
			for (const r of summary.rows) {
				const v = langScore(r, lang);
				if (v == null) continue;
				if (v > max) max = v;
				if (v < min) min = v;
			}
			best[lang] = max;
			worst[lang] = min;
		}
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
	const sort = createSortState<SortKey>({
		urlKeys: ['s.lang', 'd.lang'],
		ascKeys: ['model']
	});

	let sortedRows = $derived.by(() => {
		let rows = summary.rows;
		if (sort.key) {
			const dir = sort.dir === 'asc' ? 1 : -1;
			const key = sort.key;
			// Resolve the language label once instead of slicing the key per comparison.
			const sortLang = key.startsWith('lang:') ? key.slice(5) : '';
			rows = [...rows].sort((a, b) => {
				if (key === 'model') {
					return (
						a.model.displayName.toLowerCase().localeCompare(b.model.displayName.toLowerCase()) * dir
					);
				}
				const va: number | null = key === 'mean' ? rowMean(a) : langScore(a, sortLang);
				const vb: number | null = key === 'mean' ? rowMean(b) : langScore(b, sortLang);
				// Push nulls to the bottom regardless of direction.
				if (va == null && vb == null) return 0;
				if (va == null) return 1;
				if (vb == null) return -1;
				return (va - vb) * dir;
			});
		}
		if (pinnedModels.size === 0) return rows;
		// Single-pass partition: pinned first, others in original order.
		const pinned: SummaryRow[] = [];
		const unpinned: SummaryRow[] = [];
		for (const r of rows) {
			if (pinnedModels.has(rowId(r))) pinned.push(r);
			else unpinned.push(r);
		}
		return [...pinned, ...unpinned];
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
			...LANGUAGES.map((lang) => round(langScore(row, lang)))
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
					<th class="tbl-sticky-col" aria-sort={sort.aria('model')}>
						<SortHeader {sort} field="model" label="Model" align="left" />
					</th>
					<th class="tbl-num" aria-sort={sort.aria('mean')}>
						<SortHeader {sort} field="mean" label="Mean" />
					</th>
					{#each LANGUAGES as lang (lang)}
						{@const k = `lang:${lang}` as SortKey}
						<th class="tbl-num" aria-sort={sort.aria(k)}>
							<SortHeader {sort} field={k} label={lang} />
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedRows as row (rowId(row))}
					{@const rid = rowId(row)}
					{@const mean = rowMean(row)}
					<tr class:pinned={pinnedModels.has(rid)}>
						<td class="tbl-pin-col tbl-sticky-pin">
							<PinButton name={rid} />
						</td>
						<td
							class="tbl-sticky-col"
							data-model-type={row.model.modelType}
							onpointerover={(e) => onCellEnter(e, row)}
							onpointerout={onCellLeave}
							onfocusin={(e) => onCellEnter(e, row)}
							onfocusout={onCellLeave}
						>
							<ModelCellName model={row.model} experiments={row.experiments} />
						</td>
						<td
							class="tbl-num {heat(mean, worstMean, bestMean)}"
							class:tbl-best={mean != null && mean === bestMean}
						>
							{fmt(mean)}
						</td>
						{#each LANGUAGES as lang (lang)}
							{@const score = langScore(row, lang)}
							<td
								class="tbl-num {heat(score, worst[lang], best[lang])}"
								class:tbl-best={score != null && score === best[lang]}
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
