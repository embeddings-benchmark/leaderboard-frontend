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
		gap: 4px;
		border-bottom: 1px solid var(--border);
		padding-top: 2px;
		/* Keep the tab strip on a single row at every viewport — narrow
		   screens scroll horizontally instead of stacking, which kept
		   pushing the page content down by one+ rows. */
		flex-wrap: nowrap;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
		/* Snap each tab so quick swipes settle on a button edge instead
		   of stopping mid-label. */
		scroll-snap-type: x proximity;
		-webkit-overflow-scrolling: touch;
	}
	.tabs::-webkit-scrollbar {
		height: 4px;
	}
	.tabs::-webkit-scrollbar-thumb {
		background: var(--border-strong);
		border-radius: 2px;
	}
	.tab {
		position: relative;
		padding: 10px 16px 12px;
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-subtle);
		white-space: nowrap;
		transition: color 0.16s ease;
		flex: 0 0 auto;
		scroll-snap-align: start;
	}
	/* Resting underline accent — sits flush against the hairline, scales on
	   active. Subtler than a 2px border because it has rounded ends and a
	   soft secondary glow. */
	.tab::after {
		content: '';
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: -1px;
		height: 3px;
		background: var(--primary);
		border-radius: 2px 2px 0 0;
		transform: scaleY(0.001) translateY(2px);
		transform-origin: bottom center;
		transition:
			transform 0.22s cubic-bezier(0.6, 0.1, 0.2, 1),
			opacity 0.12s;
		opacity: 0;
	}
	.tab:hover {
		color: var(--ink-strong);
	}
	.tab:hover::after {
		opacity: 0.35;
		transform: scaleY(0.55) translateY(1px);
	}
	.tab.active {
		color: var(--ink-strong);
	}
	.tab.active::after {
		opacity: 1;
		transform: scaleY(1);
		box-shadow: 0 -2px 6px color-mix(in srgb, var(--primary) 28%, transparent);
	}
	.tab:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -3px;
		border-radius: 4px;
	}
</style>
