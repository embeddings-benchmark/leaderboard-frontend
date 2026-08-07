<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Benchmark } from '$lib/types';
	import { apiUrl, fmtCompact, isIconUrl, slug, sortModalities } from '$lib/format';
	import { stickyHead } from '$lib/actions/sticky-head';
	import type { SortState } from '$lib/stores/sort.svelte';
	import ModalityIcon from './ModalityIcon.svelte';
	import SortHeader from './SortHeader.svelte';

	type SortId = 'name' | 'tasks' | 'languages' | 'models';

	interface Props {
		rows: Benchmark[];
		sort: SortState<SortId>;
	}
	let { rows, sort }: Props = $props();
</script>

<div class="tbl-scroll tbl-overview">
	<table class="tbl" use:stickyHead>
		<thead>
			<tr>
				<th class="tbl-col-name">
					<SortHeader {sort} field="name" label="Benchmark" align="left" />
				</th>
				<th class="tbl-col-chips">Modalities</th>
				<th class="tbl-col-chips">Task types</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="tasks" label="Tasks" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="languages" label="Languages" />
				</th>
				<th class="tbl-num tbl-col-num">
					<SortHeader {sort} field="models" label="Models" />
				</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as b (b.name)}
				<tr>
					<th class="tbl-col-name" scope="row">
						<a
							class="tbl-row-link row-link-icon"
							href={resolve('/benchmark/[name]', { name: slug(b.name) })}
						>
							{#if b.icon}
								{#if isIconUrl(b.icon)}
									<img
										class="icon-tile row-icon"
										src={apiUrl(b.icon)}
										alt=""
										width="24"
										height="24"
										loading="lazy"
										decoding="async"
										crossorigin="anonymous"
									/>
								{:else}
									<span class="icon-tile icon-tile-text row-icon" aria-hidden="true">{b.icon}</span>
								{/if}
							{/if}
							<span class="row-text">
								<span class="tbl-row-title">{b.displayName}</span>
								<span class="tbl-row-id">{b.name}</span>
							</span>
						</a>
					</th>
					<td class="tbl-col-chips">
						<div class="tbl-chips">
							{#each sortModalities(b.modalities ?? []) as mod (mod)}
								<span class="badge modality-tint" data-modality={mod} title={mod}>
									<ModalityIcon modality={mod} size={11} />
									<span>{mod}</span>
								</span>
							{/each}
						</div>
					</td>
					<td class="tbl-col-chips">
						<div class="tbl-chips">
							{#each b.simplifiedTaskTypes ?? [] as t (t)}
								<span class="tbl-stype-chip" data-stype={t}>{t}</span>
							{/each}
						</div>
					</td>
					<td class="tbl-num tbl-col-num">{fmtCompact(b.tasks.length)}</td>
					<td class="tbl-num tbl-col-num">{fmtCompact(b.languages.length)}</td>
					<td class="tbl-num tbl-col-num">{fmtCompact(b.numModels ?? 0)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
