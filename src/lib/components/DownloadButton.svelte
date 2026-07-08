<script lang="ts">
	import Download from 'lucide-svelte/icons/download';
	import { track } from '$lib/analytics/client';
	import { downloadCsv, type CsvCell } from '$lib/csv';

	interface Props {
		/** Base filename — extension is appended automatically. */
		filename: string;
		/**
		 * Called lazily on click. Returning the rows from a callback keeps the
		 * parent free of upfront serialisation cost on every render — only the
		 * actual click pays.
		 */
		build: () => { headers: string[]; rows: CsvCell[][] };
		/** Button label. Default reads naturally on every page. */
		label?: string;
	}
	let { filename, build, label = 'Download CSV' }: Props = $props();

	function onClick() {
		const { headers, rows } = build();
		downloadCsv(filename, headers, rows);
		track('csv_downloaded', { filename, rowCount: rows.length });
	}
</script>

<button type="button" class="dl" onclick={onClick} title="Download table as CSV">
	<Download size={14} aria-hidden="true" />
	<span>{label}</span>
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
