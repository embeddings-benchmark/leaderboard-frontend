<script lang="ts">
	import { resolve } from '$app/paths';
	import { fmtCompact, slug, sortModalities } from '$lib/format';
	import { stickyHead } from '$lib/actions/sticky-head';
	import type { SortState } from '$lib/stores/sort.svelte';
	import ModalityIcon from './ModalityIcon.svelte';
	import SortHeader from './SortHeader.svelte';

	type SortId = 'name' | 'type' | 'benchmarks' | 'languages' | 'models' | 'metric';

	interface Row {
		name: string;
		type: string;
		simplifiedType: string;
		languages: string[];
		domains: string[];
		modalities: string[];
		benchmarks: string[];
		mainScore: string;
		numModels: number;
	}

	interface Props {
		rows: Row[];
		sort: SortState<SortId>;
	}
	let { rows, sort }: Props = $props();
</script>

<div class="tbl-scroll tbl-overview">
	<table class="tbl" use:stickyHead>
		<thead>
			<tr>
				<th class="tbl-col-name">
					<SortHeader {sort} field="name" label="Task" align="left" />
				</th>
				<th class="tbl-col-type">
					<SortHeader {sort} field="type" label="Group" align="left" />
				</th>
				<th class="tbl-col-chips">Modalities</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="benchmarks" label="Benchmarks" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="languages" label="Languages" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="models" label="Models" />
				</th>
				<th class="tbl-col-metric">
					<SortHeader {sort} field="metric" label="Main metric" align="left" />
				</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as t (t.name)}
				<tr data-stype={t.simplifiedType}>
					<th class="tbl-col-name" scope="row">
						<a class="tbl-row-link" href={resolve('/tasks/[name]', { name: slug(t.name) })}>
							<span class="tbl-row-title">{t.name}</span>
							<span class="tbl-row-sub">{t.type}</span>
						</a>
					</th>
					<td class="tbl-col-type">
						<span class="tbl-stype-chip" data-stype={t.simplifiedType}>{t.simplifiedType}</span>
					</td>
					<td class="tbl-col-chips">
						<div class="tbl-chips">
							{#each sortModalities(t.modalities) as mod (mod)}
								<span class="badge modality-tint" data-modality={mod} title={mod}>
									<ModalityIcon modality={mod} size={11} />
									<span>{mod}</span>
								</span>
							{/each}
						</div>
					</td>
					<td class="tbl-num tbl-col-num">{fmtCompact(t.benchmarks.length)}</td>
					<td class="tbl-num tbl-col-num">{fmtCompact(t.languages.length)}</td>
					<td class="tbl-num tbl-col-num">{fmtCompact(t.numModels)}</td>
					<td class="tbl-col-metric">{t.mainScore || '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.tbl-col-metric {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-strong);
	}
</style>
