/** Lightweight runtime: only fix broken same-origin paths, let game CDNs load direct. */
export function buildRuntimeScript(target: URL, currentPath: string): string {
  const origin = target.origin;
  const path = currentPath || target.pathname || "/";
  const pageOrigin = target.origin;
  return `<script id="proxy-runtime">(function(){
var O=${JSON.stringify(origin)};
var P=${JSON.stringify(path)};
var SITE=${JSON.stringify(pageOrigin)};
var X="/api/proxy?url=";
var LO=location.origin;
function extract(h){
  if(!h)return null;
  var m=String(h).match(/[?&]url=([^&]+)/);
  if(m){try{return decodeURIComponent(m[1]);}catch(e){return null;}}
  return h;
}
function absUrl(u){
  if(!u)return null;
  u=extract(u)||String(u);
  if(/^javascript:|^#|^mailto:|^tel:|^data:|^blob:/i.test(u))return null;
  if(/^https?:\\/\\//i.test(u)){
    if(u.indexOf("/api/proxy")!==-1)return extract(u);
    return u;
  }
  if(/^\\/\\//.test(u))return "https:"+u.slice(2);
  if(u.charAt(0)==="/")return O+u;
  var base=P.endsWith("/")?P:P.slice(0,P.lastIndexOf("/")+1);
  return O+base+u;
}
function prox(u){
  var a=absUrl(u);
  return a?X+encodeURIComponent(a):u;
}
function shouldProxy(u){
  if(!u)return false;
  u=String(u);
  if(/^https?:\\/\\//i.test(u)){
    if(u.indexOf("/api/proxy")!==-1)return true;
    try{
      var parsed=new URL(u);
      if(parsed.origin===LO&&parsed.pathname.indexOf("/api/proxy")!==0)return true;
    }catch(e){}
    return false;
  }
  return !!absUrl(u);
}
function fixInput(input){
  if(typeof input==="string")return shouldProxy(input)?prox(input):input;
  if(input&&input.url&&shouldProxy(input.url))return new Request(prox(input.url),input);
  return input;
}
var of=window.fetch;
if(of)window.fetch=function(i,n){try{i=fixInput(i);}catch(e){}return of.call(this,i,n);};
var xo=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  try{if(arguments.length>1&&typeof arguments[1]==="string"&&shouldProxy(arguments[1]))arguments[1]=prox(arguments[1]);}catch(e){}
  return xo.apply(this,arguments);
};
var sa=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(n,v){
  if(typeof v==="string"&&(n==="src"||n==="href"||n==="action")&&shouldProxy(v))v=prox(v);
  return sa.call(this,n,v);
};
function patchSrc(proto,prop){
  if(!proto)return;
  var d=Object.getOwnPropertyDescriptor(proto,prop);
  if(!d||!d.set)return;
  Object.defineProperty(proto,prop,{get:d.get,set:function(v){if(typeof v==="string"&&shouldProxy(v))v=prox(v);d.set.call(this,v);},configurable:true});
}
try{
  patchSrc(HTMLScriptElement.prototype,"src");
  patchSrc(HTMLImageElement.prototype,"src");
  patchSrc(HTMLLinkElement.prototype,"href");
}catch(e){}
var OW=window.Worker;
if(OW)window.Worker=function(u,o){
  if(typeof u==="string"&&shouldProxy(u))u=prox(u);
  return new OW(u,o);
};
})();
</script>`;
}
