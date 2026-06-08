<script lang="ts" generics="T extends string">
	interface Props {
		ariaLabel: string;
		options: readonly { label: string; value: T }[];
		value: T;
		onChange: (next: T) => void;
	}
	let { ariaLabel, options, value, onChange }: Props = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={ariaLabel}>
	{#each options as opt (opt.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			class="seg"
			class:on={value === opt.value}
			onclick={() => onChange(opt.value)}
		>
			{opt.label}
		</button>
	{/each}
</div>

<style>
	.segmented {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		padding: 3px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		/* Let the grid track shrink the button below content-box width. */
		min-width: 0;
		padding: 6px 8px;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.25;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s,
			box-shadow 0.12s;
		/* Long labels ("Instruction-tuned", "Only zero-shot", "Proprietary")
		   wrap within their column instead of truncating with an ellipsis. */
		text-align: center;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}
	.seg:hover {
		color: var(--text);
	}
	.seg.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.08);
	}
</style>
