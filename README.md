# Web Proxy

Standalone fast web proxy (Next.js). Deploy to Vercel and use the browser UI or the `/api/proxy` endpoint from other apps.

## Project location

```
C:\Users\diddy\Projects\web-proxy
```

## Run locally

```bash
cd C:\Users\diddy\Projects\web-proxy
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this folder as its **own** GitHub repo (root = project root, not a subfolder).
2. [vercel.com](https://vercel.com) → **Add New Project** → import `web-proxy`.
3. Deploy (Framework: Next.js, no root directory override needed).

Or with CLI:

```bash
cd C:\Users\diddy\Projects\web-proxy
npm i -g vercel
vercel login
vercel --prod
```

To reuse your old v0 URL, run `vercel link` and select the existing project before `vercel --prod`.

## API

```
GET|POST /api/proxy?url=https://example.com
```

## Use from other apps

Point embedders at your deployed origin:

```
https://YOUR-APP.vercel.app/api/proxy?url=<encoded-target-url>
```

Example: VM Desktop sets `PROXY_ORIGIN` in its `proxy.ts` to your Vercel URL.

## What works vs what does not

**Works well:** mostly static sites (Wikipedia, Hacker News, blogs, simple shops).

**Often broken:** Roblox, Google, Netflix, banking, and most games. They block proxy/datacenter IPs (`Request forbidden by administrative rules`) or need WebGL/WebSocket/real login — an HTML proxy cannot run those like a normal browser.

After deploying, test **CrazyGames** (`crazygames.com`) — games should load in their iframe like normal.

### Game sites (CrazyGames, etc.)

- Portal HTML goes through the proxy
- **Game iframes and CDN assets use their real URLs** (not double-proxied) so WebGL/Unity games can run
- Iframe has no sandbox lock — fullscreen and gamepad allowed
- Asset cache in service worker for faster repeat loads
