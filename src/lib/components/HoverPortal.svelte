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
		class="hover-portal tip-portal"
		class:tip-portal-interactive={interactive}
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
		min-width: 220px;
	}
	/* Extra top padding bridges the gap to the anchor so the cursor
	   can cross from the anchor into the bubble without exiting
	   either hit area — clickable links inside need this. */
	.hover-portal.tip-portal-interactive {
		padding-top: 16px;
	}
	.hover-title {
		display: block;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		/* Per-model-type tint via `--type-tint` (set on `[data-model-type]`
		   in `leaderboard-table.css`). Falls back to the primary accent
		   for non-model tooltips (column headers). */
		color: var(--type-tint, var(--primary));
		margin-bottom: 4px;
	}
</style>
