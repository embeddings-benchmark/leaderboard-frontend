/**
 * CSV serialisation + browser download helpers shared by every table that
 * exposes an export button. Centralised so escaping, filename hygiene, and
 * the blob-download dance live in one place — components only describe what
 * to export, not how to ship it.
 */

export type CsvCell = string | number | null | undefined;

/** RFC-4180 minimum: quote if the cell contains a comma, quote, or newline. */
export function escapeCsv(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/** Serialise rows to a CSV body. ``null`` and ``undefined`` become empty cells. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
	const fmt = (c: CsvCell): string => (c == null ? '' : escapeCsv(String(c)));
	const lines = [headers.map(escapeCsv).join(',')];
	for (const row of rows) {
		lines.push(row.map(fmt).join(','));
	}
	return lines.join('\n');
}

/**
 * Collapse non-alphanumerics into single underscores and trim outer ones —
 * keeps filenames readable without exotic punctuation that some shells
 * mishandle. Returns ``fallback`` when the input slug is empty.
 */
export function sanitizeFilename(name: string, fallback = 'export'): string {
	const slug = name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
	return slug || fallback;
}

/** Ensure the filename ends with a single ``.csv`` extension. */
function ensureCsvExt(name: string): string {
	return /\.csv$/i.test(name) ? name : `${name}.csv`;
}

/**
 * Trigger a browser download of ``headers`` + ``rows`` as a CSV file. Runs
 * client-side only; no-op on the server during prerender.
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = ensureCsvExt(filename);
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
