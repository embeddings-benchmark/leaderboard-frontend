<script lang="ts">
	// `as="span"` (default): non-interactive hint; surrounding host
	// fires the tip. `as="button"`: standalone hint that fires the
	// tip itself and forwards pointer/focus handlers.
	//
	// FUTURE: migrate to `popover="hint"` + `interestfor=` once those
	// leave Chrome-only — would drop the host-driven tooltip portal.

	interface Props {
		ariaLabel?: string;
		as?: 'span' | 'button';
		tipKey?: string;
		onPointerEnter?: (e: PointerEvent) => void;
		onPointerLeave?: (e: PointerEvent) => void;
		onFocusIn?: (e: FocusEvent) => void;
		onFocusOut?: (e: FocusEvent) => void;
	}
	let {
		ariaLabel = 'More info',
		as = 'span',
		tipKey,
		onPointerEnter,
		onPointerLeave,
		onFocusIn,
		onFocusOut
	}: Props = $props();
</script>

{#if as === 'button'}
	<button
		type="button"
		class="info-dot"
		aria-label={ariaLabel}
		title={ariaLabel}
		data-tip-key={tipKey}
		onclick={(e) => e.stopPropagation()}
		onpointerenter={onPointerEnter}
		onpointerleave={onPointerLeave}
		onfocusin={onFocusIn}
		onfocusout={onFocusOut}>?</button
	>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<span
		class="info-dot"
		role="img"
		aria-label={ariaLabel}
		title={ariaLabel}
		onclick={(e) => e.stopPropagation()}>?</span
	>
{/if}

<style>
	/* Surface-muted fill keeps the `?` readable on dark themes against
	   either parent surface (muted `<th>` reads via the border; page
	   surface reads via the muted fill). */
	.info-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		margin-left: 4px;
		padding: 0;
		background: var(--surface-muted);
		color: var(--text-muted);
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 700;
		line-height: 1;
		cursor: inherit;
		flex-shrink: 0;
		vertical-align: middle;
		box-sizing: border-box;
	}
	button.info-dot {
		cursor: help;
	}
	.info-dot:hover,
	.info-dot:focus-visible {
		color: var(--ink-strong, var(--text));
		background: var(--primary-soft);
		border-color: color-mix(in srgb, var(--primary) 35%, transparent);
	}
</style>
