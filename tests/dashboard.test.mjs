import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).filter(source => source.trim());
assert.equal(scripts.length, 1, 'Review harness if inline scripts are split');
const source = new Script(scripts[0], { filename: 'dashboard-inline.js' });
const fixture = JSON.parse(readFileSync(new URL('./fixtures/brand-metrics.json', import.meta.url)));

async function harness(responses = [{ data: structuredClone(fixture), error: null }]) {
  const nodes = new Map();
  const queryCalls = [];
  const errors = [];
  let subscription;
  let clientOptions;
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { textContent: '', innerHTML: '', style: {} });
    return nodes.get(selector);
  };
  const client = {
    from(table) {
      return { select(columns) { return { async eq(field, value) {
        queryCalls.push({ table, columns, field, value });
        const result = responses.shift();
        assert.ok(result, 'Unexpected query beyond provided responses');
        return await result;
      } }; } };
    },
    channel(name) {
      return { on(event, filter, callback) {
        subscription = { name, event, filter, callback };
        return { subscribe(statusCallback) { subscription.statusCallback = statusCallback; } };
      } };
    },
  };
  const context = createContext({
    document: { querySelector: element, querySelectorAll: () => [] },
    window: {},
    console: { error: error => errors.push(error) },
    supabase: { createClient(_url, _key, options) { clientOptions = options; return client; } },
  });
  source.runInContext(context);
  await new Promise(resolve => setImmediate(resolve));
  return { element, queryCalls, errors, subscription, clientOptions, context };
}

test('initial success queries only the Gemini consumer table and disables persisted auth sessions', async () => {
  const h = await harness();
  assert.deepEqual(h.queryCalls, [{ table: 'brand_metrics_latest', columns: '*', field: 'platform', value: 'gemini' }]);
  assert.equal(h.clientOptions.auth.persistSession, false);
  assert.equal(h.element('#status').textContent, 'LIVE · GEMINI');
});

test('ranks by authority without mutating input and renders the focal brand', async () => {
  const rows = structuredClone(fixture);
  const h = await harness([{ data: rows, error: null }]);
  assert.equal(rows[0].brand, 'NIVEA');
  assert.match(h.element('#headline').textContent, /NIVEA is #2\. Example Brand leads/);
  assert.match(h.element('#kpis').innerHTML, /60\.0/);
  assert.equal(h.element('#overviewTable').innerHTML, h.element('#competitorTable').innerHTML);
  assert.ok(h.element('#overviewTable').innerHTML.indexOf('Example Brand') < h.element('#overviewTable').innerHTML.indexOf('NIVEA'));
});

test('renders an explicit empty state and clears previous metric surfaces', async () => {
  const h = await harness([{ data: fixture, error: null }, { data: [], error: null }]);
  await h.subscription.callback();
  assert.equal(h.element('#status').textContent, 'NO DATA · GEMINI');
  assert.match(h.element('#headline').textContent, /No Gemini metrics/);
  assert.match(h.element('#overviewTable').innerHTML, /No Gemini metrics available/);
  assert.equal(h.element('#kpis').innerHTML, '');
});

test('does not render an invalid #0 rank when the focal brand is missing', async () => {
  const withoutFocal = structuredClone(fixture).filter(row => row.brand !== 'NIVEA');
  const h = await harness([{ data: withoutFocal, error: null }]);
  assert.match(h.element('#headline').textContent, /NIVEA is not present/);
  assert.doesNotMatch(h.element('#headline').textContent, /#0/);
  assert.doesNotMatch(h.element('#kpis').innerHTML, /#0/);
});

test('normalizes invalid and missing numeric values and clamps bar widths', async () => {
  const rows = structuredClone(fixture);
  rows[0].visibility_score = null;
  rows[0].share_of_voice = 'invalid';
  rows[1].visibility_score = 150;
  const h = await harness([{ data: rows, error: null }]);
  assert.match(h.element('#overviewTable').innerHTML, /—/);
  assert.match(h.element('#authorityBars').innerHTML, /width:0%;/);
  assert.match(h.element('#authorityBars').innerHTML, /width:100%;/);
  assert.equal(new Script('fmt(null)').runInContext(h.context), '—');
  assert.equal(new Script("fmt('invalid')").runInContext(h.context), '—');
});

test('refetches the filtered dataset after a table change', async () => {
  const updated = structuredClone(fixture);
  updated[0].visibility_score = 90;
  const h = await harness([{ data: fixture, error: null }, { data: updated, error: null }]);
  assert.equal(h.subscription.name, 'bimmca-live');
  assert.equal(h.subscription.event, 'postgres_changes');
  assert.deepEqual(JSON.parse(JSON.stringify(h.subscription.filter)), { event: '*', schema: 'public', table: 'brand_metrics_latest' });
  await h.subscription.callback();
  assert.equal(h.queryCalls.length, 2);
  assert.deepEqual(h.queryCalls[0], h.queryCalls[1]);
  assert.match(h.element('#headline').textContent, /NIVEA is #1/);
});

test('surfaces an initial query failure and does not subscribe', async () => {
  const error = new Error('synthetic query failure');
  const h = await harness([{ data: null, error }]);
  assert.equal(h.element('#status').textContent, 'LIVE DATA ERROR');
  assert.equal(h.element('#sampleNote').textContent, 'Could not load current Supabase metrics.');
  assert.equal(h.element('#dot').style.background, '#d94f5d');
  assert.equal(h.subscription, undefined);
  assert.deepEqual(h.errors, [error]);
});

test('marks the current view stale when a realtime refetch fails', async () => {
  const error = new Error('synthetic refresh failure');
  const h = await harness([{ data: fixture, error: null }, { data: null, error }]);
  const before = h.element('#overviewTable').innerHTML;
  await h.subscription.callback();
  assert.equal(h.element('#overviewTable').innerHTML, before);
  assert.equal(h.element('#status').textContent, 'STALE · REFRESH ERROR');
  assert.match(h.element('#sampleNote').textContent, /last successful sample/);
  assert.deepEqual(h.errors, [error]);
});

test('coalesces concurrent realtime change events into one follow-up refetch', async () => {
  let resolveRefresh;
  const firstRefresh = new Promise(resolve => { resolveRefresh = resolve; });
  const updated = structuredClone(fixture);
  updated[0].visibility_score = 91;
  const h = await harness([
    { data: fixture, error: null },
    firstRefresh,
    { data: updated, error: null },
  ]);
  const p1 = h.subscription.callback();
  const p2 = h.subscription.callback();
  assert.equal(h.queryCalls.length, 2);
  resolveRefresh({ data: fixture, error: null });
  await Promise.all([p1, p2]);
  assert.equal(h.queryCalls.length, 3);
  assert.match(h.element('#headline').textContent, /NIVEA is #1/);
});
