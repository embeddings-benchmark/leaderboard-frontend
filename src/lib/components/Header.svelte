<script lang="ts">
	interface Props {
		benchmarkName: string;
	}
	let { benchmarkName }: Props = $props();
</script>

<header class="header">
	<h1 class="intro">Embedding Leaderboard</h1>
	<p class="blurb">
		This leaderboard compares 100+ text and image embedding models across 1000+ languages. We
		refer to the publication of each selectable benchmark for details on metrics, languages,
		tasks, and task types. Anyone is welcome
		<a
			href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_model/"
			target="_blank"
			rel="noreferrer">to add a model</a
		>,
		<a
			href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_benchmark/"
			target="_blank"
			rel="noreferrer">add benchmarks</a
		>, or
		<a
			href="https://github.com/embeddings-benchmark/mteb/issues/new?template=enhancement.yaml"
			target="_blank"
			rel="noreferrer">propose changes to the leaderboard</a
		>.
	</p>
	<h2 class="title">{benchmarkName}</h2>
</header>

<style>
	.header {
		padding: 24px 0 8px;
	}
	.intro {
		font-size: 20px;
		font-weight: 700;
		margin: 0 0 6px;
	}
	.blurb {
		max-width: 1100px;
		color: var(--text-muted);
		margin: 0 0 18px;
	}
	.title {
		text-align: center;
		font-size: 22px;
		font-weight: 700;
		margin: 12px 0 4px;
	}
</style>
