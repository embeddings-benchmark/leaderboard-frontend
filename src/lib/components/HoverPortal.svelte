<script lang="ts">
	// Generic hover-tooltip shell. Owns the fixed-position bubble, the
	// title, per-model-type tint mapping, and the pointer-events
	// behaviour; specialised tooltips (ModelHoverPortal, SummaryTable's
	// column-header tip) supply their own body via the `children`
	// snippet so they don't have to re-declare the shell CSS.
	//
	// Two interaction modes via `interactive`:
	//   false (default) — `pointer-events: none`. The bubble doesn't
	//     receive hover, so the cell's `pointerleave` always fires
	//     cleanly. Used for model-cell tips where there's nothing
	//     clickable inside.
	//   true — `pointer-events: auto`. The bubble can receive hover,
	//     so the user can click links inside it. Extra top padding
	//     bridges the 6 px gap so the cursor can cross from anchor
	//     into the bubble without exiting either hit area. Used for
	//     column-header tips that render Markdown links.
	import type { Snippet } from 'svelte';

	interface Props {
		visible: boolean;
		title?: string;
		// Drives the title + Type-row colour via the existing
		// `[data-model-type='…']` tint mapping. Omit for non-model
		// tooltips (column headers) — title falls back to --primary.
		modelType?: string;
		x: number;
		y: number;
		interactive?: boolean;
		onPointerEnter?: (e: PointerEvent) => void;
		onPointerLeave?: (e: PointerEvent) => void;
		children?: Snippet;
	}
	let {
		visible,
		title,
		modelType,
		x,
		y,
		interactive = false,
		onPointerEnter,
		onPointerLeave,
		children
	}: Props = $props();
</script>

{#if visible}
	<div
		class="hover-portal"
		class:interactive
		role="tooltip"
		data-model-type={modelType}
		style:left="{x}px"
		style:top="{y}px"
		onpointerenter={onPointerEnter}
		onpointerleave={onPointerLeave}
	>
		{#if title}<strong class="hover-title">{title}</strong>{/if}
		{@render children?.()}
	</div>
{/if}

<style>
	.hover-portal {
		position: fixed;
		transform: translate(-50%, 6px);
		min-width: 220px;
		max-width: 340px;
		padding: 10px 12px;
		background: var(--tip-bg);
		color: var(--tip-fg);
		border-radius: 8px;
		font-size: 12px;
		font-weight: 400;
		font-family: var(--font-sans);
		text-transform: none;
		letter-spacing: 0;
		line-height: 1.5;
		text-align: left;
		z-index: 1000;
		box-shadow: 0 12px 28px rgb(var(--shadow-tint) / 0.22);
		white-space: normal;
		pointer-events: none;
	}
	.hover-portal.interactive {
		/* Extra top padding bridges the visual gap to the anchor so
		   the cursor can cross into the bubble without exiting either
		   hit area — clickable links inside the body need this. */
		padding-top: 16px;
		pointer-events: auto;
	}
	.hover-title {
		display: block;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--primary);
		margin-bottom: 4px;
	}
	/* Per-model-type tint on the title. Same colour map as the table
	   cells (see leaderboard-table.css `[data-model-type='…']`). */
	.hover-portal[data-model-type='dense'] .hover-title {
		color: var(--tint-blue-fg);
	}
	.hover-portal[data-model-type='cross-encoder'] .hover-title {
		color: var(--tint-orange-fg);
	}
	.hover-portal[data-model-type='late-interaction'] .hover-title {
		color: var(--tint-green-fg);
	}
	.hover-portal[data-model-type='sparse'] .hover-title {
		color: var(--tint-amber-fg);
	}
	.hover-portal[data-model-type='router'] .hover-title {
		color: var(--tint-purple-fg);
	}
</style>
