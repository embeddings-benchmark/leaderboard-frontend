<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { updated } from '$app/state';
	import { base } from '$app/paths';
	import ViewSwitcher from '$lib/components/ViewSwitcher.svelte';

	let { children } = $props();

	// $app/state's `updated.current` flips to true when the poll detects a new
	// deployed version (svelte.config.js `kit.version.pollInterval`). Force a
	// full reload on the next client-side navigation so the new build lands
	// without users needing to clear cache.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) {
			location.href = to.url.href;
		}
	});

	// As a belt-and-suspenders fallback: if no navigation happens but the page
	// is idle for a while after detecting an update, refresh once it goes
	// hidden so the next foreground visit is fresh.
	onMount(() => {
		function onVisibility() {
			if (document.visibilityState === 'hidden' && updated.current) {
				location.reload();
			}
		}
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});
</script>

<svelte:head>
	<link rel="icon" href="{base}/dots-icon.ico" type="image/x-icon" />
	<title>MTEB Leaderboard</title>
</svelte:head>

<ViewSwitcher />
{@render children()}
