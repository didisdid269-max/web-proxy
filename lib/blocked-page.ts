export function isBlockedResponse(status: number, body: string): boolean {
  if (status === 403 || status === 401 || status === 451) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("forbidden by administrative") ||
    lower.includes("access denied") ||
    lower.includes("request blocked") ||
    lower.includes("attention required") ||
    lower.includes("cf-browser-verification") ||
    (lower.includes("cloudflare") && lower.includes("ray id"))
  );
}

export function blockedPageHtml(target: string, status: number, snippet: string): string {
  const preview = snippet.slice(0, 200).replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Site blocked the proxy</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed;margin:0;padding:32px;line-height:1.5}
    .card{max-width:32rem;margin:4rem auto;padding:24px;border:1px solid #2a2f3a;border-radius:12px;background:#1a1d24}
    h1{font-size:1.25rem;margin:0 0 12px}
    p{color:#9aa0a6;margin:0 0 12px}
    code{font-size:.85rem;color:#7eb6ff;word-break:break-all}
    ul{margin:12px 0 0;padding-left:1.2rem;color:#9aa0a6}
    a{color:#4f8cff}
  </style>
</head>
<body>
  <div class="card">
    <h1>This site cannot be loaded through the proxy</h1>
    <p><code>${target}</code> returned HTTP ${status}. Many large sites (Roblox, Google, banking, games) block datacenter IPs and web proxies.</p>
    <ul>
      <li>Try simpler sites: Wikipedia, Hacker News, example.com</li>
      <li>Open the site directly in a normal browser tab</li>
      <li>Heavy apps and games need a real browser, not an HTML proxy</li>
    </ul>
    <p style="margin-top:16px;font-size:.8rem">Server message: ${preview || "(empty)"}</p>
  </div>
</body>
</html>`;
}
