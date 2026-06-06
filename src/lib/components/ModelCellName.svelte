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
	}
	let { model }: Props = $props();
</script>

<a class="tbl-model-link" href={resolve('/models/[...name]', { name: modelPath(model.name) })}>
	<span class="tbl-model-org">{model.org}</span><span class="tbl-model-sep">/</span><span
		class="tbl-model-name">{model.displayName}</span
	>
</a>
