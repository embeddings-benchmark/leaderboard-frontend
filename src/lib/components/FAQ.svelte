<script lang="ts">
	let open = $state(false);
</script>

<details bind:open class="faq">
	<summary>Frequently Asked Questions</summary>
	<div class="body">
		<h4>What do aggregate measures (Rank(Borda), Mean(Task), etc.) mean?</h4>
		<ul>
			<li>
				<strong>Rank(borda)</strong> is computed based on the
				<a href="https://en.wikipedia.org/wiki/Borda_count" target="_blank" rel="noreferrer"
					>borda count</a
				>, where each task is treated as a preference voter. The Borda rank tends to prefer models
				that perform well broadly across tasks.
			</li>
			<li>
				<strong>Mean(Task)</strong> is a naïve average across all tasks. Simple and continuous, but
				can overvalue high-variance tasks.
			</li>
			<li>
				<strong>Mean(TaskType)</strong> is a weighted average across task categories, computed by
				averaging per category and then averaging the categories. Prefers models that perform well
				across all task categories.
			</li>
		</ul>

		<h4>What does zero-shot mean?</h4>
		<p>
			A model is zero-shot if it has not been trained on any splits of the datasets used to derive
			the benchmark's tasks. 100% means the benchmark is fully out-of-distribution for the model;
			50% means the model has been fine-tuned on half of the tasks.
		</p>

		<h4>Why is a model missing?</h4>
		<ul>
			<li>It may be filtered out by your current settings (e.g. zero-shot only).</li>
			<li>It may not have been run on the tasks in the benchmark yet.</li>
			<li>Its metadata may not yet be in mteb.</li>
		</ul>
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
</style>
