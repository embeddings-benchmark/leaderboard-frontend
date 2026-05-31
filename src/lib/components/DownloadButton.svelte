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

<button type="button" class="dl" onclick={download}>Download Table</button>

<style>
	.dl {
		display: block;
		margin: 14px auto;
		padding: 10px 20px;
		background: var(--primary);
		color: #fff;
		border: 1px solid var(--primary-strong);
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
	}
	.dl:hover {
		background: var(--primary-strong);
	}
</style>
