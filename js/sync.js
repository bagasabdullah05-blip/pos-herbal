// Sync layer: Dexie cache + Supabase (realtime) — semua entitas
let _origSaveAll = null;
let _origLoadData = null;
let syncDebounce = null;
let lastPushed = {produk:0, member:0, supplier:0, promo:0};

function wrapSaveAll(){
  if(_origSaveAll) return;
  _origSaveAll = window.saveAll;
  window.saveAll = function(){
    _origSaveAll.apply(this, arguments);
    try{
      const dex = window.getDexie && window.getDexie();
      if(dex){
        cachePut('produk', produk);
        cachePut('member', member);
        if(trx && trx.length) cachePut('trx', trx.slice(0,100));
        localStorage.setItem('dexie_last_sync', Date.now().toString());
      }
    }catch(e){ console.warn('dexie cache save', e.message); }
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(async()=>{
      const s = window.getSupa && window.getSupa();
      if(!s) return;
      try{
        // push yang berubah — untuk sekarang push supplier/produk/member yang baru diedit akan di-handle di simpan* langsung,
        // debounced ini untuk jaga-jaga jika ada perubahan lain
      }catch(e){ console.warn('[sync debounce]', e.message); }
    }, 1200);
  };
}

async function hybridLoadData(){
  try{
  const pDex = window.initDexie ? window.initDexie() : Promise.resolve(null);
  const pSupa = window.initSupabase ? window.initSupabase() : Promise.resolve(null);
  await Promise.allSettled([pDex, pSupa]);

  const supa = window.getSupa && window.getSupa();
  // MODE: Pure Supabase — online wajib, semua device load dari cloud saja
  if(supa){
    try{
      const [pCloud, mCloud, supCloud, promoCloud] = await Promise.all([
        window.SupaDB.getProduk().catch(()=>null),
        window.SupaDB.getMember().catch(()=>null),
        window.SupaDB.getSupplier().catch(()=>null),
        window.SupaDB.getPromo ? window.SupaDB.getPromo().catch(()=>null) : Promise.resolve(null)
      ]);
      // load outlets/users/kategori/etc tetap via _origLoadData (masih local, akan di-migrate ke cloud nanti)
      await _origLoadData();
      // PURE: pakai cloud sebagai sumber utama
      if(pCloud !== null){
        if(pCloud.length===0 && produk.length>0){
          console.log('[sync] cloud kosong, seed dari lokal', produk.length);
          setTimeout(async()=>{ for(const p of produk) await window.SupaDB.upsertProduk(p).catch(()=>{}); }, 500);
        } else {
          console.log('[sync] Supabase-only produk', pCloud.length);
          produk = pCloud || [];
        }
      }
      if(mCloud !== null){
        if(mCloud.length===0 && member.length>2){
          setTimeout(async()=>{ for(const m of member) await window.SupaDB.upsertMember(m).catch(()=>{}); }, 500);
        } else { member = mCloud || []; }
      }
      if(supCloud !== null){
        if(supCloud.length===0 && supplier.length>0){
          setTimeout(async()=>{ for(const s of supplier) await window.SupaDB.upsertSupplier(s).catch(()=>{}); }, 500);
        } else { supplier = supCloud || []; }
      }
      if(promoCloud !== null && promoCloud.length) promo = promoCloud;
      // simpan ke cache lokal hanya sebagai backup, bukan sumber
      try{ localStorage.setItem(LS.produk, JSON.stringify(produk)); localStorage.setItem(LS.member, JSON.stringify(member)); localStorage.setItem(LS.sup, JSON.stringify(supplier)); }catch{}
      if(window.getDexie()){
        await cachePut('produk', produk);
        await cachePut('member', member);
      }
      updateSupaStatus('connected — ONLINE Supabase ('+(pCloud?.length||0)+' produk)');
      refreshSupaUI();
      // jangan fallback ke Dexie/local lagi
      saveAll();
      return;
    }catch(e){
      console.warn('[sync] supabase pure load gagal', e.message);
      updateSupaStatus('OFFLINE — butuh internet untuk load Supabase');
      // tampilkan error, jangan fallback diam-diam
      alert('Gagal load dari Supabase (butuh online): '+e.message);
      throw e;
    }
  }

  const dex = window.getDexie && window.getDexie();
  if(dex){
    try{
      const cProduk = await cacheGetAll('produk');
      const cMember = await cacheGetAll('member');
      if(cProduk && cProduk.length) localStorage.setItem(LS.produk, JSON.stringify(cProduk));
      if(cMember && cMember.length) localStorage.setItem(LS.member, JSON.stringify(cMember));
    }catch(e){ console.warn('dexie load', e.message); }
  }

  await _origLoadData();
  refreshSupaUI();
  }catch(e){
    console.error('[sync] hybridLoadData fatal, fallback ke local', e);
    try{ await _origLoadData(); }catch(ee){ console.error(ee); }
    refreshSupaUI();
  }
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
  if(!confirm('Upload '+produk.length+' produk + '+member.length+' member + '+supplier.length+' supplier lokal ke cloud?')) return;
  let ok=0, fail=0;
  for(const p of produk){ try{ await window.SupaDB.upsertProduk(p); ok++; }catch(e){ fail++; } }
  for(const m of member){ try{ await window.SupaDB.upsertMember(m); ok++; }catch(e){ fail++; } }
  for(const sup of supplier){ try{ await window.SupaDB.upsertSupplier(sup); ok++; }catch(e){ fail++; } }
  alert('Upload selesai: '+ok+' ok, '+fail+' gagal');
}
async function syncFromSupabase(){
  const s = window.getSupa && window.getSupa();
  if(!s) return alert('Supabase belum connected');
  try{
    const pCloud = await window.SupaDB.getProduk();
    const mCloud = await window.SupaDB.getMember();
    const supCloud = await window.SupaDB.getSupplier();
    if(pCloud) produk = pCloud;
    if(mCloud) member = mCloud;
    if(supCloud) supplier = supCloud;
    saveAll();
    if(window.getDexie()){ await cachePut('produk', produk); await cachePut('member', member); }
    renderAll();
    alert('Download OK: '+(pCloud?.length||0)+' produk, '+(supCloud?.length||0)+' supplier dari cloud');
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
  const origBayar = window.bayarSekarang;
  if(origBayar && !origBayar._supaWrapped){
    window.bayarSekarang = function(){
      const res = origBayar.apply(this, arguments);
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
  // wrap supplier/produk/member simpan agar langsung push ke cloud (realtime)
  const wrap = (fnName, handler)=>{
    const orig = window[fnName];
    if(!orig || orig._supaWrapped) return;
    window[fnName] = async function(...args){
      const res = orig.apply(this, args);
      const s = window.getSupa && window.getSupa();
      if(s){
        try{ await handler(...args); }catch(e){ console.warn('[sync push]', fnName, e.message); }
      }
      return res;
    };
    window[fnName]._supaWrapped=true;
  };
  wrap('simpanSupplier', async()=>{
    const id=document.getElementById('s_id')?.value;
    const sup=supplier.find(x=>x.id===id);
    if(sup) await window.SupaDB.upsertSupplier(sup).catch(()=>{});
  });
  wrap('hapusSupplier', async(id)=>{
    // id bisa undefined jika dipanggil tanpa arg (via confirm), ambil dari closure tidak bisa — skip, sync via full upload
  });
  wrap('simpanProduk', async()=>{
    const id=document.getElementById('p_id')?.value;
    const p=produk.find(x=>x.id===id);
    if(p) await window.SupaDB.upsertProduk(p).catch(()=>{});
  });
  wrap('simpanMember', async()=>{
    const id=document.getElementById('m_id')?.value;
    const m=member.find(x=>x.id===id);
    if(m) await window.SupaDB.upsertMember(m).catch(()=>{});
  });
}

// Sesi login PERSISTEN

(function(){
  try{
  _origSaveAll = window.saveAll;
  _origLoadData = window.loadData;
  if(_origLoadData) window.loadData = hybridLoadData;
  wrapSaveAll();
  document.addEventListener('DOMContentLoaded', ()=>{
    refreshSupaUI();
    if(window.SUPABASE_CONFIG && !window.getSupa()){
      window.initSupabase && window.initSupabase().then(()=> refreshSupaUI());
    }
    if(window.CACHE_CONFIG?.useDexie && !window.getDexie()){
      window.initDexie && window.initDexie();
    }
  });
  setTimeout(refreshSupaUI, 800);
  window.addEventListener('error', (e)=>{ console.warn('[global error]', e.message, e.error); });
  window.addEventListener('unhandledrejection', (e)=>{ console.warn('[unhandled]', e.reason); });
  }catch(e){ console.error('[sync init] ', e); }
})();

window.saveSupaConfig = saveSupaConfig;
window.testSupa = testSupa;
window.syncToSupabase = syncToSupabase;
window.syncFromSupabase = syncFromSupabase;
