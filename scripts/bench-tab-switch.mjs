#!/usr/bin/env node
/**
 * Cross-browser tab-switch benchmark.
 *
 * Loads /benchmark/{name} with the Summary tab active, waits for the idle
 * pre-warm to finish, then alternates clicking Summary ↔ <target> tab and
 * reports per-browser latency.
 *
 * Usage:
 *   node scripts/bench-tab-switch.mjs                # defaults
 *   node scripts/bench-tab-switch.mjs --base=http://localhost:4173
 *   node scripts/bench-tab-switch.mjs --bench='MTEB(eng, v2)' --to=perf_task
 *   BROWSERS=chromium,firefox node scripts/bench-tab-switch.mjs
 *
 * Defaults to MTEB(Multilingual, v2) Summary ↔ Performance per language.
 */
import { chromium, firefox, webkit } from 'playwright';

const args = Object.fromEntries(
	process.argv
		.slice(2)
		.filter((a) => a.startsWith('--'))
		.map((a) => {
			const [k, ...rest] = a.replace(/^--/, '').split('=');
			return [k, rest.join('=') || true];
		})
);

const BASE = args.base ?? 'http://localhost:5173';
const BENCH = args.bench ?? 'MTEB(Multilingual, v2)';
const TARGET = args.to ?? 'perf_language'; // 'perf_task' | 'perf_language' | 'perf_size' | 'perf_time' | 'task_info'
const ITERATIONS = Number(args.iters ?? 6);
const BROWSER_LIST = (process.env.BROWSERS ?? 'chromium,firefox,webkit')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

const ENGINES = { chromium, firefox, webkit };

const TARGET_LABEL = {
	perf_size: 'size',
	perf_time: 'time',
	perf_task: 'per task',
	perf_language: 'per language',
	task_info: 'task information'
};
const targetLabel = TARGET_LABEL[TARGET];
if (!targetLabel) {
	console.error(`Unknown target tab: ${TARGET}. Known: ${Object.keys(TARGET_LABEL).join(', ')}`);
	process.exit(1);
}

function statsOf(nums) {
	if (nums.length === 0) return { n: 0 };
	const sorted = [...nums].sort((a, b) => a - b);
	const sum = nums.reduce((a, b) => a + b, 0);
	return {
		n: nums.length,
		avg: Math.round(sum / nums.length),
		median: Math.round(sorted[Math.floor(sorted.length / 2)])
	};
}

function summarise(samples) {
	// samples is now an array of {duration, processingDuration, presentationDelay}.
	if (samples.length === 0) return { n: 0 };
	return {
		n: samples.length,
		duration: statsOf(samples.map((s) => s.duration)),
		processing: statsOf(samples.map((s) => s.processingDuration)),
		presentation: statsOf(samples.map((s) => s.presentationDelay))
	};
}

/** Install a PerformanceObserver that captures the next `click` event-timing
 *  entry and stashes it on `window.__lastEventEntry`. Real Playwright input
 *  (page.click via CDP/marionette/webdriver) is trusted, so Event Timing
 *  entries fire — unlike synthetic `element.click()` from page.evaluate. */
async function armEventCapture(page) {
	await page.evaluate(() => {
		window.__lastEventEntry = null;
		if (window.__bench_po) window.__bench_po.disconnect();
		window.__bench_po = new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				if (e.name !== 'click') continue;
				window.__lastEventEntry = {
					duration: Math.round(e.duration),
					processingDuration: Math.round(e.processingEnd - e.processingStart),
					presentationDelay: Math.round(e.duration - (e.processingEnd - e.startTime))
				};
				return;
			}
		});
		try {
			window.__bench_po.observe({ type: 'event', durationThreshold: 0, buffered: false });
		} catch {
			window.__bench_po.observe({ type: 'event', buffered: false });
		}
	});
}

async function clickAndMeasure(page, selector) {
	await armEventCapture(page);
	await page.click(selector, { delay: 0 });
	// Poll for the entry — present after the browser has finished rendering.
	for (let i = 0; i < 200; i++) {
		const entry = await page.evaluate(() => window.__lastEventEntry);
		if (entry) return entry;
		await new Promise((r) => setTimeout(r, 25));
	}
	return null;
}

async function bench(name) {
	const engine = ENGINES[name];
	if (!engine) {
		console.error(`Unknown browser: ${name}`);
		return null;
	}
	const browser = await engine.launch();
	try {
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		const page = await ctx.newPage();
		await page.goto(`${BASE}/benchmark/${encodeURIComponent(BENCH)}`, { waitUntil: 'load' });
		await page.waitForSelector('.tab-pane.active .tbl', { timeout: 30_000 });
		// Wait long enough for the idle pre-warm slots to land.
		await page.waitForTimeout(2500);

		// Locate the buttons by visible text so we get unique CSS selectors.
		const tabIds = { summary: 'Summary' };
		tabIds.target = TARGET_LABEL[TARGET];
		const buttons = await page.evaluate(
			({ labels }) => {
				const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
				const find = (label) =>
					tabs.findIndex((b) => b.textContent.toLowerCase().includes(label.toLowerCase()));
				return { target: find(labels.target), summary: find(labels.summary) };
			},
			{ labels: tabIds }
		);
		const targetSel = `[role="tab"]:nth-of-type(${buttons.target + 1})`;
		const summarySel = `[role="tab"]:nth-of-type(${buttons.summary + 1})`;

		const coldFirst = await clickAndMeasure(page, targetSel);
		await clickAndMeasure(page, summarySel);

		const steady = [];
		for (let i = 0; i < ITERATIONS; i++) {
			const m = await clickAndMeasure(page, targetSel);
			if (m) steady.push(m);
			await clickAndMeasure(page, summarySel);
		}

		return {
			browser: name,
			coldFirst,
			steady: summarise(steady)
		};
	} finally {
		await browser.close();
	}
}

console.log(`Benchmark: ${BENCH}  Summary ↔ ${targetLabel}  (${ITERATIONS} iters, base=${BASE})`);
console.log('—'.repeat(64));
function fmt(n) {
	return String(n ?? '?').padStart(4) + 'ms';
}

console.log('  Reporting Event Timing API entries — `total` is full INP (click→paint),');
console.log('  `proc` is the JS handler, `present` is browser render+composite.');
console.log();

for (const browserName of BROWSER_LIST) {
	try {
		const r = await bench(browserName);
		if (!r) continue;
		const c = r.coldFirst;
		const s = r.steady;
		console.log(
			`${browserName.padEnd(10)}  cold-first  total ${fmt(c?.duration)}  ` +
				`proc ${fmt(c?.processingDuration)}  present ${fmt(c?.presentationDelay)}`
		);
		console.log(
			`${' '.repeat(10)}  steady avg  total ${fmt(s.duration?.avg)}  ` +
				`proc ${fmt(s.processing?.avg)}  present ${fmt(s.presentation?.avg)}`
		);
		console.log(
			`${' '.repeat(10)}  steady med  total ${fmt(s.duration?.median)}  ` +
				`proc ${fmt(s.processing?.median)}  present ${fmt(s.presentation?.median)}`
		);
		console.log();
	} catch (e) {
		console.error(`${browserName}: ${e.message}`);
	}
}
