import { resolveAgainstBase, toProxyUrl } from "./proxy-url";
import { buildRuntimeScript } from "./runtime-script";
import { buildSwRegistration } from "./service-worker";

const SRCSET_RE = /\bsrcset\s*=\s*(["'])([^"']+)\1/gi;
const STYLE_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const CSS_IMPORT_RE =
  /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(["'])([^"']+)\3)/gi;
const STYLE_BLOCK_RE = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
const REL_ATTR_RE =
  /\b(src|href|srcset|data-src|poster)\s*=\s*(["'])([^"']*)\2/gi;

function isAbsoluteUrl(value: string): boolean {
  const v = value.trim();
  return (
    /^https?:\/\//i.test(v) ||
    v.startsWith("//") ||
    v.startsWith("data:") ||
    v.startsWith("blob:")
  );
}

function rewriteSrcset(value: string, base: URL, proxyOrigin: string): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const space = trimmed.indexOf(" ");
      const urlPart = space === -1 ? trimmed : trimmed.slice(0, space);
      const descriptor = space === -1 ? "" : trimmed.slice(space);
      if (isAbsoluteUrl(urlPart)) return part;
      const resolved = resolveAgainstBase(urlPart, base);
      if (!resolved) return part;
      return `${toProxyUrl(resolved, proxyOrigin)}${descriptor}`;
    })
    .join(", ");
}

function rewriteUrlsInText(
  text: string,
  base: URL,
  proxyOrigin: string,
): string {
  let out = text.replace(STYLE_URL_RE, (_m, quote: string, value: string) => {
    const v = value.trim();
    if (isAbsoluteUrl(v)) return `url(${quote}${value}${quote})`;
    const resolved = resolveAgainstBase(v, base);
    if (!resolved) return `url(${quote}${value}${quote})`;
    return `url(${quote}${toProxyUrl(resolved, proxyOrigin)}${quote})`;
  });
  out = out.replace(
    CSS_IMPORT_RE,
    (_m, q1: string, u1: string, q2: string, u2: string) => {
      const raw = (u1 || u2 || "").trim();
      if (!raw || isAbsoluteUrl(raw)) return _m;
      const quote = q1 || q2 || '"';
      const resolved = resolveAgainstBase(raw, base);
      if (!resolved) return _m;
      if (q1 || u1) {
        return `@import url(${quote}${toProxyUrl(resolved, proxyOrigin)}${quote})`;
      }
      return `@import ${quote}${toProxyUrl(resolved, proxyOrigin)}${quote}`;
    },
  );
  return out;
}

function stripBlockingTags(html: string): string {
  return html
    .replace(
      /<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi,
      "",
    )
    .replace(/<meta[^>]+http-equiv=["']?x-frame-options[^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']?permissions-policy[^>]*>/gi, "")
    .replace(/<base[^>]*>/gi, "");
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildHeadInjection(target: URL): string {
  const baseHref = escapeHtmlAttr(target.href);
  return [
    `<base href="${baseHref}">`,
    buildSwRegistration(),
    buildRuntimeScript(target, target.pathname),
  ].join("");
}

export function buildNavigateScript(target: URL, currentPath: string): string {
  const base = target.origin;
  const path = currentPath || target.pathname || "/";
  return `<script id="proxy-nav">
(function(){
  var ORIGIN=${JSON.stringify(base)};
  var PATH=${JSON.stringify(path)};
  function extract(h){
    if(!h)return null;
    var m=h.match(/[?&]url=([^&]+)/);
    if(m){try{return decodeURIComponent(m[1]);}catch(e){return null;}}
    return h;
  }
  function resolve(h){
    if(!h)return null;
    h=extract(h);
    if(!h)return null;
    if(/^javascript:|^#|^mailto:|^tel:|^data:/i.test(h))return null;
    if(/^https?:\\/\\//i.test(h)){
      if(h.indexOf("/api/proxy")!==-1)return extract(h);
      return h;
    }
    if(/^\\/\\//.test(h))return "https:"+h;
    if(h.charAt(0)==="/")return ORIGIN+h;
    var bp=PATH.endsWith("/")?PATH:PATH.slice(0,PATH.lastIndexOf("/")+1);
    return ORIGIN+bp+h;
  }
  function go(url){
    var abs=/^https?:\\/\\//i.test(url)?url:resolve(url);
    if(!abs)return;
    try{
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:"navigate",url:abs},"*");
        return;
      }
    }catch(e){}
    location.href="/api/proxy?url="+encodeURIComponent(abs);
  }
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("a");
    if(!a)return;
    var href=a.getAttribute("href");
    if(!href||href.charAt(0)==="#"||/^javascript:|^mailto:|^tel:/i.test(href))return;
    var abs=resolve(href);
    if(!abs)return;
    e.preventDefault();
    e.stopPropagation();
    go(abs);
  },true);
  document.addEventListener("submit",function(e){
    var f=e.target;
    if(!f||f.tagName!=="FORM")return;
    e.preventDefault();
    e.stopPropagation();
    var fd=new FormData(f);
    var method=(f.method||"GET").toUpperCase();
    var action=f.getAttribute("action")||"";
    var url=resolve(action)||(ORIGIN+PATH);
    try{
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:"formSubmit",url:url,method:method,data:Object.fromEntries(fd)},"*");
        return;
      }
    }catch(err){}
    if(method==="GET"){
      var qs=new URLSearchParams(fd).toString();
      location.href="/api/proxy?url="+encodeURIComponent(url+(qs?"?"+qs:""));
    }else{
      var body=new URLSearchParams(fd).toString();
      fetch("/api/proxy?url="+encodeURIComponent(url),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body})
        .then(function(r){return r.text();})
        .then(function(html){document.open();document.write(html);document.close();});
    }
  },true);
  window.open=function(u,n,f){
    if(u){go(u);return null;}
    return null;
  };
})();
</script>`;
}

function injectIntoHead(html: string, injection: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${injection}</head>`);
  }
  return injection + html;
}

/** Only rewrite relative URLs — absolute game/CDN URLs load direct (CrazyGames-style). */
function rewriteRelativeAttrs(
  html: string,
  target: URL,
  proxyOrigin: string,
): string {
  return html.replace(REL_ATTR_RE, (match, attr, quote, value) => {
    const v = value.trim();
    if (
      !v ||
      v.startsWith("#") ||
      /^javascript:|^mailto:|^tel:/i.test(v) ||
      isAbsoluteUrl(v)
    ) {
      return match;
    }
    const resolved = resolveAgainstBase(v, target);
    if (!resolved) return match;
    return `${attr}=${quote}${toProxyUrl(resolved, proxyOrigin)}${quote}`;
  });
}

export function rewriteHtml(
  html: string,
  target: URL,
  proxyOrigin: string,
  currentPath: string,
): string {
  let out = stripBlockingTags(html);

  out = out.replace(STYLE_BLOCK_RE, (_m, attrs, css) => {
    return `<style${attrs}>${rewriteUrlsInText(css, target, proxyOrigin)}</style>`;
  });

  out = rewriteRelativeAttrs(out, target, proxyOrigin);

  out = out.replace(SRCSET_RE, (_m, quote, value) => {
    return `srcset=${quote}${rewriteSrcset(value, target, proxyOrigin)}${quote}`;
  });

  out = injectIntoHead(out, buildHeadInjection(target));

  const navigate = buildNavigateScript(target, currentPath);
  if (out.includes("</body>")) {
    out = out.replace(/<\/body>/i, `${navigate}</body>`);
  } else {
    out += navigate;
  }

  return out;
}

export function rewriteCss(css: string, target: URL, proxyOrigin: string): string {
  return rewriteUrlsInText(css, target, proxyOrigin);
}

const JS_ABS_URL_RE = /(["'])(https?:\/\/[^"'\\\n\r]+)\1/g;

export function rewriteJavaScript(
  js: string,
  target: URL,
  proxyOrigin: string,
): string {
  if (js.length > 400_000) return js;
  return js.replace(JS_ABS_URL_RE, (_m, quote, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== target.origin) return `${quote}${url}${quote}`;
    } catch {
      return `${quote}${url}${quote}`;
    }
    const resolved = resolveAgainstBase(url, target);
    if (!resolved) return `${quote}${url}${quote}`;
    return `${quote}${toProxyUrl(resolved, proxyOrigin)}${quote}`;
  });
}
