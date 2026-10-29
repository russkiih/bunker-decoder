# Bunker Decoder

Single-page web app that decodes a Morse-code radio broadcast into a six-digit grid reference and a four-digit keypad code. Three input modes: live microphone listening, a two-key (short/long) pad, and a timed paddle. Everything runs in the browser; nothing is recorded or sent anywhere.

Live: https://bunker-decoder.web.app

## Languages

English, Russian, German, Polish, Spanish, French and Brazilian Portuguese. The app opens in the phone's language and has a picker in the header. A link can force one with `?lang=`, for example `https://bunker-decoder.web.app/?lang=ru`. Translations live in the `STR` table in `public/index.html`.

## Analytics and launch

Firebase Analytics (GA4) logs six events, each tagged with the first-touch Discord community from the link's `utm_campaign`. See [docs/launch-and-metrics.md](docs/launch-and-metrics.md) for the event list, the one-time console setup, the per-community launch links and the two-week review.

## Deploy

```
npm i -g firebase-tools
firebase login
firebase deploy --only hosting
```

`firebase.json` serves `public/` with `Permissions-Policy: microphone=(self)` (needed for the Listen mode) and `Cache-Control: no-cache`.
