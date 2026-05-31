<script lang="ts">
	interface Props {
		text: string;
		title?: string;
		placement?: 'top' | 'bottom';
	}
	let { text, title, placement = 'bottom' }: Props = $props();
</script>

<!--
	Pure-content tooltip. The component renders only the popover; the consumer is
	expected to wrap it in a positioned `tip-cell` (th, etc.) and reveal it via
	a `:hover` / `:focus-within` selector. See SummaryTable.svelte for the trigger.
-->
<span role="tooltip" class="tip" data-placement={placement}>
	{#if title}<strong class="tip-title">{title}</strong>{/if}
	<span class="tip-body">{text}</span>
</span>

<style>
	.tip {
		position: fixed;
		/* left / top set by JS in the consumer on hover so it escapes any
		   scroll-container overflow:hidden clipping. transform centers it. */
		left: 0;
		top: 0;
		transform: translate(-50%, 4px);
		min-width: 220px;
		max-width: 320px;
		padding: 10px 12px;
		background: #1f2329;
		color: #f1f3f5;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 400;
		font-family: var(--font-sans);
		text-transform: none;
		letter-spacing: 0;
		line-height: 1.5;
		text-align: left;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			transform 0.12s ease;
		z-index: 50;
		box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
		white-space: normal;
	}
	.tip[data-placement='top'] {
		transform: translate(-50%, calc(-100% - 4px));
	}
	.tip::before {
		content: '';
		position: absolute;
		top: -4px;
		left: 50%;
		transform: translateX(-50%) rotate(45deg);
		width: 8px;
		height: 8px;
		background: #1f2329;
	}
	.tip[data-placement='top']::before {
		top: auto;
		bottom: -4px;
	}
	.tip-title {
		display: block;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #ff9b6f;
		margin-bottom: 4px;
	}
	.tip-body {
		display: block;
	}
</style>
