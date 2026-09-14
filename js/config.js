// Konfigurasi Supabase - isi dari Supabase Dashboard > Project Settings > API
// Cara dapatkan: buat project di https://supabase.com/dashboard (region Singapore ap-southeast-1)
// Copy URL + anon key, paste di bawah, commit aman? anon key boleh public, service_role JANGAN commit.
window.SUPABASE_CONFIG = {
  url: localStorage.getItem('supabase_url') || 'https://fgssagcmayqledvrflhx.supabase.co',
  anonKey: localStorage.getItem('supabase_anon') || 'sb_publishable_tgl8JJ4yIfPLTz4gaQoOhw_4wlnoUcl',
  enabled: false // auto true jika url & key terisi
};
(function(){
  const c = window.SUPABASE_CONFIG;
  if(c.url && c.anonKey) c.enabled = true;
})();

// AUTO POPUP TIAP BUKA LINK — harus sebelum app.js load, jadi taruh di config.js
try{
  localStorage.removeItem('herbal_curUser');
  sessionStorage.removeItem('pos_session');
  console.log('[config] force clear curUser for auto popup');
}catch(e){}

// Dexie cache config
window.CACHE_CONFIG = {
  useDexie: true, // pakai IndexedDB cache agar buka internet tetap cepat (stale-while-revalidate)
  syncIntervalMs: 30000 // sync ke Supabase tiap 30 detik jika online
};
