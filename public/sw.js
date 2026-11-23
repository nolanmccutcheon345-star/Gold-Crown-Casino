/* Poker Night AI offline support, reviewed after Patch 56.
 * Cache only app-shell documents and static assets, never API/data requests.
 * The install cache contains the built JS/CSS linked by index.html so a completed
 * first visit can survive an offline reload without a second online refresh.
 * Saved games remain in browser-managed local storage, outside this worker. */
const PREFIX='pna-offline-';
const CACHE=PREFIX+'v2';
const SHELL=['./','./index.html','./site.webmanifest'];
const ICONS=['./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const LIMIT=160;
const scope=new URL(self.registration.scope);
const withinScope=url=>url.origin===self.location.origin&&url.pathname.startsWith(scope.pathname);
const isAsset=url=>withinScope(url)&&/\.(?:js|css|png|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname);
const isShell=url=>withinScope(url)&&['/','/index.html','/site.webmanifest'].includes(url.pathname.slice(scope.pathname.length-1));
const mayCache=(request,url)=>request.method==='GET'&&withinScope(url)&&(request.mode==='navigate'||isShell(url)||isAsset(url));
async function trim(cache){const keys=await cache.keys();for(let i=0;i<keys.length-LIMIT;i++)await cache.delete(keys[i]);}
async function installShell(){
  const cache=await caches.open(CACHE);
  const index=new URL('./index.html',scope);
  // Do not activate a new worker with an incomplete app shell: keep the old worker on failure.
  const response=await fetch(index,{cache:'reload'});
  if(!response.ok)throw Error('Offline shell is unavailable');
  const html=await response.text();
  const references=[...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)];
  const assets=references.map(([,path])=>new URL(path,index)).filter(isAsset).map(url=>url.href);
  await cache.addAll([...SHELL,...new Set(assets)]);
  // Icons are cosmetic: an unavailable icon must not prevent an otherwise usable offline app.
  await Promise.all(ICONS.map(path=>cache.add(path).catch(()=>undefined)));
  await trim(cache);
}
self.addEventListener('install',event=>{
  event.waitUntil(installShell().then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(!mayCache(request,url))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(request);
      if(response.ok&&response.type==='basic'){
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.put(request,copy);await trim(cache);}).catch(()=>undefined));
      }
      return response;
    }catch(error){
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate'){
        const fallback=await caches.match(new URL('./index.html',scope))??await caches.match(scope);
        if(fallback)return fallback;
      }
      throw error;
    }
  })());
});
