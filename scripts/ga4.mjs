#!/usr/bin/env node
// Read Badlands Morse GA4 data with the read-only ga4-reader service account.
// The key comes from the GA4_SA_KEY environment variable (raw JSON or base64 JSON); it is never printed.
//
//   node scripts/ga4.mjs realtime        last 30 minutes: events and countries
//   node scripts/ga4.mjs report [days]   app events by community and mode, plus decodes by country (default 28 days)

import { loadKey, accessToken } from './google-auth.mjs';

const PROPERTY = '561527723';
const EVENTS = ['listen_started', 'paddle_used', 'decode_success', 'decode_fail', 'copy_grid', 'copy_code'];

async function run(token, method, body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:${method}`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method}: ${j.error?.status} ${j.error?.message}`);
  return j;
}

function table(title, res) {
  const head = [...(res.dimensionHeaders || []), ...(res.metricHeaders || [])].map(h => h.name.replace('customEvent:', ''));
  const rows = (res.rows || []).map(r => [...(r.dimensionValues || []), ...(r.metricValues || [])].map(v => v.value));
  console.log(`\n${title}`);
  if (!rows.length) return console.log('  (no data yet)');
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = r => '  ' + r.map((c, i) => c.padEnd(w[i])).join('  ');
  console.log(line(head)); console.log('  ' + w.map(n => '-'.repeat(n)).join('  ')); rows.forEach(r => console.log(line(r)));
}

const onlyAppEvents = { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } };

const [mode = 'realtime', daysArg] = process.argv.slice(2);
const token = await accessToken(loadKey());
if (mode === 'realtime') {
  table('Realtime, last 30 minutes: events', await run(token, 'runRealtimeReport', {
    dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }] }));
  table('Realtime, last 30 minutes: countries', await run(token, 'runRealtimeReport', {
    dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }] }));
} else if (mode === 'report') {
  const days = Math.max(1, parseInt(daysArg || '28', 10));
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
  table(`Last ${days} days: app events by community and mode`, await run(token, 'runReport', {
    dateRanges, dimensions: [{ name: 'eventName' }, { name: 'customEvent:community' }, { name: 'customEvent:mode' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: onlyAppEvents,
    orderBys: [{ dimension: { dimensionName: 'eventName' } }, { metric: { metricName: 'eventCount' }, desc: true }] }));
  table(`Last ${days} days: decodes by country`, await run(token, 'runReport', {
    dateRanges, dimensions: [{ name: 'country' }], metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'decode_success' } } },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 20 }));
  table(`Last ${days} days: first-touch campaign of visitors`, await run(token, 'runReport', {
    dateRanges, dimensions: [{ name: 'firstUserCampaignName' }], metrics: [{ name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }] }));
} else {
  console.log('Usage: node scripts/ga4.mjs realtime | report [days]');
}
