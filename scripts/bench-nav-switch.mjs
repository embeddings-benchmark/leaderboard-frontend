#!/usr/bin/env node
/**
 * Cross-browser top-nav switch benchmark.
 *
 * Measures the SPA navigation latency from one top-nav page to another
 * via real Playwright clicks (which trigger Event Timing entries).
 * Reports the full INP (input → next paint) broken into the three
 * subparts: input delay, JS processing, browser presentation.
 *
 * Usage:
 *   node scripts/bench-nav-switch.mjs                  # all defaults
 *   node scripts/bench-nav-switch.mjs --base=http://localhost:4173
 *   node scripts/bench-nav-switch.mjs --iters=5
 *   BROWSERS=chromium,firefox node scripts/bench-nav-switch.mjs
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
const ITERATIONS = Number(args.iters ?? 4);
const BROWSER_LIST = (process.env.BROWSERS ?? 'chromium,firefox,webkit')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

const ENGINES = { chromium, firefox, webkit };

/** Top-nav routes — `ready` is the selector that signals first
 *  meaningful content for that route. Order matches the navbar. */
const NAV = [
	{ key: 'home', href: '/', ready: '.section .card' },
	{ key: 'benchmarks', href: '/benchmarks', ready: 'section.block a.card' },
	{ key: 'models', href: '/models', ready: 'a.card' },
	{ key: 'tasks', href: '/tasks', ready: 'a.card' }
];

async function armCapture(page) {
	await page.evaluate(() => {
		window.__lastClick = null;
		if (window.__nav_po) window.__nav_po.disconnect();
		window.__nav_po = new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				if (e.name !== 'click') continue;
				window.__lastClick = {
					duration: Math.round(e.duration),
					processingDuration: Math.round(e.processingEnd - e.processingStart),
					presentationDelay: Math.round(e.duration - (e.processingEnd - e.startTime))
				};
				return;
			}
		});
		try {
			window.__nav_po.observe({ type: 'event', durationThreshold: 0, buffered: false });
		} catch {
			window.__nav_po.observe({ type: 'event', buffered: false });
		}
	});
}

async function clickAndMeasure(page, route) {
	await armCapture(page);
	// `a[href="..."]` finds the top-nav link; SvelteKit's client router takes over.
	const sel = `a[href="${route.href}"]`;
	const start = Date.now();
	await page.click(sel, { delay: 0 });
	// Wait for the destination's first meaningful content.
	await page.waitForSelector(route.ready, { timeout: 30_000 });
	const wallClockMs = Date.now() - start;
	// Pull the Event Timing entry the observer captured (it includes
	// presentation delay that bare wall-clock can't see).
	const entry = await page.evaluate(async () => {
		// The 'event' entry may land a frame after wait-for-selector resolves.
		for (let i = 0; i < 20; i++) {
			if (window.__lastClick) return window.__lastClick;
			await new Promise((r) => setTimeout(r, 25));
		}
		return null;
	});
	return { wallClockMs, entry };
}

function statsOf(nums) {
	if (!nums.length) return { n: 0 };
	const sorted = [...nums].sort((a, b) => a - b);
	return {
		n: nums.length,
		avg: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length),
		median: Math.round(sorted[Math.floor(sorted.length / 2)])
	};
}

function summarise(samples) {
	if (samples.length === 0) return null;
	return {
		wall: statsOf(samples.map((s) => s.wallClockMs)),
		duration: statsOf(samples.map((s) => s.entry?.duration ?? 0)),
		processing: statsOf(samples.map((s) => s.entry?.processingDuration ?? 0)),
		presentation: statsOf(samples.map((s) => s.entry?.presentationDelay ?? 0))
	};
}

async function bench(name) {
	const engine = ENGINES[name];
	if (!engine) return null;
	const browser = await engine.launch();
	try {
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		const page = await ctx.newPage();

		// Warm: visit each route once to populate cachedHttp.
		for (const r of NAV) {
			await page.goto(`${BASE}${r.href}`, { waitUntil: 'load' });
			await page.waitForSelector(r.ready, { timeout: 30_000 });
		}

		const results = {};
		// For each route, navigate from / to that route, repeated.
		for (const target of NAV) {
			if (target.key === 'home') continue; // we're always starting on home, skip
			const samples = [];
			for (let i = 0; i < ITERATIONS; i++) {
				// Reset to home before each iter
				await page.goto(`${BASE}/`, { waitUntil: 'load' });
				await page.waitForSelector('.section .card', { timeout: 30_000 });
				const m = await clickAndMeasure(page, target);
				samples.push(m);
			}
			results[target.key] = summarise(samples);
		}
		return results;
	} finally {
		await browser.close();
	}
}

function pad(s, n) {
	s = String(s);
	return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

console.log(
	`Top-nav switch benchmark  —  start on /, click target nav link  (${ITERATIONS} iters, base=${BASE})`
);
console.log('  Cache warmed before timing. INP via Event Timing API; wall = goto→ready selector.');
console.log('—'.repeat(96));
console.log(
	`${pad('browser', 10)} ${pad('target', 12)} ${pad('wall med', 10)} ${pad('INP total', 11)} ${pad('processing', 11)} ${pad('presentation', 13)}`
);
console.log('—'.repeat(96));

for (const browserName of BROWSER_LIST) {
	let perRoute;
	try {
		perRoute = await bench(browserName);
	} catch (e) {
		console.error(`${browserName}: ${e.message}`);
		continue;
	}
	if (!perRoute) continue;
	for (const route of NAV) {
		if (route.key === 'home') continue;
		const r = perRoute[route.key];
		if (!r) continue;
		console.log(
			`${pad(browserName, 10)} ${pad(route.key, 12)} ` +
				`${pad(r.wall.median + ' ms', 10)} ${pad(r.duration.median + ' ms', 11)} ` +
				`${pad(r.processing.median + ' ms', 11)} ${pad(r.presentation.median + ' ms', 13)}`
		);
	}
	console.log('—'.repeat(96));
}
