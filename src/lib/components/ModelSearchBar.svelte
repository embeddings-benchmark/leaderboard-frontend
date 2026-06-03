<script lang="ts">
	import { filters } from '$lib/stores/filters.svelte';

	interface Props {
		matchCount?: number;
		totalCount?: number;
	}
	let { matchCount, totalCount }: Props = $props();
</script>

<div class="bar">
	<div class="input-wrap">
		<svg
			class="icon"
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
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-3.5-3.5" />
		</svg>
		<input type="search" placeholder="Search models by name…" bind:value={filters.nameQuery} />
		{#if filters.nameQuery}
			<button
				type="button"
				class="clear"
				onclick={() => (filters.nameQuery = '')}
				aria-label="Clear search"
			>
				×
			</button>
		{/if}
	</div>
	{#if filters.nameQuery && matchCount !== undefined && totalCount !== undefined}
		<span class="count">{matchCount} / {totalCount} models</span>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 8px 0 12px;
	}
	.input-wrap {
		position: relative;
		flex: 1;
		max-width: 420px;
	}
	.icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-subtle);
		pointer-events: none;
	}
	input {
		width: 100%;
		padding: 8px 32px 8px 32px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 13px;
		font-family: inherit;
		background: var(--surface);
		color: var(--text);
	}
	input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	input::placeholder {
		color: var(--text-subtle);
	}
	.clear {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		width: 22px;
		height: 22px;
		border: none;
		background: none;
		color: var(--text-subtle);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		border-radius: 4px;
		padding: 0;
	}
	.clear:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
	.count {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
