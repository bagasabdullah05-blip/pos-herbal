// Supabase client wrapper untuk POS - Vercel Edge + Singapore
let supa = null;
let supaReady = false;

async function loadSupabaseLib(){
  if(window.supabase) return window.supabase;
  return new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = ()=> res(window.supabase);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initSupabase(){
  const cfg = window.SUPABASE_CONFIG;
  if(!cfg || !cfg.url || !cfg.anonKey){
    console.log('[supabase] belum dikonfigurasi');
    return null;
  }
  try{
    const lib = await loadSupabaseLib();
    supa = lib.createClient(cfg.url, cfg.anonKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
      global: { headers: { 'x-pos-outlet': '1' } }
    });
    const { error } = await supa.from('produk').select('id', {count:'exact', head:true}).limit(1);
    if(error) throw error;
    supaReady = true;
    cfg.enabled = true;
    console.log('[supabase] connected', cfg.url);
    setupRealtime();
    return supa;
  }catch(e){
    console.warn('[supabase] connect gagal, fallback localStorage', e.message);
    supaReady = false;
    return null;
  }
}

function getSupa(){ return supaReady ? supa : null; }

// Realtime — semua channel update langsung tanpa reload
let realtimeChannels = [];
function setupRealtime(){
  const s = getSupa(); if(!s) return;
  try{ realtimeChannels.forEach(ch=>{ try{ s.removeChannel(ch); }catch{} }); }catch{}
  realtimeChannels=[];
  const tables = ['produk','member','supplier','promo','transaksi','shifts','pembelian','opname','outlets','users','kategori'];
  tables.forEach(tbl=>{
    try{
      const ch = s.channel('rt-'+tbl)
        .on('postgres_changes', {event:'*', schema:'public', table: tbl}, payload=>{
          console.log('[realtime]', tbl, payload.eventType, payload.new?.id||payload.old?.id);
          // reload ringan — debounce agar tidak spam jika banyak event
          clearTimeout(window._rtDebounce);
          window._rtDebounce=setTimeout(async()=>{
            try{
              if(tbl==='produk'){ const d=await SupaDB.getProduk(); if(d){ produk=d; localStorage.setItem(LS.produk, JSON.stringify(produk)); renderProdukGrid(); renderTabelProduk(); renderStok(); } }
              if(tbl==='member'){ const d=await SupaDB.getMember(); if(d){ member=d; localStorage.setItem(LS.member, JSON.stringify(member)); renderTabelMember(); renderMemberSelect(); } }
              if(tbl==='supplier'){ const d=await SupaDB.getSupplier(); if(d){ supplier=d; localStorage.setItem(LS.sup, JSON.stringify(supplier)); renderSupplier(); } }
              if(tbl==='promo'){ const d=await SupaDB.getPromo(); if(d){ promo=d; localStorage.setItem(LS.promo, JSON.stringify(promo)); renderPromo(); } }
              if(tbl==='transaksi'){ const d=await SupaDB.getTransaksi({outletId: currentOutlet, limit:50}); if(d){ /* merge — realtime transaksi sudah di-push via insert, reload laporan jika perlu */ renderLaporan(); } }
              if(tbl==='shifts'){ renderShift(); }
              if(tbl==='pembelian'){ renderPembelian(); renderStok(); }
              if(tbl==='opname'){ renderOpname(); }
              if(tbl==='outlets'){ const d=await supa.from('outlets').select('*'); if(d.data){ outlets=d.data; localStorage.setItem(LS.outlet, JSON.stringify(outlets)); renderOutlet(); } }
              if(tbl==='users'){ const d=await supa.from('users').select('*'); if(d.data){ users=d.data.map(u=>({id:u.id, nama:u.nama, username:u.username||u.nama, password:u.password||u.pin||'', role:u.role==='Admin'?'Owner':u.role, outletId:u.outlet_id, outletIds:u.outlet_ids||(u.outlet_id?[u.outlet_id]:[])})); localStorage.setItem(LS.users, JSON.stringify(users)); renderUsers(); } }
              if(tbl==='kategori'){ const d=await supa.from('kategori').select('nama'); if(d.data){ kategoriList=d.data.map(r=>r.nama); localStorage.setItem(LS.kategori, JSON.stringify(kategoriList)); renderKategoriSelects(); } }
            }catch(e){ console.warn('[realtime reload]', e.message); }
          }, 800);
        }).subscribe();
      realtimeChannels.push(ch);
    }catch(e){ console.warn('[realtime]', tbl, e.message); }
  });
}

