<script lang="ts">
	// Shared openness widget: a 0–6 pip meter with score, and an optional
	// per-dimension breakdown. Presentational only — driven by the helpers in
	// `$lib/openness`. Reused on the model card and (later) filters + table.
	import Check from 'lucide-svelte/icons/check';
	import X from 'lucide-svelte/icons/x';
	import type { ModelMeta } from '$lib/types';
	import { opennessDimensions, opennessScore, OPENNESS_MAX } from '$lib/openness';

	interface Props {
		model: ModelMeta;
		// Show the 6-dimension check/x breakdown below the meter.
		breakdown?: boolean;
		// Dense variant for table cells: smaller pips, no score label.
		compact?: boolean;
	}
	let { model, breakdown = false, compact = false }: Props = $props();

	let score = $derived(opennessScore(model));
	let dims = $derived(opennessDimensions(model));
</script>

{#if score !== null}
	<div class="openness" class:compact>
		<div class="meter" role="img" aria-label="Openness score: {score} of {OPENNESS_MAX} dimensions">
			<div class="pips" aria-hidden="true">
				{#each dims as d, i (i)}
					<span class="pip" class:on={d.open}></span>
				{/each}
			</div>
			{#if !compact}
				<span class="score"><strong>{score}</strong>/{OPENNESS_MAX}</span>
			{/if}
		</div>

		{#if breakdown}
			<ul class="dims">
				{#each dims as d (d.label)}
					<li class="dim" class:open={d.open}>
						{#if d.open}
							<Check class="dim-icon" size={13} aria-hidden="true" />
						{:else}
							<X class="dim-icon" size={13} aria-hidden="true" />
						{/if}
						<span>{d.label}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.openness {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.meter {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.pips {
		display: flex;
		gap: 3px;
	}
	.pip {
		width: 20px;
		height: 6px;
		border-radius: 3px;
		background: var(--border);
	}
	.pip.on {
		background: var(--tint-green-fg);
	}
	/* Dense table-cell variant. */
	.compact .pips {
		gap: 2px;
	}
	.compact .pip {
		width: 9px;
		height: 12px;
		border-radius: 2px;
	}
	.score {
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		color: var(--text-subtle);
		font-weight: 500;
	}
	.score strong {
		font-size: 16px;
		font-weight: 800;
		color: var(--text);
	}

	.dims {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 4px 16px;
	}
	.dim {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		color: var(--text-subtle);
	}
	.dim.open {
		color: var(--text);
	}
	.dim :global(.dim-icon) {
		flex: none;
		color: var(--text-subtle);
	}
	.dim.open :global(.dim-icon) {
		color: var(--tint-green-fg);
	}
	@media (max-width: 640px) {
		.dims {
			grid-template-columns: 1fr;
		}
	}
</style>
