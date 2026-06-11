<script lang="ts" generics="T extends string">
	interface Props {
		ariaLabel: string;
		options: readonly { label: string; value: T }[];
		value: T;
		onChange: (next: T) => void;
	}
	let { ariaLabel, options, value, onChange }: Props = $props();

	// Roving tabindex per WAI-ARIA radiogroup pattern — only the checked
	// radio sits in the tab sequence; Arrow keys move focus + check.
	let buttons: HTMLButtonElement[] = $state([]);

	function onKeyDown(e: KeyboardEvent) {
		const i = options.findIndex((o) => o.value === value);
		if (i === -1) return;
		const n = options.length;
		let next = -1;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
		else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = n - 1;
		else return;
		e.preventDefault();
		onChange(options[next].value);
		queueMicrotask(() => buttons[next]?.focus());
	}
</script>

<!-- tabindex=-1 satisfies Svelte's a11y check for keydown-bearing role=radiogroup;
     real focus lives on the buttons via roving tabindex. -->
<div class="segmented" role="radiogroup" aria-label={ariaLabel} tabindex="-1" onkeydown={onKeyDown}>
	{#each options as opt, i (opt.value)}
		<button
			bind:this={buttons[i]}
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			tabindex={value === opt.value ? 0 : -1}
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
