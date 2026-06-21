<script lang="ts">
	// Shared rendering for a "model name" cell — the org/name link that
	// appears in SummaryTable, PerTaskTab, PerLanguageTab, and
	// ModelScoreTable. Each consumer keeps its own `<td>` wrapper (so
	// context-specific classes, sticky positioning, hover-tip handlers,
	// and `data-model-type` stay local), but the inner link markup lives
	// here. CSS for `.tbl-model-link`, `.tbl-model-org`, `.tbl-model-sep`,
	// `.tbl-model-name` lives in `src/lib/styles/leaderboard-table.css`.

	import type { ModelMeta } from '$lib/types';
	import { resolve } from '$app/paths';
	import { modelPath } from '$lib/format';

	interface Props {
		model: ModelMeta;
		// Experiment kwargs that produced the row, when this cell renders a
		// variant. Drives the chip displayed inline after the model name so
		// users can tell ablations apart (e.g. ``colbert=true``,
		// ``use_image_modality=false``). ``null``/absent for base rows.
		experiments?: Record<string, unknown> | null;
	}
	let { model, experiments = null }: Props = $props();

	// Compact "k=v, k=v" rendering of the experiment kwargs for the chip.
	// Sorted so identical kwarg sets always render identically across rows.
	let variantLabel = $derived.by(() => {
		if (!experiments) return '';
		const keys = Object.keys(experiments).sort();
		if (keys.length === 0) return '';
		return keys.map((k) => `${k}=${experiments[k]}`).join(', ');
	});
</script>

<a
	class="tbl-model-link"
	href={resolve('/models/[...name=modelName]', { name: modelPath(model.name) })}
>
	<span class="tbl-model-org">{model.org}</span><span class="tbl-model-sep">/</span><span
		class="tbl-model-name">{model.displayName}</span
	>
</a>
{#if variantLabel}
	<span
		class="variant-chip"
		title={`Experiment variant: ${variantLabel}`}
		aria-label={`Experiment variant: ${variantLabel}`}>{variantLabel}</span
	>
{/if}

<style>
	.variant-chip {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 6px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--tint-purple-fg);
		background: color-mix(in srgb, var(--tint-purple) 22%, transparent);
		border: 1px solid color-mix(in srgb, var(--tint-purple-fg) 35%, transparent);
		border-radius: 999px;
		white-space: nowrap;
		vertical-align: middle;
	}
</style>
