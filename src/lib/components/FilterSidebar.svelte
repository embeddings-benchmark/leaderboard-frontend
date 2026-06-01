<script lang="ts">
	import FilterContent from './FilterContent.svelte';

	interface Props {
		hideScope?: boolean;
	}
	let { hideScope = false }: Props = $props();

	let collapsed = $state(false);
</script>

<aside class="sidebar" class:collapsed aria-label="Filters">
	<button
		type="button"
		class="toggle"
		onclick={() => (collapsed = !collapsed)}
		aria-expanded={!collapsed}
		title={collapsed ? 'Expand filters' : 'Collapse filters'}
	>
		<span class="chev" class:open={!collapsed}>‹</span>
		{#if !collapsed}
			<span class="toggle-label">Filters</span>
		{/if}
	</button>

	{#if !collapsed}
		<FilterContent {hideScope} />
	{/if}
</aside>

<style>
	.sidebar {
		flex: 0 0 300px;
		min-width: 280px;
		max-width: 340px;
		border-left: 1px solid var(--border);
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
		z-index: 2;
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
</style>
