# Browser architecture and data contract

This document describes the JavaScript in [index.html](../index.html). It does not reconstruct a private backend.

## Source-backed flow

~~~mermaid
flowchart TD
    A["Browser load()"] --> B["Supabase client: no persisted auth session"]
    B --> C["brand_metrics_latest: platform = gemini"]
    C --> D{"Query result"}
    D -->|Rows| E["Normalize, sort, and render metrics"]
    D -->|Empty| F["Explicit NO DATA state"]
    D -->|Initial error| G["Visible data error"]
    E --> H["Subscribe to table changes"]
    F --> H
    H --> I["Coalesced full Gemini refetch"]
    I -->|Success| D
    I -->|Error| J["Keep last successful view + mark STALE"]
~~~

The application registers a postgres_changes callback for all events on public.brand_metrics_latest. Change events trigger a filtered refetch rather than applying the event payload directly. While one refetch is in flight, additional events are coalesced into at most one follow-up refetch.

Query filtering is not an authorization boundary; backend access policies are outside this repository. The application remains a static HTML/CSS/JavaScript page using the Supabase client from a CDN. There is no server application, bundler, database migration, or published ingestion worker here.

## Consumer contract, not a database schema

The fields below are derived from query and rendering expressions. Their PostgreSQL types, nullability, uniqueness, constraints, calculation methods, and RLS policies are **UNKNOWN**.

| Field | Consumer use | Defensive behavior |
| --- | --- | --- |
| platform | Query equality filter | Query is fixed to gemini |
| brand | Label, colour lookup, focal-brand lookup | Missing focal brand produces no rank instead of #0; rendered labels are HTML-escaped |
| visibility_score | Descending rank, display, bar width | Invalid/missing values do not become display zero; bar width is clamped to 0–100 |
| share_of_voice | Percentage display | Invalid/missing values render as an em dash |
| avg_position | Position display | Invalid/missing values render as an em dash |
| top1_rate | Percentage display | Invalid/missing values render as an em dash |
| recommendation_rate | Table percentage display | Invalid/missing values render as an em dash |
| positive_sentiment | Percentage display | Invalid/missing values render as an em dash |
| updated_at | Last-data timestamp | Invalid timestamps are ignored |

[brand-metrics.json](../tests/fixtures/brand-metrics.json) is a small synthetic query-result example. It is not a database export or evidence of monitoring results.

## Runtime states

| Situation | Current source behavior |
| --- | --- |
| Initial success | Renders normalized rows and marks the view LIVE · GEMINI |
| Initial query failure | Shows LIVE DATA ERROR and explanatory text |
| Empty result | Clears prior metric surfaces and shows an explicit NO DATA · GEMINI state |
| Focal brand absent | Renders no focal rank and explicitly states that NIVEA is absent |
| Realtime refetch succeeds | Replaces rows and returns to LIVE · GEMINI |
| Realtime refetch fails | Keeps the last successful view, marks it STALE · REFRESH ERROR, and logs the error |
| Concurrent change events | One in-flight refetch is allowed; additional events are coalesced into one follow-up query |
| Missing/nonnumeric metric | Renders an em dash rather than silently converting null to zero |

## Tests and practical limits

[dashboard.test.mjs](../tests/dashboard.test.mjs) executes the actual inline script with local DOM/Supabase doubles. Tests cover initial success/error, empty results, missing focal brand, realtime success/failure, concurrent change coalescing, and invalid numeric values.

No real database or browser session is involved. Correct metric definitions, upstream ingestion, backend access policy review, retry scheduling after a lone failed refetch, and browser/database integration checks remain separate work.
