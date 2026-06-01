<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	function escapeCsv(value: string): string {
		if (value.includes(',') || value.includes('"') || value.includes('\n')) {
			return `"${value.replace(/"/g, '""')}"`;
		}
		return value;
	}

	function buildCsv(): string {
		const headers = [
			'Rank',
			'Model',
			'Zero-shot',
			'Active Params (B)',
			'Total Params (B)',
			'Embedding Dim',
			'Max Tokens',
			'Mean (Task)',
			'Mean (TaskType)',
			...summary.taskTypes
		];
		const lines = [headers.map(escapeCsv).join(',')];
		for (const row of summary.rows) {
			const cells: (string | number)[] = [
				row.rank,
				row.model.name,
				row.zeroShotPct === -1 ? 'NA' : row.zeroShotPct,
				row.activeParamsB,
				row.totalParamsB,
				row.embeddingDim,
				row.maxTokens,
				(row.meanTask * 100).toFixed(2),
				(row.meanTaskType * 100).toFixed(2),
				...summary.taskTypes.map((tt) =>
					row.scoresByTaskType[tt] !== undefined
						? (row.scoresByTaskType[tt] * 100).toFixed(2)
						: ''
				)
			];
			lines.push(cells.map((c) => escapeCsv(String(c))).join(','));
		}
		return lines.join('\n');
	}

	function download() {
		const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${summary.benchmarkName.replace(/[^a-z0-9]+/gi, '_')}_summary.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<button type="button" class="dl" onclick={download} title="Download summary as CSV">
	<svg
		viewBox="0 0 24 24"
		width="14"
		height="14"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M12 3v12" />
		<path d="m7 10 5 5 5-5" />
		<path d="M5 21h14" />
	</svg>
	<span>Download CSV</span>
</button>

<style>
	.dl {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition:
			color 0.12s,
			border-color 0.12s,
			background 0.12s;
	}
	.dl:hover {
		color: var(--primary-strong);
		border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
		background: color-mix(in srgb, var(--primary-soft) 55%, var(--surface));
	}
	.dl:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
</style>