const SupaDB = {
  async getProduk(){
    const s = getSupa(); if(!s) return null;
    const { data, error } = await s.from('produk').select('*').order('nama').limit(1000);
    if(error) throw error;
    return data.map(r=>({
      id:r.id, sku:r.sku, barcode:r.barcode, nama:r.nama, kategori:r.kategori,
      harga:r.harga, hpp:r.hpp, stok:r.stok, stokByOutlet: r.stok_by_outlet||{[r.outlet_id||'OUT002']: r.stok}, exp:r.exp, batch:r.batch, bpom:r.bpom, supplier:r.supplier_id, gambar:r.gambar, outlet:r.outlet_id
    }));
  },
  async upsertProduk(p){
    const s = getSupa(); if(!s) return;
    const stokBy = p.stokByOutlet || {[p.outlet||currentOutlet||'OUT002']: p.stok||0};
    const { error } = await s.from('produk').upsert({
      id:p.id, sku:p.sku, barcode:p.barcode, nama:p.nama,
      kategori:p.kategori, harga:p.harga, hpp:p.hpp||0, stok: p.stok||0, stok_by_outlet: stokBy, exp:p.exp||null, batch:p.batch||null, bpom:p.bpom||null, supplier_id:p.supplier||null, outlet_id:p.outlet||currentOutlet||'OUT002'
    }, {onConflict:'id'});
    if(error) throw error;
  },
  async deleteProduk(id){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('produk').delete().eq('id', id);
    if(error) throw error;
  },
  async getMember(){
    const s = getSupa(); if(!s) return null;
    const { data, error } = await s.from('member').select('*').order('nama').limit(1000);
    if(error) throw error;
    return data.map(r=>({id:r.id, nama:r.nama, hp:r.hp, poin:r.poin, level:r.level, referral:r.referral, diskon:r.diskon}));
  },
  async upsertMember(m){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('member').upsert({id:m.id, nama:m.nama, hp:m.hp, poin:m.poin||0, level:m.level, referral:m.referral, diskon:m.diskon||0}, {onConflict:'id'});
    if(error) throw error;
  },
  async getSupplier(){
    const s=getSupa(); if(!s) return null;
    const {data, error}=await s.from('supplier').select('*').order('nama').limit(500);
    if(error) throw error;
    return data.map(r=>({id:r.id, nama:r.nama, kontak:r.kontak, alamat:r.alamat}));
  },
  async upsertSupplier(sup){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('supplier').upsert({id:sup.id, nama:sup.nama, kontak:sup.kontak||null, alamat:sup.alamat||null}, {onConflict:'id'});
    if(error) throw error;
  },
  async deleteSupplier(id){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('supplier').delete().eq('id', id);
    if(error) throw error;
  },
  async getPromo(){
    const s=getSupa(); if(!s) return null;
    const {data, error}=await s.from('promo').select('*').order('nama').limit(200);
    if(error) throw error;
    return data.map(r=>({id:r.id, nama:r.nama, tipe:r.tipe, nilai:r.nilai, nilai2:r.nilai2, kategori:r.kategori, produkIds:r.produk_ids||[], freeProdukIds:r.free_produk_ids||[], memberLevel:r.member_level, kode:r.kode, minBelanja:r.min_belanja, maxDiskon:r.max_diskon, periodeStart:r.periode_start, periodeEnd:r.periode_end, expHari:r.exp_hari, aktif:r.aktif, bundlingDiskon:r.bundling_diskon||0}));
  },
  async upsertPromo(p){
    const s=getSupa(); if(!s) return;
    const payload={id:p.id, nama:p.nama, tipe:p.tipe, nilai:p.nilai||0, nilai2:p.nilai2||0, kategori:p.kategori||null, produk_ids:p.produkIds||[], free_produk_ids:p.freeProdukIds||[], member_level:p.memberLevel||null, kode:p.kode||null, min_belanja:p.minBelanja||0, max_diskon:p.maxDiskon||0, periode_start:p.periodeStart||null, periode_end:p.periodeEnd||null, exp_hari:p.expHari||null, bundling_diskon:p.bundlingDiskon||0, aktif:p.aktif!==false};
    let {error}=await s.from('promo').upsert(payload, {onConflict:'id'});
    if(error && error.message.includes('bundling_diskon')){ delete payload.bundling_diskon; const r2=await s.from('promo').upsert(payload, {onConflict:'id'}); error=r2.error; }
    if(error) throw error;
  },
  async deletePromo(id){ const s=getSupa(); if(!s) return; const {error}=await s.from('promo').delete().eq('id',id); if(error) throw error; },
  async getUsers(){
    const s=getSupa(); if(!s) return null;
    const {data,error}=await s.from('users').select('*').order('nama').limit(200);
    if(error) throw error;
    return data.map(u=>({id:u.id, nama:u.nama, username:u.username||u.nama, password:u.password||u.pin||'', role:u.role==='Admin'?'Owner':u.role, outletId:u.outlet_id, outletIds:u.outlet_ids||(u.outlet_id?[u.outlet_id]:[]), pin:u.pin}));
  },
  async upsertUser(u){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('users').upsert({id:u.id, nama:u.nama, username:(u.username||'').toLowerCase(), password:u.password||u.pin||'1234', pin:u.pin||(u.password||'').slice(0,4), role:u.role, outlet_id:u.outletId||u.outlet_id||null, outlet_ids:u.outletIds||u.outlet_ids||null}, {onConflict:'id'});
    if(error) throw error;
  },
  async deleteUser(id){ const s=getSupa(); if(!s) return; const {error}=await s.from('users').delete().eq('id',id); if(error) throw error; },
  async deleteMember(id){ const s=getSupa(); if(!s) return; const {error}=await s.from('member').delete().eq('id',id); if(error) throw error; },
  async getTransaksi({since, outletId, limit=50}={}){
    const s = getSupa(); if(!s) return null;
    let q = s.from('transaksi').select('*').order('waktu',{ascending:false}).limit(limit);
    if(outletId) q = q.eq('outlet_id', outletId);
    if(since) q = q.gt('waktu', new Date(since).toISOString());
    const { data, error } = await q;
    if(error) throw error;
    return data;
  },
  async insertTransaksi(t){
    const s = getSupa(); if(!s) return;
    const { error } = await s.from('transaksi').insert({
      id:t.id, waktu:t.waktu||new Date().toISOString(), outlet_id:t.outlet||t.outlet_id||'OUT002',
      user_id:t.user_id||(window.getCurrentUser?window.getCurrentUser():null)?.id||null, member_id:t.member||t.member_id||null,
      cart: t.cart||[], subtotal:t.subtotal||t.sub||0, diskon:t.diskon||t.disc||0, ppn:t.ppn||0, total:t.total||0, bayar:t.bayar||t.pay||'Tunai', status:t.status||'paid'
    });
    if(error) throw error;
  },
  async insertPembelian(b){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('pembelian').insert({outlet_id:b.outlet||b.outlet_id||currentOutlet, supplier_id:b.supplier||b.supplier_id, produk_id:b.produk||b.produk_id, qty:b.qty, hpp:b.hpp||0, batch:b.batch||null, exp:b.exp||null, ket:b.ket||'Beli'});
    if(error) throw error;
  },
  async insertOpname(o){
    const s=getSupa(); if(!s) return;
    const {error}=await s.from('opname').insert({outlet_id:o.outlet||o.outlet_id||currentOutlet, produk_id:o.produk||o.produk_id, sistem:o.sistem, fisik:o.fisik, selisih:o.selisih});
    if(error) throw error;
  }
};
window.SupaDB = SupaDB;
window.initSupabase = initSupabase;
window.getSupa = getSupa;
