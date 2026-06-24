# ASXFolio — Live ASX Portfolio Tracker

A single-page portfolio tracker for ASX shares with live prices, profit/loss
overview, and an installable mobile app experience (PWA).

## Why this needs to be hosted (not run as a Claude artifact)

Claude.ai artifacts run in a sandboxed iframe that blocks all outbound
network requests except a small allowlist of CDN hosts. This app needs to
call Yahoo Finance for live prices, which requires a real server — so it
must be deployed to a hosting platform. The good news: both Vercel and
Netlify offer generous **free tiers** that are perfect for this.

## What's included

- **Live prices** — `/api/prices` is a server-side API route that fetches
  current price + previous close from Yahoo Finance for any ASX code
  (no CORS issues, since the request happens on the server)
- **Portfolio view** — total invested, market value, total P&L, today's
  move, plus a per-holding breakdown table
- **Settings page** — add/edit/remove holdings (ASX code, quantity, total
  cost paid including brokerage)
- **Auto-refresh** every 60 seconds, plus a manual refresh button
- **Installable (PWA)** — "Add to Home Screen" on iOS/Android gives you an
  app icon and full-screen experience
- **Local storage** — your holdings are saved in your browser; nothing is
  sent to any third-party server except the price lookups

## Deploying to Vercel (recommended, easiest)

1. Create a free account at https://vercel.com if you don't have one
2. Install the Vercel CLI: `npm install -g vercel`
3. From this project folder, run:
   ```
   vercel
   ```
4. Follow the prompts (accept defaults). Vercel will give you a live URL
   like `https://asxfolio-yourname.vercel.app`
5. Open that URL on your phone and use "Add to Home Screen" (Safari) or
   the install prompt (Chrome) to install it as an app

**Alternative — deploy via GitHub:**
1. Push this folder to a new GitHub repository
2. Go to https://vercel.com/new, import the repo, click Deploy
3. Done — Vercel auto-detects Next.js and configures everything

## Deploying to Netlify

1. Push this folder to a GitHub repository
2. Go to https://app.netlify.com, click "Add new site" → "Import an
   existing project"
3. Connect your repo. Netlify auto-detects Next.js
4. Build command: `next build` — Publish directory: `.next`
   (Netlify's Next.js runtime handles the rest automatically)

## Local development

```
npm install
npm run dev
```
Then open http://localhost:3000

## Installing on your phone (after deploying)

**iPhone/iPad (Safari):**
1. Open your deployed URL in Safari
2. Tap the Share icon → "Add to Home Screen"

**Android (Chrome):**
1. Open your deployed URL in Chrome
2. Tap the menu (⋮) → "Add to Home screen" or "Install app"

## Notes on the price data

- Prices come from Yahoo Finance's public chart API using the `.AX`
  ticker suffix (e.g. `BHP.AX`)
- This is unofficial/undocumented but widely used and generally reliable.
  If Yahoo changes their API, the `/api/prices` route is the only place
  that needs updating
- Prices may be delayed ~15-20 minutes depending on market data licensing
