# Migraine Compass (PWA prototype)

Installable web app for the UX course user tests (Stage 3). Plain HTML/CSS/JS, no build step.
All entries stay on the device (`localStorage`). Sleep and screen time are simulated; weather uses
the browser location and the free Open-Meteo API.

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

The service worker and install prompt need HTTPS (localhost is allowed).

## Deploy on Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick `migraine-compass`.
3. Build command: *(empty)*. Output directory: `/` (root). Deploy.
4. Optional, for the AI summary: Settings → Variables and Secrets → add `GEMINI_API_KEY` as a **secret**
   (optionally `GEMINI_MODEL`). Redeploy. Without it, the button shows a friendly error and the
   automatic summary still works.

Share the `*.pages.dev` URL with testers.

## Install on the phone

- Android (Chrome): menu ⋮ → **Install app**.
- iPhone (Safari): Share → **Add to Home Screen**.

## Files

- `index.html`, `styles.css`, `app.js`: the app (screens follow the Figma prototype).
- `manifest.webmanifest`, `sw.js`, `icons/`: install + offline.
- `functions/api/summary.js`: Cloudflare Pages Function calling Gemini with counts only (no notes).

## Updating after a change

Bump `VERSION` in `sw.js` so installed copies refresh.
