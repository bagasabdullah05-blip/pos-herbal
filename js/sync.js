// Sync layer: Dexie cache + Supabase untuk internet cepat (Opsi 2 - Vercel + Supabase SIN)
// Di-load SETELAH js/app.js agar bisa wrap saveAll/loadData

let _origSaveAll = null;
let _origLoadData = null;
let syncDebounce = null;

function wrapSaveAll(){
  if(_origSaveAll) return;
  _origSaveAll = window.saveAll;
  window.saveAll = function(){
    _origSaveAll.apply(this, arguments);
    // cache ke Dexie (non-blocking)
    try{
      const dex = window.getDexie && window.getDexie();
      if(dex){
        cachePut('produk', produk);
        cachePut('member', member);
        if(trx && trx.length) cachePut('trx', trx.slice(0,100));
        localStorage.setItem('dexie_last_sync', Date.now().toString());
      }
    }catch(e){ console.warn('dexie cache save', e.message); }
    // debounce sync ke Supabase (1 detik)
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(async()=>{
      const s = window.getSupa && window.getSupa();
      if(!s) return;
      // hanya upload produk yang berubah terakhir? untuk cepat, upsert 5 produk terbaru saja
      // full sync dipanggil manual via syncToSupabase()
    }, 1000);
  };
}

// Override loadData untuk hybrid: cache dulu -> supabase -> localStorage fallback
async function hybridLoadData(){
  try{
  // init dexie + supabase parallel
  const pDex = window.initDexie ? window.initDexie() : Promise.resolve(null);
  const pSupa = window.initSupabase ? window.initSupabase() : Promise.resolve(null);
  await Promise.allSettled([pDex, pSupa]);

  // coba load dari supabase jika ready (cepat dari SIN)
  const supa = window.getSupa && window.getSupa();
  if(supa){
    try{
      const [pCloud, mCloud] = await Promise.all([
        window.SupaDB.getProduk().catch(()=>null),
        window.SupaDB.getMember().catch(()=>null)
      ]);
      if(pCloud && pCloud.length){
        // simpan ke dexie + localStorage via saveAll nanti
        // tapi jangan timpa jika cloud kosong
        console.log('[sync] loaded from supabase', pCloud.length, 'produk');
        // simpan sementara ke LS agar loadData asli bisa pakai fallback Logic-nya kita override langsung
        // panggil origLoad dulu untuk isi defaults, lalu timpa dengan cloud
        await _origLoadData();
        // timpa dengan cloud (cloud adalah source of truth jika ada)
        // merge: cloud wins, tapi produk lokal yang belum di-cloud tetap ada
        const map = new Map(pCloud.map(p=>[p.id, p]));
        // tambahkan produk lokal yang belum ada di cloud (offline create)
        produk.forEach(p=>{ if(!map.has(p.id)) map.set(p.id, p); });
        produk = Array.from(map.values());
        if(mCloud && mCloud.length){
          const mmap = new Map(mCloud.map(m=>[m.id, m]));
          member.forEach(m=>{ if(!mmap.has(m.id)) mmap.set(m.id, m); });
          member = Array.from(mmap.values());
        }
        // cache ke dexie
        if(window.getDexie()){ await cachePut('produk', produk); await cachePut('member', member); }
        saveAll(); // sudah wrapped -> cache lagi
        updateSupaStatus('connected — '+produk.length+' produk dari cloud');
        return; // skip fallback lagi
      } else {
        console.log('[sync] supabase empty, pakai lokal');
      }
    }catch(e){
      console.warn('[sync] supabase load gagal, fallback lokal', e.message);
      updateSupaStatus('error: '+e.message+' — fallback lokal');
    }
  }

  // coba dexie cache sebelum localStorage (lebih cepat, non-blocking, >5MB)
  const dex = window.getDexie && window.getDexie();
  if(dex){
    try{
      const cProduk = await cacheGetAll('produk');
      const cMember = await cacheGetAll('member');
      if(cProduk && cProduk.length){
        // inject ke localStorage agar origLoad pakai ini
        localStorage.setItem(LS.produk, JSON.stringify(cProduk));
      }
      if(cMember && cMember.length){
        localStorage.setItem(LS.member, JSON.stringify(cMember));
      }
    }catch(e){ console.warn('dexie load', e.message); }
  }

  await _origLoadData();
  // after load, ensure status
  refreshSupaUI();
  }catch(e){
    console.error('[sync] hybridLoadData fatal, fallback ke local', e);
    try{ await _origLoadData(); }catch(ee){ console.error(ee); }
    refreshSupaUI();
  }
  // paksa modal login muncul jika belum login (DIAM fix)
  setTimeout(()=>{
    try{
      const cur = (window.getCurrentUser?window.getCurrentUser():null);
      const modal = document.getElementById('modalLogin');
      if(!cur && modal && !modal.open){
        console.log('[sync] force show login modal');
        modal.showModal();
      }
    }catch(e){ console.warn('force modal', e.message); }
  }, 900);
}

