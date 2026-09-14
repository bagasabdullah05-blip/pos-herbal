// Dexie IndexedDB cache - bikin buka dari internet tetap cepat (stale-while-revalidate)
// CDN: https://cdn.jsdelivr.net/npm/dexie@4/dist/dexie.min.js

let db = null;
async function loadDexie(){
  if(window.Dexie) return window.Dexie;
  return new Promise((res, rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/dexie@4/dist/dexie.min.js';
    s.onload=()=>res(window.Dexie);
    s.onerror=rej;
    document.head.appendChild(s);
  });
}
async function initDexie(){
  if(!window.CACHE_CONFIG?.useDexie) return null;
  try{
    const Dexie = await loadDexie();
    db = new Dexie('pos_outlet');
    db.version(1).stores({
      produk: 'id,barcode,sku,kategori,nama',
      member: 'id,hp,level',
      trx: 'id,waktu,outlet_id',
      meta: 'key'
    });
    console.log('[dexie] ready');
    return db;
  }catch(e){ console.warn('[dexie] gagal', e); return null; }
}
function getDexie(){ return db; }

// Sync helpers: Supabase -> Dexie -> UI, biar first paint dari cache <50ms
async function cachePut(store, items){
  if(!db) return;
  try{ await db[store].bulkPut(items); }catch(e){ console.warn('cachePut', store, e.message); }
}
async function cacheGetAll(store){
  if(!db) return null;
  try{ return await db[store].toArray(); }catch{ return null; }
}
window.initDexie = initDexie;
window.getDexie = getDexie;
window.cachePut = cachePut;
window.cacheGetAll = cacheGetAll;
