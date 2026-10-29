# Bunker Decoder

Single-page web app that decodes a Morse-code radio broadcast into a six-digit grid reference and a four-digit keypad code. Three input modes: live microphone listening, a two-key (short/long) pad, and a timed paddle. Everything runs in the browser; nothing is recorded or sent anywhere.

Live: https://bunker-decoder.web.app

## Deploy

```
npm i -g firebase-tools
firebase login
firebase deploy --only hosting
```

`firebase.json` serves `public/` with `Permissions-Policy: microphone=(self)` (needed for the Listen mode) and `Cache-Control: no-cache`.
