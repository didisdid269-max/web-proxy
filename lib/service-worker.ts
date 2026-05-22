/** Service worker: cache assets + fix stray same-origin requests */
export const SERVICE_WORKER_SCRIPT = `
var CACHE="proxy-assets-v2";
self.addEventListener("install",function(e){e.waitUntil(self.skipWaiting());});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim());});
function getBase(cookie){
  var m=(cookie||"").match(/(?:^|;\\s*)__proxy_base=([^;]+)/);
  if(!m)return null;
  try{return decodeURIComponent(m[1]);}catch(e){return null;}
}
self.addEventListener("fetch",function(e){
  var u=new URL(e.request.url);
  if(u.pathname.indexOf("/api/proxy")===0)return;
  if(u.pathname==="/sw.js")return;
  var base=getBase(e.request.headers.get("cookie"));
  if(!base)return;
  var target;
  try{target=new URL(u.pathname+u.search+u.hash,base).href;}catch(err){return;}
  var proxyUrl="/api/proxy?url="+encodeURIComponent(target);
  if(e.request.method!=="GET"){
    e.respondWith(fetch(proxyUrl,{method:e.request.method,body:e.request.body,credentials:"include"}));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(function(cache){
      return cache.match(e.request).then(function(hit){
        if(hit)return hit;
        return fetch(proxyUrl,{credentials:"include",redirect:"follow"}).then(function(res){
          if(res.ok&&res.status===200){
            var ct=res.headers.get("content-type")||"";
            if(/image|font|css|javascript|wasm|octet-stream/i.test(ct)){
              cache.put(e.request,res.clone());
            }
          }
          return res;
        });
      });
    })
  );
});
`.trim();

export function buildSwRegistration(): string {
  return `<script id="proxy-sw">(function(){
if(!("serviceWorker"in navigator))return;
navigator.serviceWorker.register("/sw.js",{scope:"/"}).then(function(){navigator.serviceWorker.ready;}).catch(function(){});
})();</script>`;
}

export function proxyBaseCookie(target: URL): string {
  const value = encodeURIComponent(target.href);
  return `__proxy_base=${value}; Path=/; SameSite=Lax; Max-Age=7200; Secure`;
}
