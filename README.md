# BIMMCA Intelligence

JavaScript dashboard for comparing sampled AI recommendation metrics. The public implementation reads Gemini rows from Supabase and refreshes the view on database change notifications.

**Scope:** this repository contains the browser consumer. Database migrations, row-level security policies, metric calculation, raw AI responses, and n8n ingestion workflows are not included or runtime-verified here.

## Technical review path

1. [`index.html`](index.html) — inline `load()`, `render()`, ranking, and Realtime callback.
2. [`tests/dashboard.test.mjs`](tests/dashboard.test.mjs) — offline tests of the actual inline script with DOM/Supabase doubles.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — source-backed data flow, consumer contract, and known limitations.
4. [`tests/fixtures/brand-metrics.json`](tests/fixtures/brand-metrics.json) — synthetic input for tests, not historical monitoring evidence.
5. [`SECURITY.md`](SECURITY.md) — public-key boundary and private reporting.
6. [GitHub Actions](https://github.com/naraya07pedro-spec/bimmca-intelligence/actions/workflows/public-surface-check.yml) — HTML, source safety, documentation, and offline test checks.

## Run and check

Use Node.js 24 for the dependency-free checks:

```bash
npm ci
npm test
npm run check
```

The tests do not contact Supabase, fetch the CDN, or require credentials. They execute the current inline JavaScript in a Node VM and cover success, initial failure, empty data, missing focal brand, realtime success/failure, concurrent change coalescing, and invalid numeric values; they are not browser end-to-end or database integration tests. There is no TypeScript project or build step in this static application.

To serve the application:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. The browser then loads the Supabase client from a CDN and uses the endpoint already configured in `index.html`; successful operation depends on network access and backend authorization. The repository does not provide a local database setup. Deployment configuration is in [`netlify.toml`](netlify.toml).

## What is verified

- The browser queries `brand_metrics_latest`, selects all columns, and filters `platform = gemini`.
- Rows are ranked by descending `visibility_score`; NIVEA is the focal brand in the current interface.
- A `postgres_changes` subscription triggers the same filtered query again.
- An initial query error is surfaced as `LIVE DATA ERROR`.
- Empty query results clear previous metrics and render an explicit `NO DATA · GEMINI` state.
- A missing NIVEA row does not render an invalid `#0` rank.
- Realtime refetch failures keep the last successful view but mark it `STALE · REFRESH ERROR`.
- Concurrent realtime change events are coalesced while a refetch is already in flight.
- Missing or nonnumeric metric values render defensively instead of silently becoming zero.

The UI also mentions `ai_responses`, `prompts`, and a 30-minute n8n schedule. Those are display text, not proof of tables, ingestion execution, or scheduler activity. Static strategy copy and `LIVE` indicators do not verify metric provenance or freshness. See the [architecture and limitations](docs/ARCHITECTURE.md) before drawing operational conclusions.

## Evidence boundary

Test fixtures are synthetic. No public backend schema, n8n execution screenshot, or ingestion log is supplied for BIMMCA. The Supabase client integration is inspectable; live data correctness, RLS, uptime, production traffic, client impact, and business outcomes remain unverified.

Related work: [Production Integration Reference](https://github.com/naraya07pedro-spec/production-integration-reference) · [VAREVANT](https://github.com/naraya07pedro-spec/varevant.com).
