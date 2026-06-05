<script lang="ts">
	// Thin indeterminate progress bar. Renders into the document only
	// while `active` is true; the parent decides positioning (typically
	// sticks to the top edge of a table or sidebar via `position: sticky`).
	// Doesn't take layout space when inactive — the wrapper collapses to
	// height 0 so toggling on/off doesn't shift content below.
	let { active = false, label = 'Loading' }: { active?: boolean; label?: string } = $props();
</script>

{#if active}
	<div class="progress" role="progressbar" aria-busy="true" aria-label={label}>
		<div class="bar"></div>
	</div>
{/if}

<style>
	.progress {
		position: relative;
		height: 3px;
		width: 100%;
		overflow: hidden;
		background: color-mix(in srgb, var(--primary) 14%, transparent);
	}
	/* Indeterminate progress: a solid bar that grows from the left edge,
	   reaches full width, then shrinks off the right edge — same idea as
	   Material's indeterminate linear progress. Solid bar (not a gradient
	   blob) makes the direction unambiguous: it visibly *fills* and
	   *drains* instead of drifting back and forth. */
	.bar {
		position: absolute;
		left: 0;
		width: 0;
		height: 100%;
		background: var(--primary);
		transform-origin: 0 0;
		animation: indeterminate 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}
	@keyframes indeterminate {
		0% {
			left: 0;
			width: 0;
		}
		50% {
			left: 0;
			width: 100%;
		}
		100% {
			left: 100%;
			width: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation-duration: 3.2s;
		}
	}
</style>
