#!/usr/bin/env node
// List Badlands Morse bug reports from Firestore (collection bugReports), newest first.
// Uses the read-only ga4-reader service account (GA4_SA_KEY). It needs the "Cloud Datastore Viewer" role
// in Google Cloud IAM for project bunker-decoder.
//
//   node scripts/bug-reports.mjs           table + counts by category, language and mode
//   node scripts/bug-reports.mjs --json    every report as JSON (for deeper analysis)
//   node scripts/bug-reports.mjs --csv     every report as CSV

import { loadKey, accessToken } from './google-auth.mjs';

const BASE = 'https://firestore.googleapis.com/v1/projects/bunker-decoder/databases/(default)/documents/bugReports';
const FIELDS = ['category', 'message', 'contact', 'lang', 'mode', 'grid', 'code', 'pin', 'raw', 'community', 'screen', 'ua', 'page', 'appVersion'];

const token = await accessToken(loadKey(), 'https://www.googleapis.com/auth/datastore');
const reports = [];
let pageToken = '';
do {
  const r = await fetch(`${BASE}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json();
  if (!r.ok) throw new Error(`${j.error?.status} ${j.error?.message}${r.status === 403 ? ' (give ga4-reader the Cloud Datastore Viewer role)' : ''}`);
  for (const d of j.documents || []) {
    const o = { id: d.name.split('/').pop(), created: d.createTime };
    for (const f of FIELDS) o[f] = d.fields?.[f]?.stringValue ?? '';
    reports.push(o);
  }
  pageToken = j.nextPageToken || '';
} while (pageToken);
reports.sort((a, b) => b.created.localeCompare(a.created));

const mode = process.argv[2];
if (mode === '--json') { console.log(JSON.stringify(reports, null, 2)); process.exit(0); }
if (mode === '--csv') {
  const cols = ['created', 'id', ...FIELDS], q = v => `"${String(v).replace(/"/g, '""')}"`;
  console.log(cols.join(',')); for (const r of reports) console.log(cols.map(c => q(r[c])).join(',')); process.exit(0);
}
console.log(`${reports.length} bug report(s)\n`);
const count = k => Object.entries(reports.reduce((m, r) => (m[r[k] || '-'] = (m[r[k] || '-'] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(' · ');
if (reports.length) {
  console.log('by category:', count('category')); console.log('by language:', count('lang')); console.log('by mode:    ', count('mode')); console.log('by community:', count('community'), '\n');
  for (const r of reports) {
    console.log(`${r.created.slice(0, 16).replace('T', ' ')}  [${r.category}] ${r.lang} ${r.mode || '-'}  grid ${r.grid || '-'} code ${r.code || '-'}${r.contact ? '  from ' + r.contact : ''}`);
    console.log(`  ${r.message.replace(/\s+/g, ' ')}`);
  }
}
