import { fetchUpstream, corsHeaders, stripFrameHeaders } from "@/lib/fetch-upstream";
import {
  getProxyOrigin,
  looksLikeAsset,
  parseTargetUrl,
} from "@/lib/proxy-url";
import { rewriteCss, rewriteHtml } from "@/lib/rewrite";

export const runtime = "edge";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  return handleProxy(request);
}

export async function POST(request: Request) {
  return handleProxy(request);
}

export async function HEAD(request: Request) {
  return handleProxy(request);
}

async function handleProxy(request: Request): Promise<Response> {
  const proxyOrigin = getProxyOrigin(request);
  const rawUrl = new URL(request.url).searchParams.get("url");
  const target = parseTargetUrl(rawUrl);

  if (!target) {
    return new Response("Invalid or blocked URL", {
      status: 400,
      headers: corsHeaders(),
    });
  }

  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return new Response(`Upstream error: ${message}`, {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "text/plain" },
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const pathParam =
    new URL(request.url).searchParams.get("path") ?? target.pathname;

  if (request.method === "HEAD") {
    return new Response(null, {
      status: upstream.status,
      headers: {
        ...Object.fromEntries(stripFrameHeaders(upstream.headers)),
        ...corsHeaders(),
      },
    });
  }

  if (looksLikeAsset(target, contentType)) {
    const body = await upstream.arrayBuffer();
    const headers = stripFrameHeaders(upstream.headers);
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...Object.fromEntries(headers),
        ...corsHeaders(),
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  }

  const text = await upstream.text();
  const lower = contentType.toLowerCase();

  if (lower.includes("text/css")) {
    const css = rewriteCss(text, target, proxyOrigin);
    return new Response(css, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        ...corsHeaders(),
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const isHtml =
    lower.includes("text/html") ||
    text.trimStart().toLowerCase().startsWith("<!doctype") ||
    text.trimStart().toLowerCase().startsWith("<html");

  if (!isHtml) {
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...Object.fromEntries(stripFrameHeaders(upstream.headers)),
        ...corsHeaders(),
      },
    });
  }

  const rewritten = rewriteHtml(text, target, proxyOrigin, pathParam);
  return new Response(rewritten, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...corsHeaders(),
      "Cache-Control": "private, no-cache",
    },
  });
}
