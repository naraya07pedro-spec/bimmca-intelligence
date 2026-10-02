# Supabase refresh visibility and request coordination

This is a source-hardening case from BIMMCA's browser consumer, verified with offline DOM/Supabase doubles. It is not evidence of a historical Supabase outage, private ingestion pipeline or customer impact.

## Context and failure

The browser fetches Gemini rows and refetches on postgres_changes. Before the hardening in [PR 5](https://github.com/naraya07pedro-spec/bimmca-intelligence/pull/5), a failed Realtime refresh logged the error while the displayed data could still look live. Concurrent callbacks could also launch overlapping queries. Empty results and missing focal-brand data needed explicit display states.

## Root cause and fix

The initial-load path and subsequent-refresh path did not share explicit state handling or an in-flight coordinator. [Merged hardening a8f88a3](https://github.com/naraya07pedro-spec/bimmca-intelligence/commit/a8f88a34801ace8258de194f9b7e9967eaa75808) retains the last successful data on refresh failure, marks it STALE · REFRESH ERROR, and coalesces concurrent changes into one follow-up refetch. Empty queries clear old metrics; absent focal brands render no rank; invalid numeric values do not silently become zero.

## Safeguard and verified result

The [actual inline-script tests](../tests/dashboard.test.mjs) force a failed refresh and assert unchanged prior table content plus the stale label. A delayed-response fixture triggers concurrent events and verifies one in-flight query followed by one coalesced refetch. The nine-test suite also checks initial failure, empty data, absent focal brand and invalid numeric inputs.

## Limitations

These are offline implementation tests. They do not establish live database authorization, RLS, ingestion schedules, metric provenance, browser end-to-end behavior or outage recovery. A lone failed refresh does not have an automatic retry schedule. Query filtering is not an authorization boundary. See [architecture](ARCHITECTURE.md).

[VAREVANT flagship](https://github.com/naraya07pedro-spec/varevant.com/blob/main/n8n/FLAGSHIP-CASE-STUDY.md) · [Integration reliability reference](https://github.com/naraya07pedro-spec/production-integration-reference/blob/main/docs/RELIABILITY-REVIEW.md)
