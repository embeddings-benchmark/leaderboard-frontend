<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Data, Layout, Config } from 'plotly.js';

	interface Props {
		data: Data[];
		layout?: Partial<Layout>;
		config?: Partial<Config>;
		height?: number;
		/** Which Plotly trace modules to register before drawing. Default
		 *  `scatter` covers the perf-by-size / perf-by-time figures on
		 *  /benchmark/[name]; the /compare radar passes `scatterpolar`
		 *  so we don't bundle polar code into the benchmark route. */
		traces?: ('scatter' | 'scatterpolar')[];
	}
	let { data, layout = {}, config = {}, height = 480, traces = ['scatter'] }: Props = $props();

	let el: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let Plotly: any;
	let mounted = $state(false);

	/** Read the leaderboard's theme tokens so chart text/grid lines adapt to
	 *  light/dark without per-chart wiring. Computed at every render so a
	 *  later theme switch picks the new palette up.
	 *
	 *  Note: `getPropertyValue('--token')` returns the *declared* value, which
	 *  for our tokens is a `light-dark(...)` expression — not something Plotly
	 *  understands. Resolving through the var requires applying it as a real
	 *  CSS color on a probe element and reading the computed style back. */
	function themeColors() {
		if (typeof window === 'undefined') {
			return { text: 'var(--tip-bg)', muted: '#5a6470', grid: '#cdd0d6', surface: '#ffffff' };
		}
		const probe = document.createElement('span');
		probe.style.position = 'absolute';
		probe.style.visibility = 'hidden';
		probe.style.pointerEvents = 'none';
		document.body.appendChild(probe);
		const resolve = (token: string, fallback: string) => {
			probe.style.color = `var(${token})`;
			const v = getComputedStyle(probe).color;
			return v && v !== 'rgb(0, 0, 0)' ? v : fallback;
		};
		const text = resolve('--ink-strong', '#0e1116');
		const muted = resolve('--text', 'var(--tip-bg)');
		const grid = resolve('--border', '#cdd0d6');
		const surface = resolve('--surface', '#ffffff');
		probe.remove();
		return { text, muted, grid, surface };
	}

	function buildLayout(): Partial<Layout> {
		const c = themeColors();
		const axisDefaults = {
			gridcolor: c.grid,
			linecolor: c.grid,
			tickcolor: c.grid,
			zerolinecolor: c.grid,
			tickfont: { color: c.muted }
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const xa = (layout.xaxis ?? {}) as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ya = (layout.yaxis ?? {}) as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const polar = (layout.polar ?? {}) as any;
		return {
			template: 'plotly_white' as unknown as Layout['template'],
			font: { size: 13, color: c.text },
			margin: { t: 20, r: 20, b: 50, l: 60 },
			paper_bgcolor: 'rgba(0,0,0,0)',
			plot_bgcolor: 'rgba(0,0,0,0)',
			hoverlabel: {
				bgcolor: c.surface,
				bordercolor: c.grid,
				font: { size: 13, color: c.text }
			},
			...layout,
			xaxis: {
				...axisDefaults,
				...xa,
				title: {
					font: { color: c.text },
					...(xa.title ?? {})
				}
			},
			yaxis: {
				...axisDefaults,
				...ya,
				title: {
					font: { color: c.text },
					...(ya.title ?? {})
				}
			},
			polar:
				polar.radialaxis || polar.angularaxis
					? {
							...polar,
							radialaxis: {
								gridcolor: c.grid,
								linecolor: 'rgba(0,0,0,0)',
								tickfont: { color: c.muted },
								...(polar.radialaxis ?? {})
							},
							angularaxis: {
								gridcolor: c.grid,
								linecolor: 'rgba(0,0,0,0)',
								tickfont: { color: c.muted },
								...(polar.angularaxis ?? {})
							}
						}
					: layout.polar
		};
	}

	const defaultConfig: Partial<Config> = {
		displaylogo: false,
		responsive: true,
		modeBarButtonsToRemove: ['lasso2d', 'select2d']
	};

	onMount(async () => {
		// Route-split modular build: each consumer declares which trace
		// modules it needs. /benchmark/[name] pulls only `scatter` (~1 MB);
		// /compare adds `scatterpolar` for the radar. Avoids loading polar
		// code on routes that don't draw a polar plot.
		const PlotlyMod = await import('plotly.js/lib/core');
		Plotly = PlotlyMod.default;
		const traceMods = await Promise.all(
			traces.map((name) =>
				name === 'scatterpolar'
					? import('plotly.js/lib/scatterpolar').then((m) => m.default)
					: import('plotly.js/lib/scatter').then((m) => m.default)
			)
		);
		Plotly.register(traceMods);
		mounted = true;
		await Plotly.newPlot(el, data, buildLayout(), { ...defaultConfig, ...config });

		// React to manual toggle (writes `data-theme` on <html>) and to OS
		// preference changes (no attribute set — plain media-query flip).
		const mo = new MutationObserver(() =>
			Plotly?.react(el, data, buildLayout(), { ...defaultConfig, ...config })
		);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onMq = () => Plotly?.react(el, data, buildLayout(), { ...defaultConfig, ...config });
		mq.addEventListener('change', onMq);

		// Cleanup on destroy is handled in onDestroy below; stash the disposers
		// on a closure so onDestroy can reach them.
		teardown = () => {
			mo.disconnect();
			mq.removeEventListener('change', onMq);
		};
	});

	let teardown: (() => void) | null = null;

	$effect(() => {
		if (!mounted || !Plotly) return;
		Plotly.react(el, data, buildLayout(), { ...defaultConfig, ...config });
	});

	onDestroy(() => {
		teardown?.();
		if (Plotly && el) Plotly.purge(el);
	});
</script>

<div class="chart" bind:this={el} style:height="{height}px"></div>

<style>
	.chart {
		width: 100%;
	}
</style>
