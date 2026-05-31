<script lang="ts">
	import { page } from '$app/state';
	import type { Benchmark } from '$lib/types';

	interface Props {
		benchmark: Benchmark;
	}
	let { benchmark }: Props = $props();

	let open = $state(false);
	let copiedCitation = $state(false);
	let copiedLink = $state(false);

	let shareUrl = $derived.by(() => {
		if (typeof window === 'undefined') return '';
		const url = new URL(page.url.toString(), window.location.origin);
		url.searchParams.set('benchmark_name', benchmark.name);
		return url.toString();
	});

	async function copy(text: string, which: 'citation' | 'link') {
		try {
			await navigator.clipboard.writeText(text);
			if (which === 'citation') {
				copiedCitation = true;
				setTimeout(() => (copiedCitation = false), 1500);
			} else {
				copiedLink = true;
				setTimeout(() => (copiedLink = false), 1500);
			}
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<details class="cite" bind:open>
	<summary>Cite and share this benchmark</summary>
	<div class="body">
		{#if benchmark.citation}
			<div class="block">
				<div class="block-head">
					<span class="label">Citation (BibTeX)</span>
					<button type="button" class="copy" onclick={() => copy(benchmark.citation!, 'citation')}>
						{copiedCitation ? 'Copied' : 'Copy'}
					</button>
				</div>
				<pre><code>{benchmark.citation}</code></pre>
			</div>
		{:else}
			<p class="muted">No citation available for this benchmark yet.</p>
		{/if}

		<div class="block">
			<div class="block-head">
				<span class="label">Shareable link</span>
				<button type="button" class="copy" onclick={() => copy(shareUrl, 'link')}>
					{copiedLink ? 'Copied' : 'Copy'}
				</button>
			</div>
			<pre><code>{shareUrl || `?benchmark_name=${benchmark.name}`}</code></pre>
		</div>
	</div>
</details>

<style>
	.cite {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		margin-bottom: 14px;
	}
	summary {
		padding: 10px 14px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
		color: var(--text);
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	summary::after {
		content: '+';
		color: var(--text-subtle);
		font-weight: 400;
		font-size: 16px;
	}
	details[open] summary::after {
		content: '−';
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.body {
		padding: 0 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}
	.copy {
		padding: 3px 10px;
		font-size: 11px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text-muted);
		border-radius: 4px;
		cursor: pointer;
	}
	.copy:hover {
		background: var(--surface-muted);
		color: var(--text);
	}
	pre {
		margin: 0;
		padding: 10px 12px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
		overflow-x: auto;
	}
	code {
		font-family: var(--font-mono);
		background: none;
		padding: 0;
		white-space: pre;
	}
	.muted {
		color: var(--text-muted);
		font-size: 13px;
		margin: 0;
	}
</style>