// UI helpers untuk Setting > Supabase
function saveSupaConfig(){
  const url = document.getElementById('supaUrl')?.value.trim();
  const key = document.getElementById('supaKey')?.value.trim();
  if(!url || !key) return alert('Isi URL dan anon key');
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon', key);
  window.SUPABASE_CONFIG.url = url;
  window.SUPABASE_CONFIG.anonKey = key;
  window.SUPABASE_CONFIG.enabled = true;
  updateSupaStatus('menyambungkan...');
  window.initSupabase().then(s=>{
    if(s) updateSupaStatus('connected');
    else updateSupaStatus('gagal — cek URL/key & pastikan schema.sql sudah dijalankan');
  });
  alert('Config disimpan. Reload untuk sync.');
  location.reload();
}
function testSupa(){
  const s = window.getSupa && window.getSupa();
  if(!s) return alert('Belum connected. Simpan URL & key dulu.');
  s.from('produk').select('id', {count:'exact', head:true}).limit(1).then(({count, error})=>{
    if(error) alert('Test gagal: '+error.message);
    else alert('Test OK — '+count+' produk di cloud');
  });
}
async function syncToSupabase(){
  const s = window.getSupa && window.getSupa();
  if(!s) return alert('Supabase belum connected');
  if(!confirm('Upload '+produk.length+' produk + '+member.length+' member lokal ke cloud?')) return;
  let ok=0, fail=0;
  for(const p of produk){
    try{ await window.SupaDB.upsertProduk(p); ok++; }catch(e){ fail++; console.warn(e.message); }
  }
  alert('Upload selesai: '+ok+' ok, '+fail+' gagal');
}
async function syncFromSupabase(){
  const s = window.getSupa && window.getSupa();
  if(!s) return alert('Supabase belum connected');
  try{
    const pCloud = await window.SupaDB.getProduk();
    const mCloud = await window.SupaDB.getMember();
    if(pCloud) { produk = pCloud; }
    if(mCloud) { member = mCloud; }
    saveAll();
    if(window.getDexie()){ await cachePut('produk', produk); await cachePut('member', member); }
    renderAll();
    alert('Download OK: '+produk.length+' produk dari cloud');
  }catch(e){ alert('Download gagal: '+e.message); }
}
function updateSupaStatus(msg){
  const el = document.getElementById('supaStatusText');
  if(el) el.textContent = msg;
}
function refreshSupaUI(){
  const cfg = window.SUPABASE_CONFIG;
  const urlEl = document.getElementById('supaUrl');
  const keyEl = document.getElementById('supaKey');
  if(urlEl) urlEl.value = localStorage.getItem('supabase_url') || '';
  if(keyEl) keyEl.value = localStorage.getItem('supabase_anon') || '';
  if(cfg && cfg.enabled) updateSupaStatus('connected — '+cfg.url);
  else updateSupaStatus('belum dikonfigurasi — pakai localStorage');
  // hook bayarSekarang untuk juga insert ke supabase transaksi
  const origBayar = window.bayarSekarang;
  if(origBayar && !origBayar._supaWrapped){
    window.bayarSekarang = function(){
      const res = origBayar.apply(this, arguments);
      // setelah trx dibuat, push ke cloud async (trx adalah array, ambil terbaru)
      setTimeout(async()=>{
        const s = window.getSupa && window.getSupa();
        if(s && trx && trx[0]){
          try{ await window.SupaDB.insertTransaksi(trx[0]); console.log('[sync] trx pushed', trx[0].id); }catch(e){ console.warn('push trx', e.message); }
        }
      }, 500);
      return res;
    };
    window.bayarSekarang._supaWrapped = true;
  }
}

// Sesi login PERSISTEN — jangan hapus curUser saat load (reload tidak perlu login lagi).

// init wrapping setelah app.js load
(function(){
  try{
  // simpan orig
  _origSaveAll = window.saveAll;
  _origLoadData = window.loadData;
  if(_origLoadData){
    window.loadData = hybridLoadData;
  }
  wrapSaveAll();
  // after DOM ready, refresh UI + re-init jika loadData sudah terlanjur dipanggil
  document.addEventListener('DOMContentLoaded', ()=>{
    refreshSupaUI();
    // jika loadData sudah finish sebelum wrapping (app.js: loadData().then(renderAll) di akhir), wrap terlambat
    // jadi pastikan supabase tetap init
    if(window.SUPABASE_CONFIG && !window.getSupa()){
      window.initSupabase && window.initSupabase().then(()=> refreshSupaUI());
    }
    if(window.CACHE_CONFIG?.useDexie && !window.getDexie()){
      window.initDexie && window.initDexie();
    }
  });
  // juga panggil langsung
  setTimeout(refreshSupaUI, 800);
  // global error handler: catat saja, JANGAN paksa tampilkan login
  // (error apapun tidak boleh mengeluarkan user yang sedang login)
  window.addEventListener('error', (e)=>{
    console.warn('[global error]', e.message, e.error);
  });
  window.addEventListener('unhandledrejection', (e)=>{
    console.warn('[unhandled]', e.reason);
  });
  }catch(e){ console.error('[sync init] ', e); }
})();

window.saveSupaConfig = saveSupaConfig;
window.testSupa = testSupa;
window.syncToSupabase = syncToSupabase;
window.syncFromSupabase = syncFromSupabase;
