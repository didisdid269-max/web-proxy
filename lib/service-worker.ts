/** Service worker: routes same-origin asset requests through /api/proxy */
export const SERVICE_WORKER_SCRIPT = `
self.addEventListener("install", function (e) {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", function (e) {
  var reqUrl = new URL(e.request.url);
  if (reqUrl.pathname.indexOf("/api/proxy") === 0) return;
  if (reqUrl.pathname === "/sw.js") return;

  var cookie = e.request.headers.get("cookie") || "";
  var match = cookie.match(/(?:^|;\\s*)__proxy_base=([^;]+)/);
  if (!match) return;

  var baseHref;
  try {
    baseHref = decodeURIComponent(match[1]);
  } catch (err) {
    return;
  }

  var target;
  try {
    target = new URL(
      reqUrl.pathname + reqUrl.search + reqUrl.hash,
      baseHref,
    ).href;
  } catch (err2) {
    return;
  }

  e.respondWith(
    (async function () {
      var init = {
        method: e.request.method,
        credentials: "include",
        redirect: "follow",
      };
      if (e.request.method !== "GET" && e.request.method !== "HEAD") {
        init.body = await e.request.arrayBuffer();
      }
      return fetch(
        "/api/proxy?url=" + encodeURIComponent(target),
        init,
      );
    })(),
  );
});
`.trim();

export function buildSwRegistration(): string {
  return `<script id="proxy-sw">(function(){
if(!("serviceWorker" in navigator))return;
navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(function(){});
})();</script>`;
}

export function proxyBaseCookie(target: URL): string {
  const value = encodeURIComponent(target.href);
  return `__proxy_base=${value}; Path=/; SameSite=Lax; Max-Age=3600; Secure`;
}
