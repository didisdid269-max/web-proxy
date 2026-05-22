"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const EXAMPLES = [
  { name: "Example.com", url: "https://example.com" },
  { name: "Hacker News", url: "https://news.ycombinator.com" },
  { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page" },
  { name: "Reddit (Old)", url: "https://old.reddit.com" },
];

function normalizeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function toProxyPath(targetUrl: string): string {
  return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

type FormMessage = {
  type: "formSubmit";
  url: string;
  method: string;
  data: Record<string, string>;
};

export default function ProxyBrowserPage() {
  const [input, setInput] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [frameSrc, setFrameSrc] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const histIdxRef = useRef(-1);

  useEffect(() => {
    histIdxRef.current = histIdx;
  }, [histIdx]);

  const navigate = useCallback((raw: string, pushHistory: boolean) => {
    const normalized = normalizeInput(raw);
    if (!normalized) return;

    setTargetUrl(normalized);
    setInput(normalized);
    setFrameSrc(toProxyPath(normalized));
    setLoading(true);

    if (pushHistory) {
      const idx = histIdxRef.current;
      setHistory((h) => [...h.slice(0, idx + 1), normalized]);
      setHistIdx(idx + 1);
    }
  }, []);

  const submitForm = useCallback(async (url: string, method: string, data: Record<string, string>) => {
    const normalized = normalizeInput(url);
    setTargetUrl(normalized);
    setInput(normalized);
    setLoading(true);

    try {
      const init: RequestInit = { method: method.toUpperCase() };
      if (init.method === "POST") {
        init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
        init.body = new URLSearchParams(
          Object.entries(data).map(([k, v]) => [k, String(v)]),
        ).toString();
      }
      const res = await fetch(toProxyPath(normalized), init);
      const html = await res.text();
      const frame = iframeRef.current;
      if (!frame) return;
      frame.removeAttribute("src");
      frame.srcdoc = html;
      setFrameSrc("");

      const idx = histIdxRef.current;
      setHistory((h) => [...h.slice(0, idx + 1), normalized]);
      setHistIdx(idx + 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; url?: string; method?: string; data?: Record<string, string> };
      if (data?.type === "navigate" && typeof data.url === "string") {
        navigate(data.url, true);
      } else if (data?.type === "formSubmit" && typeof data.url === "string") {
        const msg = data as FormMessage;
        void submitForm(msg.url, msg.method ?? "GET", msg.data ?? {});
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, submitForm]);

  const onFrameLoad = () => setLoading(false);

  const back = () => {
    if (histIdx <= 0) return;
    const next = histIdx - 1;
    setHistIdx(next);
    const url = history[next];
    setTargetUrl(url);
    setInput(url);
    setFrameSrc(toProxyPath(url));
    setLoading(true);
    iframeRef.current?.removeAttribute("srcdoc");
  };

  const forward = () => {
    if (histIdx >= history.length - 1) return;
    const next = histIdx + 1;
    setHistIdx(next);
    const url = history[next];
    setTargetUrl(url);
    setInput(url);
    setFrameSrc(toProxyPath(url));
    setLoading(true);
    iframeRef.current?.removeAttribute("srcdoc");
  };

  const refresh = () => {
    if (!targetUrl) return;
    setFrameSrc(toProxyPath(targetUrl));
    setLoading(true);
    iframeRef.current?.removeAttribute("srcdoc");
  };

  const resetHome = () => {
    setInput("");
    setTargetUrl("");
    setFrameSrc("");
    setHistory([]);
    setHistIdx(-1);
    setLoading(false);
    const frame = iframeRef.current;
    if (frame) {
      frame.removeAttribute("src");
      frame.removeAttribute("srcdoc");
    }
  };

  const showFrame = Boolean(frameSrc || iframeRef.current?.srcdoc);

  return (
    <div className="app">
      <div className="toolbar">
        <div className="nav-btns">
          <button type="button" onClick={back} disabled={histIdx <= 0 || loading} aria-label="Back">
            ←
          </button>
          <button
            type="button"
            onClick={forward}
            disabled={histIdx >= history.length - 1 || loading}
            aria-label="Forward"
          >
            →
          </button>
          <button type="button" onClick={refresh} disabled={!targetUrl || loading} aria-label="Refresh">
            ↻
          </button>
          <button type="button" onClick={resetHome} aria-label="Home">
            ⌂
          </button>
        </div>
        <form
          className="url-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(input, true);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter URL (e.g., example.com)"
            spellCheck={false}
          />
          <button className="go" type="submit" disabled={!input.trim() || loading}>
            Go
          </button>
        </form>
      </div>

      {!showFrame ? (
        <div className="home">
          <div>
            <h1>Web Proxy Browser</h1>
            <p>Browse websites through the proxy. Enter a URL above or try an example.</p>
          </div>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex.url} type="button" onClick={() => navigate(ex.url, true)}>
                {ex.name}
              </button>
            ))}
          </div>
          <div className="tips">
            <strong>How it works</strong>
            <ul>
              <li>Pages load directly in the frame for faster rendering</li>
              <li>Links, images, CSS, and scripts are rewritten to stay on the proxy</li>
              <li>Works in embedded browsers via postMessage</li>
              <li>Complex JS apps may still have limits</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="frame-wrap">
          {loading && <div className="loading-bar" aria-hidden />}
          <iframe
            ref={iframeRef}
            src={frameSrc || undefined}
            title="Proxied page"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            onLoad={onFrameLoad}
          />
        </div>
      )}
    </div>
  );
}
