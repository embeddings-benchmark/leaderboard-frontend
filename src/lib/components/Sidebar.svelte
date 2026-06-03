<script lang="ts">
	import type { MenuEntry } from '$lib/types';
	import MenuGroup from './MenuGroup.svelte';

	interface Props {
		menu: MenuEntry[];
	}
	let { menu }: Props = $props();

	let collapsed = $state(false);
</script>

<aside class="sidebar" class:collapsed aria-label="Benchmark selection">
	<button
		type="button"
		class="toggle"
		onclick={() => (collapsed = !collapsed)}
		aria-expanded={!collapsed}
		aria-controls="benchmark-menu"
		title={collapsed ? 'Expand benchmark selection' : 'Collapse benchmark selection'}
	>
		<span class="chev" class:open={!collapsed}>›</span>
		{#if !collapsed}
			<span class="toggle-label">Collapse</span>
		{/if}
	</button>

	{#if !collapsed}
		<div class="inner" id="benchmark-menu">
			<h2 class="title">Benchmark Selection</h2>
			{#each menu as entry (entry.name)}
				<MenuGroup {entry} level={0} />
			{/each}
		</div>
	{/if}
</aside>

<style>
	.sidebar {
		flex: 0 0 260px;
		min-width: 240px;
		max-width: 320px;
		border-right: 1px solid var(--border);
		background: var(--surface);
		height: 100vh;
		position: sticky;
		top: 0;
		overflow-y: auto;
		transition:
			flex-basis 0.18s ease,
			min-width 0.18s ease,
			max-width 0.18s ease;
	}
	.sidebar.collapsed {
		flex: 0 0 44px;
		min-width: 44px;
		max-width: 44px;
		overflow: hidden;
	}
	.toggle {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		background: var(--surface);
		border: none;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		z-index: 1;
	}
	.sidebar.collapsed .toggle {
		justify-content: center;
		padding: 10px 0;
	}
	.toggle:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
	.chev {
		display: inline-block;
		font-size: 18px;
		line-height: 1;
		transition: transform 0.18s ease;
		color: var(--text-subtle);
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.toggle-label {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.inner {
		padding: 12px 12px 24px;
	}
	.title {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-subtle);
		margin: 4px 0 12px;
	}
</style>
