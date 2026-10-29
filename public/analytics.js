// Bunker Decoder analytics: Firebase Analytics (GA4) plus first-touch community tagging.
// Loaded as an ES module. If the SDK is blocked or unsupported, every call becomes a no-op
// and the decoder keeps working.

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';

// Public web config for the bunker-decoder Firebase project (GA4 measurement ID included).
const firebaseConfig = {
  apiKey: 'AIzaSyDux_0DbSaXiSLUt-D4KopT3LT8tSAHX3I',
  authDomain: 'bunker-decoder.firebaseapp.com',
  projectId: 'bunker-decoder',
  storageBucket: 'bunker-decoder.firebasestorage.app',
  messagingSenderId: '1016979602645',
  appId: '1:1016979602645:web:b9953646dae4311c7bb65c',
  measurementId: 'G-EPL6087MJ8',
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const COMMUNITY_KEY = 'community';

/** Read the four UTM params from the current URL. */
export function readUtm() {
  const out = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of UTM_KEYS) { const v = q.get(k); if (v) out[k] = v; }
  } catch {}
  return out;
}

/** First touch wins: store utm_campaign as the community only if nothing is stored yet. */
export function captureFirstTouch() {
  const utm = readUtm();
  if (utm.utm_campaign) {
    const value = utm.utm_campaign.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    try { if (value && !localStorage.getItem(COMMUNITY_KEY)) localStorage.setItem(COMMUNITY_KEY, value); } catch {}
  }
  return utm;
}

/** The cohort every event is tagged with. */
export function community() {
  try { return localStorage.getItem(COMMUNITY_KEY) || 'direct'; } catch { return 'direct'; }
}

// getAnalytics(app) runs once; every caller shares this promise.
let ready = null;
export function initAnalytics() {
  if (ready) return ready;
  if (typeof window === 'undefined') return Promise.resolve(null);
  ready = (async () => {
    try {
      const [appSdk, analyticsSdk] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-analytics.js'),
      ]);
      if (!(await analyticsSdk.isSupported())) return null;
      const app = appSdk.getApps()[0] || appSdk.initializeApp(firebaseConfig);
      return { analytics: analyticsSdk.getAnalytics(app), logEvent: analyticsSdk.logEvent };
    } catch {
      return null;
    }
  })();
  return ready;
}

/** Log one event with the three standard params: community, mode (audio|paddle), digits. */
export async function track(name, { mode, digits }) {
  const params = { community: community(), mode, digits };
  const fb = await initAnalytics();
  if (fb) fb.logEvent(fb.analytics, name, params);
}

export const logListenStarted = p => track('listen_started', p);
export const logPaddleUsed    = p => track('paddle_used', p);
export const logDecodeSuccess = p => track('decode_success', { ...p, digits: 10 });
export const logDecodeFail    = p => track('decode_fail', p);
export const logCopyGrid      = p => track('copy_grid', p);
export const logCopyCode      = p => track('copy_code', p);

const EVENTS = {
  listen_started: logListenStarted, paddle_used: logPaddleUsed,
  decode_success: logDecodeSuccess, decode_fail: logDecodeFail,
  copy_grid: logCopyGrid, copy_code: logCopyCode,
};

// Wire up the page: tag first touch, start analytics, then drain events queued before this loaded.
if (typeof window !== 'undefined') {
  captureFirstTouch();
  initAnalytics();
  const send = (name, p) => { const fn = EVENTS[name]; if (fn) fn(p); };
  const queued = window.bdQ || [];
  window.bdTrack = send;
  window.bdQ = [];
  for (const [name, p] of queued) send(name, p);
}
