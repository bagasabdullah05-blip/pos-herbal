// Konfigurasi Supabase - isi dari Supabase Dashboard > Project Settings > API
// Cara dapatkan: buat project di https://supabase.com/dashboard (region Singapore ap-southeast-1)
// Copy URL + anon key, paste di bawah, commit aman? anon key boleh public, service_role JANGAN commit.
const FIXED_SUPA_URL='https://fgssagcmayqledvrflhx.supabase.co';
const FIXED_SUPA_KEY='sb_publishable_tgl8JJ4yIfPLTz4gaQoOhw_4wlnoUcl';
try{ localStorage.setItem('supabase_url', FIXED_SUPA_URL); localStorage.setItem('supabase_anon', FIXED_SUPA_KEY); }catch{}
window.SUPABASE_CONFIG = { url: FIXED_SUPA_URL, anonKey: FIXED_SUPA_KEY, enabled: true };

// Sesi login PERSISTEN — reload/refresh tidak perlu login lagi.
// Keluar manual lewat tombol Keluar (logout) untuk ganti user/toko.

// Dexie cache config
window.CACHE_CONFIG = {
  useDexie: true, // pakai IndexedDB cache agar buka internet tetap cepat (stale-while-revalidate)
  syncIntervalMs: 30000 // sync ke Supabase tiap 30 detik jika online
};
