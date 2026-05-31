<script lang="ts">
	let open = $state(false);
</script>

<details bind:open class="faq">
	<summary>Frequently Asked Questions</summary>
	<div class="body">
		<h4>Why is a model missing or not showing up?</h4>
		<ul>
			<li>
				<strong>Filter setting</strong> — it's being filtered out by your current filters (e.g.
				zero-shot only, model size, model type). Open the Filters panel and check the active chips
				at the top.
			</li>
			<li>
				<strong>Missing results</strong> — the model may not have been run on the tasks in the
				benchmark. We only display models that have been run on at least one task.
			</li>
			<li>
				<strong>Missing metadata</strong> — we only show models with metadata in
				<a href="https://github.com/embeddings-benchmark/mteb" target="_blank" rel="noreferrer"
					>mteb</a
				>. See the
				<a
					href="https://github.com/embeddings-benchmark/mteb/blob/main/docs/adding_a_model.md"
					target="_blank"
					rel="noreferrer">adding-a-model guide</a
				>.
			</li>
		</ul>

		<p class="note">
			<strong>Hover any column header's (i)</strong> for the definition of Rank, Mean (Task), Mean
			(TaskType), Zero-shot, parameters, embedding dimension, and max tokens.
		</p>
	</div>
</details>

<style>
	.faq {
		margin-top: 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}
	summary {
		padding: 12px 16px;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.body {
		padding: 0 16px 16px;
		color: var(--text-muted);
	}
	.body h4 {
		color: var(--text);
		margin: 16px 0 6px;
		font-size: 14px;
	}
	.body p {
		margin: 6px 0;
	}
	.body ul {
		margin: 6px 0;
		padding-left: 20px;
	}
	.note {
		margin-top: 12px;
		padding: 10px 12px;
		background: var(--primary-soft);
		border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
		color: var(--text);
		border-radius: 8px;
		font-size: 13px;
	}
</style>
