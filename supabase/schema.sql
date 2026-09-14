-- Supabase schema untuk project-pos-outlet
-- Region: ap-southeast-1 (Singapore) untuk latency tercepat dari Indonesia
-- Jalankan di Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- 1. Outlets (1 cabang sekarang, siap multi-cabang nanti)
create table if not exists outlets (
  id text primary key,
  nama text not null,
  alamat text,
  created_at timestamptz default now()
);
insert into outlets(id,nama) values ('OUT001','Toko Herbal - Pusat (1 Cabang)') on conflict (id) do nothing;

-- 2. Users (Admin/Kasir, PIN 4 digit)
create table if not exists users (
  id text primary key,
  nama text not null,
  pin text not null check (char_length(pin)=4),
  role text not null check (role in ('Admin','Kasir')),
  outlet_id text references outlets(id),
  created_at timestamptz default now()
);
insert into users(id,nama,pin,role,outlet_id) values
  ('U001','Admin','1234','Admin','OUT001'),
  ('U002','Kasir1','0000','Kasir','OUT001'),
  ('U003','Kasir2','1111','Kasir','OUT001')
on conflict (id) do nothing;

-- 3. Kategori
create table if not exists kategori (
  nama text primary key
);
insert into kategori(nama) values ('Jamu Cair'),('Kapsul'),('Minyak'),('Teh Herbal'),('Madu'),('Jamu Bubuk') on conflict do nothing;

-- 4. Produk - index untuk scan barcode cepat
create table if not exists produk (
  id text primary key,
  sku text unique not null,
  barcode text unique not null,
  nama text not null,
  kategori text references kategori(nama),
  harga int not null check (harga >=0),
  hpp int not null default 0,
  stok int not null default 0 check (stok >=0),
  exp date,
  batch text,
  bpom text,
  supplier_id text,
  gambar text,
  outlet_id text references outlets(id) default 'OUT001',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_produk_barcode on produk(barcode);
create index if not exists idx_produk_sku on produk(sku);
create index if not exists idx_produk_kategori on produk(kategori);
create index if not exists idx_produk_nama_trgm on produk using gin (nama gin_trgm_ops);
create index if not exists idx_produk_outlet on produk(outlet_id);

-- Trigger updated_at
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_produk_upd on produk;
create trigger trg_produk_upd before update on produk for each row execute function touch_updated_at();

-- 5. Member + loyalty
create table if not exists member (
  id text primary key,
  nama text not null,
  hp text unique not null,
  poin int default 0,
  level text default 'Bronze' check (level in ('Bronze','Silver','Gold','Platinum')),
  referral text unique,
  diskon int default 0,
  outlet_id text references outlets(id) default 'OUT001',
  created_at timestamptz default now()
);
create index if not exists idx_member_hp on member(hp);
create index if not exists idx_member_level on member(level);

-- 6. Promo kompleks
create table if not exists promo (
  id text primary key,
  nama text not null,
  tipe text not null check (tipe in ('persen','nominal','bogo','bundling','tiered','kategori')),
  nilai int default 0,
  nilai2 int default 0,
  kategori text,
  produk_ids text[] default '{}',
  free_produk_ids text[] default '{}',
  member_level text,
  kode text,
  min_belanja int default 0,
  max_diskon int default 0,
  periode_start date,
  periode_end date,
  exp_hari int,
  aktif boolean default true,
  outlet_id text references outlets(id) default 'OUT001',
  created_at timestamptz default now()
);
create index if not exists idx_promo_kode on promo(kode) where kode is not null and kode <> '';
create index if not exists idx_promo_aktif on promo(aktif) where aktif = true;

-- 7. Transaksi (trx) - JSON untuk cart + index waktu/outlet untuk laporan cepat
create table if not exists transaksi (
  id text primary key,
  waktu timestamptz not null default now(),
  outlet_id text references outlets(id) not null,
  user_id text references users(id),
  member_id text references member(id),
  cart jsonb not null default '[]'::jsonb,
  subtotal int not null default 0,
  diskon int not null default 0,
  ppn int not null default 0,
  total int not null default 0,
  bayar text default 'Tunai',
  status text default 'paid' check (status in ('draft','paid','void')),
  created_at timestamptz default now()
);
create index if not exists idx_trx_waktu on transaksi(waktu desc);
create index if not exists idx_trx_outlet_waktu on transaksi(outlet_id, waktu desc);
create index if not exists idx_trx_member on transaksi(member_id);

-- 8. Shift per toko per admin
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  outlet_id text references outlets(id) not null,
  user_id text references users(id) not null,
  buka_at timestamptz not null default now(),
  tutup_at timestamptz,
  modal_awal int default 0,
  modal_akhir int,
  status text default 'buka' check (status in ('buka','tutup'))
);
create index if not exists idx_shifts_outlet_status on shifts(outlet_id, status);

-- 9. Supplier & pembelian (opsional, untuk HPP moving average)
create table if not exists supplier (
  id text primary key,
  nama text not null,
  kontak text,
  alamat text
);

-- RLS: matikan dulu untuk kecepatan dev, aktifkan jika butuh multi-tenant
alter table outlets disable row level security;
alter table users disable row level security;
alter table produk disable row level security;
alter table member disable row level security;
alter table promo disable row level security;
alter table transaksi disable row level security;
alter table shifts disable row level security;
alter table supplier disable row level security;
alter table kategori disable row level security;

-- Seed produk dari data/produk.json (10 sample)
insert into produk(id,sku,barcode,nama,kategori,harga,hpp,stok,exp,batch) values
  ('HB001','JAM-8990001001','8990001001','Jamu Kunyit Asam 250ml','Jamu Cair',15000,9000,48,'2027-02-15','B2401'),
  ('HB002','KAP-8990001002','8990001002','Kapsul Daun Kelor 60 kapsul','Kapsul',35000,21000,32,'2027-08-20','B2402'),
  ('HB003','MIN-8990001003','8990001003','Minyak Kayu Putih 60ml','Minyak',28000,16000,24,'2027-05-10','B2403'),
  ('HB004','TEH-8990001004','8990001004','Teh Rosella Celup 20 bag','Teh Herbal',22000,13000,18,'2027-01-30','B2404'),
  ('HB005','MAD-8990001005','8990001005','Madu Hutan 500ml','Madu',75000,50000,15,'2027-11-11','B2405')
on conflict (id) do nothing;
