<!--
  Shared search input used by every "index" toolbar — /benchmarks,
  /models (via ModelSearchBar), /tasks, and the per-benchmark detail
  toolbar. Renders a magnifying-glass icon, a search input, and a clear
  button that appears once the value is non-empty.

  Visual contract (must stay in sync if changed):
    height ≈ 32 px (padding 8 + 13 px font + 1 px border × 2)
    so the row co-aligns with the `.sort select` / `.dir-btn` widgets
    in `app.css`.
-->
<script lang="ts">
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
	<svg
		class="icon"
		viewBox="0 0 24 24"
		width="14"
		height="14"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.5-3.5" />
	</svg>
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
		flex: 1;
		min-width: 220px;
		max-width: 420px;
	}
	.icon {
		position: absolute;
		left: 10px;
		top: 50%;
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
	input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
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
