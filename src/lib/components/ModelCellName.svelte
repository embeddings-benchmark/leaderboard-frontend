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
	import { experimentLabel, missingModalities, modelPath } from '$lib/format';
	// Distinct from the plain-text `⚠️` used for the (non-interactive)
	// zero-shot "NA" indicator elsewhere — this badge is a clickable/
	// hoverable button, so it gets its own glyph rather than reusing a
	// symbol readers already associate with something inert.
	import CircleAlert from 'lucide-svelte/icons/circle-alert';

	interface Props {
		model: ModelMeta;
		// Experiment kwargs that produced the row, when this cell renders a
		// variant. Drives the chip displayed inline after the model name so
		// users can tell ablations apart (e.g. ``colbert=true``,
		// ``use_image_modality=false``). ``null``/absent for base rows.
		experiments?: Record<string, unknown> | null;
		// Modalities the benchmark/task this row belongs to actually requires
		// (e.g. ``["image", "text"]`` for ViDoRe). When the model can't encode
		// one of them, a badge flags that its score can't reflect genuine
		// understanding of that modality. Omit to skip the check (e.g. a
		// context with no single well-defined modality set).
		requiredModalities?: string[];
		// Whether this row is on the benchmark's size vs. Mean (Task) Pareto
		// frontier (see `$lib/pareto`). Shows a tag right after the name, so
		// it sits beside the name rather than under a variant chip.
		pareto?: boolean;
	}
	let {
		model,
		experiments = null,
		requiredModalities = undefined,
		pareto = false
	}: Props = $props();

	// Compact "k=v, k=v" rendering of the experiment kwargs for the chip.
	let variantLabel = $derived(experimentLabel(experiments));

	let missing = $derived(missingModalities(model.modalities, requiredModalities));
</script>

<a
	class="tbl-model-link"
	href={resolve('/models/[...name=modelName]', { name: modelPath(model.name) })}
>
	<span class="tbl-model-org">{model.org}</span><span class="tbl-model-sep">/</span><span
		class="tbl-model-name">{model.displayName}</span
	>
</a>
{#if pareto}
	<span class="pareto-tag">Pareto</span>
{/if}
{#if variantLabel}
	<span
		class="variant-chip"
		title={`Experiment variant: ${variantLabel}`}
		aria-label={`Experiment variant: ${variantLabel}`}>{variantLabel}</span
	>
{/if}
{#if missing.length > 0}
	<!-- No `title` here — the explanation lives in the model-cell hover
	     card (`ModelHoverPortal`), which already opens for this whole
	     cell. Keeps a single tooltip instead of two competing ones. -->
	<button
		type="button"
		class="modality-warn"
		aria-label={`Warning: model doesn't support ${missing.join(', ')}, which this requires`}
	>
		<CircleAlert size={13} aria-hidden="true" />
	</button>
{/if}

<style>
	/* Inline after the model name so it wraps with long names instead of
	   widening the fixed-width sticky column. Pink because it's the one tint
	   no model type uses for its name colour (and purple is the variant
	   chip); the size chart rings frontier bubbles in the same hue. */
	.pareto-tag {
		display: inline-block;
		margin-left: 6px;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--tint-pink);
		color: var(--tint-pink-fg);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		line-height: 16px;
		text-transform: uppercase;
		vertical-align: 1px;
		white-space: nowrap;
	}
	.variant-chip {
		/* `display: block` (not inline-block) so the chip always starts its
		   own line under the model name — the alternative, relying on the
		   browser to wrap it onto a new line when it doesn't fit next to
		   the name, doesn't work here: the whitespace between `.tbl-model-
		   link` and this chip inherits `white-space: nowrap` from the base
		   `.tbl th, .tbl td` rule (PerTaskTab/PerLanguageTab), which glues
		   them to the same line regardless of the link's own wrapping. A
		   long name then pushes the chip past the sticky column's fixed
		   width — clipped in some browsers, overflowing into the next
		   column in others (reported on Firefox). Forcing a block start
		   sidesteps the inline-wrap ambiguity outright. */
		display: block;
		width: fit-content;
		margin-top: 3px;
		padding: 1px 6px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--tint-purple-fg);
		background: color-mix(in srgb, var(--tint-purple) 22%, transparent);
		border: 1px solid color-mix(in srgb, var(--tint-purple-fg) 35%, transparent);
		border-radius: 999px;
		white-space: nowrap;
	}
	.modality-warn {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		color: var(--tint-amber-fg);
	}
	.modality-warn:hover,
	.modality-warn:focus-visible {
		color: color-mix(in srgb, var(--tint-amber-fg) 80%, var(--ink-strong));
	}
</style>
