// Supabase client wrapper untuk POS - Vercel Edge + Singapore
// Load via CDN: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
// Fallback ke localStorage jika offline / belum konfigurasi

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
    console.log('[supabase] belum dikonfigurasi - pakai localStorage fallback. Set di Setting > Supabase');
    return null;
  }
  try{
    const lib = await loadSupabaseLib();
    supa = lib.createClient(cfg.url, cfg.anonKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
      global: { headers: { 'x-pos-outlet': '1' } }
    });
    // test ping (cepat, pakai head)
    const { error } = await supa.from('produk').select('id', {count:'exact', head:true}).limit(1);
    if(error) throw error;
    supaReady = true;
    cfg.enabled = true;
    console.log('[supabase] connected', cfg.url);
    return supa;
  }catch(e){
    console.warn('[supabase] connect gagal, fallback localStorage', e.message);
    supaReady = false;
    return null;
  }
}

function getSupa(){ return supaReady ? supa : null; }

// Helper CRUD cepat dengan cache handling
const SupaDB = {
  async getProduk(){
    const s = getSupa();
    if(!s) return null;
    const { data, error } = await s.from('produk').select('*').order('nama').limit(1000);
    if(error) throw error;
    return data.map(r=>({
      id:r.id, sku:r.sku, barcode:r.barcode, nama:r.nama, kategori:r.kategori,
      harga:r.harga, hpp:r.hpp, stok:r.stok, exp:r.exp, batch:r.batch, bpom:r.bpom, supplier:r.supplier_id, gambar:r.gambar
    }));
  },
  async upsertProduk(p){
    const s = getSupa(); if(!s) return;
    const { error } = await s.from('produk').upsert({
      id:p.id, sku:p.sku||p.kategori?.slice(0,3).toUpperCase()+'-'+p.barcode, barcode:p.barcode, nama:p.nama,
      kategori:p.kategori, harga:p.harga, hpp:p.hpp||0, stok:p.stok, exp:p.exp||null, batch:p.batch||null, bpom:p.bpom||null, supplier_id:p.supplier||null
    });
    if(error) throw error;
  },
  async getMember(){
    const s = getSupa(); if(!s) return null;
    const { data, error } = await s.from('member').select('*').order('nama').limit(1000);
    if(error) throw error;
    return data.map(r=>({id:r.id, nama:r.nama, hp:r.hp, poin:r.poin, level:r.level, referral:r.referral, diskon:r.diskon}));
  },
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
      id:t.id, waktu:t.waktu||new Date().toISOString(), outlet_id:t.outlet||t.outlet_id||'OUT001',
      user_id:t.user_id||(window.getCurrentUser?window.getCurrentUser():null)?.id||null, member_id:t.member||t.member_id||null,
      cart: t.cart||[], subtotal:t.subtotal||0, diskon:t.diskon||0, ppn:t.ppn||0, total:t.total||0, bayar:t.bayar||'Tunai', status:t.status||'paid'
    });
    if(error) throw error;
  }
};
window.SupaDB = SupaDB;
window.initSupabase = initSupabase;
window.getSupa = getSupa;
