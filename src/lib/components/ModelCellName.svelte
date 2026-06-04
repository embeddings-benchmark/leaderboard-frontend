<script lang="ts">
	// Shared rendering for a "model name" cell — the type icon + the
	// org/name link that appears in SummaryTable, PerTaskTab,
	// PerLanguageTab, and ModelScoreTable. Each consumer keeps its own
	// `<td>` wrapper (so context-specific classes, sticky positioning,
	// hover-tip handlers, and `data-model-type` stay local), but the
	// inner icon + link markup lives here. CSS for `.type-icon`,
	// `.tbl-model-link`, `.tbl-model-org`, `.tbl-model-sep`,
	// `.tbl-model-name` lives in `src/lib/styles/leaderboard-table.css`.

	import type { ModelMeta } from '$lib/types';
	import { resolve } from '$app/paths';
	import { slug } from '$lib/format';
	import ModelTypeIcon from './ModelTypeIcon.svelte';

	interface Props {
		model: ModelMeta;
		/** Glyph size in px. Defaults to 13 (the table-cell default). */
		iconSize?: number;
	}
	let { model, iconSize = 13 }: Props = $props();
</script>

<span class="type-icon" title={model.modelType}>
	<ModelTypeIcon type={model.modelType} size={iconSize} />
</span>
<a class="tbl-model-link" href={resolve('/models/[name]', { name: slug(model.name) })}>
	<span class="tbl-model-org">{model.org}</span><span class="tbl-model-sep">/</span><span
		class="tbl-model-name">{model.displayName}</span
	>
</a>
