# Project POS Outlet / Toko Herbal

POS Profesional multi-toko, by Nota, by Outlet terpisah - tema soft CBM #f6f7f9 + Feather 2016 + Font Awesome 6.

## Fitur
- Multi-toko (multi-outlet) dengan stok terpisah per toko
- Hierarki akun: Owner -> Spv -> Kasir (username/password)
- Kasir by Nota (multi-nota draft), scan barcode auto-tambah, multi-input bulk, FEFO
- SKU profesional, barcode EAN13/CODE128, stok & kadaluarsa per toko, HPP Moving Average PSAK14, PPN 11%
- Member loyalty tier (Bronze/Silver/Gold/Platinum) + poin + referral + promo kompleks (persen/nominal/BOGO/bundling/tiered/kategori/exp) + kode
- Supplier, Pembelian, Opname, Promo, Laporan EOD, Shift per toko per admin (buka/tutup)
- Privilege: Owner full, SPV operasional semua toko yg dijaga, Kasir hanya POS (tidak bisa hapus input)
- PWA offline, thermal printer ESC/POS WebUSB/WebSerial, cash drawer

## Jalankan
```powershell
Set-Location -LiteralPath "C:\Users\user\Downloads\test & riset\pos-herbal"
node server.js # http://127.0.0.1:8088
# atau Python
C:\Python312\python.exe -m http.server 8089
# buka http://127.0.0.1:8089
```
Login (multi-toko): pilih toko di layar masuk.
- Owner `admin/admin` - semua toko (kelola outlet & user)
- SPV Aliya `spvaliya/spv` - hanya Aliya Herba
- SPV Gamping `spvgamping/spv` - hanya CBM Gamping
- Kasir Aliya `kasiraliya/kasir` - hanya Aliya Herba
- Kasir Gamping `kasirgamping/kasir` - hanya CBM Gamping
- Toko: **Aliya Herba** (OUT001), **CBM Gamping** (OUT002)

## Warna CBM
--bg #f6f7f9 --card #ffffff --border #e6e8eb
- Tema per toko (otomatis ikut toko aktif): Aliya Herba hijau daun (#16a34a / soft #dcfce7), CBM Gamping merah soft (#dc2626 / soft #fee2e2)