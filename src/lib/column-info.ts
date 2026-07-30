/**
 * Tooltip copy for the model-attribute columns that appear in more than one
 * table — `SummaryTable` (/benchmark/[name]) and `ModelsTable` (/models) both
 * render Parameters, Embedding dimension, Max tokens and Openness.
 *
 * Single source of truth so the two tables can't describe the same column
 * differently: a user who reads "Parameters" on a benchmark page and then on
 * /models must get the same explanation. Column copy used by exactly one table
 * (Rank, Zero-shot, the Mean columns) stays local to that component.
 */
export const COLUMN_INFO = {
	totalParams: {
		title: 'Total parameters',
		text: 'Total parameter count including embedding weights. Higher means more CPU/GPU memory required.'
	},
	openness: {
		title: 'Openness',
		text: 'How open the model is, scored 0–6 across open weights, open license, open training code, open training data, a paper, and a model card. Hover a cell for the full per-dimension breakdown.'
	},
	embedding: {
		title: 'Embedding dimension',
		text: 'The size of the vector each model produces. Higher dimensions cost more storage per embedding and more compute downstream.'
	},
	maxTokens: {
		title: 'Max tokens',
		text: 'How many tokens (word-pieces) the model can process in a single input. Larger is usually better for long-context tasks.'
	}
} as const;
