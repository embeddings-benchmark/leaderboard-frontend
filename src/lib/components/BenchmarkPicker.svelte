<script lang="ts">
	import type { MenuEntry } from '$lib/types';
	import MenuGroup from './MenuGroup.svelte';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';

	interface Props {
		menu: MenuEntry[];
	}
	let { menu }: Props = $props();

	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	function onDocClick(e: MouseEvent) {
		if (!open || !root) return;
		if (!root.contains(e.target as Node)) open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) open = false;
	}

	// Close when the selection changes (the menu's BenchmarkButton calls leaderboard.select).
	let lastSelected = $state(leaderboard.selected);
	$effect(() => {
		if (leaderboard.selected !== lastSelected) {
			lastSelected = leaderboard.selected;
			open = false;
		}
	});
</script>

<svelte:window onclick={onDocClick} onkeydown={onKey} />

<div class="picker" bind:this={root}>
	<button type="button" class="trigger" onclick={toggle} aria-expanded={open}>
		<span class="dot"></span>
		<span class="label">{leaderboard.selected}</span>
		<span class="chev" class:open>▾</span>
	</button>
	{#if open}
		<div class="panel" role="dialog" aria-label="Benchmark picker">
			<div class="panel-inner">
				{#each menu as entry (entry.name)}
					<MenuGroup {entry} level={0} />
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.picker {
		position: relative;
		display: inline-block;
	}
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		cursor: pointer;
		max-width: 100%;
	}
	.trigger:hover {
		border-color: var(--border-strong);
	}
	.dot {
		width: 8px;
		height: 8px;
		background: var(--primary);
		border-radius: 50%;
		flex-shrink: 0;
	}
	.label {
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chev {
		font-size: 10px;
		color: var(--text-muted);
		transition: transform 0.15s ease;
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.panel {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 320px;
		max-width: 380px;
		max-height: 540px;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 12px 28px rgb(var(--shadow-tint) / 0.12);
		z-index: 50;
		animation: drop 0.14s ease;
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.panel-inner {
		padding: 8px 12px;
	}
</style>
