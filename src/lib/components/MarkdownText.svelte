<script lang="ts">
	// Renders a string with very small markdown handling: inline links of the
	// form `[label](https://...)` become real `<a>` elements. No HTML escaping
	// issues because we don't touch innerHTML — every segment is bound through
	// Svelte's normal text interpolation, which escapes by default.
	//
	// Intentional non-features: no emphasis, no headings, no images, no
	// nested links. The descriptions on benchmarks and tasks are short bits
	// of prose where links are the only markdown that ever appears, and we'd
	// rather keep this primitive than pull in a full markdown parser.

	interface Segment {
		type: 'text' | 'link';
		text: string;
		url?: string;
	}

	interface Props {
		text: string | null | undefined;
	}
	let { text }: Props = $props();

	const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

	function parse(input: string): Segment[] {
		const out: Segment[] = [];
		let i = 0;
		// reset between calls — JS regex state is per-instance, this one is module-scoped.
		LINK_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = LINK_RE.exec(input)) !== null) {
			if (m.index > i) {
				out.push({ type: 'text', text: input.slice(i, m.index) });
			}
			out.push({ type: 'link', text: m[1], url: m[2] });
			i = m.index + m[0].length;
		}
		if (i < input.length) {
			out.push({ type: 'text', text: input.slice(i) });
		}
		return out;
	}

	let segments = $derived(parse(text ?? ''));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<!-- All <a> here carry URLs from user-supplied markdown — always external. -->
{#each segments as seg, i (i)}
	{#if seg.type === 'link'}
		<a
			href={seg.url}
			target="_blank"
			rel="noreferrer"
			class="md-link"
			onclick={(e) => e.stopPropagation()}>{seg.text}</a
		>
	{:else}
		{seg.text}
	{/if}
{/each}

<style>
	.md-link {
		color: var(--link);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.md-link:hover {
		text-decoration-color: var(--primary);
	}
</style>
