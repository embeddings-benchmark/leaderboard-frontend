<script lang="ts">
	import FilterContent from './FilterContent.svelte';

	interface Props {
		hideScope?: boolean;
		flatModel?: boolean;
	}
	let { hideScope = false, flatModel = false }: Props = $props();

	// Start collapsed on narrow viewports — at <640 px the 300 px
	// sidebar would otherwise overlap the page content. SSR has no
	// `window`, so default to expanded there; the client takes over
	// on hydration.
	let collapsed = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
	);
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
		<FilterContent {hideScope} {flatModel} />
	{/if}
</aside>

<style>
	.sidebar {
		flex: 0 0 300px;
		min-width: 280px;
		max-width: 340px;
		/* Pin to the right edge of the page when the viewport is wider
		   than `.main`'s 1400 px max. Without this the sidebar sits
		   immediately after `.main` (e.g. at x ≈ 1400 on a 2000 px
		   screen) and leaves a dead strip between it and the viewport
		   edge — sticky still works, it just looks off-centre. */
		margin-left: auto;
		border-left: 1px solid var(--border);
		background: var(--surface);
		/* Anchor below the sticky page header (z-index: 10 in
		   `+layout.svelte`) instead of viewport top: 0. Without this
		   offset the toggle button — sticky to the top of THIS
		   element's scrollport — ends up hidden behind the bar as
		   soon as the page scrolls. 64 px matches the bar's height
		   on desktop and the compacted bar on phones. */
		--header-offset: 64px;
		height: calc(100vh - var(--header-offset));
		position: sticky;
		top: var(--header-offset);
		overflow-y: auto;
		transition:
			flex-basis 0.18s ease,
			min-width 0.18s ease,
			max-width 0.18s ease;
	}
	/* Collapsed = a 0-width column with the toggle button overflowing
	   leftward onto the table. Removing the column from the flex track
	   lets the main content fill the whole viewport; the sticky
	   sidebar keeps the button anchored beside the page header as the
	   user scrolls. */
	.sidebar.collapsed {
		flex: 0 0 0;
		min-width: 0;
		max-width: none;
		width: 0;
		/* Keep the base `height: calc(100vh - header-offset)` so the
		   element is tall enough for `position: sticky` to engage as
		   the user scrolls. With `height: auto` the sidebar shrinks
		   to the button and sticky has no scrollport to ride. */
		border-left: none;
		background: none;
		overflow: visible;
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
		/* The sidebar column is 0-wide; the button overflows leftward
		   on top of the table via `transform: translateX(-100%)`. A
		   small top offset clears the table's sticky thead so they
		   don't overlap as the user scrolls. z-index: 11 sits above
		   table sticky cells (z-index ≤ 3) but below the page header
		   so it still ducks under the top bar. */
		position: relative;
		transform: translateX(-100%);
		/* Clear the sticky thead overlay (~36 px tall starting just
		   below the page header). 56 px puts the button at viewport
		   ~120 px — past the thead, before the first data row. */
		margin-top: 56px;
		margin-right: 8px;
		padding: 6px 10px;
		width: auto;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		z-index: 11;
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
