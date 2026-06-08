<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// The static-adapter SPA shell (build/404.html) hydrates with whatever
	// route the URL points at. SvelteKit lands on this component whenever
	// no route matches, or when a +page.{ts,server.ts} load throws an
	// HttpError. ``page.status`` carries the original HTTP code so the
	// shell can adapt copy per 404 / 500 / etc.
</script>

<div class="error-page">
	<section class="card panel">
		<p class="status">{page.status}</p>
		<h1>
			{#if page.status === 404}
				Page not found
			{:else if page.status >= 500}
				Something went wrong
			{:else}
				{page.error?.message ?? 'Error'}
			{/if}
		</h1>
		<p class="msg">
			{#if page.status === 404}
				The link you followed doesn't match a benchmark, model, task, or comparison page.
				Double-check the URL or jump back to one of the index pages below.
			{:else if page.error?.message}
				{page.error.message}
			{:else}
				An unexpected error occurred while loading this page.
			{/if}
		</p>
		<nav class="links">
			<a class="primary" href={resolve('/')}>← Home</a>
			<a href={resolve('/benchmarks')}>Benchmarks</a>
			<a href={resolve('/models')}>Models</a>
			<a href={resolve('/tasks')}>Tasks</a>
			<a href={resolve('/compare')}>Compare</a>
		</nav>
	</section>
</div>

<style>
	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 220px);
		padding: 48px 24px;
	}
	.card {
		--panel-radius: 16px;
		--panel-shadow: 0 10px 30px rgb(var(--shadow-tint) / 0.06);
		max-width: 520px;
		width: 100%;
		text-align: center;
		padding: 44px 32px;
	}
	.status {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 80px;
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--primary);
	}
	@media (max-width: 480px) {
		.status {
			font-size: 64px;
		}
	}
	h1 {
		margin: 0 0 12px;
		font-size: 30px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--ink-strong);
	}
	.msg {
		margin: 0 auto 28px;
		max-width: 38ch;
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1.55;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}
	.links a {
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		text-decoration: none;
		transition:
			color 0.12s,
			background 0.12s,
			border-color 0.12s;
	}
	.links a:hover {
		color: var(--primary-strong);
		background: var(--primary-soft);
		border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
	}
	.links a.primary {
		color: var(--primary-strong);
		background: var(--primary-soft);
		border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
	}
	.links a.primary:hover {
		background: color-mix(in srgb, var(--primary) 14%, var(--surface));
	}
</style>
