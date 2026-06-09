<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ModelMeta } from '$lib/types';
	import { fmtInt, fmtParamsCompact, modelPath, sortModalities, splitModelName } from '$lib/format';
	import { stickyHead } from '$lib/actions/sticky-head';
	import type { SortState } from '$lib/stores/sort.svelte';
	import ModalityIcon from './ModalityIcon.svelte';
	import SortHeader from './SortHeader.svelte';

	type SortId = 'name' | 'params' | 'embedDim' | 'maxTokens' | 'released' | 'type';

	interface Props {
		rows: ModelMeta[];
		sort: SortState<SortId>;
	}
	let { rows, sort }: Props = $props();
</script>

<div class="tbl-scroll tbl-overview">
	<table class="tbl" use:stickyHead>
		<thead>
			<tr>
				<th class="tbl-col-name">
					<SortHeader {sort} field="name" label="Model" align="left" />
				</th>
				<th class="tbl-col-type">
					<SortHeader {sort} field="type" label="Type" align="left" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="params" label="Params" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="embedDim" label="Embed dim" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="maxTokens" label="Max tokens" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="released" label="Released" />
				</th>
				<th class="tbl-col-chips">Modalities</th>
				<th class="tbl-col-avail">Availability</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as m (m.name)}
				{@const split = m.displayName && m.org ? null : splitModelName(m.name)}
				{@const org = m.org || split?.org || ''}
				{@const display = m.displayName || split?.displayName || m.name}
				<tr data-model-type={m.modelType}>
					<th class="tbl-col-name" scope="row">
						<a
							class="tbl-row-link"
							href={resolve('/models/[...name]', { name: modelPath(m.name) })}
						>
							<span class="tbl-model-link">
								{#if org}<span class="tbl-model-org">{org}</span><span class="tbl-model-sep">/</span
									>{/if}<span class="tbl-model-name">{display}</span>
							</span>
						</a>
					</th>
					<td class="tbl-col-type">
						<span class="tbl-type-chip" data-type={m.modelType}>{m.modelType}</span>
					</td>
					<td class="tbl-num tbl-col-num">{fmtParamsCompact(m.totalParamsB)}</td>
					<td class="tbl-num tbl-col-num">{fmtInt(m.embeddingDim)}</td>
					<td class="tbl-num tbl-col-num">{fmtInt(m.maxTokens)}</td>
					<td class="tbl-num tbl-col-num">{m.releaseDate ?? '—'}</td>
					<td class="tbl-col-chips">
						<div class="tbl-chips">
							{#each sortModalities(m.modalities ?? []) as mod (mod)}
								<span class="badge modality-tint" data-modality={mod} title={mod}>
									<ModalityIcon modality={mod} size={11} />
									<span>{mod}</span>
								</span>
							{/each}
						</div>
					</td>
					<td class="tbl-col-avail">
						<span class="badge avail" class:open={m.openWeights} class:closed={!m.openWeights}>
							{m.openWeights ? 'Open' : 'Proprietary'}
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.badge.avail.open {
		color: var(--tint-green-fg);
		background: transparent;
	}
	.badge.avail.closed {
		color: var(--text-muted);
		background: transparent;
	}
</style>
