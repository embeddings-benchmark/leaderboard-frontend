<script lang="ts">
	// Skeleton placeholder for the leaderboard tables (SummaryTable,
	// ModelScoreTable, BenchScoreTable). Renders a header strip + N row
	// strips with cell-sized blocks — calibrated to ~10 visible rows so
	// the loader covers above-the-fold without overflowing.

	interface Props {
		rows?: number;
		cols?: number;
	}
	let { rows = 10, cols = 7 }: Props = $props();
	const rowKeys = $derived(Array.from({ length: rows }, (_, i) => i));
	const colKeys = $derived(Array.from({ length: cols }, (_, i) => i));
</script>

<div class="table-skel" aria-busy="true" aria-label="Loading">
	<div class="head">
		{#each colKeys as i (i)}
			<div class="skel head-cell" class:first={i === 0}></div>
		{/each}
	</div>
	{#each rowKeys as r (r)}
		<div class="row">
			{#each colKeys as i (i)}
				<div class="skel cell" class:first={i === 0}></div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.table-skel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* Header strip — slightly taller + flatter pulse to hint at the th row. */
	.head,
	.row {
		display: grid;
		grid-template-columns: 70px 240px repeat(var(--skel-cols, 5), 1fr);
		gap: 12px;
		align-items: center;
	}
	.head {
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}
	.head-cell {
		height: 14px;
	}
	.head-cell.first {
		width: 40px;
	}
	.cell {
		height: 18px;
	}
	.cell.first {
		width: 30px;
	}
	.row {
		padding: 4px 0;
	}
</style>
