<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';

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

	function fmt(n: number): string {
		return n.toFixed(2);
	}
</script>

<div class="wrap">
	<p class="muted">
		Example per-language scores for the visible models. Values shown here are simulated until the
		backend exposes the real per-language breakdown.
	</p>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th class="sticky">Model</th>
					{#each LANGUAGES as lang (lang)}
						<th class="num">{lang}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each summary.rows as row (row.model.name)}
					<tr>
						<td class="sticky">
							{#if row.model.url}
								<a href={row.model.url} target="_blank" rel="noreferrer">{row.model.displayName}</a>
							{:else}
								{row.model.displayName}
							{/if}
						</td>
						{#each LANGUAGES as lang, idx (lang)}
							{@const score = fakeLangScore(row, idx)}
							<td class="num" class:best={score === best[lang]}>
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
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		text-align: left;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		position: sticky;
		top: 0;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.sticky {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 1;
		min-width: 220px;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 2;
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
		color: var(--primary-strong);
	}
</style>
