export type AnalyticsEventName =
	| 'page_view'
	| 'search_changed'
	| 'filter_changed'
	| 'sort_changed'
	| 'tab_selected'
	| 'model_pinned'
	| 'model_unpinned'
	| 'compare_opened'
	| 'compare_model_changed'
	| 'csv_downloaded'
	| 'share_link_copied'
	| 'external_link_clicked';

export interface PageContext {
	path: string;
	queryKeys: string[];
}

export interface AnalyticsPayloads {
	page_view: {
		path: string;
		queryKeys: string[];
		title?: string;
		referrer?: string;
	};
	search_changed: {
		page: string;
		queryLength: number;
		resultCount?: number;
		totalCount?: number;
	};
	filter_changed: {
		page: string;
		filter: string;
		selectedCount?: number;
		totalCount?: number;
		resultCount?: number;
	};
	sort_changed: {
		table: string;
		field: string | null;
		dir: 'asc' | 'desc';
	};
	tab_selected: {
		page: string;
		tab: string;
	};
	model_pinned: {
		model: string;
	};
	model_unpinned: {
		model: string;
	};
	compare_opened: {
		source: string;
		modelCount: number;
		benchmark?: string | null;
	};
	compare_model_changed: {
		action: 'added' | 'removed' | 'cleared';
		modelCount: number;
	};
	csv_downloaded: {
		filename: string;
		rowCount: number;
	};
	share_link_copied: {
		path: string;
	};
	external_link_clicked: {
		href: string;
		label?: string;
		location: string;
	};
}

export interface AnalyticsEvent<N extends AnalyticsEventName = AnalyticsEventName> {
	eventName: N;
	id: string;
	page: PageContext;
	payload: AnalyticsPayloads[N];
	sentAt: string;
}
