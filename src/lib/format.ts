import { env } from '$env/dynamic/public';

/**
 * Insert a space before each new capitalized word so CamelCase task type
 * identifiers read naturally in the UI. The backend canonicalises these to
 * CamelCase ("BitextMining") so per-type column keys line up with
 * `tasksMeta[].type` across filter / table / chart code; this is the one
 * place that humanises the same string for display.
 *
 * Examples:
 *   "BitextMining"          -> "Bitext Mining"
 *   "InstructionReranking"  -> "Instruction Reranking"
 *   "STS"                   -> "STS"
 *   "Classification"        -> "Classification"
 */
export function humanizeType(s: string): string {
	return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Resolve an API-relative URL (one starting with "/") against PUBLIC_API_URL.
 * Absolute URLs and empty/null inputs pass through unchanged. Used so the
 * backend can serve cache-friendly proxy paths (e.g. /icon/<name>) without
 * the frontend having to know the API origin at every consumer.
 */
export function apiUrl(path: string | null | undefined): string | undefined {
	if (!path) return undefined;
	if (/^https?:\/\//i.test(path)) return path;
	const base = env.PUBLIC_API_URL?.trim().replace(/\/$/, '') ?? '';
	if (!base) return path; // offline build — return as-is, will 404 but harmlessly
	return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * A benchmark icon may be a URL (flag SVG, hosted PNG, our /icon proxy path)
 * or short text/emoji ("🌍"). URLs get rendered as <img>; everything else
 * is rendered as text in the consumer's UI.
 */
export function isIconUrl(icon: string | null | undefined): boolean {
	if (!icon) return false;
	return icon.startsWith('/') || /^(https?:|data:)/i.test(icon);
}
