<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	function fmt(score: number | undefined): string {
		if (score === undefined) return '';
		return (score * 100).toFixed(2);
	}

	function bestPerTask(): Record<string, number> {
		const best: Record<string, number> = {};
		for (const t of summary.tasks) {
			let max = -Infinity;
			for (const r of summary.rows) {
				const v = r.scoresByTask[t];
				if (v !== undefined && v > max) max = v;
			}
			best[t] = max;
		}
		return best;
	}
	let best = $derived(bestPerTask());
</script>

<div class="wrap">
	{#if summary.tasks.length === 0}
		<p class="muted">This benchmark has no tasks defined in the mock data.</p>
	{:else}
		<p class="muted">
			Per-task scores for each visible model. {summary.tasks.length} tasks; scroll horizontally to
			see them all.
		</p>
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th class="sticky">Model</th>
						{#each summary.tasks as task (task)}
							<th class="num" title={task}>{task}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each summary.rows as row (row.model.name)}
						<tr>
							<td class="sticky">
								{#if row.model.url}
									<a href={row.model.url} target="_blank" rel="noreferrer">
										{row.model.displayName}
									</a>
								{:else}
									{row.model.displayName}
								{/if}
							</td>
							{#each summary.tasks as task (task)}
								<td class="num" class:best={row.scoresByTask[task] === best[task]}>
									{fmt(row.scoresByTask[task])}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
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
		max-height: 700px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}
	table {
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
		z-index: 1;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.sticky {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
		min-width: 220px;
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 3;
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
