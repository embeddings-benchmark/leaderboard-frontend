<script lang="ts">
	import type { Benchmark } from '$lib/types';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';

	interface Props {
		benchmark: Benchmark;
		level: number;
	}
	let { benchmark, level }: Props = $props();

	let active = $derived(leaderboard.selected === benchmark.name);
</script>

<button
	type="button"
	class="btn"
	class:active
	class:nested={level > 0}
	onclick={() => leaderboard.select(benchmark.name)}
	title={benchmark.name}
>
	{#if benchmark.icon}
		<span class="icon">{benchmark.icon}</span>
	{/if}
	<span class="label">{benchmark.displayName}</span>
</button>

<style>
	.btn {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		text-align: left;
		padding: 6px 10px;
		margin: 2px 0;
		font-size: 13px;
		font-weight: 500;
		border: 1px solid transparent;
		background: var(--surface);
		color: var(--text);
		border-radius: 6px;
		cursor: pointer;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
	}
	.btn:hover {
		background: var(--surface-muted);
		border-color: var(--border);
	}
	.btn.active {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary-strong);
	}
	.btn.active:hover {
		background: var(--primary-strong);
	}
	.btn.nested {
		font-size: 12.5px;
		padding: 5px 10px;
	}
	.icon {
		font-size: 14px;
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
