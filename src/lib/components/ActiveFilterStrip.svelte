<script lang="ts">
	// Shared "active filter chips + Reset all" strip used by the
	// catalogue pages (/benchmarks, /tasks). The benchmark detail page's
	// FilterContent has its own copy because it pulls from the shared
	// filter store; this version is for pages whose filter state lives
	// in local SvelteSets.
	export interface Chip {
		key: string;
		label: string;
		clear: () => void;
	}
	interface Props {
		chips: Chip[];
		onResetAll: () => void;
	}
	let { chips, onResetAll }: Props = $props();
</script>

{#if chips.length > 0}
	<div class="active-strip">
		<div class="chips">
			{#each chips as c (c.key)}
				<button type="button" class="active-chip" onclick={c.clear} title="Click to clear">
					<span class="label">{c.label}</span>
					<span class="x" aria-hidden="true">×</span>
				</button>
			{/each}
		</div>
		<button type="button" class="reset-all" onclick={onResetAll}>Reset all</button>
	</div>
{/if}

<style>
	.active-strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 10px 12px;
		background: var(--primary-soft);
		border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
		border-radius: 10px;
		flex-shrink: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}
	.active-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px 3px 10px;
		background: var(--primary-soft);
		border: 1px solid var(--primary);
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		color: var(--primary-strong);
		cursor: pointer;
		max-width: 100%;
		transition:
			background 0.12s,
			color 0.12s;
	}
	.active-chip:hover {
		background: var(--primary);
		color: var(--surface);
	}
	.active-chip .x {
		font-size: 14px;
		line-height: 1;
		opacity: 0.8;
		font-weight: 600;
	}
	.reset-all {
		background: none;
		border: none;
		font-size: 11px;
		font-weight: 600;
		color: var(--primary-strong);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		padding: 0 2px;
	}
	.reset-all:hover {
		color: var(--text);
	}
</style>
