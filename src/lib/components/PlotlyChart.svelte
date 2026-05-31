<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Data, Layout, Config } from 'plotly.js';

	interface Props {
		data: Data[];
		layout?: Partial<Layout>;
		config?: Partial<Config>;
		height?: number;
	}
	let { data, layout = {}, config = {}, height = 480 }: Props = $props();

	let el: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let Plotly: any;
	let mounted = $state(false);

	const defaultLayout: Partial<Layout> = {
		template: 'plotly_white' as unknown as Layout['template'],
		font: { size: 13, color: '#1f2329' },
		margin: { t: 20, r: 20, b: 50, l: 60 },
		paper_bgcolor: 'rgba(0,0,0,0)',
		plot_bgcolor: 'rgba(0,0,0,0)',
		hoverlabel: { bgcolor: 'white', font: { size: 13 } }
	};
	const defaultConfig: Partial<Config> = {
		displaylogo: false,
		responsive: true,
		modeBarButtonsToRemove: ['lasso2d', 'select2d']
	};

	onMount(async () => {
		const mod = await import('plotly.js-dist-min');
		Plotly = mod.default ?? mod;
		mounted = true;
		await Plotly.newPlot(
			el,
			data,
			{ ...defaultLayout, ...layout },
			{ ...defaultConfig, ...config }
		);
	});

	$effect(() => {
		if (!mounted || !Plotly) return;
		Plotly.react(
			el,
			data,
			{ ...defaultLayout, ...layout },
			{ ...defaultConfig, ...config }
		);
	});

	onDestroy(() => {
		if (Plotly && el) Plotly.purge(el);
	});
</script>

<div class="chart" bind:this={el} style:height="{height}px"></div>

<style>
	.chart {
		width: 100%;
	}
</style>
