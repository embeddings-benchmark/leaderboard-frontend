import type { Data, Layout } from 'plotly.js';
import type { BenchmarkSummary } from '$lib/types';

const RADAR_LINE_COLORS = ['#EE4266', '#00a6ed', '#ECA72C', '#B42318', '#3CBBB1'];

export interface PlotSpec {
	data: Data[];
	layout: Partial<Layout>;
}

function paramSizeForBubble(embeddingDim: number): number {
	// sqrt(dim) clipped at sqrt(4096), then scaled into Plotly's diameter sizing.
	const clipped = Math.min(embeddingDim || 0, 4096);
	return Math.sqrt(clipped);
}

export function performanceSizePlot(
	summary: BenchmarkSummary,
	pinned: ReadonlySet<string> = new Set()
): PlotSpec {
	const rows = summary.rows.filter((r) => r.activeParamsB > 0);

	const x = rows.map((r) => r.activeParamsB * 1e9);
	const y = rows.map((r) => r.meanTask * 100);
	const sizes = rows.map((r) => paramSizeForBubble(r.embeddingDim));
	const colors = rows.map((r) => Math.log10(Math.max(r.maxTokens, 1)));
	const text = rows.map((r) => r.model.displayName);
	const isPinned = rows.map((r) => pinned.has(r.model.name));
	const customdata = rows.map((r) => [
		r.maxTokens.toLocaleString(),
		r.embeddingDim.toLocaleString(),
		(r.activeParamsB * 1e9).toLocaleString(),
		r.rank
	]);

	const maxSizeRef = Math.sqrt(4096) / 40; // matches original: desired max diameter = 40px
	const PIN = '#ff6f3c';

	const trace: Data = {
		x,
		y,
		text,
		mode: 'text+markers',
		type: 'scatter',
		textposition: 'top center',
		textfont: {
			size: isPinned.map((p) => (p ? 13 : 11)),
			color: isPinned.map((p) => (p ? PIN : '#1f2329'))
		},
		hovertemplate:
			'<b>%{text}</b><br>Mean(Task): %{y:.2f}<br>Active params: %{customdata[2]}<br>' +
			'Max tokens: %{customdata[0]}<br>Embedding dim: %{customdata[1]}<br>' +
			'Rank: %{customdata[3]}<extra></extra>',
		customdata,
		marker: {
			size: sizes,
			sizemode: 'diameter',
			sizeref: maxSizeRef,
			sizemin: 4,
			color: colors,
			colorscale: 'Greens',
			cmin: 2,
			cmax: 5,
			showscale: true,
			colorbar: {
				title: { text: 'Max Tokens' },
				tickvals: [2, 3, 4, 5],
				ticktext: ['100', '1K', '10K', '100K']
			},
			line: {
				width: isPinned.map((p) => (p ? 3 : 0.5)),
				color: isPinned.map((p) => (p ? PIN : 'rgba(31,35,41,0.35)'))
			}
		}
	};

	const layout: Partial<Layout> = {
		xaxis: { title: { text: 'Number of Active Parameters' }, type: 'log' },
		yaxis: { title: { text: 'Mean (Task) score' } },
		showlegend: false
	};

	return { data: [trace], layout };
}

export function performanceOverTimePlot(
	summary: BenchmarkSummary,
	pinned: ReadonlySet<string> = new Set()
): PlotSpec {
	const points = summary.rows
		.filter((r) => r.model.releaseDate)
		.sort(
			(a, b) =>
				new Date(a.model.releaseDate!).getTime() - new Date(b.model.releaseDate!).getTime()
		);

	const dates = points.map((r) => r.model.releaseDate!);
	const scores = points.map((r) => r.meanTask * 100);
	const names = points.map((r) => r.model.displayName);
	const isPinned = points.map((r) => pinned.has(r.model.name));

	// Pareto frontier (cumulative max), step-after style.
	const frontier: number[] = [];
	let running = -Infinity;
	for (const s of scores) {
		running = Math.max(running, s);
		frontier.push(running);
	}

	const PIN_FILL = '#1f2329';
	const PIN_RING = '#ff6f3c';

	const scatter: Data = {
		x: dates,
		y: scores,
		text: names,
		// Pinned points get a persistent label; others stay name-on-hover.
		customdata: names,
		mode: 'markers+text',
		type: 'scatter',
		hovertemplate: '<b>%{customdata}</b><br>%{x|%Y-%m-%d}<br>Mean(Task): %{y:.2f}<extra></extra>',
		texttemplate: isPinned.map((p, i) => (p ? names[i] : '')),
		textposition: 'top center',
		textfont: { size: 12, color: PIN_RING },
		marker: {
			size: isPinned.map((p) => (p ? 14 : 9)),
			color: isPinned.map((p) => (p ? PIN_FILL : '#ff6f3c')),
			line: {
				color: isPinned.map((p) => (p ? PIN_RING : '#e85a2a')),
				width: isPinned.map((p) => (p ? 2.5 : 1))
			}
		},
		name: 'Models'
	};
	const frontierLine: Data = {
		x: dates,
		y: frontier,
		mode: 'lines',
		type: 'scatter',
		line: { color: '#1f7a1f', width: 2, shape: 'hv' },
		hovertemplate: '%{x|%Y-%m-%d}<br>Best so far: %{y:.2f}<extra></extra>',
		name: 'Pareto frontier'
	};

	const layout: Partial<Layout> = {
		xaxis: { title: { text: 'Release Date' }, type: 'date' },
		yaxis: { title: { text: 'Mean (Task) score' } },
		showlegend: false
	};

	return { data: [frontierLine, scatter], layout };
}

export function radarPlot(summary: BenchmarkSummary): PlotSpec {
	const top = summary.rows.slice(0, 5);
	const taskTypes = summary.taskTypes;
	if (taskTypes.length < 2 || top.length === 0) {
		return { data: [], layout: {} };
	}
	const theta = [...taskTypes, taskTypes[0]];
	const traces: Data[] = top.map((row, i) => {
		const r = taskTypes.map((tt) => (row.scoresByTaskType[tt] ?? 0) * 100);
		return {
			type: 'scatterpolar',
			mode: 'lines',
			name: row.model.displayName,
			r: [...r, r[0]],
			theta,
			line: { color: RADAR_LINE_COLORS[i % RADAR_LINE_COLORS.length], width: 2 },
			fill: 'toself',
			fillcolor: 'rgba(0,0,0,0)'
		};
	});

	const layout: Partial<Layout> = {
		polar: {
			radialaxis: {
				visible: true,
				showticklabels: false,
				ticks: '',
				gridcolor: '#cdd0d6',
				linecolor: 'rgba(0,0,0,0)'
			},
			angularaxis: {
				gridcolor: '#cdd0d6',
				linecolor: 'rgba(0,0,0,0)'
			}
		},
		showlegend: true,
		legend: {
			orientation: 'h',
			y: -0.15,
			yanchor: 'top',
			x: 0.5,
			xanchor: 'center'
		},
		margin: { l: 40, r: 40, t: 30, b: 30 }
	};

	return { data: traces, layout };
}

