import { resolveAgainstBase, toProxyUrl } from "./proxy-url";

const ATTR_RE =
  /\b(href|src|action|poster|data-src)\s*=\s*(["'])([^"']*)\2/gi;
const SRCSET_RE = /\bsrcset\s*=\s*(["'])([^"']+)\1/gi;
const STYLE_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

function rewriteSrcset(value: string, base: URL, proxyOrigin: string): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const space = trimmed.indexOf(" ");
      const urlPart = space === -1 ? trimmed : trimmed.slice(0, space);
      const descriptor = space === -1 ? "" : trimmed.slice(space);
      const resolved = resolveAgainstBase(urlPart, base);
      if (!resolved) return part;
      return `${toProxyUrl(resolved, proxyOrigin)}${descriptor}`;
    })
    .join(", ");
}

function stripBlockingTags(html: string): string {
  return html
    .replace(
      /<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi,
      "",
    )
    .replace(/<base[^>]*>/gi, "");
}

export function buildNavigateScript(target: URL, currentPath: string): string {
  const base = target.origin;
  const path = currentPath || target.pathname || "/";
  return `<script>
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
    var basePath=PATH.endsWith("/")?PATH:PATH.slice(0,PATH.lastIndexOf("/")+1);
    return ORIGIN+basePath+h;
  }
  function go(url){
    var abs=/^https?:\\/\\//i.test(url)?url:resolve(url);
    if(!abs)return;
    var proxy="/api/proxy?url="+encodeURIComponent(abs);
    try{
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:"navigate",url:abs},"*");
        return;
      }
    }catch(e){}
    location.href=proxy;
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
  var _open=window.open;
  window.open=function(u){go(u);return null;};
})();
</script>`;
}

export function rewriteHtml(
  html: string,
  target: URL,
  proxyOrigin: string,
  currentPath: string,
): string {
  let out = stripBlockingTags(html);

  out = out.replace(ATTR_RE, (_match, attr: string, quote: string, value: string) => {
    const resolved = resolveAgainstBase(value, target);
    if (!resolved) return `${attr}=${quote}${value}${quote}`;
    return `${attr}=${quote}${toProxyUrl(resolved, proxyOrigin)}${quote}`;
  });

  out = out.replace(SRCSET_RE, (_match, quote: string, value: string) => {
    return `srcset=${quote}${rewriteSrcset(value, target, proxyOrigin)}${quote}`;
  });

  out = out.replace(STYLE_URL_RE, (_match, quote: string, value: string) => {
    const resolved = resolveAgainstBase(value.trim(), target);
    if (!resolved) return `url(${quote}${value}${quote})`;
    return `url(${quote}${toProxyUrl(resolved, proxyOrigin)}${quote})`;
  });

  const script = buildNavigateScript(target, currentPath);
  if (out.includes("</body>")) {
    out = out.replace(/<\/body>/i, `${script}</body>`);
  } else {
    out += script;
  }

  return out;
}

export function rewriteCss(css: string, target: URL, proxyOrigin: string): string {
  return css.replace(STYLE_URL_RE, (_match, quote: string, value: string) => {
    const resolved = resolveAgainstBase(value.trim(), target);
    if (!resolved) return `url(${quote}${value}${quote})`;
    return `url(${quote}${toProxyUrl(resolved, proxyOrigin)}${quote})`;
  });
}
