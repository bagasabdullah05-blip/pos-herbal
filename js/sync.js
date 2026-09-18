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

  // paksa hard reset sekali untuk semua device yang masih cache lama
  try{
    const urlParams=new URLSearchParams(location.search);
    if(urlParams.has('hard_reset') || !localStorage.getItem('hard_reset_v44')){
      localStorage.setItem('hard_reset_v44','1');
      // jangan loop — hanya bersihkan herbal_* yang usang, bukan supabase_url yang sudah fix
    }
    if(urlParams.has('hard_reset')) history.replaceState(null,'',location.pathname);
  }catch{}
  const supa = window.getSupa && window.getSupa();
  // MODE: Pure Supabase — semua load dari cloud, local diabaikan
  if(supa){
    try{
      // PURE SUPABASE: langsung ambil semua dari cloud, tanpa baca localStorage dulu
      const [pCloud, mCloud, supCloud, promoCloud, trxCloud, beliCloud, opCloud, shiftCloud, outletCloud, userCloud, katCloud] = await Promise.all([
        window.SupaDB.getProduk().catch(e=>{ console.warn('pCloud',e.message); return null; }),
        window.SupaDB.getMember().catch(e=>{ console.warn('mCloud',e.message); return null; }),
        window.SupaDB.getSupplier().catch(e=>{ console.warn('supCloud',e.message); return null; }),
        window.SupaDB.getPromo ? window.SupaDB.getPromo().catch(()=>null) : Promise.resolve(null),
        window.SupaDB.getTransaksi ? window.SupaDB.getTransaksi({limit:200}).catch(()=>null) : Promise.resolve(null),
        supa.from('pembelian').select('*').order('waktu',{ascending:false}).limit(200).then(r=> r.error? null : r.data.map(x=>({waktu:x.waktu, outlet:x.outlet_id, supplier:x.supplier_id, produk:x.produk_id, qty:x.qty, hpp:x.hpp, batch:x.batch, exp:x.exp, ket:x.ket}))).catch(()=>null),
        supa.from('opname').select('*').order('waktu',{ascending:false}).limit(200).then(r=> r.error? null : r.data.map(x=>({waktu:x.waktu, outlet:x.outlet_id, produk:x.produk_id, sistem:x.sistem, fisik:x.fisik, selisih:x.selisih}))).catch(()=>null),
        supa.from('shifts').select('*').order('buka_at',{ascending:false}).limit(100).then(r=> r.error? null : r.data.map(s=>({id:s.id, outlet:s.outlet_id, user:s.user_id, userNama:s.user_id, buka:s.buka_at, tutup:s.tutup_at, saldoAwal:s.modal_awal, omzet:0, transaksi:0, status:s.status==='buka'?'buka':'tutup'}))).catch(()=>null),
        supa.from('outlets').select('*').then(r=> r.error? null : r.data).catch(()=>null),
        supa.from('users').select('*').then(r=> r.error? null : r.data.map(u=>({id:u.id, nama:u.nama, username:u.username||u.nama, password:u.password||u.pin, role:u.role==='Admin'?'Owner':u.role, outletId:u.outlet_id, outletIds:u.outlet_ids||(u.outlet_id?[u.outlet_id]:[])}))).catch(()=>null),
        supa.from('kategori').select('nama').then(r=> r.error? null : r.data.map(x=>x.nama)).catch(()=>null)
      ]);
      // tetap panggil _origLoadData untuk inisialisasi struktur dasar (LS keys, default), tapi langsung timpa dengan cloud
      await _origLoadData();
      // PURE but keep extra local not yet in cloud (push them)
      if(pCloud !== null){
        if(pCloud.length < produk.length){
          const extra=produk.filter(p=> !pCloud.some(c=>c.id===p.id));
          if(extra.length){ console.log('[sync] push extra produk', extra.length); setTimeout(async()=>{ for(const p of extra) await window.SupaDB.upsertProduk(p).catch(()=>{}); }, 500); }
          const map=new Map(pCloud.map(p=>[p.id,p])); produk.forEach(p=>{ if(!map.has(p.id)) map.set(p.id,p); }); produk=Array.from(map.values());
        } else { console.log('[sync] PURE produk', pCloud.length); produk = pCloud; }
      }
      if(mCloud !== null){
        if(mCloud.length < member.length){
          const extra=member.filter(m=> !mCloud.some(c=>c.id===m.id));
          if(extra.length) setTimeout(async()=>{ for(const m of extra) await window.SupaDB.upsertMember(m).catch(()=>{}); }, 500);
          const map=new Map(mCloud.map(m=>[m.id,m])); member.forEach(m=>{ if(!map.has(m.id)) map.set(m.id,m); }); member=Array.from(map.values());
        } else { console.log('[sync] PURE member', mCloud.length); member = mCloud; }
      }
      if(supCloud !== null){
        if(supCloud.length < supplier.length){
          const extra=supplier.filter(s=> !supCloud.some(c=>c.id===s.id));
          if(extra.length) setTimeout(async()=>{ for(const s of extra) await window.SupaDB.upsertSupplier(s).catch(()=>{}); }, 500);
          const map=new Map(supCloud.map(s=>[s.id,s])); supplier.forEach(s=>{ if(!map.has(s.id)) map.set(s.id,s); }); supplier=Array.from(map.values());
        } else { console.log('[sync] PURE supplier', supCloud.length); supplier = supCloud; }
      }
      if(promoCloud !== null){
        if(promoCloud.length < promo.length){
          const extra=promo.filter(p=> !promoCloud.some(c=>c.id===p.id));
          if(extra.length) setTimeout(async()=>{ for(const p of extra) await window.SupaDB.upsertPromo(p).catch(()=>{}); }, 500);
          const map=new Map(promoCloud.map(p=>[p.id,p])); promo.forEach(p=>{ if(!map.has(p.id)) map.set(p.id,p); }); promo=Array.from(map.values());
        } else if(promoCloud.length) promo = promoCloud;
      }
      if(trxCloud !== null){ trx = trxCloud.map(t=>({id:t.id, waktu:t.waktu, outlet:t.outlet_id, user_id:t.user_id, member:t.member_id, cart:t.cart, subtotal:t.subtotal, diskon:t.diskon, ppn:t.ppn, total:t.total, pay:t.bayar, bayar:t.total, kembalian:0, status:t.status, laba:0})); console.log('[sync] PURE trx', trx.length); }
      if(beliCloud !== null) pembelian = beliCloud || [];
      if(opCloud !== null) opname = opCloud || [];
      if(shiftCloud !== null) shifts = shiftCloud || [];
      if(outletCloud !== null && outletCloud.length){ outlets = outletCloud.map(o=>({id:o.id, nama:o.nama})); console.log('[sync] PURE outlets', outlets.length); }
      if(userCloud !== null){
        if(userCloud.length < users.length){
          const extra=users.filter(u=> !userCloud.some(c=>c.id===u.id));
          if(extra.length){ console.log('[sync] push extra users', extra.map(u=>u.username)); setTimeout(async()=>{ for(const u of extra) await window.SupaDB.upsertUser(u).catch(e=> console.warn('push user',e.message)); }, 500); }
          const map=new Map(userCloud.map(u=>[u.id,u])); users.forEach(u=>{ if(!map.has(u.id)) map.set(u.id,u); }); users=Array.from(map.values());
        } else if(userCloud.length){ users = userCloud; console.log('[sync] PURE users', users.length); }
      }
      if(katCloud !== null && katCloud.length){ kategoriList = katCloud; }
      try{ localStorage.setItem(LS.produk, JSON.stringify(produk)); localStorage.setItem(LS.member, JSON.stringify(member)); localStorage.setItem(LS.sup, JSON.stringify(supplier)); localStorage.setItem(LS.promo, JSON.stringify(promo)); localStorage.setItem(LS.trx, JSON.stringify(trx)); localStorage.setItem(LS.beli, JSON.stringify(pembelian)); localStorage.setItem(LS.op, JSON.stringify(opname)); }catch{}
      if(window.getDexie()){
        await cachePut('produk', produk);
        await cachePut('member', member);
      }
      updateSupaStatus('connected — ONLINE Supabase ('+(pCloud?.length||0)+' produk, '+(trxCloud?.length||0)+' trx)');
      refreshSupaUI();
      saveAll();
      return;
    }catch(e){
      console.warn('[sync] supabase pure load gagal', e.message);
      updateSupaStatus('OFFLINE — butuh internet untuk load Supabase');
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
async function hardResetSupabase(){
  try{
    // simpan supabase url dulu
    const keepUrl=localStorage.getItem('supabase_url')||FIXED_SUPA_URL;
    const keepKey=localStorage.getItem('supabase_anon')||FIXED_SUPA_KEY;
    Object.keys(localStorage).forEach(k=>{ if(k.startsWith('herbal_')||k.startsWith('dexie_')) localStorage.removeItem(k); });
    localStorage.setItem('supabase_url', keepUrl); localStorage.setItem('supabase_anon', keepKey);
    localStorage.setItem('hard_reset_v45','1');
    try{ sessionStorage.clear(); }catch{}
    if(window.getDexie && window.getDexie()){
      try{ const db=window.getDexie(); if(db){ try{await db.produk.clear();}catch{} try{await db.member.clear();}catch{} try{await db.trx.clear();}catch{} try{await db.supplier?.clear();}catch{} } }catch{}
      try{ indexedDB.deleteDatabase('pos_outlet'); }catch{}
      try{ indexedDB.deleteDatabase('pos_outlet_db'); }catch{}
    }
    if('caches' in window){ try{ const keys=await caches.keys(); for(const k of keys) await caches.delete(k); }catch{} }
    if('serviceWorker' in navigator){ try{ const regs=await navigator.serviceWorker.getRegistrations(); for(const r of regs) await r.unregister(); }catch{} }
    // paksa reload tanpa cache
    location.href=location.origin+location.pathname+'?hard_reset=1&v=v45&t='+Date.now();
  }catch(e){
    try{ localStorage.clear(); }catch{}
    location.href=location.origin+location.pathname+'?hard_reset=1&t='+Date.now();
  }
}
async function bersihkanCacheLokal(){
  if(!confirm('Bersihkan SEMUA cache lokal dan paksa reload Supabase (hard reset)?')) return;
  return hardResetSupabase();
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
    // hapusSupplier dipanggil sebagai hapusSupplier('S003') — id ada
    if(id) await window.SupaDB.deleteSupplier(id).catch(e=> console.warn('delete supplier cloud', e.message));
    else {
      // fallback: jika id tidak ada (dipanggil tanpa arg), sync full akan handle
    }
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
  wrap('hapusMember', async(id)=>{
    const delId=id||window._lastDeletedMemberId;
    if(delId) await window.SupaDB.deleteMember(delId).catch(()=>{});
  });
  const _origHapusMember=window.hapusMember;
  if(_origHapusMember && !_origHapusMember._track){
    window.hapusMember=function(id){ window._lastDeletedMemberId=id; return _origHapusMember.apply(this, arguments); };
    _origHapusMember._track=true;
  }
  wrap('simpanPromo', async()=>{
    const id=document.getElementById('pr_id')?.value;
    const p=promo.find(x=>x.id===id);
    if(p) await window.SupaDB.upsertPromo(p).catch(e=> console.warn('upsert promo',e.message));
  });
  wrap('hapusPromo', async(id)=>{
    const delId=id||window._lastDeletedPromoId;
    if(delId) await window.SupaDB.deletePromo(delId).catch(()=>{});
  });
  const _origHapusPromo=window.hapusPromo;
  if(_origHapusPromo && !_origHapusPromo._track){
    window.hapusPromo=function(id){ window._lastDeletedPromoId=id; return _origHapusPromo.apply(this, arguments); };
    _origHapusPromo._track=true;
  }
  wrap('simpanUser', async()=>{
    const id=document.getElementById('u_id')?.value;
    const u=users.find(x=>x.id===id);
    if(u) await window.SupaDB.upsertUser(u).catch(e=> console.warn('upsert user',e.message));
  });
  wrap('hapusUser', async(id)=>{
    const delId=id||window._lastDeletedUserId;
    if(delId) await window.SupaDB.deleteUser(delId).catch(()=>{});
  });
  const _origHapusUser=window.hapusUser;
  if(_origHapusUser && !_origHapusUser._track){
    window.hapusUser=function(id){ window._lastDeletedUserId=id; return _origHapusUser.apply(this, arguments); };
    _origHapusUser._track=true;
  }
  wrap('hapusProduk', async(id)=>{
    const delId=id||window._lastDeletedProdukId;
    if(delId) await window.SupaDB.deleteProduk(delId).catch(()=>{});
  });
  const _origHapusProduk=window.hapusProduk;
  if(_origHapusProduk && !_origHapusProduk._track){
    window.hapusProduk=function(id){ window._lastDeletedProdukId=id; return _origHapusProduk.apply(this, arguments); };
    _origHapusProduk._track=true;
  }
  // pembelian & opname realtime push
  const origTerima = window.terimaBarang;
  if(origTerima && !origTerima._supaWrapped){
    window.terimaBarang = function(...args){
      const res = origTerima.apply(this, args);
      const s=window.getSupa && window.getSupa();
      if(s && res) window.SupaDB.insertPembelian(res).catch(()=>{});
      return res;
    }; window.terimaBarang._supaWrapped=true;
  }
  const origOpname = window.simpanOpnameRows;
  if(origOpname && !origOpname._supaWrapped){
    window.simpanOpnameRows = function(...args){
      const before=opname.length;
      const res=origOpname.apply(this, args);
      const s=window.getSupa && window.getSupa();
      if(s){
        const added=opname.slice(0, opname.length-before);
        added.forEach(o=> window.SupaDB.insertOpname(o).catch(()=>{}));
      }
      return res;
    }; window.simpanOpnameRows._supaWrapped=true;
  }
  // shifts realtime push
  const origBuka = window.bukaShift;
  if(origBuka && !origBuka._supaWrapped){
    window.bukaShift = function(...args){
      const res=origBuka.apply(this, args);
      const s=window.getSupa && window.getSupa();
      if(s && shifts[0]) supa.from('shifts').upsert({id:shifts[0].id, outlet_id:shifts[0].outlet, user_id:shifts[0].user, buka_at:shifts[0].buka, status:'buka', modal_awal:shifts[0].saldoAwal||0}).then(()=>{},()=>{});
      return res;
    }; window.bukaShift._supaWrapped=true;
  }
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

window.hardResetSupabase = hardResetSupabase;
window.bersihkanCacheLokal = bersihkanCacheLokal;
window.saveSupaConfig = saveSupaConfig;
window.testSupa = testSupa;
window.syncToSupabase = syncToSupabase;
window.syncFromSupabase = syncFromSupabase;
