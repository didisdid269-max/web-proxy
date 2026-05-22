/** Runs first in proxied pages so fetch/XHR and dynamic assets use the proxy. */
export function buildRuntimeScript(target: URL, currentPath: string): string {
  const origin = target.origin;
  const path = currentPath || target.pathname || "/";
  return `<script id="proxy-runtime">(function(){
var O=${JSON.stringify(origin)};
var P=${JSON.stringify(path)};
var X="/api/proxy?url=";
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
  var a=absUrl(u);
  return !!a;
}
var of=window.fetch;
if(of)window.fetch=function(input,init){
  try{
    if(typeof input==="string"){if(shouldProxy(input))input=prox(input);}
    else if(input&&input.url){var u=input.url;if(shouldProxy(u))input=new Request(prox(u),input);}
  }catch(e){}
  return of.call(this,input,init);
};
var xo=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  try{
    if(arguments.length>1&&typeof arguments[1]==="string"&&shouldProxy(arguments[1])){
      arguments[1]=prox(arguments[1]);
    }
  }catch(e){}
  return xo.apply(this,arguments);
};
var sa=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(n,v){
  if((n==="src"||n==="href"||n==="action"||n==="poster"||n==="data-src")&&typeof v==="string"){
    try{if(shouldProxy(v))v=prox(v);}catch(e){}
  }
  return sa.call(this,n,v);
};
function patchSrc(proto,prop){
  if(!proto||!Object.getOwnPropertyDescriptor(proto,prop))return;
  var d=Object.getOwnPropertyDescriptor(proto,prop);
  if(!d||!d.set)return;
  Object.defineProperty(proto,prop,{
    get:d.get,
    set:function(v){d.set.call(this,typeof v==="string"&&shouldProxy(v)?prox(v):v);},
    configurable:true
  });
}
try{
  patchSrc(HTMLScriptElement.prototype,"src");
  patchSrc(HTMLImageElement.prototype,"src");
  patchSrc(HTMLLinkElement.prototype,"href");
  patchSrc(HTMLIFrameElement.prototype,"src");
}catch(e){}
})();
</script>`;
}
