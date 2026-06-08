// Static file server for Playwright e2e — mimics the production nginx
// fallback chain (`$uri $uri.html $uri/ /404.html`) that's used on the
// Hugging Face Space. `vite preview` / `sirv-cli` don't quite match it:
// `vite preview` fails to URL-decode special chars like `(` `)` `,` in
// benchmark filenames (e.g. `MTEB(eng, v2).html`), and `sirv-cli --single`
// falls through to `index.html` instead of the prerendered SPA shell at
// `404.html`. This little server gets both right.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const PORT = parseInt(process.env.PREVIEW_PORT || '4173', 10);
const ROOT = resolve(process.cwd(), 'build');

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml; charset=utf-8',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8'
};

async function tryServe(filePath, res) {
	try {
		const s = await stat(filePath);
		if (!s.isFile()) return false;
		const body = await readFile(filePath);
		res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
		res.end(body);
		return true;
	} catch {
		return false;
	}
}

createServer(async (req, res) => {
	let pathname = new URL(req.url ?? '/', `http://localhost:${PORT}`).pathname;
	try {
		pathname = decodeURIComponent(pathname);
	} catch {
		/* malformed — leave as-is */
	}
	// Strip trailing slash so /foo/ resolves to /foo.html (the prerender
	// output) instead of /foo/index.html (which doesn't exist).
	if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

	// Resolution order: exact file, `.html` suffix, `/index.html`, then
	// the SPA shell at `/404.html`. Path-traversal guard keeps escapes
	// out of the build dir.
	const base = join(ROOT, pathname);
	const candidates = [base, `${base}.html`, join(base, 'index.html'), join(ROOT, '404.html')];

	for (const file of candidates) {
		if (!file.startsWith(ROOT)) continue;
		if (await tryServe(file, res)) return;
	}
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('not found');
}).listen(PORT, () => {
	console.log(`preview server on http://localhost:${PORT} serving ${ROOT}`);
});
