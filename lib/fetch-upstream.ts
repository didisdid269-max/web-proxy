const UPSTREAM_HEADERS = [
  "user-agent",
  "accept",
  "accept-language",
  "accept-encoding",
  "referer",
  "cookie",
  "content-type",
  "content-length",
];

export async function fetchUpstream(
  target: URL,
  request: Request,
): Promise<Response> {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    request.headers.get("user-agent") ??
      "Mozilla/5.0 (compatible; WebProxy/2.0; +https://vercel.app)",
  );
  headers.set("Accept", request.headers.get("accept") ?? "*/*");
  headers.set(
    "Accept-Language",
    request.headers.get("accept-language") ?? "en-US,en;q=0.9",
  );

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const ref = new URL(referer);
      const inner = ref.searchParams.get("url");
      headers.set("Referer", inner ? inner : target.origin + "/");
    } catch {
      headers.set("Referer", target.origin + "/");
    }
  } else {
    headers.set("Referer", target.origin + "/");
  }

  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("Cookie", cookie);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
    const ct = request.headers.get("content-type");
    if (ct) headers.set("Content-Type", ct);
  }

  return fetch(target.href, init);
}

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

export function stripFrameHeaders(headers: Headers): Headers {
  const out = new Headers(headers);
  out.delete("x-frame-options");
  out.delete("content-security-policy");
  out.delete("content-security-policy-report-only");
  out.delete("permissions-policy");
  return out;
}
