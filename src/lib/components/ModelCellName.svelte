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
	import { missingModalities, modelPath, serializeExperimentValue } from '$lib/format';
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
	}
	let { model, experiments = null, requiredModalities = undefined }: Props = $props();

	// Compact "k=v, k=v" rendering of the experiment kwargs for the chip.
	// Sorted so identical kwarg sets always render identically across rows.
	// `serializeExperimentValue` handles nested objects/arrays (e.g.
	// `model_kwargs: {}`) — plain `${v}` on those renders `[object Object]`.
	let variantLabel = $derived.by(() => {
		if (!experiments) return '';
		const keys = Object.keys(experiments).sort();
		if (keys.length === 0) return '';
		return keys.map((k) => `${k}=${serializeExperimentValue(experiments[k])}`).join(', ');
	});

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
