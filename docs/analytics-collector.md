# Analytics Collector Contract

The leaderboard frontend sends anonymous behavior events to an independent collector.
The browser never connects to MongoDB directly.

## Endpoint

`POST /v1/events/batch`

```json
{
	"visitorId": "anonymous stable id from localStorage",
	"sessionId": "anonymous tab/session id from sessionStorage",
	"events": [
		{
			"id": "event uuid",
			"eventName": "page_view",
			"sentAt": "2026-06-23T01:00:00.000Z",
			"page": {
				"path": "/models",
				"queryKeys": ["q"]
			},
			"payload": {
				"path": "/models",
				"queryKeys": ["q"],
				"title": "Models",
				"referrer": "https://example.com/"
			}
		}
	]
}
```

The frontend intentionally sends query parameter names, not query values.
Search events send `queryLength`, not the raw search text.

## Event Envelope

Every item in `events` uses the same envelope:

```json
{
	"id": "event uuid",
	"eventName": "csv_downloaded",
	"sentAt": "2026-06-23T01:00:00.000Z",
	"page": {
		"path": "/benchmark/MTEB%28eng%2C%20v2%29",
		"queryKeys": ["tab", "pin"]
	},
	"payload": {}
}
```

- `id`: client-generated event id.
- `eventName`: one of the supported event names below.
- `sentAt`: client timestamp in ISO 8601 format.
- `page.path`: current browser pathname.
- `page.queryKeys`: sorted query parameter names only; query values are intentionally omitted.
- `payload`: event-specific fields.

## Event Dictionary

### `page_view`

Recorded after SvelteKit navigation, including the initial client-side route.

```json
{
	"eventName": "page_view",
	"payload": {
		"path": "/models",
		"queryKeys": ["q", "mtypes"],
		"title": "Models | MTEB",
		"referrer": "https://www.google.com/"
	}
}
```

Fields:

- `path`: current pathname.
- `queryKeys`: query parameter names only.
- `title`: browser document title when available.
- `referrer`: browser referrer when available.

### `search_changed`

Recorded when the user changes a search query through the shared filter store.
The raw search text is never sent.

```json
{
	"eventName": "search_changed",
	"payload": {
		"page": "/models",
		"queryLength": 12,
		"resultCount": 87,
		"totalCount": 1732
	}
}
```

Fields:

- `page`: current pathname.
- `queryLength`: trimmed search string length.
- `resultCount`: matching result count when the caller has it.
- `totalCount`: full result count when the caller has it.

### `filter_changed`

Recorded when the user changes model, task, benchmark-scope, or reset filters.

```json
{
	"eventName": "filter_changed",
	"payload": {
		"page": "/benchmark/MTEB%28eng%2C%20v2%29",
		"filter": "languages",
		"selectedCount": 3,
		"totalCount": 12,
		"resultCount": 245
	}
}
```

Fields:

- `page`: current pathname.
- `filter`: filter key, for example `languages`, `modelTypes`, `availability`, `zeroShot`, or `model_filters_reset`.
- `selectedCount`: selected value count for set-style filters.
- `totalCount`: available value count for set-style filters.
- `resultCount`: filtered row count when the caller has it.

### `sort_changed`

Recorded when a sortable table header changes sort state.

```json
{
	"eventName": "sort_changed",
	"payload": {
		"table": "summary",
		"field": "meanTask",
		"dir": "desc"
	}
}
```

Fields:

- `table`: table namespace, derived from the URL sort key.
- `field`: active sort field; `null` means default sort.
- `dir`: `asc` or `desc`.

### `tab_selected`

Recorded when the user changes a tab, including keyboard tab navigation.

```json
{
	"eventName": "tab_selected",
	"payload": {
		"page": "/benchmark/MTEB%28eng%2C%20v2%29",
		"tab": "perf_task"
	}
}
```

Fields:

- `page`: current pathname.
- `tab`: selected tab id.

### `model_pinned`

Recorded when the user pins a model row.

```json
{
	"eventName": "model_pinned",
	"payload": {
		"model": "sentence-transformers/all-MiniLM-L6-v2"
	}
}
```

Fields:

- `model`: canonical model name.

### `model_unpinned`

Recorded when the user unpins a model row.

```json
{
	"eventName": "model_unpinned",
	"payload": {
		"model": "sentence-transformers/all-MiniLM-L6-v2"
	}
}
```

Fields:

- `model`: canonical model name.

### `compare_opened`

Recorded when the user opens or lands on the compare experience.

```json
{
	"eventName": "compare_opened",
	"payload": {
		"source": "pinned_chip",
		"modelCount": 3,
		"benchmark": "MTEB(eng, v2)"
	}
}
```

Fields:

- `source`: source surface, currently `pinned_chip` or `compare_page`.
- `modelCount`: number of selected models at open time.
- `benchmark`: selected benchmark name when available.

### `compare_model_changed`

Recorded when the user adds, removes, or clears models in the compare page.

```json
{
	"eventName": "compare_model_changed",
	"payload": {
		"action": "added",
		"modelCount": 2
	}
}
```

Fields:

- `action`: `added`, `removed`, or `cleared`.
- `modelCount`: selected model count after the change.

### `csv_downloaded`

Recorded when a CSV export button successfully builds and starts a browser download.

```json
{
	"eventName": "csv_downloaded",
	"payload": {
		"filename": "MTEB_eng_v2_summary",
		"rowCount": 642
	}
}
```

Fields:

- `filename`: base CSV filename before the helper appends `.csv`.
- `rowCount`: exported data row count, excluding headers.

### `share_link_copied`

Recorded after the share button successfully writes the current URL to the clipboard.

```json
{
	"eventName": "share_link_copied",
	"payload": {
		"path": "/benchmark/MTEB%28eng%2C%20v2%29"
	}
}
```

Fields:

- `path`: current pathname.

### `external_link_clicked`

Recorded when the user clicks an outbound link.

```json
{
	"eventName": "external_link_clicked",
	"payload": {
		"href": "https://github.com/embeddings-benchmark/mteb/",
		"label": "MTEB",
		"location": "header"
	}
}
```

Fields:

- `href`: absolute outbound URL.
- `label`: trimmed visible link text or title, capped by the frontend.
- `location`: coarse surface, currently `header`, `footer`, or `content`.

## Server Responsibilities

- Validate event names and payload shape.
- Rate limit by IP and visitor id.
- Add `receivedAt`, `ipHash`, `userAgent`, `referer`, and coarse `geo` fields.
- Resolve location from the request IP on the server side only.
- Drop or quarantine invalid batches instead of trusting browser data.

## MongoDB

Suggested collection: `analytics_events`.

Suggested indexes:

- `{ receivedAt: -1 }`
- `{ visitorId: 1, receivedAt: -1 }`
- `{ sessionId: 1, receivedAt: -1 }`
- `{ eventName: 1, receivedAt: -1 }`
- `{ "page.path": 1, receivedAt: -1 }`
- `{ "geo.country": 1, receivedAt: -1 }`

For dashboards, build daily/hourly aggregates into `analytics_daily_metrics` rather than scanning raw events for every view.
