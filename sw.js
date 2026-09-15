const CACHE='herbal-pos-multioutlet-v35';
const ASSETS=['/css/style.css','/js/app.js','/manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  // Network-first untuk HTML/JS/CSS agar update selalu segar saat online, fallback cache saat offline
  const accept=e.request.headers.get('accept')||'';
  let path='';
  try{ path=new URL(e.request.url).pathname; }catch{}
  if(accept.includes('text/html')||path.startsWith('/js/')||path.startsWith('/css/')){
    e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(CACHE).then(cache=>cache.put(e.request,c)); return r; }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).then(res=>{ const c=res.clone(); caches.open(CACHE).then(cache=>cache.put(e.request,c)); return res; }).catch(()=> r)));
});
