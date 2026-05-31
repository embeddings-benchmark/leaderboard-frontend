<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	const LANGUAGES = ['English', 'Chinese', 'French', 'German', 'Spanish', 'Arabic'];

	function fakeLangScore(row: SummaryRow, langIdx: number): number {
		const base = row.meanTask * 100;
		const shift = ((langIdx + row.rank) % 7) - 3;
		const firstType = summary.taskTypes[0];
		const delta = firstType ? (row.scoresByTaskType[firstType] ?? 0) * 5 : 0;
		return Math.max(0, Math.min(99, base + shift + delta - 4));
	}

	function bestPerLang(): Record<string, number> {
		const best: Record<string, number> = {};
		LANGUAGES.forEach((lang, idx) => {
			let max = -Infinity;
			for (const r of summary.rows) {
				const v = fakeLangScore(r, idx);
				if (v > max) max = v;
			}
			best[lang] = max;
		});
		return best;
	}
	let best = $derived(bestPerLang());

	type SortKey = 'model' | `lang:${string}`;
	let sortKey = $state<SortKey | null>(null);
	let sortDir = $state<'asc' | 'desc'>('desc');

	function defaultDir(k: SortKey): 'asc' | 'desc' {
		return k === 'model' ? 'asc' : 'desc';
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
	function sortIcon(k: SortKey): string {
		if (sortKey !== k) return '↕';
		return sortDir === 'asc' ? '↑' : '↓';
	}
	function ariaSort(k: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== k) return 'none';
		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

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
				const lang = key.slice(5);
				const idx = LANGUAGES.indexOf(lang);
				if (idx < 0) return 0;
				return (fakeLangScore(a, idx) - fakeLangScore(b, idx)) * dir;
			});
		}
		if (pinnedModels.size === 0) return rows;
		const isPinned = (r: SummaryRow) => pinnedModels.has(r.model.name);
		return [...rows.filter(isPinned), ...rows.filter((r) => !isPinned(r))];
	});

	function fmt(n: number): string {
		return n.toFixed(2);
	}
	function heat(score: number | undefined): string {
		if (score === undefined) return '';
		// Score is 0..99 here; normalize and shape with the same 0.45–0.75 curve.
		const normalized = score / 100;
		const v = Math.max(0, Math.min(1, (normalized - 0.45) / 0.3));
		const pct = Math.round(v * 55);
		if (pct === 0) return '';
		return `background-color: color-mix(in srgb, var(--primary) ${pct}%, transparent);`;
	}
</script>

<div class="wrap">
	<p class="muted">
		Example per-language scores for the visible models. Click any column header to sort. Values are
		simulated until the backend exposes the real per-language breakdown.
	</p>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th class="pin-col sticky-pin" aria-label="Pinned"></th>
					<th class="sticky" aria-sort={ariaSort('model')}>
						<button class="sort left" onclick={() => clickSort('model')}>
							<span>Model</span>
							<span class="ind" class:on={sortKey === 'model'}>{sortIcon('model')}</span>
						</button>
					</th>
					{#each LANGUAGES as lang (lang)}
						{@const k = `lang:${lang}` as SortKey}
						<th class="num" aria-sort={ariaSort(k)}>
							<button class="sort" onclick={() => clickSort(k)}>
								<span>{lang}</span>
								<span class="ind" class:on={sortKey === k}>{sortIcon(k)}</span>
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedRows as row (row.model.name)}
					<tr class:pinned={pinnedModels.has(row.model.name)}>
						<td class="pin-col sticky-pin">
							<button
								type="button"
								class="pin-btn"
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
						<td class="sticky">
							{#if row.model.url}
								<a href={row.model.url} target="_blank" rel="noreferrer">{row.model.displayName}</a>
							{:else}
								{row.model.displayName}
							{/if}
						</td>
						{#each LANGUAGES as lang, idx (lang)}
							{@const score = fakeLangScore(row, idx)}
							<td class="num" class:best={score === best[lang]} style={heat(score)}>
								{fmt(score)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	.muted {
		color: var(--text-muted);
		margin: 0 0 12px;
	}
	.scroll {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}
	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 13px;
	}
	th,
	td {
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		text-align: left;
	}
	td {
		padding: 8px 12px;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		position: sticky;
		top: 0;
		padding: 0;
	}
	.sort {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		width: 100%;
		padding: 8px 12px;
		cursor: pointer;
		color: var(--text-muted);
		font-weight: 600;
		transition:
			color 0.12s,
			background 0.12s;
		box-sizing: border-box;
	}
	.sort.left {
		justify-content: flex-start;
	}
	.sort:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
	}
	.sort:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
		border-radius: 4px;
	}
	.ind {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-subtle);
		opacity: 0.4;
		transition:
			opacity 0.12s,
			color 0.12s;
	}
	.sort:hover .ind {
		opacity: 1;
	}
	.ind.on {
		color: var(--primary-strong);
		opacity: 1;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.sticky {
		position: sticky;
		left: 32px;
		background: var(--surface);
		z-index: 1;
		min-width: 220px;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 2;
	}
	.pin-col {
		width: 32px;
		min-width: 32px;
		padding: 0;
		text-align: center;
	}
	.sticky-pin {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 1;
	}
	thead th.sticky-pin {
		background: var(--surface-muted);
		z-index: 2;
	}
	tbody tr:nth-child(even) td.sticky-pin {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky-pin {
		background: var(--row-hover);
	}
	.pin-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: none;
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--border-strong);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.12s,
			background 0.12s,
			transform 0.06s;
	}
	.pin-btn:hover {
		color: var(--text-muted);
		background: var(--surface-muted);
	}
	.pin-btn.on {
		color: var(--primary);
		background: var(--primary-soft);
		border-color: color-mix(in srgb, var(--primary) 35%, transparent);
		transform: rotate(35deg);
	}
	tbody tr.pinned td {
		background: color-mix(in srgb, var(--primary-soft) 65%, transparent);
	}
	tbody tr.pinned + tr:not(.pinned) td {
		border-top: 2px solid color-mix(in srgb, var(--primary) 50%, var(--border));
	}
	tbody tr:nth-child(even) td {
		background: var(--row-alt);
	}
	tbody tr:nth-child(even) td.sticky {
		background: var(--row-alt);
	}
	tbody tr:hover td {
		background: var(--row-hover);
	}
	tbody tr:hover td.sticky {
		background: var(--row-hover);
	}
	.best {
		font-weight: 700;
	}
</style>
