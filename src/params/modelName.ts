import type { ParamMatcher } from '@sveltejs/kit';

// HF identifier shape: exactly `org/name`, no empty segments, no `..`.
// Malformed slugs fail at the router (root 404); valid-shape-but-unknown
// names fall through to the loader's `error(404, ...)`.
export const match: ParamMatcher = (param) => {
	if (!param || param.includes('..')) return false;
	if (param.startsWith('/') || param.endsWith('/')) return false;
	const parts = param.split('/');
	return parts.length === 2 && parts.every((p) => p.length > 0);
};
