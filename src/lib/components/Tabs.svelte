<script lang="ts" generics="T extends string">
	interface Props {
		tabs: { id: T; label: string; visible?: boolean }[];
		active: T;
		onSelect: (id: T) => void;
	}
	let { tabs, active, onSelect }: Props = $props();
</script>

<div class="tabs" role="tablist">
	{#each tabs as tab (tab.id)}
		{#if tab.visible !== false}
			<button
				type="button"
				role="tab"
				aria-selected={active === tab.id}
				class="tab"
				class:active={active === tab.id}
				onclick={() => onSelect(tab.id)}
			>
				{tab.label}
			</button>
		{/if}
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
	}
	.tab {
		padding: 10px 16px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		white-space: nowrap;
		transition: color 0.12s, border-color 0.12s;
	}
	.tab:hover {
		color: var(--text);
	}
	.tab.active {
		color: var(--primary-strong);
		border-bottom-color: var(--primary);
	}
</style>
