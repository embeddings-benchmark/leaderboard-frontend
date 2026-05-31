<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	let { children } = $props();

	// "page.url.pathname" includes base; strip it for matching.
	let path = $derived.by(() => {
		const p = page.url.pathname;
		return base && p.startsWith(base) ? p.slice(base.length) || '/' : p;
	});

	const NAV = [
		{ label: 'Benchmarks', href: '/explorer', match: (p: string) => p === '/explorer' || /^\/explorer\/[^/]+\/?$/.test(p) },
		{ label: 'Models', href: '/explorer/models', match: (p: string) => p.startsWith('/explorer/models') },
		{ label: 'Tasks', href: '/explorer/tasks', match: (p: string) => p.startsWith('/explorer/tasks') }
	];
</script>

<div class="explorer-shell">
	<header class="bar">
		<a class="brand" href="{base}/explorer">
			<span class="dot"></span>
			<span class="name">mteb&nbsp;leaderboard</span>
			<span class="tag">Explorer</span>
		</a>
		<nav class="subnav" aria-label="Explorer sections">
			{#each NAV as item (item.href)}
				<a
					href="{base}{item.href}"
					class:active={item.match(path)}
					data-sveltekit-preload-data="hover"
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	{@render children()}
</div>

<style>
	.explorer-shell {
		min-height: 100vh;
		background: linear-gradient(180deg, #fbfbfc 0%, var(--bg) 240px);
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 28px;
		background: rgba(255, 255, 255, 0.86);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--text);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 0 4px var(--primary-soft);
	}
	.name {
		font-weight: 700;
		font-size: 14px;
	}
	.tag {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--primary-strong);
		background: var(--primary-soft);
		padding: 3px 8px;
		border-radius: 999px;
	}
	.subnav {
		display: inline-flex;
		gap: 2px;
		padding: 4px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
	}
	.subnav a {
		padding: 6px 14px;
		border-radius: 999px;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.12s, background 0.12s;
	}
	.subnav a:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
	.subnav a.active {
		color: #fff;
		background: var(--primary);
	}
	.subnav a.active:hover {
		background: var(--primary-strong);
	}
</style>
