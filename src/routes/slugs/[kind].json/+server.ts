// Prerendered slug → name index per entity kind; read by the detail loaders
// via `loadSlugIndex`. Building it also fails the build on a slug collision.
import { error, json } from '@sveltejs/kit';
import type { EntryGenerator, RequestHandler } from './$types';
import { buildEntitySlugIndex, type SlugKind } from '$lib/data/service';

export const prerender = !process.env.BUILD_NO_PRERENDER;

const KINDS: SlugKind[] = ['benchmarks', 'models', 'tasks'];

export const entries: EntryGenerator = () => KINDS.map((kind) => ({ kind }));

export const GET: RequestHandler = async ({ params }) => {
	const kind = params.kind as SlugKind;
	if (!KINDS.includes(kind)) error(404, `Unknown slug kind "${params.kind}"`);
	return json(await buildEntitySlugIndex(kind));
};
