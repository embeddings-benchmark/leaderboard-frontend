<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Data, Layout, Config } from 'plotly.js';
	import { onThemeChange } from '$lib/theme-bus';

	interface Props {
		data: Data[];
		layout?: Partial<Layout>;
		config?: Partial<Config>;
		height?: number;
		/** Which Plotly trace modules to register before drawing. Default
		 *  `scatter` covers the perf-by-size / perf-by-time figures on
		 *  /benchmark/[name]; the /compare radar passes `scatterpolar`
		 *  so we don't bundle polar code into the benchmark route, and the
		 *  /compare grouped bar passes `bar`. */
		traces?: ('scatter' | 'scatterpolar' | 'bar')[];
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
	// Cached across all calls within one theme — data/config changes shouldn't
	// re-probe the DOM. Invalidated below via `onThemeChange` so the next
	// `buildLayout()` reads the new palette.
	let cachedColors: { text: string; muted: string; grid: string; surface: string } | null = null;
	function themeColors() {
		if (cachedColors) return cachedColors;
		if (typeof window === 'undefined') {
			cachedColors = {
				text: 'var(--tip-bg)',
				muted: '#5a6470',
				grid: '#cdd0d6',
				surface: '#ffffff'
			};
			return cachedColors;
		}
		const text = resolveToken('--ink-strong', '#0e1116');
		const muted = resolveToken('--text', 'var(--tip-bg)');
		const grid = resolveToken('--border', '#cdd0d6');
		const surface = resolveToken('--surface', '#ffffff');
		cachedColors = { text, muted, grid, surface };
		return cachedColors;
	}

	// Per-theme cache of resolved tokens, shared by the layout colours above
	// and `var(--token)` strings in trace data below.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const tokenCache = new Map<string, string>();
	function resolveToken(token: string, fallback: string): string {
		const hit = tokenCache.get(token);
		if (hit) return hit;
		const probe = document.createElement('span');
		probe.style.position = 'absolute';
		probe.style.visibility = 'hidden';
		probe.style.pointerEvents = 'none';
		document.body.appendChild(probe);
		probe.style.color = `var(${token})`;
		const v = getComputedStyle(probe).color;
		probe.remove();
		const out = v && v !== 'rgb(0, 0, 0)' ? v : fallback;
		tokenCache.set(token, out);
		return out;
	}

	/** Figure specs may colour traces with theme tokens — `'var(--tint-green-fg)'`
	 *  — so a line can follow light/dark like the rest of the UI. Plotly can't
	 *  read CSS variables, so swap each such string for its resolved colour. */
	const VAR_RE = /^var\((--[\w-]+)\)$/;
	function resolveVars<T>(value: T): T {
		if (typeof value === 'string') {
			const m = VAR_RE.exec(value);
			return (m && typeof window !== 'undefined' ? resolveToken(m[1], value) : value) as T;
		}
		if (Array.isArray(value)) {
			// Numeric coordinate arrays are the bulk of the data; skip them whole.
			return (typeof value[0] === 'number' ? value : value.map(resolveVars)) as T;
		}
		if (value && typeof value === 'object') {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(value)) out[k] = resolveVars(v);
			return out as T;
		}
		return value;
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
					: name === 'bar'
						? import('plotly.js/lib/bar').then((m) => m.default)
						: import('plotly.js/lib/scatter').then((m) => m.default)
			)
		);
		Plotly.register(traceMods);
		mounted = true;
		await Plotly.newPlot(el, resolveVars(data), buildLayout(), { ...defaultConfig, ...config });

		// React to manual toggle (writes `data-theme` on <html>) and to OS
		// preference changes — both routed through the shared dispatcher in
		// `theme-bus` so we share one observer/media listener across all charts.
		const offTheme = onThemeChange(() => {
			cachedColors = null;
			tokenCache.clear();
			Plotly?.react(el, resolveVars(data), buildLayout(), { ...defaultConfig, ...config });
		});

		// Cleanup on destroy is handled in onDestroy below; stash the disposer
		// on a closure so onDestroy can reach it.
		teardown = offTheme;
	});

	let teardown: (() => void) | null = null;

	/** Show Plotly's own hover label on the point whose trace `ids` entry is
	 *  `id`, as if the pointer were over it — lets a list outside the chart
	 *  point at its bubble. No-op until Plotly has loaded or if no trace
	 *  carries that id. */
	export function hoverPoint(id: string) {
		if (!Plotly || !el) return;
		const points: { curveNumber: number; pointNumber: number }[] = [];
		data.forEach((trace, curveNumber) => {
			const pointNumber = ((trace as { ids?: string[] }).ids ?? []).indexOf(id);
			if (pointNumber >= 0) points.push({ curveNumber, pointNumber });
		});
		if (points.length) Plotly.Fx.hover(el, points);
	}
	export function unhover() {
		if (Plotly && el) Plotly.Fx.unhover(el);
	}

	$effect(() => {
		if (!mounted || !Plotly) return;
		Plotly.react(el, resolveVars(data), buildLayout(), { ...defaultConfig, ...config });
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
