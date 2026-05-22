const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

export function getProxyOrigin(request: Request): string {
  const env = process.env.VERCEL_URL;
  if (env) return `https://${env}`;
  const url = new URL(request.url);
  return url.origin;
}

export function toProxyUrl(target: string, proxyOrigin: string): string {
  return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(target)}`;
}

export function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function parseTargetUrl(raw: string | null): URL | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) return null;
    if (isPrivateIpv4(host)) return null;
    if (host.startsWith("fe80:") || host === "::1") return null;
    return url;
  } catch {
    return null;
  }
}

export function resolveAgainstBase(href: string, base: URL): string | null {
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }
  try {
    return new URL(trimmed, base).href;
  } catch {
    return null;
  }
}

const ASSET_EXT =
  /\.(css|js|mjs|cjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|webm|mp3|wav)(\?|$)/i;

export function looksLikeAsset(url: URL, contentType: string): boolean {
  if (ASSET_EXT.test(url.pathname)) return true;
  const ct = contentType.toLowerCase();
  if (ct.includes("text/html")) return false;
  if (
    ct.includes("image/") ||
    ct.includes("font/") ||
    ct.includes("javascript") ||
    ct.includes("text/css") ||
    ct.includes("application/octet-stream")
  ) {
    return true;
  }
  return false;
}
