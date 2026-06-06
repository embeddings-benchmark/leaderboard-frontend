<script lang="ts">
	import type { Benchmark } from '$lib/types';

	interface Props {
		benchmark: Benchmark;
	}
	let { benchmark }: Props = $props();
</script>

<section class="desc">
	<p class="text">{benchmark.description}</p>
	<ul class="stats">
		<li><strong>Number of languages</strong>: {benchmark.languages.length}</li>
		<li><strong>Number of tasks</strong>: {benchmark.tasks.length}</li>
		<li><strong>Number of task types</strong>: {benchmark.taskTypes.length}</li>
		<li><strong>Number of domains</strong>: {benchmark.domains.length}</li>
	</ul>
	{#if benchmark.reference}
		<!-- External paper URL -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="more" href={benchmark.reference} target="_blank" rel="noreferrer">
			Click for More Info
		</a>
	{/if}
</section>

<style>
	.desc {
		padding: 12px 0;
	}
	.text {
		margin: 0 0 12px;
		color: var(--text);
	}
	.stats {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 4px 16px;
		color: var(--text-muted);
		font-size: 13px;
	}
	.stats li::before {
		content: '• ';
		color: var(--text-subtle);
	}
	.more {
		display: inline-block;
		margin-top: 10px;
		font-weight: 500;
	}
</style>
