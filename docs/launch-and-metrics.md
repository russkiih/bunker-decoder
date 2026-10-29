# Launch and metrics playbook

How Badlands Morse is wired for analytics, how to post it to the three Discords, and what to review after two weeks.

## 1. One-time setup (manual, in consoles)

1. **Turn on Google Analytics.** Done: the project is linked to GA4 measurement ID `G-EPL6087MJ8`, which is set in `public/analytics.js`.
2. **Custom dimensions.** Done on Oct 29, 2026: `community`, `mode` and `digits` are registered as event-scoped custom dimensions in GA4, so explorations can break events down by them from that date on.
3. **Optional: BigQuery export.** Firebase console → Project settings → Integrations → BigQuery → Link, with Google Analytics export on. Needed only for the SQL in section 5.
4. **Credit.** Done: `CREDIT` in `public/index.html` is set to Twitch `geezlys`, shown in the footer and About dialog, and in the README. Add a `name` there if you want "Built by <name>" in the About line.
5. **Check the Discord embed.** DM yourself `https://badlands-morse.web.app/` in Discord before posting anywhere. You should see the title, description and the grid/code image. Discord caches embeds hard, so if you ever change the image, save it as `og-image-v4.png` and update the four `og:image` / `twitter:image` meta tags.

## 2. Events

Every event carries the same three parameters.

| Parameter | Values |
|---|---|
| `community` | First-touch `utm_campaign`, for example `karmakrew`, `dayzero`, `dayone`, or `direct` when the visitor never arrived with one |
| `mode` | `audio` for Listen, `paddle` for Two-key and Paddle |
| `digits` | Digits decoded so far, 0 to 10; always 10 on `decode_success` |

| Event | Fires when |
|---|---|
| `listen_started` | The microphone is granted and listening starts |
| `paddle_used` | Keyed input starts (Two-key or Paddle), once per decode |
| `decode_success` | All ten slots are filled and lined up into grid + code, once per decode |
| `decode_fail` | A symbol group or tone sequence is not a digit; at most 10 per decode so noise cannot flood the property |
| `copy_grid` | The grid Copy button is tapped |
| `copy_code` | The keypad Copy button is tapped |

**Consent.** Analytics does not load until the player taps Allow on the consent bar. Events from before that choice wait in memory: Allow sends them, No thanks drops them. The footer's Privacy link reopens the bar so the choice can be changed. Advertising signals are always off. Expect GA4 numbers to cover only players who allowed, so compare communities by ratios (copies per decode, fails per success) rather than raw totals.

First touch is stored in `localStorage` under `community` and is never overwritten by a later UTM link. A player who first arrived from KarmaKrew stays `karmakrew` even if they later click the DayOne post.

## 3. Discord rollout

One canonical URL, one UTM string per community:

```
KarmaKrew  https://badlands-morse.web.app/?utm_source=discord&utm_medium=community&utm_campaign=karmakrew&utm_content=launch
DayZero    https://badlands-morse.web.app/?utm_source=discord&utm_medium=community&utm_campaign=dayzero&utm_content=launch
DayOne     https://badlands-morse.web.app/?utm_source=discord&utm_medium=community&utm_campaign=dayone&utm_content=launch
```

Reddit gets its own link and shows up as its own `reddit` cohort:

```
Reddit     https://badlands-morse.web.app/?utm_source=reddit&utm_medium=social&utm_campaign=reddit&utm_content=launch
```

For Reddit, read each subreddit's rules on self-promotion first, post once with a short clip or screenshot of a real decode, use the right flair, and stay in the comments to answer questions.

Rules for each server:

- Post once, in the designated tools, community-tools or content-creator channel. Read the pinned rules first.
- If the server has modmail or a tool-submission bot, use that instead of posting directly.
- No @everyone, no repeated bumps, no DM blasts.
- If a mod pins it, great. Otherwise answer questions in a thread and let the tool do the talking.

Post template (one short paragraph, one screenshot or 15-second clip of a real decode showing the grid and code, the UTM link):

> Made a free decoder for the Badlands bunker radio. Hold your phone to the speaker and it turns the Morse broadcast into the 6-digit grid and 4-digit keypad code, or key it in by hand if you'd rather. It checks each digit against the repeat so you know when it's safe to use. Works in the browser, nothing to install: `<community UTM link>`
>
> I stream the DayZ side of this at twitch.tv/geezlys

The Twitch line is the only Twitch mention in the launch copy. Post a native clip in Discord rather than linking a player.

## 4. What stays off the decoder page

- No Twitch embed or autoplay player: it is a heavy iframe, competes with the grid and code, and slows mobile.
- No live Twitch badge for launch: it would need a Cloud Function holding Twitch credentials, an app token cache and Helix polling.
- No live-by-country counter or presence map. Country data stays in the private analytics dashboard. If a public aggregate is wanted later, add a cached "decodes today" counter through a Cloud Function with App Check, shown only once it passes 20.

## 5. Live view

GA4 → Reports → Realtime shows active users, events and countries for the last 30 minutes, about a minute behind. The Google Analytics phone app shows the same Realtime view. Full reports and explorations fill in 24 to 48 hours later. There is deliberately no live counter on the page itself (see section 4).

## 6. Two-week review

Build three explorations in GA4 → Explore → Free form (or in Firebase Analytics → Events):

1. **Who decodes.** Rows: `community`, `mode`. Values: Event count. Filter: event name exactly `decode_success`. Shows whether KarmaKrew, DayZero or DayOne users actually decode, and whether audio or paddle converts better.
2. **Who takes the output.** Rows: `community`. Columns: Event name. Values: Event count. Filter: event name is one of `copy_grid`, `copy_code`. Shows whether people copy one, both, or just browse.
3. **Where decoding struggles.** Rows: `mode`. Columns: Event name. Values: Event count. Filter: event name is one of `decode_fail`, `decode_success`. Divide fail by success per mode to see whether audio thresholds or paddle timing need tuning.

**Last month by country**, in GA4: add dimension *Country* to exploration 1 with the date range set to last month. Or in BigQuery once export is on:

```sql
-- decode_success by country, previous calendar month
SELECT
  FORMAT_DATE('%Y-%m', PARSE_DATE('%Y%m%d', event_date)) AS month,
  geo.country AS country,
  COUNT(*) AS decodes
FROM `bunker-decoder.analytics_561527723.events_*`
WHERE event_name = 'decode_success'
  AND _TABLE_SUFFIX BETWEEN
      FORMAT_DATE('%Y%m%d', DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 MONTH))
  AND FORMAT_DATE('%Y%m%d', DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 DAY))
GROUP BY month, country
ORDER BY decodes DESC;
```

```sql
-- fail-to-success ratio by community and mode, all time
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'community') AS community,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'mode') AS mode,
  COUNTIF(event_name = 'decode_success') AS successes,
  COUNTIF(event_name = 'decode_fail') AS fails,
  ROUND(SAFE_DIVIDE(COUNTIF(event_name = 'decode_fail'), COUNTIF(event_name = 'decode_success')), 2) AS fails_per_success
FROM `bunker-decoder.analytics_561527723.events_*`
WHERE event_name IN ('decode_success', 'decode_fail')
GROUP BY community, mode
ORDER BY successes DESC;
```
