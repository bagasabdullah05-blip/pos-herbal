-- Supabase schema untuk POS HERBAL multi-toko (Aliya Herba + CBM Gamping)
-- Region: ap-southeast-1 (Singapore)
-- Jalankan di Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql (pilih project fgssagcmayqledvrflhx)

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- 1. Outlets
create table if not exists outlets (
  id text primary key,
  nama text not null,
  alamat text,
  created_at timestamptz default now()
);
insert into outlets(id,nama) values
  ('OUT001','Aliya Herba'),
  ('OUT002','CBM Gamping')
on conflict (id) do update set nama=excluded.nama;

-- 2. Users — hierarki Owner -> Spv -> Kasir (per toko)
create table if not exists users (
  id text primary key,
  nama text not null,
  pin text check (char_length(pin)=4),
  role text not null check (role in ('Owner','Spv','Kasir','Admin','Kasir1','Kasir2')),
  outlet_id text references outlets(id),
  created_at timestamptz default now()
);
-- migrasi kolom baru untuk multi-toko
alter table users add column if not exists username text;
alter table users add column if not exists password text;
alter table users add column if not exists outlet_ids text[];
-- pin boleh null setelah migrasi ke username/password
alter table users alter column pin drop not null;
-- update role check untuk Owner/Spv/Kasir
do $$ begin
  alter table users drop constraint if exists users_role_check;
  alter table users add constraint users_role_check check (role in ('Owner','Spv','Kasir','Admin','Kasir1','Kasir2'));
exception when others then null; end $$;
create unique index if not exists idx_users_username on users(username) where username is not null;
insert into users(id,nama,username,password,role,outlet_id,outlet_ids) values
  ('U001','Owner','admin','admin','Owner',null,null),
  ('U002','SPV Aliya','spvaliya','spv','Spv','OUT001','{OUT001}'),
  ('U003','SPV Gamping','spvgamping','spv','Spv','OUT002','{OUT002}'),
  ('U004','Kasir Aliya','kasiraliya','kasir','Kasir','OUT001',null),
  ('U005','Kasir Gamping','kasirgamping','kasir','Kasir','OUT002',null)
on conflict (id) do update set nama=excluded.nama, username=excluded.username, password=excluded.password, role=excluded.role, outlet_id=excluded.outlet_id, outlet_ids=excluded.outlet_ids;

-- 3. Kategori
create table if not exists kategori (
  nama text primary key
);
insert into kategori(nama) values ('Jamu Cair'),('Kapsul'),('Minyak'),('Teh Herbal'),('Madu'),('Jamu Bubuk'),('Kurma'),('Herbal'),('Dapur'),('Perawatan'),('Susu'),('Jamu'),('Makanan'),('Snack'),('Minuman'),('Harian'),('Kemasan'),('Buku'),('Parfum'),('Aksesoris'),('Kopi'),('Es Krim'),('Umum') on conflict do nothing;

-- 4. Supplier
create table if not exists supplier (
  id text primary key,
  nama text not null,
  kontak text,
  alamat text,
  created_at timestamptz default now()
);

-- 5. Produk — stokByOutlet untuk multi-toko
create table if not exists produk (
  id text primary key,
  sku text unique not null,
  barcode text unique not null,
  nama text not null,
  kategori text references kategori(nama),
  harga int not null check (harga >=0),
  hpp int not null default 0,
  stok int not null default 0 check (stok >=0),
  stok_by_outlet jsonb default '{}'::jsonb,
  exp date,
  batch text,
  bpom text,
  supplier_id text references supplier(id),
  gambar text,
  outlet_id text references outlets(id) default 'OUT001',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table produk add column if not exists stok_by_outlet jsonb default '{}'::jsonb;
alter table produk add column if not exists outlet_id text;
create index if not exists idx_produk_barcode on produk(barcode);
create index if not exists idx_produk_sku on produk(sku);
create index if not exists idx_produk_kategori on produk(kategori);
create index if not exists idx_produk_nama_trgm on produk using gin (nama gin_trgm_ops);
create index if not exists idx_produk_outlet on produk(outlet_id);
create or replace function touch_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_produk_upd on produk;
create trigger trg_produk_upd before update on produk for each row execute function touch_updated_at();

-- 6. Member
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

-- 7. Promo
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

-- 8. Transaksi
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

-- 9. Shifts
create table if not exists shifts (
  id text primary key,
  outlet_id text references outlets(id) not null,
  user_id text references users(id) not null,
  buka_at timestamptz not null default now(),
  tutup_at timestamptz,
  modal_awal int default 0,
  modal_akhir int,
  status text default 'buka' check (status in ('buka','tutup'))
);
create index if not exists idx_shifts_outlet_status on shifts(outlet_id, status);

-- 10. Pembelian (stok masuk) — untuk HPP moving average & kartu stok per outlet
create table if not exists pembelian (
  id uuid primary key default uuid_generate_v4(),
  waktu timestamptz not null default now(),
  outlet_id text references outlets(id) not null,
  supplier_id text references supplier(id),
  produk_id text references produk(id) not null,
  qty int not null,
  hpp int default 0,
  batch text,
  exp date,
  ket text
);
create index if not exists idx_pembelian_outlet_produk on pembelian(outlet_id, produk_id);

-- 11. Opname
create table if not exists opname (
  id uuid primary key default uuid_generate_v4(),
  waktu timestamptz not null default now(),
  outlet_id text references outlets(id) not null,
  produk_id text references produk(id) not null,
  sistem int not null,
  fisik int not null,
  selisih int not null
);

-- RLS dimatikan untuk dev (aktifkan jika butuh multi-tenant)
alter table outlets disable row level security;
alter table users disable row level security;
alter table produk disable row level security;
alter table member disable row level security;
alter table promo disable row level security;
alter table transaksi disable row level security;
alter table shifts disable row level security;
alter table supplier disable row level security;
alter table kategori disable row level security;
alter table pembelian disable row level security;
alter table opname disable row level security;

-- Realtime — agar perubahan di satu device langsung muncul di device lain
do $$ begin
  alter publication supabase_realtime add table produk;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table member;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table transaksi;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table supplier;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table promo;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table shifts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table pembelian;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table opname;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table outlets;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table users;
exception when duplicate_object then null; end $$;
