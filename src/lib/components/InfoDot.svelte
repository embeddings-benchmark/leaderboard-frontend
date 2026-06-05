<script lang="ts">
	// Small `?` info indicator dropped INSIDE a sort button, just before
	// its label span. Sits inline at the same baseline as the column
	// name. The host `<th>` already has `onpointerenter` / `onfocusin`
	// handlers that show the tip; tapping the dot fires `pointerenter`
	// on the th naturally, so the tip appears without extra plumbing.
	// `onclick` only stops propagation so a tap doesn't trigger the
	// surrounding sort button.

	interface Props {
		ariaLabel?: string;
	}
	let { ariaLabel = 'More info' }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<span
	class="info-dot"
	role="img"
	aria-label={ariaLabel}
	title={ariaLabel}
	onclick={(e) => e.stopPropagation()}>?</span
>

<style>
	.info-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		margin-right: 6px;
		background: transparent;
		color: var(--text-subtle);
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		font-size: 9px;
		font-weight: 700;
		line-height: 1;
		cursor: help;
		flex-shrink: 0;
		vertical-align: middle;
	}
	.info-dot:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
</style>
