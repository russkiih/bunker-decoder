#!/usr/bin/env node
// Read Badlands Morse GA4 data with the read-only ga4-reader service account.
// The key comes from the GA4_SA_KEY environment variable (raw JSON or base64 JSON); it is never printed.
//
//   node scripts/ga4.mjs realtime        last 30 minutes: events and countries
//   node scripts/ga4.mjs report [days]   app events by community and mode, plus decodes by country (default 28 days)

import crypto from 'node:crypto';

const PROPERTY = '561527723';
const EVENTS = ['listen_started', 'paddle_used', 'decode_success', 'decode_fail', 'copy_grid', 'copy_code'];

function loadKey() {
  const raw = (process.env.GA4_SA_KEY || '').trim();
  if (!raw) throw new Error('GA4_SA_KEY is not set in this environment.');
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const key = JSON.parse(json);
  if (!key.client_email || !key.private_key) throw new Error('GA4_SA_KEY is not a service account JSON key.');
  return key;
}

async function accessToken(key) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const jwt = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Token exchange failed: ${j.error} ${j.error_description || ''}`);
  return j.access_token;
}

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
