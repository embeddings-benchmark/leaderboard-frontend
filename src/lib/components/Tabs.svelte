<script lang="ts" generics="T extends string">
	interface Props {
		tabs: { id: T; label: string; visible?: boolean }[];
		active: T;
		onSelect: (id: T) => void;
	}
	let { tabs, active, onSelect }: Props = $props();

	let visibleTabs = $derived(tabs.filter((t) => t.visible !== false));
	// Roving tabindex: only the active tab is in the tab sequence (0), the
	// others are reachable via Arrow keys (tabindex=-1). Matches the WAI-ARIA
	// APG tablist pattern.
	let buttons: HTMLButtonElement[] = $state([]);

	function onKeyDown(e: KeyboardEvent) {
		const i = visibleTabs.findIndex((t) => t.id === active);
		if (i === -1) return;
		const n = visibleTabs.length;
		let next = -1;
		if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
		else if (e.key === 'ArrowRight') next = (i + 1) % n;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = n - 1;
		else return;
		e.preventDefault();
		onSelect(visibleTabs[next].id);
		// Wait for the re-render that flips the active tab so the focus
		// lands on the same DOM node we just selected.
		queueMicrotask(() => buttons[next]?.focus());
	}
</script>

<!-- tabindex=-1 satisfies Svelte's a11y check for keydown-bearing role=tablist;
     real focus lives on the buttons via roving tabindex. -->
<div class="tabs" role="tablist" tabindex="-1" onkeydown={onKeyDown}>
	{#each visibleTabs as tab, i (tab.id)}
		<button
			bind:this={buttons[i]}
			type="button"
			role="tab"
			aria-selected={active === tab.id}
			tabindex={active === tab.id ? 0 : -1}
			class="tab"
			class:active={active === tab.id}
			onclick={() => onSelect(tab.id)}
		>
			{tab.label}
		</button>
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
		/* Snap each tab so quick swipes settle on a button edge instead
		   of stopping mid-label. */
		scroll-snap-type: x proximity;
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
