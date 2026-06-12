<!-- Icon + input + clear button. Targets ~32 px tall to align with `.sort select` + `.dir-btn`. -->
<script lang="ts">
	import Search from 'lucide-svelte/icons/search';

	interface Props {
		value: string;
		placeholder?: string;
		/** Optional id forwarded to the underlying <input> (for labels). */
		id?: string;
		/** Optional ARIA label when no visible label is provided. */
		ariaLabel?: string;
	}
	let { value = $bindable(), placeholder = 'Search…', id, ariaLabel }: Props = $props();
</script>

<div class="search">
	<span class="icon" aria-hidden="true">
		<Search size={14} />
	</span>
	<input type="search" {id} {placeholder} aria-label={ariaLabel} bind:value />
	{#if value}
		<button type="button" class="clear" onclick={() => (value = '')} aria-label="Clear search">
			×
		</button>
	{/if}
</div>

<style>
	.search {
		position: relative;
		flex: 1 1 220px;
		min-width: 220px;
		max-width: 420px;
	}
	/* Drop the 220 px floor on mobile so the sort widget can share or wrap below the row. */
	@media (max-width: 640px) {
		.search {
			flex: 1 1 100%;
			min-width: 0;
			max-width: none;
		}
	}
	.icon {
		position: absolute;
		left: 10px;
		top: 50%;
		display: inline-flex;
		transform: translateY(-50%);
		color: var(--text-subtle);
		pointer-events: none;
	}
	input {
		width: 100%;
		padding: 8px 32px 8px 30px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 13px;
		font-family: inherit;
		background: var(--surface);
		color: var(--text);
	}
	/* `:focus-visible` so the ring only shows for keyboard/programmatic focus.
	   `box-shadow` halo for the gradient look; `@media (forced-colors)` swaps
	   to a system-colour outline since shadows are stripped in HCM. */
	input:focus-visible {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	@media (forced-colors: active) {
		input:focus-visible {
			outline: 2px solid Highlight;
			outline-offset: 1px;
		}
	}
	input::placeholder {
		color: var(--text-subtle);
	}
	.clear {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		width: 22px;
		height: 22px;
		border: none;
		background: none;
		color: var(--text-subtle);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		border-radius: 4px;
		padding: 0;
	}
	.clear:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
</style>
