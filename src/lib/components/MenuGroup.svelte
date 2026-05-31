<script lang="ts">
	import { untrack } from 'svelte';
	import type { MenuEntry } from '$lib/types';
	import { isBenchmark } from '$lib/types';
	import BenchmarkButton from './BenchmarkButton.svelte';
	import Self from './MenuGroup.svelte';

	interface Props {
		entry: MenuEntry;
		level: number;
	}
	let { entry, level }: Props = $props();

	let open = $state(untrack(() => entry.open ?? false));
</script>

<div class="group" class:top={level === 0} class:nested={level > 0}>
	<button
		type="button"
		class="header"
		class:top={level === 0}
		onclick={() => (open = !open)}
		aria-expanded={open}
	>
		<span class="caret" class:open>▸</span>
		<span class="name">{entry.name}</span>
	</button>
	{#if open}
		<div class="body" class:indent={level > 0}>
			{#if entry.description}
				<p class="desc">{entry.description}</p>
			{/if}
			{#each entry.children as child (child.name)}
				{#if isBenchmark(child)}
					<BenchmarkButton benchmark={child} {level} />
				{:else}
					<Self entry={child} level={level + 1} />
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.group {
		display: flex;
		flex-direction: column;
	}
	.group.top {
		margin-bottom: 8px;
	}
	.group.nested {
		margin-top: 2px;
	}
	.header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		padding: 6px 4px;
		color: var(--text);
	}
	.header.top {
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
		margin-bottom: 4px;
		padding: 8px 2px;
	}
	.header:not(.top) {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text-muted);
		padding: 4px 4px;
	}
	.header:hover {
		color: var(--text);
	}
	.caret {
		display: inline-block;
		font-size: 10px;
		transition: transform 0.15s ease;
		color: var(--text-subtle);
	}
	.caret.open {
		transform: rotate(90deg);
	}
	.body {
		display: flex;
		flex-direction: column;
	}
	.body.indent {
		padding-left: 8px;
		border-left: 1px solid var(--border);
		margin-left: 6px;
	}
	.desc {
		font-size: 12px;
		color: var(--text-muted);
		margin: 2px 0 6px;
	}
</style>
