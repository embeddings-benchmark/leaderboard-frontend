<script lang="ts">
	// Compact cards/table view toggle for overview-page toolbars.
	// Two icon buttons sharing the look of the `.dir-btn` widget so it
	// docks naturally next to the sort dropdown.

	export type ViewMode = 'cards' | 'table';

	interface Props {
		value: ViewMode;
		onChange: (next: ViewMode) => void;
	}
	let { value, onChange }: Props = $props();
</script>

<div class="view-toggle" role="radiogroup" aria-label="View mode">
	<button
		type="button"
		role="radio"
		aria-checked={value === 'cards'}
		class="vt-btn"
		class:on={value === 'cards'}
		onclick={() => onChange('cards')}
		title="Card grid"
		aria-label="Card grid"
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</svg>
	</button>
	<button
		type="button"
		role="radio"
		aria-checked={value === 'table'}
		class="vt-btn"
		class:on={value === 'table'}
		onclick={() => onChange('table')}
		title="Table"
		aria-label="Table"
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="4" width="18" height="16" rx="1" />
			<path d="M3 10h18" />
			<path d="M3 16h18" />
			<path d="M9 4v16" />
		</svg>
	</button>
</div>

<style>
	.view-toggle {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		overflow: hidden;
	}
	.vt-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 8px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		transition:
			color 0.12s,
			background 0.12s;
	}
	.vt-btn + .vt-btn {
		border-left: 1px solid var(--border);
	}
	.vt-btn:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
	}
	.vt-btn.on {
		color: var(--primary-strong);
		background: var(--primary-soft);
	}
	.vt-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}
</style>
