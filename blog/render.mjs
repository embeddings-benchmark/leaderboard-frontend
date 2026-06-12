#!/usr/bin/env node
// Render every blog hero/feature HTML into a PNG via Playwright.
//
// Usage:
//   node render.mjs              # render every target
//   node render.mjs hero-1       # render only matching targets (substring match)
//
// Assumes Playwright is installed in the parent SvelteKit project (it is,
// for e2e tests). Serves blog/ over a tiny localhost HTTP server because
// Playwright's Chromium blocks file:// for sibling assets.

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const TARGETS = [
  { html: 'hero-1.html', out: 'hero-1.png', w: 2240, h: 1180 },
  { html: 'hero-1-1.html', out: 'hero-1-1.png', w: 2240, h: 1180 },
  { html: 'hero-3.html', out: 'hero-3.png', w: 2240, h: 1180 },
  { html: 'hero-4.html', out: 'hero-4.png', w: 2240, h: 1180 },
  { html: 'hero-5.html', out: 'hero-5.png', w: 2240, h: 1180 },
  { html: 'hero-6.html', out: 'hero-6.png', w: 2240, h: 1180 },
  { html: 'feature-mobile.html', out: 'feature-mobile.png', w: 2240, h: 1180 },
  { html: 'feature-share.html', out: 'feature-share.png', w: 2240, h: 1180 },
  { html: 'comparison.html', out: 'leaderboard-versions-comparison.png', w: 2240, h: 1345 },
  { html: 'grid-overview.html', out: 'grid-overview.png', w: 2240, h: 1480 },
  { html: 'table-pinned.html', out: 'table-pinned.png', w: 1438, h: 382 },
  { html: 'tasks-views.html', out: 'tasks-views.png', w: 2240, h: 660 },
  { html: 'benchmark-filters.html', out: 'benchmark-filters.png', w: 1100, h: 1180 },
  { html: 'task-tip.html', out: 'task-tip.png', w: 1640, h: 500 },

  // Originals from the HF CDN, downloaded into blog/original/.
  // Each is rendered onto the dotted background with a 60 px margin via framed.html.
  { html: 'framed.html?src=original/C01n7urmyT-xhL3KCU8ji.png', out: 'figure-pin-hover.png', w: 998, h: 575 },
  { html: 'framed.html?src=original/FV8RVY_N9pZNF7J7nn1GM.png', out: 'figure-filter-scope.png', w: 762, h: 1546 },
  { html: 'framed.html?src=original/5gD3VGloOKEZ46bNwRIJu.png', out: 'figure-task-tooltip.png', w: 894, h: 498 },
  { html: 'framed.html?src=original/LfdOcAVJSoI_fLLB26qFF.png', out: 'figure-tasks-list.png', w: 1515, h: 787 },
  { html: 'framed.html?src=original/spyP77__0Yb7c1-Ls4vtx.png', out: 'figure-tasks-grid.png', w: 1362, h: 1335 },
  { html: 'framed.html?src=original/46rS1BafXJWomNd52RaNJ.png', out: 'figure-models-grid.png', w: 1388, h: 1122 },
  { html: 'framed.html?src=original/hvPogCxF3rzUQZp0Lqub3.png', out: 'figure-trained-on.png', w: 1334, h: 684 },
  { html: 'framed.html?src=original/XDUovTqlj9f8HOvNFhqh-.png', out: 'figure-task-detail.png', w: 1412, h: 2226 },
  { html: 'framed.html?src=original/agtIAi4jNVaQIWjijv0-2.png', out: 'figure-perf-size.png', w: 2068, h: 1067 },
  { html: 'framed.html?src=original/USL5Ll4tvZEEML4Y8iluL.png', out: 'figure-primary-tile.png', w: 914, h: 694 },
  { html: 'framed.html?src=original/e60VlIrTCfGdAy9Z-aQSe.png', out: 'figure-compare-button.png', w: 1024, h: 333 },
  { html: 'framed.html?src=original/y9kX0ebFFKc3kv0ZmajYA.png', out: 'figure-compare.png', w: 1398, h: 1167 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer(root, port) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(root, url);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function main() {
  const filter = process.argv[2];
  const targets = filter ? TARGETS.filter((t) => t.html.includes(filter)) : TARGETS;
  if (targets.length === 0) {
    console.error(`no targets match "${filter}"`);
    process.exit(1);
  }

  const port = 18765;
  const server = await startServer(here, port);
  const browser = await chromium.launch();
  try {
    for (const t of targets) {
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h } });
      const page = await ctx.newPage();
      const url = `http://localhost:${port}/${t.html}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      const outPath = path.join(here, t.out);
      await page.screenshot({ path: outPath, type: 'png' });
      const size = (fs.statSync(outPath).size / 1024).toFixed(0);
      console.log(`✓ ${t.html.padEnd(24)} → ${t.out} (${size} KB, ${t.w}×${t.h})`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
