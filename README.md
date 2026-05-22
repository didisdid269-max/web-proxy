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
