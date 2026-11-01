// Shared sign-in for the read-only ga4-reader service account.
// The key comes from the GA4_SA_KEY environment variable (whole JSON, base64 JSON, or bare PEM); it is never printed.
import crypto from 'node:crypto';

const DEFAULT_EMAIL = 'ga4-reader@bunker-decoder.iam.gserviceaccount.com';

// Accepts the whole JSON key file (preferred), base64 of it, or just the PEM private key.
export function loadKey() {
  let raw = (process.env.GA4_SA_KEY || '').trim();
  if (!raw) throw new Error('GA4_SA_KEY is not set in this environment.');
  if (/^(['"]).*\1$/s.test(raw)) raw = raw.slice(1, -1).trim();            // stray surrounding quotes
  if (!raw.startsWith('{') && raw.includes('BEGIN PRIVATE KEY')) {
    return { client_email: process.env.GA4_SA_EMAIL || DEFAULT_EMAIL, private_key: raw.replace(/\\n/g, '\n') };
  }
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const key = JSON.parse(json);
  if (!key.client_email || !key.private_key) throw new Error('GA4_SA_KEY is not a service account JSON key.');
  return key;
}

export async function accessToken(key, scope = 'https://www.googleapis.com/auth/analytics.readonly') {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: key.client_email, scope,
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
