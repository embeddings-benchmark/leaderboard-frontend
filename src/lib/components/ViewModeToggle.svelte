<script lang="ts">
	import LayoutGrid from 'lucide-svelte/icons/layout-grid';
	import Table from 'lucide-svelte/icons/table';

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
		<LayoutGrid size={14} aria-hidden="true" />
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
		<Table size={14} aria-hidden="true" />
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
