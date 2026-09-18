const LS={produk:'herbal_produk',member:'herbal_member',trx:'herbal_trx',sup:'herbal_sup',beli:'herbal_beli',op:'herbal_op',promo:'herbal_promo',outlet:'herbal_outlet',users:'herbal_users',curOut:'herbal_curOut',curUser:'herbal_curUser',nota:'herbal_nota',curNota:'herbal_curNota',shift:'herbal_shift',mLevel:'herbal_mLevel',kategori:'herbal_kategori',ppn:'herbal_ppn',struk:'herbal_struk',qris:'herbal_qris'};
let produk=[],member=[],trx=[],supplier=[],pembelian=[],opname=[],promo=[],outlets=[],users=[],notas=[],shifts=[],memberLevels=[],kategoriList=[],cart=[],pay='Tunai';
let currentOutlet='OUT001', currentUser=null, currentNotaId=null;
window.getCurrentUser=()=>currentUser;
let printerDevice=null, printerPort=null;
const DEFAULT_OUTLETS=[
  {id:'OUT001',nama:'Aliya Herba'},
  {id:'OUT002',nama:'CBM Gamping'}
];
const DEFAULT_USERS=[
  {id:'U001',nama:'Owner',username:'admin',password:'admin',role:'Owner'},
  {id:'U002',nama:'SPV Aliya',username:'spvaliya',password:'spv',role:'Spv',outletIds:['OUT001']},
  {id:'U003',nama:'SPV Gamping',username:'spvgamping',password:'spv',role:'Spv',outletIds:['OUT002']},
  {id:'U004',nama:'Kasir Aliya',username:'kasiraliya',password:'kasir',role:'Kasir',outletId:'OUT001'},
  {id:'U005',nama:'Kasir Gamping',username:'kasirgamping',password:'kasir',role:'Kasir',outletId:'OUT002'}
];
const DEFAULT_LEVELS=[
  {id:'L1', nama:'Bronze', diskon:3, minPoin:0},
  {id:'L2', nama:'Silver', diskon:5, minPoin:100},
  {id:'L3', nama:'Gold', diskon:10, minPoin:300},
  {id:'L4', nama:'Platinum', diskon:15, minPoin:600}
];
const DEFAULT_KATEGORI=["Jamu Cair","Kapsul","Minyak","Teh Herbal","Madu","Jamu Bubuk"];
const PRIV={
  Owner: { pos:true, produk:true, member:true, supplier:true, pembelian:true, stok:true, opname:true, promo:true, laporan:true, outlet:true, shift:true, setting:true, users:true, hapus:true, retur:true, kosongkan:true },
  Spv: { pos:true, produk:true, member:true, supplier:true, pembelian:true, stok:true, opname:true, promo:true, laporan:true, outlet:false, shift:true, setting:true, users:false, hapus:true, retur:true, kosongkan:true },
  Kasir: { pos:true, produk:false, member:false, supplier:false, pembelian:false, stok:false, opname:false, promo:false, laporan:false, outlet:false, shift:true, setting:false, users:false, hapus:false, retur:false, kosongkan:false }
};
function hasPriv(key){ return (PRIV[currentUser?.role||'Kasir']||PRIV.Kasir)[key]===true; }
function needAdmin(action){ if(!hasPriv(action)){ alert('Akses ditolak: '+action+' hanya untuk Owner/SPV'); return false; } return true; }
function myOutlets(u){ u=u||currentUser; if(!u) return outlets; if(u.role==='Owner') return outlets; if(u.role==='Spv') return outlets.filter(o=>(u.outletIds||[]).includes(o.id)); if(u.role==='Kasir') return outlets.filter(o=>o.id===u.outletId); return []; }
function canAccessOutlet(u,id){ return myOutlets(u).some(o=>o.id===id); }
function getStok(p){
  if(p.stokByOutlet) return (p.stokByOutlet[currentOutlet]!=null) ? p.stokByOutlet[currentOutlet] : 0;
  return (p.outlet && p.outlet!==currentOutlet) ? 0 : (p.stok||0);
}
function setStok(p,n){ if(!p.stokByOutlet) p.stokByOutlet={}; p.stokByOutlet[currentOutlet]=n; p.stok=n; return n; }
const PAGER={kasir:{page:0,per:9},produk:{page:0,per:15},member:{page:0,per:15},supplier:{page:0,per:15},beli:{page:0,per:15},oplog:{page:0,per:15}};
function pagerSlice(key,arr){ const pg=PAGER[key]; const pages=Math.max(1,Math.ceil(arr.length/pg.per)); if(pg.page>pages-1) pg.page=pages-1; if(pg.page<0) pg.page=0; return arr.slice(pg.page*pg.per,pg.page*pg.per+pg.per); }
function pagerHTML(key,total){
  const pg=PAGER[key]; const pages=Math.max(1,Math.ceil(total/pg.per)); if(pg.page>pages-1) pg.page=pages-1; if(pg.page<0) pg.page=0;
  const btn=(p,label,off)=>`<button onclick="pagerGo('${key}',${p})" ${off?'disabled':''} class="px-2 py-1 border rounded-lg bg-white ${off?'opacity-40':''}">${label}</button>`;
  return `<div class="flex items-center justify-between py-2 text-xs text-[#718096]"><span>${total} data • hal ${pg.page+1}/${pages}</span><div class="flex gap-1">${btn(0,'«',pg.page===0)}${btn(pg.page-1,'‹',pg.page===0)}${btn(pg.page+1,'›',pg.page>=pages-1)}${btn(pages-1,'»',pg.page>=pages-1)}</div></div>`;
}
function pagerGo(key,p){ PAGER[key].page=p; ({kasir:renderProdukGrid,produk:renderTabelProduk,member:renderTabelMember,supplier:renderSupplier,beli:renderPembelian,oplog:renderOpname}[key]||renderAll)(); }
function ensureNotaDraft(){
  let d=notas.find(n=>n.outlet===currentOutlet && n.status==='draft');
  if(!d){ const nid=genNotaId(); notas.unshift({id:nid,waktu:new Date().toISOString(),outlet:currentOutlet,member:null,cart:[],status:'draft'}); currentNotaId=nid; d=notas[0]; }
  else currentNotaId=d.id;
  cart=d.cart||[];
}
const rupiah=n=>'Rp '+Number(n).toLocaleString('id-ID');
const todayISO=()=>new Date().toISOString().slice(0,10);
const DEFAULT_PRODUK=[]; // daftar produk dari data/produk.json (hasil import CSV Gamping)
const DEFAULT_MEMBER=[{"id":"M001","nama":"Siti Aminah","hp":"081234567890","poin":120,"diskon":5,"level":"Silver"},{"id":"M002","nama":"Budi Santoso","hp":"082112345678","poin":350,"diskon":10,"level":"Gold"}];
const DEFAULT_SUP=[{"id":"S001","nama":"CV Herbal Nusantara","kontak":"081233344455","alamat":"Solo"},{"id":"S002","nama":"UD Jamu Sehat","kontak":"081244455566","alamat":"Yogya"}];
const DEFAULT_PROMO=[
  {id:"PR1",nama:"Member Gold 15%",tipe:"persen",nilai:15,kategori:"",produkIds:[],memberLevel:"Gold",kode:"",minBelanja:0,maxDiskon:50000,periodeStart:"",periodeEnd:"",aktif:true},
  {id:"PR2",nama:"Bundling Kelor 2+1 Rosella",tipe:"bundling",nilai:2,nilai2:1,produkIds:["HB002"],freeProdukIds:["HB004"],kategori:"",memberLevel:"",kode:"",minBelanja:0,maxDiskon:0,periodeStart:"",periodeEnd:"",aktif:true},
  {id:"PR3",nama:"Tiered 100rb→10% / 200rb→20%",tipe:"tiered",nilai:10,nilai2:20,minBelanja:100000,produkIds:[],kategori:"",memberLevel:"",kode:"",maxDiskon:0,periodeStart:"",periodeEnd:"",aktif:true},
  {id:"PR4",nama:"Kategori Minyak 10%",tipe:"kategori",nilai:10,kategori:"Minyak",produkIds:[],memberLevel:"",kode:"",minBelanja:0,maxDiskon:0,periodeStart:"",periodeEnd:"",aktif:true},
  {id:"PR5",nama:"Eksp Dekat 20% (<30hr)",tipe:"persen",nilai:20,kategori:"",produkIds:[],memberLevel:"",kode:"",minBelanja:0,maxDiskon:0,periodeStart:"",periodeEnd:"",aktif:true,expHari:30},
  {id:"PR6",nama:"Kode PROMO5K",tipe:"nominal",nilai:5000,kategori:"",produkIds:[],memberLevel:"",kode:"PROMO5K",minBelanja:50000,maxDiskon:5000,periodeStart:"",periodeEnd:"",aktif:true}
];

async function loadData(){
  const fetchJ=async(p,def)=>{try{const r=await fetch(p); if(!r.ok) throw 0; return await r.json()}catch{return def}};
  const p0=await fetchJ('data/produk.json',DEFAULT_PRODUK);
  const m0=await fetchJ('data/member.json',DEFAULT_MEMBER);
  const t0=await fetchJ('data/transaksi.json',[]);
  produk=JSON.parse(localStorage.getItem(LS.produk)||'null') ?? (p0.length?p0:DEFAULT_PRODUK);
  member=JSON.parse(localStorage.getItem(LS.member)||'null') ?? (m0.length?m0:DEFAULT_MEMBER);
  trx=JSON.parse(localStorage.getItem(LS.trx)||'null') ?? t0;
  supplier=JSON.parse(localStorage.getItem(LS.sup)||'null') ?? DEFAULT_SUP;
  pembelian=JSON.parse(localStorage.getItem(LS.beli)||'null') ?? [];
  opname=JSON.parse(localStorage.getItem(LS.op)||'null') ?? [];
  promo=JSON.parse(localStorage.getItem(LS.promo)||'null') ?? DEFAULT_PROMO;
  let loadedOutlets=JSON.parse(localStorage.getItem(LS.outlet)||'null');
  outlets= (loadedOutlets && loadedOutlets.length) ? loadedOutlets : JSON.parse(JSON.stringify(DEFAULT_OUTLETS));
  let loadedUsers=JSON.parse(localStorage.getItem(LS.users)||'null');
  users= loadedUsers ?? JSON.parse(JSON.stringify(DEFAULT_USERS));
  // v2: multi-toko dengan hierarki Owner -> Spv -> Kasir (username/password)
  if(localStorage.getItem('herbal_v3')!=='1'){
    outlets=JSON.parse(JSON.stringify(DEFAULT_OUTLETS));
    users=JSON.parse(JSON.stringify(DEFAULT_USERS));
    localStorage.setItem('herbal_v3','1');
  } else {
    let changed=false;
    users.forEach(u=>{
      if(u.role==='Manager'){ u.role='Spv'; changed=true; }
      if(u.role==='Admin'){ u.role='Owner'; changed=true; }
      if(!['Owner','Spv','Kasir'].includes(u.role)){ u.role='Kasir'; changed=true; }
      if(!u.username){ u.username=String((u.nama||'user').toLowerCase().replace(/\s/g,'')); changed=true; }
      if(!u.password){ u.password=u.pin||'1234'; changed=true; }
      if(u.role==='Spv' && !Array.isArray(u.outletIds)){ u.outletIds=outlets.map(o=>o.id); changed=true; }
      if(u.role==='Kasir' && !u.outletId){ u.outletId=outlets[0]?.id; changed=true; }
    });
    if(!users.some(u=>u.role==='Owner')){ users.unshift({id:'U001',nama:'Owner',username:'admin',password:'admin',role:'Owner'}); changed=true; }
    if(changed) localStorage.setItem(LS.users, JSON.stringify(users));
  }
  currentOutlet=localStorage.getItem(LS.curOut) || outlets[0].id;
  if(!outlets.some(o=>o.id===currentOutlet)) currentOutlet=outlets[0].id;
  currentUser=JSON.parse(localStorage.getItem(LS.curUser)||'null');
  if(currentUser){
    if(currentUser.role==='Manager') currentUser.role='Spv';
    if(currentUser.role==='Admin') currentUser.role='Owner';
  }
  // stok terpisah per toko (katalog global, stok per outlet)
  produk.forEach(p=>{
    if(!p.stokByOutlet){
      p.stokByOutlet={};
      if(p.outlet && outlets.some(o=>o.id===p.outlet)) p.stokByOutlet[p.outlet]=p.stok||0;
      else outlets.forEach(o=>{ p.stokByOutlet[o.id]=p.stok||0; });
    }
  });
  // migrasi outlet untuk data lama tanpa field outlet
  trx.forEach(t=>{ if(!t.outlet) t.outlet=currentOutlet; });
  pembelian.forEach(b=>{ if(!b.outlet) b.outlet=currentOutlet; });
  opname.forEach(o=>{ if(!o.outlet) o.outlet=currentOutlet; });
  notas=JSON.parse(localStorage.getItem(LS.nota)||'null') ?? [];
  notas.forEach(n=>{ if(!n.outlet) n.outlet=currentOutlet; if(!n.status) n.status='draft'; if(!Array.isArray(n.cart)) n.cart=[]; });
  currentNotaId=localStorage.getItem(LS.curNota);
  let _curNota=notas.find(n=>n.id===currentNotaId && n.outlet===currentOutlet && n.status==='draft');
  if(!_curNota) _curNota=notas.find(n=>n.outlet===currentOutlet && n.status==='draft');
  if(!_curNota){
    const id=genNotaId();
    _curNota={id,waktu:new Date().toISOString(),outlet:currentOutlet,member:null,cart:[],status:'draft'};
    notas.unshift(_curNota);
  }
  currentNotaId=_curNota.id;
  cart=_curNota.cart || [];
  _curNota.cart=cart;
  shifts=JSON.parse(localStorage.getItem(LS.shift)||'null') ?? [];
  memberLevels=JSON.parse(localStorage.getItem(LS.mLevel)||'null') ?? JSON.parse(JSON.stringify(DEFAULT_LEVELS));
  kategoriList=JSON.parse(localStorage.getItem(LS.kategori)||'null') ?? [...DEFAULT_KATEGORI];
  const ppnVal=localStorage.getItem(LS.ppn); if(ppnVal!==null) setTimeout(()=>{ const el=document.getElementById('ppnAktif'); if(el) el.checked=ppnVal==='true'; const el2=document.getElementById('settingPpn'); if(el2) el2.checked=ppnVal==='true'; }, 300);
  // v5: daftar produk Gamping + stok kolom tanggal terakhir (khusus OUT002)
  if(localStorage.getItem('herbal_v5')!=='1'){
    if(p0.length){
      produk=JSON.parse(JSON.stringify(p0));
      produk.forEach(p=>{ const s=Number(p.stok)||0; p.stok=s; p.stokByOutlet={OUT002:s}; });
      const cats=[...new Set(produk.map(p=>p.kategori).filter(Boolean))];
      kategoriList=[...new Set([...kategoriList, ...cats])];
    }
    localStorage.setItem('herbal_v5','1');
  }
  // v6: akun per toko — tiap toko punya SPV + Kasir sendiri (ganti akun generik lama)
  if(localStorage.getItem('herbal_v6')!=='1'){
    const legacyIds=['U002','U003','U004','U005'];
    const legacyNames=['spv','kasir','kasir2'];
    users=users.filter(u=>u.role==='Owner' || (!legacyIds.includes(u.id) && !legacyNames.includes((u.username||'').toLowerCase())));
    JSON.parse(JSON.stringify(DEFAULT_USERS)).forEach(d=>{ if(!users.some(u=>u.id===d.id)) users.push(d); });
    if(!users.some(u=>u.role==='Owner')) users.unshift(JSON.parse(JSON.stringify(DEFAULT_USERS))[0]);
    localStorage.setItem('herbal_v6','1');
  }
  // v7: buang baris produk tes ("TES BULK...") yang tidak sengaja masuk data
  if(localStorage.getItem('herbal_v7')!=='1'){
    produk=produk.filter(p=>!/^tes bulk/i.test((p.nama||'').trim()));
    localStorage.setItem('herbal_v7','1');
  }
  // sesi tersimpan: pastikan user masih ada & masih boleh akses toko aktif
  if(currentUser){
    const fresh=users.find(u=>u.id===currentUser.id);
    if(!fresh) currentUser=null;
    else { currentUser=fresh; if(!canAccessOutlet(currentUser,currentOutlet)) currentOutlet=(myOutlets(currentUser)[0]||outlets[0]).id; }
  }
  if(!produk.length) produk=[...DEFAULT_PRODUK];
  if(!member.length) member=[...DEFAULT_MEMBER];
  // SKU profesional: ensure each produk has SKU = KAT-BARCODE, referral code for member
  produk.forEach(p=>{ if(!p.sku) p.sku=(p.kategori.slice(0,3).toUpperCase()+'-'+p.barcode).replace(/\s/g,''); });
  member.forEach(m=>{ if(!m.referral) m.referral='REF'+m.id.slice(-3)+Math.floor(100+Math.random()*900); if(!m.sku) m.sku=m.id; });
  loadStrukCfg();
  saveAll();
}
// Pengaturan kop struk (logo, sosmed, ucapan) — tersimpan persisten
function strukCfg(){ try{ return JSON.parse(localStorage.getItem(LS.struk)||'{}'); }catch{ return {}; } }
function strukVal(id,key,def){ const v=((document.getElementById(id)?.value)||'').trim(); if(v) return v; return strukCfg()[key]||def||''; }
function loadStrukCfg(){
  const c=strukCfg(); if(!c || !Object.keys(c).length) return;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el&&v!=null) el.value=v; };
  set('tokoNama',c.nama); set('tokoAlamat',c.alamat); set('tokoWA',c.wa); set('tokoIG',c.ig); set('tokoFB',c.fb); set('tokoHead',c.head); set('tokoFoot',c.foot);
  const cb=document.getElementById('optBarcode'); if(cb&&c.showBarcode===false) cb.checked=false;
  const pv=document.getElementById('tokoLogoPrev'); if(pv&&c.logo){ pv.src=c.logo; pv.classList.remove('hidden'); }
}
function simpanStrukCfg(silent){
  const pv=document.getElementById('tokoLogoPrev');
  const c={nama:strukVal('tokoNama','nama',''),alamat:strukVal('tokoAlamat','alamat',''),wa:strukVal('tokoWA','wa',''),ig:strukVal('tokoIG','ig',''),fb:strukVal('tokoFB','fb',''),head:strukVal('tokoHead','head',''),foot:strukVal('tokoFoot','foot','Terima kasih sudah berbelanja'),logo:(pv&&!pv.classList.contains('hidden')&&pv.src)||'',showBarcode:document.getElementById('optBarcode')?.checked!==false};
  localStorage.setItem(LS.struk,JSON.stringify(c));
  if(!silent) alert('Pengaturan struk disimpan');
}
function uploadLogo(input){
  const f=input.files&&input.files[0]; if(!f) return;
  if(f.size>400*1024) return alert('Maksimal 400KB agar tersimpan aman');
  const r=new FileReader();
  r.onload=()=>{ const pv=document.getElementById('tokoLogoPrev'); if(pv){ pv.src=r.result; pv.classList.remove('hidden'); } simpanStrukCfg(true); };
  r.readAsDataURL(f); input.value='';
}
function hapusLogo(){ const pv=document.getElementById('tokoLogoPrev'); if(pv){ pv.removeAttribute('src'); pv.classList.add('hidden'); } simpanStrukCfg(true); }
function escTxt(s){ return String(s||'').replace(/½/g,'1/2').replace(/¼/g,'1/4').replace(/[^\x20-\x7E\n]/g,''); }
function genNotaId(){ const d=new Date(); return 'NT-'+d.toISOString().slice(0,10).replace(/-/g,'')+'-'+String(Date.now()).slice(-4); }
function syncNota(){
  const n=notas.find(x=>x.id===currentNotaId && x.outlet===currentOutlet);
  if(!n) return;
  if(n.status!=='draft'){ alert('Nota sudah dibayar, tidak bisa diubah'); return; }
  n.cart=[...cart]; n.member=document.getElementById('pilihMember')?.value||null; n.waktu=new Date().toISOString();
  saveAll(); renderNota();
}
function buatNotaBaru(){ const id=genNotaId(); notas.unshift({id,waktu:new Date().toISOString(),outlet:currentOutlet,member:null,cart:[],status:'draft'}); currentNotaId=id; cart=notas.find(n=>n.id===id).cart; saveAll(); renderAll(); }
function pilihNota(id){
  const n=notas.find(x=>x.id===id); if(!n) return;
  if(n.outlet!==currentOutlet){ alert('Nota toko lain ('+(outlets.find(o=>o.id===n.outlet)?.nama||n.outlet)+'), tidak bisa dibuka di '+(outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet)); return; }
  if(n.status==='paid'){ alert('Nota sudah dibayar (paid), tidak bisa diedit'); return; }
  currentNotaId=id; cart=n.cart;
  const sel=document.getElementById('pilihMember'); if(sel) sel.value=n.member||''; saveAll(); renderAll();
}
function hapusNota(){
  if(!needAdmin('hapus')) return;
  const cur=notas.find(n=>n.id===currentNotaId && n.outlet===currentOutlet);
  if(!cur) return alert('Nota tidak ditemukan');
  if(cur.status==='paid') return alert('Nota sudah dibayar, tidak bisa dihapus');
  const outletNotas=notas.filter(n=>n.outlet===currentOutlet);
  if(outletNotas.length<=1) return alert('Minimal 1 nota draft di toko ini');
  if(!confirm('Hapus nota '+currentNotaId+'?')) return;
  notas=notas.filter(n=>n.id!==currentNotaId);
  const next=notas.find(n=>n.outlet===currentOutlet && n.status==='draft');
  if(next){ currentNotaId=next.id; cart=next.cart; }
  else {
    const id=genNotaId(); const nn={id,waktu:new Date().toISOString(),outlet:currentOutlet,member:null,cart:[],status:'draft'}; notas.unshift(nn); currentNotaId=id; cart=nn.cart;
  }
  saveAll(); renderAll();
}
function renderNota(){
  const list=notas.filter(n=>n.outlet===currentOutlet);
  const sel=document.getElementById('notaSelect'); if(sel) sel.innerHTML=list.map(n=>`<option value="${n.id}" ${n.id===currentNotaId?'selected':''}>${n.id} • ${n.cart.length} item • ${n.status}</option>`).join('') || '<option value="">Tidak ada nota</option>';
  const idEl=document.getElementById('notaId'); if(idEl) idEl.textContent=currentNotaId||'';
  const st=document.getElementById('notaStatus'); if(st){ const cur=notas.find(n=>n.id===currentNotaId); st.textContent=cur?.status||'draft'; st.className=cur?.status==='paid'?'bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full':'bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full'; }
  const cnt=document.getElementById('notaCount'); if(cnt) cnt.textContent=list.length+' nota';
  const bulk=document.getElementById('bulkNotaId'); if(bulk) bulk.textContent=currentNotaId||'';
  localStorage.setItem(LS.curNota,currentNotaId);
}
function openBulkModal(){ renderNota(); document.getElementById('modalBulk')?.showModal(); }
function prosesBulk(e){
  e.preventDefault();
  const txt=document.getElementById('bulkText').value.trim(); if(!txt) return;
  const lines=txt.split(/\n/).map(s=>s.trim()).filter(Boolean);
  let ok=0, fail=[];
  lines.forEach(line=>{
    const parts=line.split(/[\s,;]+/); const code=parts[0]; const qty=Number(parts[1]||1);
    const p=produk.find(x=> x.barcode===code || x.sku===code || x.id===code || x.nama.toLowerCase()===code.toLowerCase());
    if(!p) { fail.push(code); return; }
    if(getStok(p) < qty) { fail.push(code+' stok kurang'); return; }
    const c=cart.find(x=>x.id===p.id); if(c) c.qty+=qty; else cart.push({id:p.id,nama:p.nama,harga:p.harga,hpp:p.hpp||0,qty});
    ok++;
  });
  document.getElementById('bulkText').value='';
  syncNota(); renderCart();
  if(fail.length) alert('Berhasil '+ok+' baris, gagal: '+fail.join(', '));
  else { // keep modal open for next paste? close if success
    // modalBulk.close();
  }
}
function saveAll(){
  const cur=notas.find(n=>n.id===currentNotaId && n.outlet===currentOutlet);
  if(cur && cur.status==='draft') cur.cart=[...cart];
  localStorage.setItem(LS.produk,JSON.stringify(produk));
  localStorage.setItem(LS.member,JSON.stringify(member));
  localStorage.setItem(LS.trx,JSON.stringify(trx));
  localStorage.setItem(LS.sup,JSON.stringify(supplier));
  localStorage.setItem(LS.beli,JSON.stringify(pembelian));
  localStorage.setItem(LS.op,JSON.stringify(opname));
  localStorage.setItem(LS.promo,JSON.stringify(promo));
  localStorage.setItem(LS.outlet,JSON.stringify(outlets));
  localStorage.setItem(LS.users,JSON.stringify(users));
  localStorage.setItem(LS.curOut,currentOutlet);
  localStorage.setItem(LS.curUser,JSON.stringify(currentUser));
  localStorage.setItem(LS.nota,JSON.stringify(notas));
  localStorage.setItem(LS.curNota,currentNotaId);
  localStorage.setItem(LS.shift,JSON.stringify(shifts));
  localStorage.setItem(LS.mLevel,JSON.stringify(memberLevels));
  localStorage.setItem(LS.kategori,JSON.stringify(kategoriList));
}

// Render
let _soldCache={n:-1,map:{}};
function soldQtyMap(){ if(_soldCache.n===trx.length) return _soldCache.map; const m={}; listTrxOutlet().forEach(t=>(t.cart||[]).forEach(it=>{ m[it.id]=(m[it.id]||0)+it.qty; })); _soldCache={n:trx.length,map:m}; return m; }
function renderProdukGrid(){
  const q=(document.getElementById('cari').value||'').toLowerCase();
  const kat=document.getElementById('filterKat').value;
  const sold=soldQtyMap();
  let list=[...produk].sort((a,b)=> ((sold[b.id]||0)-(sold[a.id]||0)) || (new Date(a.exp)-new Date(b.exp)) || String(a.nama).localeCompare(String(b.nama)));
  list=list.filter(p=>{ const s=getStok(p); return s>0 && (!kat||p.kategori===kat) && (!q|| p.nama.toLowerCase().includes(q)||p.barcode.includes(q)||p.id.toLowerCase().includes(q)); });
  if(!q && !kat) list=list.slice(0,9);
  const gp=document.getElementById('gridPager'); if(gp) gp.innerHTML=pagerHTML('kasir',list.length);
  document.getElementById('gridProduk').innerHTML=pagerSlice('kasir',list).map(p=>{
    const s=getStok(p);
    const diff=(new Date(p.exp)-new Date())/86400000;
    const badge=s<5?'<span class="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">Stok tipis</span>': diff<90?'<span class="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">FEFO</span>':'';
    return `<div class="bg-white rounded-2xl border p-3 flex flex-col">
      <div class="text-2xl">${p.gambar||'🌿'}</div>
      <div class="font-semibold text-sm leading-tight mt-1">${p.nama}</div>
      <div class="text-xs text-slate-500">${p.kategori} • ${p.id} • Batch ${p.batch||'-'}</div>
      <div class="text-xs text-slate-400">EXP ${p.exp} • ${p.bpom||''}</div>
      <div class="mt-2 flex items-center justify-between">
        <div><div class="font-bold text-teal-700">${rupiah(p.harga)}</div><div class="text-xs ${s<15?'text-red-500':'text-slate-500'}">Stok ${s} ${badge}</div></div>
        <button onclick="addCart('${p.id}')" class="bg-[#0f766e] text-white w-9 h-9 rounded-xl">+</button>
      </div>
      <button onclick="showBarcode('${p.barcode}')" class="mt-2 text-xs border rounded-full py-1">🏷️ barcode</button>
    </div>`;
  }).join('')||'<div class="col-span-full text-center text-slate-400 py-10">Tidak ada produk</div>';
  // fill selects
  const opt=produk.map(p=>`<option value="${p.id}">${p.nama}</option>`).join('');
  const beliP=document.getElementById('beliProduk'); if(beliP) beliP.innerHTML=opt;
  const kartuP=document.getElementById('kartuProduk'); if(kartuP) kartuP.innerHTML='<option value="">Pilih produk</option>'+opt;
  const opP=document.getElementById('opProduk'); if(opP) opP.innerHTML=opt;
  const supSel=document.getElementById('p_supplier'); if(supSel) supSel.innerHTML=supplier.map(s=>`<option value="${s.id}">${s.nama}</option>`).join('');
  const beliSup=document.getElementById('beliSupplier'); if(beliSup) beliSup.innerHTML=supplier.map(s=>`<option value="${s.id}">${s.nama}</option>`).join('');
  renderPromoSelect();
}
function renderPromoSelect(){
  const sel=document.getElementById('diskonTambahan');
  if(!sel) return;
  sel.innerHTML='<option value="">Tanpa promo</option>'+promo.filter(p=>p.aktif).map(p=>`<option value="${p.id}">${p.nama} ${p.kode? '['+p.kode+']':''}</option>`).join('');
}
function renderMemberSelect(){
  document.getElementById('pilihMember').innerHTML='<option value="">Tanpa Member</option>'+member.map(m=>`<option value="${m.id}">${m.nama} - ${m.level} (${m.diskon}%)</option>`).join('');
}
function addCart(id){
  const p=produk.find(x=>x.id===id || x.sku===id || x.barcode===id); if(!p||getStok(p)<=0) return alert('Stok habis di toko ini');
  const c=cart.find(x=>x.id===p.id); if(c){ if(c.qty>=getStok(p)) return alert('Stok tidak cukup'); c.qty++; } else cart.push({id:p.id,nama:p.nama,harga:p.harga,hpp:p.hpp||0,qty:1});
  syncNota(); renderCart();
}
function renderCart(){
  const canHapus=hasPriv('hapus');
  const el=document.getElementById('cartList');
  if(cart.length===0) el.innerHTML='<div class="text-center text-slate-400 py-10 text-sm">Keranjang kosong<br>Tap + / scan / multi-input</div>';
  else el.innerHTML=cart.map((it,i)=>`<div class="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl">
    <div class="flex-1"><div class="text-sm font-medium leading-none">${it.nama}</div><div class="text-xs text-slate-500">${rupiah(it.harga)} x ${it.qty}</div></div>
    <div class="flex items-center gap-1"><button onclick="chgQty(${i},-1)" class="w-7 h-7 bg-white border rounded-lg">-</button><span class="w-6 text-center text-sm">${it.qty}</span><button onclick="chgQty(${i},1)" class="w-7 h-7 bg-white border rounded-lg">+</button></div>
    <div class="font-bold text-sm w-[90px] text-right">${rupiah(it.harga*it.qty)}</div>
    <button ${canHapus?`onclick="cart.splice(${i},1);syncNota();renderCart()"`:`onclick="alert('Kasir tidak bisa hapus item')"`} class="${canHapus?'text-red-500':'text-slate-300'} px-1" ${canHapus?'':'disabled'}>×</button></div>`).join('');
  hitung(); renderNota();
}
function chgQty(i,d){
  const it=cart[i]; const p=produk.find(x=>x.id===it.id);
  const n=it.qty+d;
  if(n<1 && !hasPriv('hapus')){ alert('Kasir tidak bisa hapus item'); return; }
  if(n<1) cart.splice(i,1); else if(n>getStok(p)) alert('Stok tidak cukup'); else it.qty=n;
  syncNota(); renderCart();
}
function isPromoPeriode(pr){
  if(!pr.aktif) return false;
  const now=new Date().toISOString().slice(0,10);
  if(pr.periodeStart && now < pr.periodeStart) return false;
  if(pr.periodeEnd && now > pr.periodeEnd) return false;
  return true;
}
function calcPromo(pr, cart, sub, discMember){
  if(!pr || !isPromoPeriode(pr)) return 0;
  const mId=document.getElementById('pilihMember')?.value;
  const mem=member.find(x=>x.id===mId);
  if(pr.memberLevel && mem?.level!==pr.memberLevel) return 0;
  if(pr.minBelanja && sub < pr.minBelanja) return 0;
  if(pr.kode){
    const inputKode=(document.getElementById('promoKode')?.value||'').trim().toUpperCase();
    if(inputKode!==pr.kode.toUpperCase()) return 0;
  }
  let pot=0;
  const base=sub - discMember;
  if(pr.tipe==='persen'){
    if(pr.expHari){
      const now=new Date(); const eligible=cart.filter(it=>{
        const p=produk.find(x=>x.id===it.id); if(!p) return false; const d=(new Date(p.exp)-now)/86400000; return d>=0 && d <= pr.expHari;
      }); const subEl=eligible.reduce((s,it)=>s+it.harga*it.qty,0);
      pot=Math.round(subEl*pr.nilai/100);
    } else pot=Math.round(base*pr.nilai/100);
  } else if(pr.tipe==='nominal'){
    pot=pr.nilai;
  } else if(pr.tipe==='bogo'){
    const totalQty=cart.reduce((s,i)=>s+i.qty,0);
    if(totalQty>=2) pot=Math.min(...cart.map(c=>c.harga));
  } else if(pr.tipe==='bundling'){
    const triggerIds=pr.produkIds||[];
    const freeIds=pr.freeProdukIds||[];
    let triggerQty=0;
    triggerIds.forEach(tid=>{ const r=cart.find(c=>c.id===tid); if(r) triggerQty+=r.qty; });
    if(triggerIds.length===0) triggerQty=cart.reduce((s,c)=>s+c.qty,0);
    if(triggerQty>=pr.nilai && pr.nilai>0){
      const freeQty=Math.floor(triggerQty/pr.nilai)*pr.nilai2;
      if(freeIds.length>0){
        const freeP=produk.find(x=> freeIds.includes(x.id));
        pot=freeQty*(freeP?.harga||0);
      } else if(freeQty>0){
        let cheapest=Infinity;
        triggerIds.forEach(tid=>{ const pp=produk.find(x=>x.id===tid); if(pp) cheapest=Math.min(cheapest, pp.harga); });
        if(cheapest===Infinity && cart.length) cheapest=Math.min(...cart.map(c=>c.harga));
        pot=freeQty*(cheapest===Infinity?0:cheapest);
      }
      if(pr.bundlingDiskon && pr.bundlingDiskon>0){
        const subTrigger=cart.filter(it=> triggerIds.includes(it.id) || triggerIds.length===0).reduce((s,it)=>s+it.harga*it.qty,0);
        pot+=Math.round(subTrigger*pr.bundlingDiskon/100);
      }
    }
  } else if(pr.tipe==='tiered'){
    if(sub>=200000) pot=Math.round(base*pr.nilai2/100);
    else if(sub>=pr.minBelanja) pot=Math.round(base*pr.nilai/100);
  } else if(pr.tipe==='kategori'){
    const subKat=cart.filter(it=> produk.find(p=>p.id===it.id)?.kategori===pr.kategori).reduce((s,it)=>s+it.harga*it.qty,0);
    pot=Math.round(subKat*pr.nilai/100);
  }
  if(pr.maxDiskon && pot>pr.maxDiskon) pot=pr.maxDiskon;
  return Math.min(pot, base);
}
function hitung(){
  const sub=cart.reduce((s,it)=>s+it.harga*it.qty,0);
  const mid=document.getElementById('pilihMember').value;
  const m=member.find(x=>x.id===mid);
  const discPct=m?m.diskon:0;
  const disc=Math.round(sub*discPct/100);
  let promoPot=0;
  let promoTerpakai=null;
  const prId=document.getElementById('diskonTambahan').value;
  const pr=promo.find(x=>x.id===prId);
  const kodeInput=(document.getElementById('promoKode')?.value||'').trim();
  let prByKode=null;
  if(kodeInput) prByKode=promo.find(x=> x.kode && x.kode.toUpperCase()===kodeInput.toUpperCase());
  if(prByKode){
    promoPot=calcPromo(prByKode, cart, sub, disc);
    promoTerpakai=prByKode;
  } else if(pr){
    promoPot=calcPromo(pr, cart, sub, disc);
    promoTerpakai=pr;
  } else {
    // auto: cari promo terbaik yang otomatis (tanpa kode, aktif)
    let best=0, bestPr=null;
    promo.filter(pp=> pp.aktif && !pp.kode).forEach(pp=>{
      const v=calcPromo(pp, cart, sub, disc);
      if(v>best){ best=v; bestPr=pp; }
    });
    if(bestPr){
      promoPot=best;
      promoTerpakai=bestPr;
    }
  }
  const potonganManual=Math.max(0, Number(document.getElementById('potonganKasir')?.value||0));
  document.getElementById('potonganManualRp').textContent='- '+rupiah(potonganManual);
  let ppn=0;
  if(document.getElementById('ppnAktif')?.checked) ppn=Math.round((sub-disc-promoPot-potonganManual)*0.11);
  const qpct=pay==='QRIS'?qrisPct():0;
  const qrisFee=qpct>0?Math.round((sub-disc-promoPot-potonganManual+ppn)*qpct/100):0;
  const tot=Math.max(0, sub-disc-promoPot-potonganManual+ppn+qrisFee);
  document.getElementById('subtotal').textContent=rupiah(sub);
  document.getElementById('diskonRp').textContent='- '+rupiah(disc);
  document.getElementById('labelDiskon').textContent=discPct?`(${discPct}%)`:'';
  document.getElementById('promoRp').textContent='- '+rupiah(promoPot);
  const ppnEl=document.getElementById('ppnRp'); if(ppnEl) ppnEl.textContent=rupiah(ppn);
  const qfRow=document.getElementById('qrisFeeRow'); if(qfRow) qfRow.classList.toggle('hidden', !(pay==='QRIS'&&qrisFee>0));
  const qfRp=document.getElementById('qrisFeeRp'); if(qfRp) qfRp.textContent=rupiah(qrisFee);
  const qfLb=document.getElementById('qrisFeeLabel'); if(qfLb) qfLb.textContent=`Biaya QRIS (${qpct}%)`;
  document.getElementById('total').textContent=rupiah(tot);
  const promoInfo=document.getElementById('promoInfo');
  if(promoInfo){
    if(promoTerpakai && promoPot>0) promoInfo.textContent='Promo: '+promoTerpakai.nama+' ('+promoTerpakai.tipe+')';
    else if(promoTerpakai) promoInfo.textContent='Promo: '+promoTerpakai.nama+' (tidak memenuhi syarat)';
    else promoInfo.textContent='';
  }
  const bayar=Number(document.getElementById('bayar').value||0);
  if(pay==='Split'){
    const t=Number(document.getElementById('splitTunai').value||0)+Number(document.getElementById('splitTransfer').value||0);
    document.getElementById('kembalian').textContent=rupiah(Math.max(0,t - tot));
  } else {
    document.getElementById('kembalian').textContent=rupiah(Math.max(0,bayar - tot));
  }
  const info=document.getElementById('infoMember');
  if(m){ info.innerHTML=`Member ${m.level} • Diskon ${m.diskon}% • Poin ${m.poin} • Ref: <b>${m.referral}</b> <button onclick="copyReferral('${m.referral}')" class="border px-1 rounded">copy</button>`; info.classList.remove('hidden'); } else info.classList.add('hidden');
  const ts=document.getElementById('totalBar'); if(ts) ts.textContent=rupiah(tot);
  const tq=document.getElementById('totalBarQty'); if(tq) tq.textContent=cart.reduce((s,it)=>s+it.qty,0);
  const tp=document.getElementById('totalBarPay'); if(tp) tp.textContent=pay;
  return {sub,disc,promoPot,ppn,tot,qrisFee,potonganManual};
}
function bayarFocus(){ const b=document.getElementById('bayar'); if(!b) return; b.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>{ try{b.focus({preventScroll:true})}catch{ b.focus(); } },350); }
function setPay(v){
  pay=v;
  document.querySelectorAll('.pay-btn').forEach(b=>b.className='pay-btn bg-white border py-2 rounded-xl text-xs');
  const map={Tunai:'btnTunai',Transfer:'btnTransfer',QRIS:'btnQRIS',Split:'btnSplit'};
  document.getElementById(map[v]).className='pay-btn bg-teal-600 text-white py-2 rounded-xl text-xs font-semibold';
  document.getElementById('qrBox').classList.toggle('hidden', v!=='QRIS');
  document.getElementById('splitBox').classList.toggle('hidden', v!=='Split');
  hitung();
}
function bayarSekarang(){
  if(!currentUser) return modalLogin.showModal();
  if(!getShiftAktif(currentOutlet)) return alert('Shift belum dibuka untuk toko '+ (outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet) +'. Buka shift dulu di menu Shift.');
  if(cart.length===0) return alert('Keranjang kosong');
  const {tot,sub,disc,promoPot,ppn,qrisFee,potonganManual}=hitung();
  let bayar=Number(document.getElementById('bayar').value||0);
  if(pay==='Split') bayar=Number(document.getElementById('splitTunai').value||0)+Number(document.getElementById('splitTransfer').value||0);
  if(pay!=='QRIS' && bayar < tot) return alert('Bayar kurang');
  const mid=document.getElementById('pilihMember').value;
  // FEFO: already sorted, deduct stok per toko
  cart.forEach(it=>{ const p=produk.find(x=>x.id===it.id); if(p) setStok(p, getStok(p)-it.qty); });
  const idTrx='TRX-'+currentOutlet+'-'+Date.now().toString().slice(-6);
  const labaKotor=cart.reduce((s,it)=>s+(it.harga-(it.hpp||0))*it.qty,0)-disc-promoPot-potonganManual;
  const shiftAktif=getShiftAktif(currentOutlet);
  const rec={id:idTrx,waktu:new Date().toISOString(),outlet:currentOutlet,kasir:currentUser?.nama||'?',shiftId:shiftAktif?.id||null,cart:[...cart],sub,disc,promoPot,potonganManual:potonganManual||0,ppn,pay,bayar,total:tot,qrisFee:qrisFee||0,splitTunai:pay==='Split'?Number(document.getElementById('splitTunai').value||0):0,splitTransfer:pay==='Split'?Number(document.getElementById('splitTransfer').value||0):0,kembalian:Math.max(0,bayar-tot),member:mid||null, laba: labaKotor, hppTotal: cart.reduce((s,it)=>s+(it.hpp||0)*it.qty,0) };
  // kartu stok log (per toko)
  rec.cart.forEach(it=> pembelian.push({waktu:rec.waktu, outlet:currentOutlet, produk:it.id, qty:-it.qty, ket:'Jual '+idTrx, batch:produk.find(p=>p.id===it.id)?.batch||''}));
  trx.unshift(rec);
  if(shiftAktif){ shiftAktif.transaksi=(shiftAktif.transaksi||0)+1; shiftAktif.omzet=(shiftAktif.omzet||0)+tot; }
  if(mid){ const m=member.find(x=>x.id===mid); if(m) m.poin+=Math.floor(tot/10000); }
  // tandai nota paid (hanya draft toko aktif)
  const curNota=notas.find(n=>n.id===currentNotaId && n.outlet===currentOutlet);
  if(curNota && curNota.status==='draft') curNota.status='paid';
  saveAll(); renderAll();
  if(document.getElementById('autoPrint').checked) cetakStruk(rec);
  else if(confirm('Cetak struk?')) cetakStruk(rec);
  // buat nota baru otomatis untuk input selanjutnya (by nota)
  const newId=genNotaId(); notas.unshift({id:newId,waktu:new Date().toISOString(),outlet:currentOutlet,member:null,cart:[],status:'draft'}); currentNotaId=newId; cart=notas.find(n=>n.id===newId).cart;
  document.getElementById('bayar').value=''; document.getElementById('splitTunai').value=''; document.getElementById('splitTransfer').value=''; document.getElementById('potonganKasir').value=''; saveAll(); renderAll();
  alert('Transaksi '+idTrx+' berhasil — Nota baru '+newId+' siap');
}
function cetakStruk(r){
  const cfg=strukCfg();
  const nama=strukVal('tokoNama','nama','TOKO HERBAL');
  const alamat=strukVal('tokoAlamat','alamat','');
  const wa=strukVal('tokoWA','wa',''); const ig=strukVal('tokoIG','ig',''); const fb=strukVal('tokoFB','fb','');
  const head=strukVal('tokoHead','head',''); const foot=strukVal('tokoFoot','foot','Terima kasih sudah berbelanja');
  const pv=document.getElementById('tokoLogoPrev');
  const logo=(pv&&!pv.classList.contains('hidden')&&pv.src)||cfg.logo||'';
  const sl=document.getElementById('strukLogo'); if(sl){ if(logo){ sl.src=logo; sl.classList.remove('hidden'); } else sl.classList.add('hidden'); }
  document.getElementById('strukToko').textContent=nama;
  document.getElementById('strukAlamat').textContent=alamat;
  document.getElementById('strukSosmed').textContent=[wa&&('WA: '+wa),ig&&('IG: '+ig),fb&&('FB: '+fb)].filter(Boolean).join(' • ');
  document.getElementById('strukHead').textContent=head;
  const m=member.find(x=>x.id===r.member);
  document.getElementById('strukBody').innerHTML=`
    <div>No: ${r.id} • ${new Date(r.waktu).toLocaleString('id-ID')}</div>
    <div>Outlet: ${r.outlet||currentOutlet} • Kasir: ${r.kasir||currentUser?.nama||''}</div>
    <div>Member: ${m?m.nama:'Umum'}${m? ' ('+m.referral+')':''} • ${r.pay}</div>
    <div class="border-t border-dashed my-1"></div>
    ${r.cart.map(it=>`<div class="flex justify-between"><span>${it.nama} x${it.qty}</span><span>${rupiah(it.harga*it.qty)}</span></div>`).join('')}
    <div class="border-t border-dashed my-1"></div>
    <div class="flex justify-between"><span>Subtotal</span><span>${rupiah(r.sub)}</span></div>
    ${r.disc?`<div class="flex justify-between"><span>Diskon</span><span>- ${rupiah(r.disc)}</span></div>`:''}
    ${r.promoPot?`<div class="flex justify-between"><span>Promo</span><span>- ${rupiah(r.promoPot)}</span></div>`:''}
    ${r.potonganManual?`<div class="flex justify-between"><span>Potongan Manual</span><span>- ${rupiah(r.potonganManual)}</span></div>`:''}
    ${r.ppn?`<div class="flex justify-between"><span>PPN 11%</span><span>${rupiah(r.ppn)}</span></div>`:''}
    ${r.qrisFee?`<div class="flex justify-between"><span>Biaya QRIS</span><span>${rupiah(r.qrisFee)}</span></div>`:''}
    <div class="flex justify-between font-bold"><span>Total</span><span>${rupiah(r.total)}</span></div>
    <div class="flex justify-between"><span>Bayar</span><span>${rupiah(r.bayar)}</span></div>
    <div class="flex justify-between"><span>Kembali</span><span>${rupiah(r.kembalian)}</span></div>
  `;
  document.getElementById('strukFoot').textContent=strukVal('tokoFoot','foot','Terima kasih sudah berbelanja');
  const showBc=document.getElementById('optBarcode')?.checked!==false;
  const bc=document.getElementById('strukBarcode'); if(bc){ bc.style.display=showBc?'':'none'; }
  if(showBc){ try{ JsBarcode("#strukBarcode", r.id, {height:30, width:1.2, fontSize:10}); }catch{} }
  const w=document.getElementById('paperSize').value;
  document.getElementById('struk-area').style.width=w+'mm';
  document.getElementById('struk-area').classList.remove('hidden');
  // ESC/POS if connected
  if(printerDevice||printerPort) printESC(r);
  else window.print();
  setTimeout(()=>document.getElementById('struk-area').classList.add('hidden'),700);
}
// ESC/POS helpers
async function connectPrinter(){
  const conn=document.getElementById('printerConn').value;
  try{
    if(conn==='WebUSB'){
      printerDevice=await navigator.usb.requestDevice({filters:[]});
      await printerDevice.open(); await printerDevice.selectConfiguration(1); await printerDevice.claimInterface(0);
      document.getElementById('printerStatus').textContent='Connected WebUSB: '+printerDevice.productName;
    } else if(conn==='Web Serial'){
      printerPort=await navigator.serial.requestPort(); await printerPort.open({baudRate:9600});
      document.getElementById('printerStatus').textContent='Connected Serial';
    } else {
      document.getElementById('printerStatus').textContent='Browser Print siap';
    }
  }catch(e){ alert('Gagal connect: '+e.message); }
}
function esc(cmd){ return new Uint8Array(cmd); }
async function printESC(r){
  const enc=new TextEncoder();
  let data=[];
  const add=t=> data.push(...enc.encode(t+'\n'));
  const nama=strukVal('tokoNama','nama','TOKO HERBAL');
  const alamat=strukVal('tokoAlamat','alamat','');
  const sos=[strukVal('tokoWA','wa','')&&('WA: '+strukVal('tokoWA','wa','')),strukVal('tokoIG','ig','')&&('IG: '+strukVal('tokoIG','ig','')),strukVal('tokoFB','fb','')&&('FB: '+strukVal('tokoFB','fb',''))].filter(Boolean).join(' | ');
  const head=strukVal('tokoHead','head',''); const foot=strukVal('tokoFoot','foot','Terima kasih sudah berbelanja');
  add(escTxt(nama)); if(alamat) add(escTxt(alamat)); if(sos) add(escTxt(sos)); if(head) add(escTxt(head));
  add('No: '+r.id); add(new Date(r.waktu).toLocaleString('id-ID'));
  add('----------------');
  r.cart.forEach(it=> add(it.nama+' x'+it.qty+' '+rupiah(it.harga*it.qty)));
  add('----------------'); if(r.promoPot) add('Promo -'+rupiah(r.promoPot)); if(r.potonganManual) add('Potongan Manual -'+rupiah(r.potonganManual)); if(r.qrisFee) add('Biaya QRIS '+rupiah(r.qrisFee)); add('Total '+rupiah(r.total)); add('Bayar '+rupiah(r.bayar)); add('Kembali '+rupiah(r.kembalian));
  add(escTxt(foot));
  const bytes=new Uint8Array([...data, 0x0A,0x0A, 0x1D,0x56,0x00]); // cut
  if(document.getElementById('optDrawer').checked) bytes.set([0x1B,0x70,0x00,0x32,0xFF], bytes.length-5);
  try{
    if(printerDevice){
      await printerDevice.transferOut(1, bytes);
    } else if(printerPort){
      const w=printerPort.writable.getWriter(); await w.write(bytes); w.releaseLock();
    }
  }catch(e){ alert('Print ESC gagal, fallback browser'); window.print(); }
}
function testPrint(){ cetakStruk({id:'TEST123',waktu:new Date().toISOString(),cart:[{nama:'Jamu Test',harga:15000,qty:1}],sub:15000,disc:0,promoPot:0,total:15000,bayar:20000,kembalian:5000,pay:'Tunai',member:null}); }
function bukaLaci(){
  if(printerDevice||printerPort) printESC({id:'DRAWER',waktu:new Date().toISOString(),cart:[],sub:0,disc:0,promoPot:0,total:0,bayar:0,kembalian:0,pay:'Tunai',member:null});
  else alert('Hubungkan printer ESC/POS dulu atau laci dibuka manual');
}
function openPrinterModal(){ document.getElementById('modalPrinter').showModal(); document.getElementById('printPreview').innerHTML=document.getElementById('struk-area')?.innerHTML||'Preview struk akan tampil setelah transaksi'; }

// Barcode
function generateBarcode(){
  const v=document.getElementById('genText').value.trim(); if(!v) return alert('Isi barcode');
  try{ JsBarcode("#barcode", v, {format:document.getElementById('genType').value, height:60, displayValue:true}); document.getElementById('barcodeText').textContent=v; }catch(e){alert(e.message)}
}
function generateBarcodeForProduk(){
  const code='899'+String(Date.now()).slice(-7)+String(Math.floor(Math.random()*90+10));
  const el=document.getElementById('p_barcode'); if(el) el.value=code;
}
function showBarcode(code){ document.getElementById('genText').value=code; generateBarcode(); document.querySelector('[data-page="setting"]').click(); document.getElementById('page-setting').scrollIntoView(); }
function cetakLabelMassal(){
  const w=window.open('','_blank'); let html='<h3>Label Barcode</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">';
  produk.slice(0,12).forEach(p=>{ html+=`<div style="border:1px solid #ccc;padding:8px;text-align:center"><div>${p.nama}</div><svg class="bc" data-v="${p.barcode}"></svg><div>${p.barcode}</div></div>`;});
  html+='</div><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script><script>document.querySelectorAll(".bc").forEach(e=>JsBarcode(e,e.dataset.v,{height:40}));window.print()<\/script>';
  w.document.write(html); w.document.close();
}

// Scanner
let html5Qr=null;
function openScanner(){ document.getElementById('modalScanner').showModal(); html5Qr=new Html5Qrcode("reader"); html5Qr.start({facingMode:"environment"},{fps:10,qrbox:250}, onScanSuccess, ()=>{}).catch(e=> alert('Kamera gagal: '+e)); }
function stopScanner(){ if(html5Qr) html5Qr.stop().catch(()=>{}); }
function onScanSuccess(decoded){ stopScanner(); document.getElementById('modalScanner').close(); handleBarcode(decoded); }
function handleBarcode(code){
  const p=produk.find(x=>x.barcode===code || x.id===code || x.sku===code); if(p) addCart(p.id); else alert('Barcode/SKU tidak ditemukan: '+code);
}
async function openPhoneScanner(){
  let url=location.origin + '/scan-phone.html';
  try{
    const r=await fetch('/api/ip'); const j=await r.json();
    if(j.ip && j.ip!=='127.0.0.1') url='http://'+j.ip+':'+j.port+'/scan-phone.html';
  }catch{}
  const elUrl=document.getElementById('phoneUrl'); if(elUrl) elUrl.textContent=url;
  const elLink=document.getElementById('phoneLink'); if(elLink) elLink.href=url;
  const elQr=document.getElementById('phoneQr'); if(elQr) elQr.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url);
  document.getElementById('modalPhoneScanner')?.showModal();
  if(window.feather) try{feather.replace()}catch{}
  // info IP
  try{
    const r2=await fetch('/api/ip'); const j2=await r2.json();
    const info=document.getElementById('phoneUrl');
    if(info && j2.ip) info.textContent += ' (IP PC: '+j2.ip+')';
  }catch{}
}
let lastPhonePoll=Date.now();
setInterval(async()=>{
  try{
    const r=await fetch('/api/phone-scan?since='+lastPhonePoll);
    if(!r.ok) return;
    const arr=await r.json();
    arr.forEach(x=>{ handleBarcode(x.code); lastPhonePoll=Math.max(lastPhonePoll, x.waktu); });
  }catch{}
}, 1100);
// USB scanner (keyboard wedge) listen
let scanBuf='', scanTimer=null;
document.addEventListener('keydown', e=>{
  if(e.key==='Enter' && scanBuf.length>3){ const c=scanBuf; scanBuf=''; handleBarcode(c); e.preventDefault(); }
  else if(e.key.length===1){ scanBuf+=e.key; clearTimeout(scanTimer); scanTimer=setTimeout(()=>scanBuf='',400); }
});

// Produk CRUD
function renderTabelProduk(){
  const q=(document.getElementById('cariProduk')?.value||'').toLowerCase();
  const list=produk.filter(p=>!q||p.nama.toLowerCase().includes(q)||(p.barcode||'').includes(q)||p.id.toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q)||(p.kategori||'').toLowerCase().includes(q));
  document.getElementById('tabelProduk').innerHTML=pagerSlice('produk',list).map(p=>`<tr class="border-t">
    <td class="p-3"><div class="font-medium">${p.gambar} ${p.nama}</div><div class="text-xs text-slate-500">SKU ${p.sku||p.id} • ${p.barcode} • ${p.id}</div></td>
    <td class="p-3 text-right">${rupiah(p.harga)}</td><td class="p-3 text-right">${rupiah(p.hpp||0)}</td>
    <td class="p-3 text-center ${getStok(p)<15?'text-red-600 font-bold':''}">${getStok(p)}</td>
    <td class="p-3 text-center text-xs">${p.batch||'-'}<br>${p.exp}</td>
    <td class="p-3 text-center text-xs">${p.bpom||'-'}</td>
    <td class="p-3 text-center"><button onclick="editProduk('${p.id}')" class="text-teal-600">Edit</button><button onclick="hapusProduk('${p.id}')" class="text-red-500 ml-2">Hapus</button></td></tr>`).join('')||'<tr><td colspan="7" class="p-6 text-center text-[#718096]">Tidak ada produk</td></tr>';
  const pg=document.getElementById('pagerProduk'); if(pg) pg.innerHTML=pagerHTML('produk',list.length);
}
function openProdukModal(id=null){
  if(!needAdmin('produk')) return;
  document.getElementById('p_supplier').innerHTML=supplier.map(s=>`<option value="${s.id}">${s.nama}</option>`).join('');
  if(id){ const p=produk.find(x=>x.id===id); p_id.value=p.id; p_nama.value=p.nama; p_kat.value=p.kategori; p_harga.value=p.harga; p_hpp.value=p.hpp||''; p_stok.value=getStok(p); p_exp.value=p.exp; p_barcode.value=p.barcode; p_batch.value=p.batch||''; p_bpom.value=p.bpom||''; p_supplier.value=p.supplier||supplier[0]?.id||''; }
  else { p_id.value=''; p_nama.value=''; p_harga.value=''; p_hpp.value=''; p_stok.value=''; p_exp.value=todayISO(); p_barcode.value=''; p_batch.value=''; p_bpom.value=''; }
  modalProduk.showModal();
}
function editProduk(id){ openProdukModal(id); }
function hapusProduk(id){ if(!needAdmin('produk')) return; if(confirm('Hapus?')){produk=produk.filter(x=>x.id!==id); saveAll(); renderAll();} }
function simpanProduk(e){
  e.preventDefault();
  if(!needAdmin('produk')) return;
  const katVal=p_kat.value.trim();
  if(katVal && !kategoriList.includes(katVal)){ kategoriList.push(katVal); saveAll(); renderKategoriSelects(); }
  const id=p_id.value || 'HB'+String(Date.now()).slice(-5);
  const barcode=p_barcode.value|| ('899'+String(Date.now()).slice(-7));
  const sku=(katVal.slice(0,3).toUpperCase()+'-'+barcode+'-'+id.slice(-3)).replace(/\s/g,'');
  const obj={id,sku,nama:p_nama.value,kategori:katVal,harga:Number(p_harga.value),hpp:Number(p_hpp.value||0),exp:p_exp.value,barcode,batch:p_batch.value||'',bpom:p_bpom.value||'',supplier:p_supplier.value,gambar:'🌿',outlet:currentOutlet};
  const idx=produk.findIndex(x=>x.id===id);
  if(idx>=0){
    const existing=produk[idx];
    obj.stokByOutlet = { ...(existing.stokByOutlet||{}), [currentOutlet]: Number(p_stok.value)||0 };
    obj.stok = obj.stokByOutlet[currentOutlet];
    produk[idx]={...existing,...obj};
  } else {
    obj.stokByOutlet={[currentOutlet]: Number(p_stok.value)||0};
    obj.stok=obj.stokByOutlet[currentOutlet];
    produk.unshift(obj);
  }
  saveAll(); modalProduk.close(); renderAll();
}
function openBulkProdukModal(){ if(!needAdmin('produk')) return; document.getElementById('modalBulkProduk')?.showModal(); }
function prosesBulkProduk(e){
  e.preventDefault(); if(!needAdmin('produk')) return;
  const txt=document.getElementById('bulkProdukText').value.trim(); if(!txt) return;
  const lines=txt.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const t=Date.now(); let ok=0, fail=[];
  lines.forEach((line,i)=>{
    const parts=line.split(/[\t|;]+/).map(s=>s.trim());
    const nama=parts[0]||'';
    const hpp=Number((parts[1]||'').replace(/\D/g,''))||0;
    const harga=Number((parts[2]||'').replace(/\D/g,''))||0;
    let kat=(parts[3]||'').trim()||'Umum';
    if(!nama){ fail.push(line); return; }
    if(produk.some(x=>x.nama.toLowerCase()===nama.toLowerCase())){ fail.push(nama+' (duplikat)'); return; }
    if(!kategoriList.includes(kat)){ kategoriList.push(kat); }
    const id='P'+String(t).slice(-6)+i;
    const barcode='899'+String(t).slice(-7)+i;
    const sku=(kat.slice(0,3).toUpperCase()+'-'+barcode+'-'+id.slice(-3)).replace(/\s/g,'');
    produk.unshift({id,sku,nama,kategori:kat,harga,hpp,exp:'',barcode,batch:'',bpom:'',supplier:supplier[0]?.id||'',gambar:'🌿',outlet:currentOutlet,stok:0,stokByOutlet:{[currentOutlet]:0}});
    ok++;
  });
  document.getElementById('bulkProdukText').value='';
  saveAll(); document.getElementById('modalBulkProduk')?.close(); renderKategoriSelects(); renderAll();
  if(fail.length) alert('OK '+ok+' • Gagal: '+fail.join(', '));
}

// Member
function renderTabelMember(){
  const q=(document.getElementById('cariMember')?.value||'').toLowerCase();
  const list=member.filter(m=>!q||m.nama.toLowerCase().includes(q)||(m.hp||'').includes(q)||(m.level||'').toLowerCase().includes(q)||(m.referral||'').toLowerCase().includes(q));
  document.getElementById('tabelMember').innerHTML=pagerSlice('member',list).map(m=>`<tr class="border-t"><td class="p-3 font-medium">${m.nama}<div class="text-xs text-slate-400">Ref: ${m.referral||'-'}</div></td><td class="p-3 text-center">${m.hp}</td><td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-xs ${m.level==='Gold'?'bg-amber-100 text-amber-700':m.level==='Silver'?'bg-slate-200':'bg-orange-100'}">${m.level}</span></td><td class="p-3 text-center">${m.diskon}%</td><td class="p-3 text-center">${m.poin}</td><td class="p-3 text-center"><button onclick="editMember('${m.id}')" class="text-teal-600">Edit</button><button onclick="hapusMember('${m.id}')" class="text-red-500 ml-2">Hapus</button></td></tr>`).join('')||'<tr><td colspan="6" class="p-6 text-center text-[#718096]">Tidak ada member</td></tr>';
  const pg=document.getElementById('pagerMember'); if(pg) pg.innerHTML=pagerHTML('member',list.length);
}
function openMemberModal(id=null){ if(!needAdmin('member')) return;
  renderMemberLevels();
  if(id){ const m=member.find(x=>x.id===id); m_id.value=m.id; m_nama.value=m.nama; m_hp.value=m.hp; m_level.value=m.level; }
  else { m_id.value=''; m_nama.value=''; m_hp.value=''; m_level.value=memberLevels[0]?.nama||'';}
  modalMember.showModal();
}
function editMember(id){ openMemberModal(id); }
function hapusMember(id){ if(!needAdmin('member')) return; if(confirm('Hapus?')){member=member.filter(x=>x.id!==id); saveAll(); renderAll();}}
function simpanMember(e){ if(!needAdmin('member')) return;
  e.preventDefault();
  const level=m_level.value;
  const lev=memberLevels.find(l=>l.nama===level);
  const disc=lev? lev.diskon : 0;
  const id=m_id.value || 'M'+String(Date.now()).slice(-5);
  const old=member.find(x=>x.id===id);
  const obj={id,nama:m_nama.value,hp:m_hp.value,level,diskon:disc,poin:old?.poin||0, referral: old?.referral || 'REF'+id.slice(-3)+Math.floor(100+Math.random()*900)};
  const idx=member.findIndex(x=>x.id===id); if(idx>=0) member[idx]=obj; else member.unshift(obj);
  saveAll(); modalMember.close(); renderAll();
}

// Supplier
function renderMemberLevels(){
  const html=memberLevels.map(l=>`
    <div class="flex items-center gap-2 bg-white border border-[#e6e8eb] p-2.5 rounded-xl">
      <input value="${l.nama}" onchange="updateMemberLevel('${l.id}','nama',this.value)" class="flex-1 border rounded-lg px-2 py-1.5 text-sm font-medium" placeholder="Nama level">
      <div class="flex items-center gap-1.5"><input type="number" value="${l.diskon}" onchange="updateMemberLevel('${l.id}','diskon',this.value)" class="w-[70px] border rounded-lg px-2 py-1.5 text-sm text-center font-bold"> <span class="text-xs">%</span></div>
      <input type="number" value="${l.minPoin||0}" onchange="updateMemberLevel('${l.id}','minPoin',this.value)" class="w-[85px] border rounded-lg px-2 py-1.5 text-xs" placeholder="Min poin">
      <button onclick="hapusMemberLevel('${l.id}')" class="text-red-500 hover:bg-red-50 w-7 h-7 rounded-full">×</button>
    </div>`).join('') + `<div class="text-xs text-[#718096] mt-1">${memberLevels.length} level • Nama & % bisa diubah</div>`;
  const el=document.getElementById('memberLevelList'); if(el) el.innerHTML=html;
  const el2=document.getElementById('settingMemberLevelList'); if(el2) el2.innerHTML=html;
  const opts=memberLevels.map(l=>`<option value="${l.nama}">${l.nama} (${l.diskon}%)</option>`).join('');
  const selM=document.getElementById('m_level'); if(selM) selM.innerHTML=opts;
  const selP=document.getElementById('pr_memberLevel'); if(selP){
    const cur=selP.value;
    selP.innerHTML='<option value="">Semua Level</option>'+opts;
    selP.value=cur;
  }
  // ppn + qris setting sync
  const ppnVal=localStorage.getItem(LS.ppn);
  const sEl=document.getElementById('settingPpn'); if(sEl) sEl.checked=ppnVal==='true';
  const kEl=document.getElementById('ppnAktif'); if(kEl && ppnVal!==null) kEl.checked=ppnVal==='true';
  const qEl=document.getElementById('settingQris'); if(qEl) qEl.value=qrisPct();
}
function qrisPct(){ const v=parseFloat(localStorage.getItem(LS.qris)); return isNaN(v)?1:Math.max(0,v); }
function simpanQrisSetting(v){
  const n=Math.max(0,parseFloat(v)||0);
  localStorage.setItem(LS.qris,String(n));
  const el=document.getElementById('settingQris'); if(el) el.value=n;
  hitung();
}
function togglePpnSetting(v){
  localStorage.setItem(LS.ppn, String(v));
  const el=document.getElementById('ppnAktif'); if(el) el.checked=v;
  const el2=document.getElementById('settingPpn'); if(el2) el2.checked=v;
}
function buatBackup(){
  const data={produk,member,trx,supplier,pembelian,opname,promo,notas,outlets,users,shifts,memberLevels,kategoriList, waktu:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='backup-pos-'+todayISO()+'.json'; a.click(); URL.revokeObjectURL(url);
  const info=document.getElementById('backupInfo'); if(info) info.textContent='Backup dibuat '+new Date().toLocaleString('id-ID')+' • '+produk.length+' produk, '+member.length+' member';
  // simpan juga ke localStorage backup
  localStorage.setItem('herbal_backup_'+todayISO(), JSON.stringify(data));
}
function importData(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(confirm('Import akan timpa data saat ini. Lanjutkan? Backup dulu?')){
        if(data.produk) produk=data.produk;
        if(data.member) member=data.member;
        if(data.trx) trx=data.trx;
        if(data.supplier) supplier=data.supplier;
        if(data.pembelian) pembelian=data.pembelian;
        if(data.opname) opname=data.opname;
        if(data.promo) promo=data.promo;
        if(data.memberLevels) memberLevels=data.memberLevels;
        if(data.kategoriList) kategoriList=data.kategoriList;
        if(data.shifts) shifts=data.shifts;
        saveAll(); renderAll();
        alert('Import berhasil — reload');
        location.reload();
      }
    }catch(err){ alert('File tidak valid: '+err.message); }
  };
  reader.readAsText(file);
}
function tambahMemberLevel(){
  if(!needAdmin('member')) return;
  const nama=prompt('Nama level baru:'); if(!nama) return;
  const diskon=Number(prompt('Diskon % untuk '+nama+':','5')||0);
  const id='L'+Date.now().toString().slice(-4);
  memberLevels.push({id, nama, diskon, minPoin:0});
  saveAll(); renderMemberLevels(); renderTabelMember();
}
function hapusMemberLevel(id){
  if(!needAdmin('member')) return;
  if(memberLevels.length<=1) return alert('Minimal 1 level');
  if(!confirm('Hapus level ini? Member dengan level ini akan jadi '+memberLevels[0].nama)) return;
  const level=memberLevels.find(l=>l.id===id);
  memberLevels=memberLevels.filter(l=>l.id!==id);
  member.forEach(m=>{ if(m.level===level.nama) m.level=memberLevels[0].nama; m.diskon=memberLevels.find(x=>x.nama===m.level)?.diskon||0; });
  saveAll(); renderMemberLevels(); renderTabelMember(); renderAll();
}
function updateMemberLevel(id, field, value){
  if(!needAdmin('member')) return;
  const lvl=memberLevels.find(l=>l.id===id); if(!lvl) return;
  const oldNama=lvl.nama;
  if(field==='diskon') lvl.diskon=Number(value)||0;
  else if(field==='minPoin') lvl.minPoin=Number(value)||0;
  else lvl[field]=value;
  if(field==='nama'){
    member.forEach(m=>{ if(m.level===oldNama) m.level=lvl.nama; });
  }
  // sinkronkan diskon semua member sesuai level terbaru
  member.forEach(m=>{
    const lev=memberLevels.find(l=>l.nama===m.level);
    if(lev) m.diskon=lev.diskon;
    else if(memberLevels[0]) { m.level=memberLevels[0].nama; m.diskon=memberLevels[0].diskon; }
  });
  saveAll(); renderMemberLevels(); renderTabelMember(); renderMemberSelect();
}

function renderKategoriSelects(){
  const opts=kategoriList.map(k=>`<option value="${k}">${k}</option>`).join('');
  const ids=['filterKat','pr_kategori','lapKategori'];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    const cur=el.value;
    const hasAll=el.querySelector('option[value=""]')!==null;
    el.innerHTML=(hasAll? '<option value="">Semua Kategori</option>':'') + opts;
    if(cur && kategoriList.includes(cur)) el.value=cur;
  });
  const dl=document.getElementById('kategoriDatalist');
  if(dl) dl.innerHTML=kategoriList.map(k=>`<option value="${k}">`).join('');
  // render kelola kategori list
  const listEl=document.getElementById('kategoriList');
  if(listEl) listEl.innerHTML=kategoriList.map(k=>`
    <div class="flex items-center justify-between bg-white border p-2 rounded-xl">
      <span class="text-sm">${k}</span>
      <button onclick="hapusKategori('${k}')" class="text-red-500 text-xs border px-2 py-1 rounded-full">Hapus</button>
    </div>`).join('') + `<div class="text-xs text-[#718096]">${kategoriList.length} kategori • otomatis terisi saat tambah produk baru</div>`;
}
function tambahKategori(){
  if(!needAdmin('produk')) return;
  const nama=(document.getElementById('kategoriBaru')?.value||'').trim();
  if(!nama) return alert('Isi nama kategori');
  if(kategoriList.includes(nama)) return alert('Kategori sudah ada');
  kategoriList.push(nama); saveAll(); renderKategoriSelects(); document.getElementById('kategoriBaru').value='';
}
function hapusKategori(nama){
  if(!needAdmin('produk')) return;
  if(!confirm('Hapus kategori '+nama+'? Produk dengan kategori ini tetap ada.')) return;
  kategoriList=kategoriList.filter(k=>k!==nama); saveAll(); renderKategoriSelects();
}
function renderSupplier(){
  const q=(document.getElementById('cariSupplier')?.value||'').toLowerCase();
  const list=supplier.filter(s=>!q||s.nama.toLowerCase().includes(q)||(s.kontak||'').includes(q)||(s.alamat||'').toLowerCase().includes(q));
  document.getElementById('tabelSupplier').innerHTML=pagerSlice('supplier',list).map(s=>`<tr class="border-t"><td class="p-3">${s.nama}</td><td class="p-3">${s.kontak}</td><td class="p-3">${s.alamat}</td><td class="p-3 text-center"><button onclick="editSupplier('${s.id}')" class="text-teal-600">Edit</button><button onclick="hapusSupplier('${s.id}')" class="text-red-500 ml-2">Hapus</button></td></tr>`).join('')||'<tr><td colspan="4" class="p-6 text-center text-[#718096]">Tidak ada supplier</td></tr>';
  const pg=document.getElementById('pagerSupplier'); if(pg) pg.innerHTML=pagerHTML('supplier',list.length);
}
function openSupplierModal(id=null){ if(!needAdmin('supplier')) return;
  if(id){ const s=supplier.find(x=>x.id===id); s_id.value=s.id; s_nama.value=s.nama; s_kontak.value=s.kontak; s_alamat.value=s.alamat; }
  else { s_id.value=''; s_nama.value=''; s_kontak.value=''; s_alamat.value='';}
  modalSupplier.showModal();
}
function editSupplier(id){ openSupplierModal(id); }
function hapusSupplier(id){ if(!needAdmin('supplier')) return; if(confirm('Hapus?')){supplier=supplier.filter(x=>x.id!==id); saveAll(); renderAll();}}
function simpanSupplier(e){ if(!needAdmin('supplier')) return;
  e.preventDefault(); const id=s_id.value||'S'+String(Date.now()).slice(-4);
  const obj={id,nama:s_nama.value,kontak:s_kontak.value,alamat:s_alamat.value};
  const idx=supplier.findIndex(x=>x.id===id); if(idx>=0) supplier[idx]=obj; else supplier.push(obj);
  saveAll(); modalSupplier.close(); renderAll();
}

// Pembelian
function terimaBarang(sup,pid,qty,batch,exp,hpp){
  const p=produk.find(x=>x.id===pid); if(!p||!qty) return null;
  const stokLama=getStok(p);
  // PSAK14 Moving Average: HPP baru = (stokLama*hppLama + qty*hppBaru)/(stokLama+qty)
  if(hpp && p.hpp){
    const totalNilai=stokLama*p.hpp + qty*hpp;
    p.hpp=Math.round(totalNilai/(stokLama+qty));
  } else if(hpp) p.hpp=hpp;
  setStok(p, stokLama+qty); if(exp) p.exp=exp; if(batch) p.batch=batch;
  const rec={waktu:new Date().toISOString(), supplier:sup, produk:pid, qty, batch, exp, hpp, outlet:currentOutlet, ket:'Beli'};
  pembelian.unshift(rec); return rec;
}
function _produkSearch(term){
  const q=(term||'').toLowerCase().trim();
  if(!q) return [];
  return produk.filter(p=> p.nama.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q) || (p.barcode||'').includes(q) || (p.kategori||'').toLowerCase().includes(q) ).slice(0,20);
}
function _showBeliDropdown(inp, list){
  const dd=inp.parentElement.querySelector('.beliDropdown');
  if(!dd) return;
  if(!list.length){ dd.classList.add('hidden'); dd.innerHTML=''; return; }
  dd.innerHTML=list.map(p=>`<div onclick="pickBeliProduk(this,'${p.id}')" class="px-3 py-2 hover:bg-[#f6f7f9] cursor-pointer flex justify-between"><span>${p.nama}<span class="text-xs text-[#718096]"> • ${p.id}</span></span><span class="text-xs text-[#718096]">${rupiah(p.harga)}</span></div>`).join('');
  dd.classList.remove('hidden');
}
function onBeliSearch(inp){
  const pid=inp.getAttribute('data-pid')||'';
  const val=inp.value.trim();
  // if exact match keeps pid, otherwise clear
  if(pid){
    const cur=produk.find(x=>x.id===pid);
    if(!cur || cur.nama!==val) inp.setAttribute('data-pid','');
  }
  const row=inp.closest('.beliRow');
  const el=row?row.querySelector('.beliRowStok'):null;
  const exact=produk.find(x=>x.nama===val);
  if(exact){ inp.setAttribute('data-pid',exact.id); if(el) el.textContent='Stok: '+getStok(exact); _showBeliDropdown(inp, []); return; }
  if(val.length<1){ if(el) el.textContent=''; _showBeliDropdown(inp, []); return; }
  const list=_produkSearch(val);
  _showBeliDropdown(inp, list);
  if(el && !exact) el.textContent=list.length? (list.length+' produk ditemukan') : 'Tidak ada';
}
function pickBeliProduk(el, pid){
  const row=el.closest('.beliRow');
  const inp=row?row.querySelector('.beliRowProduk'):null;
  const p=produk.find(x=>x.id===pid);
  if(inp && p){ inp.value=p.nama; inp.setAttribute('data-pid', pid); }
  const dd=row?row.querySelector('.beliDropdown'):null; if(dd){ dd.classList.add('hidden'); dd.innerHTML=''; }
  const stokEl=row?row.querySelector('.beliRowStok'):null;
  if(stokEl) stokEl.textContent=p?('Stok sistem: '+getStok(p)):'';
}
document.addEventListener('click', e=>{
  if(!e.target.closest('.beliRow') && !e.target.closest('.opRow')){
    document.querySelectorAll('.beliDropdown').forEach(d=>{ d.classList.add('hidden'); });
    document.querySelectorAll('.opDropdown').forEach(d=>{ d.classList.add('hidden'); });
  }
});
// Pembelian Multi — form multi-baris: pilih produk dari master (searchable), isi qty+hpp, terima sekaligus
function beliRowAdd(pid, qty, hpp){
  if(!hasPriv('pembelian')) return;
  const box=document.getElementById('beliRows'); if(!box) return;
  const p0=pid?produk.find(x=>x.id===pid):null;
  const div=document.createElement('div');
  div.className='beliRow bg-white border rounded-xl p-2 space-y-1';
  div.innerHTML=`<div class="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center"><div class="relative min-w-0"><input type="text" placeholder="Ketik nama / SKU / barcode..." value="${p0 ? p0.nama.replace(/"/g,'&quot;') : ''}" data-pid="${pid||''}" class="beliRowProduk w-full border rounded-xl px-2 py-2 text-sm" autocomplete="off" oninput="onBeliSearch(this)" onfocus="onBeliSearch(this)"><div class="beliDropdown hidden absolute z-20 bg-white border rounded-xl mt-1 max-h-40 overflow-auto w-full shadow text-sm"></div></div><input type="number" placeholder="Qty" value="${qty??''}" class="beliRowQty border rounded-xl px-2 py-2 text-sm text-center"><input type="number" placeholder="HPP" value="${hpp??''}" class="beliRowHpp border rounded-xl px-2 py-2 text-sm text-right"><button onclick="this.closest('.beliRow').remove()" class="text-red-500 font-bold">×</button></div><div class="text-xs text-[#718096] beliRowStok">${p0?('Stok sistem: '+getStok(p0)) : ''}</div>`;
  box.appendChild(div);
}
function beliRowInfo(sel){
  const row=sel.closest('.beliRow'); const p=produk.find(x=>x.id===sel.value);
  let el=row?row.querySelector('.beliRowStok'):null;
  if(el) el.textContent=p?('Stok: '+getStok(p)):'';
}
function beliRowsReset(){ const box=document.getElementById('beliRows'); if(!box||!hasPriv('pembelian')) return; box.innerHTML=''; for(let i=0;i<3;i++) beliRowAdd(); }
function terimaBeliRows(){
  if(!needAdmin('pembelian')) return;
  const rows=[...document.querySelectorAll('#beliRows .beliRow')];
  const sup=document.getElementById('beliSupplier').value;
  const batch=document.getElementById('beliBatch').value;
  const exp=document.getElementById('beliExp').value;
  const vals=[];
  for(const r of rows){
    const inp=r.querySelector('.beliRowProduk');
    let pid=inp.getAttribute('data-pid')||'';
    if(!pid){
      const v=inp.value.trim(); if(!v) continue;
      let p=produk.find(x=> x.nama===v || x.id===v || x.sku===v || x.barcode===v);
      if(!p) p=produk.find(x=> x.nama.toLowerCase().includes(v.toLowerCase()) || (x.sku||'').toLowerCase().includes(v.toLowerCase()) || (x.barcode||'').includes(v) );
      if(!p) return alert('Produk tidak ditemukan: '+v);
      pid=p.id;
    }
    const qty=Number(r.querySelector('.beliRowQty').value);
    if(!qty) return alert('Isi qty untuk semua baris yang sudah pilih produk');
    vals.push({pid,qty,hpp:Number(r.querySelector('.beliRowHpp').value)||0});
  }
  if(!vals.length) return alert('Isi dulu minimal 1 baris');
  let ok=0;
  vals.forEach(v=>{ if(terimaBarang(sup,v.pid,v.qty,batch,exp,v.hpp)) ok++; });
  saveAll(); renderAll(); beliRowsReset();
  alert('Pembelian multi berhasil: '+ok+' produk');
}
function renderPembelian(){
  const rb=document.getElementById('beliRows'); if(rb&&!rb.children.length){ for(let i=0;i<3;i++) beliRowAdd(); }
  const q=(document.getElementById('cariBeli')?.value||'').toLowerCase();
  const list=pembelian.filter(r=>r.outlet===currentOutlet).filter(r=>{ if(!q) return true; const p=produk.find(x=>x.id===r.produk); const s=supplier.find(x=>x.id===r.supplier); return ((p?p.nama:r.produk)+' '+(s?s.nama:'')+' '+(r.batch||'')+' '+(r.ket||'')).toLowerCase().includes(q); });
  document.getElementById('riwayatBeli').innerHTML=pagerSlice('beli',list).map(r=>{
    const p=produk.find(x=>x.id===r.produk); const s=supplier.find(x=>x.id===r.supplier);
    return `<div class="flex justify-between border-b py-1"><span>${new Date(r.waktu).toLocaleString('id-ID')} • ${p?p.nama:r.produk} • ${r.qty>0?'+':''}${r.qty} • Batch ${r.batch||'-'} • ${s?s.nama:''}</span><span>${r.hpp?rupiah(r.hpp):''}</span></div>`;
  }).join('')||'<div class="text-slate-400">Belum ada</div>';
  const pg=document.getElementById('pagerBeli'); if(pg) pg.innerHTML=pagerHTML('beli',list.length);
}

// Opname Multi — form multi-baris: pilih produk dari master, isi fisik, simpan sekaligus
function produkOptions(selected){
  return '<option value="">— Pilih produk —</option>'+produk.map(p=>`<option value="${p.id}"${p.id===selected?' selected':''}>${p.nama}</option>`).join('');
}
function _showOpDropdown(inp, list){
  const dd=inp.parentElement.querySelector('.opDropdown');
  if(!dd) return;
  if(!list.length){ dd.classList.add('hidden'); dd.innerHTML=''; return; }
  dd.innerHTML=list.map(p=>`<div onclick="pickOpProduk(this,'${p.id}')" class="px-3 py-2 hover:bg-[#f6f7f9] cursor-pointer flex justify-between"><span>${p.nama}<span class="text-xs text-[#718096]"> • ${p.id}</span></span><span class="text-xs">Stok ${getStok(p)}</span></div>`).join('');
  dd.classList.remove('hidden');
}
function onOpSearch(inp){
  const pid=inp.getAttribute('data-pid')||'';
  const val=inp.value.trim();
  if(pid){
    const cur=produk.find(x=>x.id===pid);
    if(!cur || cur.nama!==val) inp.setAttribute('data-pid','');
  }
  const row=inp.closest('.opRow');
  const el=row?row.querySelector('.opRowSistem'):null;
  const exact=produk.find(x=>x.nama===val);
  if(exact){ inp.setAttribute('data-pid',exact.id); if(el) el.textContent=getStok(exact); _showOpDropdown(inp, []); return; }
  if(val.length<1){ if(el) el.textContent='-'; _showOpDropdown(inp, []); return; }
  const kat=document.getElementById('opKategori')?.value||'';
  let list=_produkSearch(val);
  if(kat) list=list.filter(p=>p.kategori===kat);
  _showOpDropdown(inp, list);
  if(el && !exact) el.textContent=list.length? (list.length+' ditemukan') : '-';
}
function pickOpProduk(el, pid){
  const row=el.closest('.opRow');
  const inp=row?row.querySelector('.opRowProduk'):null;
  const p=produk.find(x=>x.id===pid);
  if(inp && p){ inp.value=p.nama; inp.setAttribute('data-pid', pid); }
  const dd=row?row.querySelector('.opDropdown'):null; if(dd){ dd.classList.add('hidden'); dd.innerHTML=''; }
  const stokEl=row?row.querySelector('.opRowSistem'):null;
  if(stokEl) stokEl.textContent=p?getStok(p):'-';
}
function opRowAdd(pid, fisik){
  if(!hasPriv('opname')) return;
  const box=document.getElementById('opRows'); if(!box) return;
  const p=pid?produk.find(x=>x.id===pid):null;
  const div=document.createElement('div');
  div.className='opRow flex flex-wrap items-center gap-2 bg-white border rounded-xl p-2';
  div.innerHTML=`<div class="relative flex-1 min-w-[160px]"><input type="text" placeholder="Ketik nama / SKU / barcode..." value="${p ? p.nama.replace(/"/g,'&quot;') : ''}" data-pid="${pid||''}" class="opRowProduk w-full border rounded-xl px-2 py-2 text-sm" autocomplete="off" oninput="onOpSearch(this)" onfocus="onOpSearch(this)"><div class="opDropdown hidden absolute z-20 bg-white border rounded-xl mt-1 max-h-40 overflow-auto w-full shadow text-sm"></div></div><span class="text-xs text-[#718096]">Sistem: <b class="opRowSistem">${p?getStok(p):'-'}</b></span><input type="number" placeholder="Fisik" value="${fisik??''}" class="opRowFisik w-[90px] border rounded-xl px-2 py-2 text-sm"><button onclick="this.closest('.opRow').remove()" class="text-red-500 px-2 font-bold">×</button>`;
  box.appendChild(div);
  if(p&&fisik==null){ const inp=div.querySelector('.opRowFisik'); if(inp) inp.focus(); }
}
function opRowSistem(sel){
  const row=sel.closest('.opRow'); const p=produk.find(x=>x.id===sel.value);
  const el=row?row.querySelector('.opRowSistem'):null; if(el) el.textContent=p?getStok(p):'-';
}
function renderOpnameKategoriFilter(){
  const sel=document.getElementById('opKategori'); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Semua Kategori</option>'+kategoriList.map(k=>`<option value="${k}">${k}</option>`).join('');
  if(kategoriList.includes(cur)) sel.value=cur;
}
function filterOpnameKategori(kat){
  // filter product search dropdown to only show products in that category when adding rows
  // no direct filter, but next opRowAdd will be filtered via _produkSearch if needed
}
function tambahOpnameKategori(){
  const kat=document.getElementById('opKategori')?.value;
  if(!kat) return alert('Pilih kategori dulu');
  const list=produk.filter(p=>p.kategori===kat);
  if(!list.length) return alert('Tidak ada produk di kategori '+kat);
  list.forEach(p=> opRowAdd(p.id));
}
function opRowsReset(){ const box=document.getElementById('opRows'); if(!box||!hasPriv('opname')) return; box.innerHTML=''; for(let i=0;i<3;i++) opRowAdd(); renderOpnameKategoriFilter(); }
function ensureOpnameKategoriFilter(){ renderOpnameKategoriFilter(); }
function simpanOpnameRows(){
  if(!needAdmin('opname')) return;
  const rows=[...document.querySelectorAll('#opRows .opRow')];
  const vals=[];
  for(const r of rows){
    const inp=r.querySelector('.opRowProduk');
    let pid=inp.getAttribute('data-pid')||'';
    if(!pid){
      const v=inp.value.trim(); if(!v) continue;
      let p=produk.find(x=> x.nama===v || x.id===v || x.sku===v || x.barcode===v);
      if(!p) p=produk.find(x=> x.nama.toLowerCase().includes(v.toLowerCase()) || (x.sku||'').toLowerCase().includes(v.toLowerCase()) || (x.barcode||'').includes(v) );
      if(!p) return alert('Produk tidak ditemukan: '+v);
      pid=p.id;
    }
    const fv=r.querySelector('.opRowFisik').value.trim();
    if(fv==='') return alert('Isi fisik untuk semua baris yang sudah pilih produk');
    const fisik=Number(fv); if(isNaN(fisik)) return alert('Fisik harus angka');
    vals.push({pid,fisik});
  }
  if(!vals.length) return alert('Isi dulu minimal 1 baris');
  const done={}; vals.forEach(v=>done[v.pid]=v.fisik);
  const waktu=new Date().toISOString(); let n=0;
  Object.keys(done).forEach(pid=>{
    const p=produk.find(x=>x.id===pid); if(!p) return;
    const fisik=done[pid];
    opname.unshift({waktu, produk:pid, outlet:currentOutlet, sistem:getStok(p), fisik, selisih:fisik-getStok(p)});
    setStok(p, fisik); n++;
  });
  saveAll(); renderAll(); opRowsReset();
  alert('Opname berhasil: '+n+' produk');
}
function openOpnameScanner(){
  // reuse scanner but handler khusus opname: scan -> tambah draft dengan prompt fisik
  openScanner();
  // override onScanSuccess sementara
  const orig=window.onScanSuccess;
  window.onScanSuccess=(code)=>{
    stopScanner(); document.getElementById('modalScanner').close();
    const p=produk.find(x=> x.barcode===code || x.sku===code || x.id===code);
    if(!p) return alert('Barcode tidak ditemukan: '+code);
    opRowAdd(p.id);
    window.onScanSuccess=orig;
  };
}
function renderOpname(){
  const rb=document.getElementById('opRows'); if(rb&&!rb.children.length){ for(let i=0;i<3;i++) opRowAdd(); }
  const filtered=opname.filter(o=>!o.outlet || o.outlet===currentOutlet);
  document.getElementById('opLog').innerHTML=pagerSlice('oplog',filtered).map(o=>{
    const p=produk.find(x=>x.id===o.produk);
    return `<div class="border-b py-1 flex justify-between text-xs"><span>${new Date(o.waktu).toLocaleString('id-ID')} • ${p?p.nama:o.produk} • Sistem ${o.sistem} → Fisik ${o.fisik} (${o.selisih>0?'+':''}${o.selisih})</span><span class="${o.selisih!==0?'text-red-600':'text-[#718096]'}">${o.selisih===0?'OK':'Selisih'}</span></div>`;
  }).join('')||'<div class="text-[#718096] text-sm">Belum ada opname</div>';
  const pg=document.getElementById('pagerOpLog'); if(pg) pg.innerHTML=pagerHTML('oplog',filtered.length);
}

// Promo Kompleks
function renderPromo(){
  document.getElementById('tabelPromo').innerHTML=promo.map(pr=>{
    const syarat=[
      pr.minBelanja? 'min '+rupiah(pr.minBelanja):'',
      pr.memberLevel? pr.memberLevel:'',
      pr.kategori? pr.kategori:'',
      pr.produkIds?.length? pr.produkIds.join(','):'',
      pr.expHari? 'exp<'+pr.expHari+'hr':'',
      pr.kode? 'kode:'+pr.kode:'',
      pr.maxDiskon? 'max '+rupiah(pr.maxDiskon):''
    ].filter(Boolean).join(' • ') || '-';
    const periode = (pr.periodeStart||pr.periodeEnd) ? `${pr.periodeStart||''} → ${pr.periodeEnd||''}` : '-';
    const freeTxt = pr.freeProdukIds?.length ? ' → free '+pr.freeProdukIds.join(',') : '';
    const nilaiTxt = pr.tipe==='persen'? pr.nilai+'%': pr.tipe==='nominal'? rupiah(pr.nilai): pr.tipe==='tiered'? pr.nilai+'%/'+pr.nilai2+'%': pr.tipe==='bundling'? `${pr.nilai}→${pr.nilai2}${freeTxt}${pr.bundlingDiskon? ' +'+pr.bundlingDiskon+'%':''}`: pr.nilai;
    return `<tr class="border-t"><td class="p-2"><div class="font-medium">${pr.nama}</div><div class="text-xs text-[#718096]">${pr.kode? 'Kode: '+pr.kode : ''}</div></td><td class="p-2 text-center"><span class="bg-[#f6f7f9] border px-2 py-0.5 rounded-full text-xs">${pr.tipe}</span></td><td class="p-2 text-center">${nilaiTxt}</td><td class="p-2 text-xs">${syarat}</td><td class="p-2 text-xs">${periode}</td><td class="p-2 text-center">${pr.aktif?'<span class="bg-[var(--cbm-accent-soft)] text-[var(--cbm-accent)] px-2 py-0.5 rounded-full text-xs">Aktif</span>':'<span class="bg-slate-100 px-2 py-0.5 rounded-full text-xs">Off</span>'}</td><td class="p-2 text-center"><button onclick="editPromo('${pr.id}')" class="text-[var(--cbm-accent)]">Edit</button><button onclick="hapusPromo('${pr.id}')" class="text-red-500 ml-2">Hapus</button></td></tr>`;
  }).join('') || '<tr><td colspan="7" class="p-6 text-center text-[#718096]">Belum ada promo</td></tr>';
  // update kasir select
  const sel=document.getElementById('diskonTambahan');
  if(sel) sel.innerHTML='<option value="">Tanpa promo</option>'+promo.filter(p=>p.aktif).map(p=>`<option value="${p.id}">${p.nama} ${p.kode?'['+p.kode+']':''} (${p.tipe})</option>`).join('');
}
function renderPromoProdukPicker(){
  const q=(document.getElementById('prProdukSearch')?.value||'').toLowerCase();
  const qFree=(document.getElementById('prProdukSearchFree')?.value||'').toLowerCase();
  const filterByQ=(p,q)=> !q || p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode||'').includes(q) || (p.kategori||'').toLowerCase().includes(q);
  const c=document.getElementById('pr_produkPicker'); if(c){
    const sel=(document.getElementById('pr_produkIds').value||'').split(',').map(s=>s.trim()).filter(Boolean);
    const list=q? produk.filter(p=>filterByQ(p,q)) : produk;
    c.innerHTML=list.slice(0,100).map(p=>`
      <label class="flex items-center gap-2 p-1.5 hover:bg-[#f6f7f9] rounded-lg cursor-pointer">
        <input type="checkbox" value="${p.id}" ${sel.includes(p.id)?'checked':''} onchange="togglePromoProduk('${p.id}',this.checked)">
        <span class="text-xs">${p.nama} <span class="text-[#718096]">${p.sku} • ${p.kategori}</span></span>
        <span class="ml-auto text-xs text-[#718096]">${rupiah(p.harga)}</span>
      </label>`).join('') || '<div class="text-xs text-[#718096] p-2">Tidak ada produk</div>';
    if(list.length>100) c.innerHTML+=`<div class="text-[10px] text-[#718096] p-1">+${list.length-100} lagi — ketik lebih spesifik</div>`;
  }
  const cf=document.getElementById('pr_produkPickerFree'); if(cf){
    const selF=(document.getElementById('pr_freeProdukIds').value||'').split(',').map(s=>s.trim()).filter(Boolean);
    const listF=qFree? produk.filter(p=>filterByQ(p,qFree)) : produk;
    cf.innerHTML=listF.slice(0,100).map(p=>`
      <label class="flex items-center gap-2 p-1.5 hover:bg-[#ecfdf5] rounded-lg cursor-pointer">
        <input type="checkbox" value="${p.id}" ${selF.includes(p.id)?'checked':''} onchange="togglePromoProdukFree('${p.id}',this.checked)">
        <span class="text-xs">${p.nama} <span class="text-[#718096]">${p.sku}</span></span>
        <span class="ml-auto text-xs text-[#059669]">${rupiah(p.harga)}</span>
      </label>`).join('') || '<div class="text-xs text-[#718096] p-2">Kosong = gratis produk yang sama</div>';
    if(listF.length>100) cf.innerHTML+=`<div class="text-[10px] text-[#718096] p-1">+${listF.length-100} lagi — ketik lebih spesifik</div>`;
  }
}
function togglePromoProduk(id, checked){
  const el=document.getElementById('pr_produkIds');
  let vals=(el.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(checked){ if(!vals.includes(id)) vals.push(id); } else vals=vals.filter(v=>v!==id);
  el.value=vals.join(',');
}
function togglePromoProdukFree(id, checked){
  const el=document.getElementById('pr_freeProdukIds');
  let vals=(el.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(checked){ if(!vals.includes(id)) vals.push(id); } else vals=vals.filter(v=>v!==id);
  el.value=vals.join(',');
}
function updatePromoPickerVisibility(){
  const tipe=document.getElementById('pr_tipe')?.value;
  const box=document.getElementById('pr_bundlingPicker');
  if(box) box.classList.toggle('hidden', tipe!=='bundling');
}
function updatePromoFormByType(){
  const tipe=document.getElementById('pr_tipe')?.value;
  // hide all promo boxes
  document.querySelectorAll('.promo-type-box').forEach(el=> el.classList.add('hidden'));
  const box=document.getElementById('promoBox_'+tipe);
  if(box) box.classList.remove('hidden');
  // also keep simple fields always visible
  updatePromoPickerVisibility();
  // re-render picker when bundling shown
  if(tipe==='bundling') renderPromoProdukPicker();
}
function openPromoModal(id=null){ if(!needAdmin('promo')) return;
  if(id){
    const pr=promo.find(x=>x.id===id);
    pr_id.value=pr.id; pr_nama.value=pr.nama; pr_tipe.value=pr.tipe; pr_nilai.value=pr.nilai; pr_nilai2.value=pr.nilai2||''; pr_minBelanja.value=pr.minBelanja||''; pr_maxDiskon.value=pr.maxDiskon||''; pr_kategori.value=pr.kategori||''; pr_memberLevel.value=pr.memberLevel||''; pr_kode.value=pr.kode||''; pr_periodeStart.value=pr.periodeStart||''; pr_periodeEnd.value=pr.periodeEnd||''; pr_produkIds.value=(pr.produkIds||[]).join(','); pr_expHari.value=pr.expHari||''; pr_aktif.checked=pr.aktif;
  } else {
    pr_id.value=''; pr_nama.value=''; pr_tipe.value='persen'; pr_nilai.value=''; pr_nilai2.value=''; pr_minBelanja.value=''; pr_maxDiskon.value=''; pr_kategori.value=''; pr_memberLevel.value=''; pr_kode.value=''; pr_periodeStart.value=''; pr_periodeEnd.value=''; pr_produkIds.value=''; pr_expHari.value=''; pr_aktif.checked=true;
  }
  renderPromoProdukPicker();
  updatePromoFormByType();
  updatePromoPickerVisibility();
  // populate per-type specific fields for edit
  const pr=promo.find(x=>x.id===pr_id.value);
  if(pr){
    const setVal=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val||''; };
    if(pr.tipe==='nominal') setVal('pr_nilai_nominal', pr.nilai);
    if(pr.tipe==='bundling'){ setVal('pr_nilai_bundling', pr.nilai); setVal('pr_nilai2', pr.nilai2); setVal('pr_diskon_bundling', pr.bundlingDiskon); }
    if(pr.tipe==='tiered'){ setVal('pr_nilai_tiered', pr.nilai); setVal('pr_nilai2_tiered', pr.nilai2); setVal('pr_minBelanja_tiered', pr.minBelanja); }
    if(pr.tipe==='kategori'){ setVal('pr_kategori_k', pr.kategori); setVal('pr_nilai_kategori', pr.nilai); }
    if(pr.tipe==='persen'){ setVal('pr_kategori', pr.kategori); setVal('pr_expHari', pr.expHari); }
  }
  const sel=document.getElementById('pr_tipe'); if(sel) sel.onchange=()=>{updatePromoFormByType(); updatePromoPickerVisibility();};
  modalPromo.showModal();
}
function editPromo(id){ openPromoModal(id); }
function hapusPromo(id){ if(!needAdmin('promo')) return; if(confirm('Hapus promo?')){promo=promo.filter(x=>x.id!==id); saveAll(); renderAll();}}
function simpanPromo(e){ if(!needAdmin('promo')) return;
  e.preventDefault(); const id=pr_id.value||'PR'+String(Date.now()).slice(-4);
  // unique check
  const namaVal=pr_nama.value.trim();
  if(promo.some(x=> x.nama.toLowerCase()===namaVal.toLowerCase() && x.id!==id)) return alert('Nama promo sudah ada — harus unique');
  const kodeVal=pr_kode.value.trim().toUpperCase();
  if(kodeVal && promo.some(x=> x.kode && x.kode.toUpperCase()===kodeVal && x.id!==id)) return alert('Kode promo sudah ada — harus unique');
  const tipe=pr_tipe.value;
  const getVal=(id)=> document.getElementById(id)?.value||'';
  const getNum=(id)=> Number(getVal(id)||0);
  let nilai=0, nilai2=0, minBelanja=0, maxDiskon=0, kategori='', expHari=0, bundlingDiskon=0;
  if(tipe==='persen'){ nilai=getNum('pr_nilai'); maxDiskon=getNum('pr_maxDiskon'); kategori=getVal('pr_kategori'); expHari=getNum('pr_expHari'); }
  else if(tipe==='nominal'){ nilai=getNum('pr_nilai_nominal')||getNum('pr_nilai'); minBelanja=getNum('pr_minBelanja'); maxDiskon=getNum('pr_maxDiskon'); }
  else if(tipe==='bogo'){ nilai=0; }
  else if(tipe==='bundling'){ nilai=getNum('pr_nilai_bundling')||getNum('pr_nilai'); nilai2=getNum('pr_nilai2'); bundlingDiskon=getNum('pr_diskon_bundling'); }
  else if(tipe==='tiered'){ nilai=getNum('pr_nilai_tiered')||getNum('pr_nilai'); nilai2=getNum('pr_nilai2_tiered')||getNum('pr_nilai2'); minBelanja=getNum('pr_minBelanja_tiered')||getNum('pr_minBelanja'); maxDiskon=getNum('pr_maxDiskon'); }
  else if(tipe==='kategori'){ kategori=document.getElementById('pr_kategori_k')?.value||getVal('pr_kategori'); nilai=getNum('pr_nilai_kategori')||getNum('pr_nilai'); maxDiskon=getNum('pr_maxDiskon'); }
  else { nilai=getNum('pr_nilai'); nilai2=getNum('pr_nilai2'); minBelanja=getNum('pr_minBelanja'); maxDiskon=getNum('pr_maxDiskon'); kategori=getVal('pr_kategori'); expHari=getNum('pr_expHari'); }
  const katVal = kategori || getVal('pr_kategori') || document.getElementById('pr_kategori_k')?.value||'';
  const memberLevelVal = getVal('pr_memberLevel') || document.getElementById('pr_memberLevel_all')?.value || '';
  const obj={
    id, nama:pr_nama.value.trim(), tipe:tipe, nilai:nilai, nilai2:nilai2,
    minBelanja:minBelanja||getNum('pr_minBelanja')||0,
    maxDiskon:maxDiskon||0,
    kategori:katVal, memberLevel:memberLevelVal, kode:pr_kode.value.trim().toUpperCase(),
    periodeStart:pr_periodeStart.value, periodeEnd:pr_periodeEnd.value,
    produkIds:(document.getElementById('pr_produkIds')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    freeProdukIds:(document.getElementById('pr_freeProdukIds')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    expHari: expHari||0, bundlingDiskon: bundlingDiskon||0, aktif: pr_aktif.checked
  };
  // hapus field tidak relevan biar rapi
  const idx=promo.findIndex(x=>x.id===id); if(idx>=0) promo[idx]=obj; else promo.push(obj);
  saveAll(); modalPromo.close(); renderAll();
}

// Stok FEFO
function renderStok(){
  const tipis=produk.filter(p=>getStok(p)<15);
  document.getElementById('stokTipis').innerHTML=tipis.length?tipis.map(p=>`<div class="flex justify-between border-b py-1"><span>${p.nama}</span><b class="text-red-600">${getStok(p)}</b></div>`).join(''):'<div class="text-slate-400">Aman</div>';
  const now=new Date();
  const dekat=[...produk].sort((a,b)=> new Date(a.exp)-new Date(b.exp)).filter(p=> (new Date(p.exp)-now)/86400000 <90);
  document.getElementById('expDekat').innerHTML=dekat.length?dekat.map(p=>`<div class="flex justify-between border-b py-1"><span>${p.nama} <span class="text-xs text-slate-500">${p.exp} • ${p.batch}</span></span><span class="text-amber-600 text-xs">${Math.floor((new Date(p.exp)-now)/86400000)} hari</span></div>`).join(''):'<div class="text-slate-400">Tidak ada</div>';
  // kartu stok
  const pid=document.getElementById('kartuProduk').value;
  if(pid){
    const logs=pembelian.filter(x=>x.produk===pid && x.outlet===currentOutlet).slice(0,20);
    document.getElementById('kartuStok').innerHTML=logs.map(l=>`<div class="border-b py-1">${new Date(l.waktu).toLocaleDateString('id-ID')} • ${l.qty>0?'+':''}${l.qty} • ${l.ket} • ${l.batch||''}</div>`).join('')||'<div class="text-slate-400">No data</div>';
  }
}

// Laporan Lengkap — Sortir, Margin, Perputaran
function getLaporanPeriode(){
  const mulai=document.getElementById('lapTglMulai')?.value;
  const akhir=document.getElementById('lapTglAkhir')?.value;
  const single=document.getElementById('lapTgl')?.value;
  let m=mulai|| single || '', a=akhir|| single || '';
  if(m && !a) a=m;
  if(!m && a) m=a;
  return {mulai:m, akhir:a};
}
function listTrxOutlet(){ return trx.filter(t=>t.outlet===currentOutlet); }
function calcTurnover(produkId, soldQty, periodeMulai, periodeAkhir){
  const p=produk.find(x=>x.id===produkId); if(!p) return 0;
  const stokAkhir=getStok(p);
  // pembelian qty di periode
  let beliQty=0;
  pembelian.forEach(b=>{
    if(b.produk===produkId && b.qty>0 && b.outlet===currentOutlet){
      const d=b.waktu.slice(0,10);
      if((!periodeMulai||d>=periodeMulai) && (!periodeAkhir||d<=periodeAkhir)) beliQty+=b.qty;
    }
  });
  const stokAwal = stokAkhir + soldQty - beliQty;
  const avg=(stokAwal+stokAkhir)/2;
  if(avg<=0) return soldQty>0? 99 : 0;
  return soldQty/avg;
}
function renderLaporan(){
  const {mulai, akhir}=getLaporanPeriode();
  const kategori=document.getElementById('lapKategori')?.value||'';
  const sortir=document.getElementById('lapSort')?.value||'qty_desc';
  let list=listTrxOutlet();
  if(mulai) list=list.filter(t=> t.waktu.slice(0,10) >= mulai);
  if(akhir) list=list.filter(t=> t.waktu.slice(0,10) <= akhir);
  if(kategori){
    // filter transaksi yang ada produk kategori tersebut? Untuk ringkasan tetap all, tapi untuk produk perform filter
  }
  const omzet=list.reduce((s,t)=>s+t.total,0);
  const laba=list.reduce((s,t)=>s+(t.laba||0),0);
  const margin = omzet? (laba/omzet*100).toFixed(1):0;
  const hari=todayISO();
  const lapHariEl=document.getElementById('lapHari'); if(lapHariEl) lapHariEl.textContent=rupiah(omzet);
  const lapHariLabel=document.getElementById('lapHariLabel'); if(lapHariLabel) lapHariLabel.textContent = mulai? (mulai===akhir? mulai : mulai+'→'+akhir) : hari;
  const lapTrxEl=document.getElementById('lapTrx'); if(lapTrxEl) lapTrxEl.textContent=list.length;
  const lapLabaEl=document.getElementById('lapLaba'); if(lapLabaEl) lapLabaEl.textContent=rupiah(laba);
  const lapMargin=document.getElementById('lapMargin'); if(lapMargin) lapMargin.textContent='Margin '+margin+'%';
  const lapMarginAvg=document.getElementById('lapMarginAvg'); if(lapMarginAvg) lapMarginAvg.textContent=margin+'%';
  const lapBulanEl=document.getElementById('lapBulan'); if(lapBulanEl){
    const bulan=hari.slice(0,7); const omBulan=listTrxOutlet().filter(t=>t.waktu.slice(0,7)===bulan).reduce((s,t)=>s+t.total,0);
    lapBulanEl.textContent=rupiah(omBulan);
  }
  // hitung performa produk
  const map={}; // id -> {qty, omzet, hpp, laba}
  list.forEach(t=> t.cart.forEach(it=>{
    const p=produk.find(x=>x.id===it.id); if(!p) return;
    if(kategori && p.kategori!==kategori) return;
    if(!map[it.id]) map[it.id]={id:it.id, nama:it.nama, sku:p.sku||p.id, kategori:p.kategori, qty:0, omzet:0, hpp:0, stok:getStok(p)};
    map[it.id].qty+=it.qty;
    map[it.id].omzet+=it.harga*it.qty;
    map[it.id].hpp+= (it.hpp||p.hpp||0)*it.qty;
  }));
  let arr=Object.values(map).map(v=>{
    v.laba=v.omzet - v.hpp;
    v.margin=v.omzet? (v.laba/v.omzet*100):0;
    v.turnover=calcTurnover(v.id, v.qty, mulai, akhir);
    v.status = v.turnover>2? 'Cepat' : v.turnover>0.8? 'Normal' : v.turnover>0? 'Lambat' : 'Mati';
    return v;
  });
  // sortir
  const sortFn={
    qty_desc:(a,b)=>b.qty-a.qty,
    omzet_desc:(a,b)=>b.omzet-a.omzet,
    laba_desc:(a,b)=>b.laba-a.laba,
    margin_desc:(a,b)=>b.margin-a.margin,
    turnover_desc:(a,b)=>b.turnover-a.turnover,
    stok_asc:(a,b)=>a.stok-b.stok
  }[sortir] || sortFn.qty_desc;
  arr.sort(sortFn);
  // turnover avg
  const avgTurn = arr.length? (arr.reduce((s,x)=>s+x.turnover,0)/arr.length).toFixed(2):0;
  const lapTurn=document.getElementById('lapTurnover'); if(lapTurn) lapTurn.textContent=avgTurn+'x';
  const lapTop=document.getElementById('lapTop'); if(lapTop){
    const top=arr[0];
    lapTop.textContent=top? `${top.nama} (${top.qty})` : '-';
  }
  const lapProdukCount=document.getElementById('lapProdukCount'); if(lapProdukCount) lapProdukCount.textContent=arr.length+' produk';
  const lapTrxCount=document.getElementById('lapTrxCount'); if(lapTrxCount) lapTrxCount.textContent=list.length+' transaksi • Periode '+(mulai||'-')+' → '+(akhir||'-');
  // omzet per metode bayar (Tunai / Transfer / QRIS / Split dipisah)
  const payMap={};
  list.forEach(t=>{ const k=t.pay||'Tunai'; if(!payMap[k]) payMap[k]={n:0,omzet:0}; payMap[k].n++; payMap[k].omzet+=t.total; });
  const lapPay=document.getElementById('lapPay');
  if(lapPay){
    const order=['Tunai','Transfer','QRIS','Split'];
    const keys=[...order.filter(k=>payMap[k]), ...Object.keys(payMap).filter(k=>!order.includes(k))];
    lapPay.innerHTML=keys.length?keys.map(k=>`<div class="bg-[#f6f7f9] border rounded-xl px-3 py-2"><div class="text-xs text-[#718096]">${k} • ${payMap[k].n}x</div><div class="font-bold">${rupiah(payMap[k].omzet)}</div></div>`).join(''):'<div class="text-xs text-[#718096]">Belum ada transaksi</div>';
  }
  // penjualan harian
  const harianMap={};
  list.forEach(t=>{ const d=t.waktu.slice(0,10); if(!harianMap[d]) harianMap[d]={tanggal:d, n:0, omzet:0, laba:0}; harianMap[d].n++; harianMap[d].omzet+=t.total; harianMap[d].laba+=(t.laba||0); });
  const harianArr=Object.values(harianMap).sort((a,b)=> b.tanggal.localeCompare(a.tanggal));
  const tabelHarian=document.getElementById('tabelHarian');
  if(tabelHarian){
    if(!harianArr.length) tabelHarian.innerHTML='<tr><td colspan="5" class="p-6 text-center text-[#718096]">Belum ada transaksi</td></tr>';
    else tabelHarian.innerHTML=harianArr.map(h=>`<tr class="border-t"><td class="p-2">${h.tanggal}</td><td class="p-2 text-center">${h.n}</td><td class="p-2 text-right">${rupiah(h.omzet)}</td><td class="p-2 text-right text-[var(--cbm-accent)]">${rupiah(h.laba)}</td><td class="p-2 text-center text-xs">${h.n? rupiah(Math.round(h.omzet/h.n)) : '-'}</td></tr>`).join('');
  }
  // rekap shift harian
  const shiftHarianMap={};
  shifts.filter(s=> !mulai || s.buka.slice(0,10)>=mulai).filter(s=> !akhir || s.buka.slice(0,10)<=akhir).filter(s=> s.outlet===currentOutlet || !s.outlet).forEach(s=>{
    const d=s.buka.slice(0,10);
    const key=d+'|'+s.id;
    if(!shiftHarianMap[key]) shiftHarianMap[key]={tanggal:d, shift:s.id, toko:outlets.find(o=>o.id===s.outlet)?.nama||s.outlet, admin:s.userNama||s.user, n:s.transaksi||0, omzet:s.omzet||0, setoran:s.setoran, selisih:s.selisih};
  });
  // juga dari transaksi per shift jika shiftId ada
  list.forEach(t=>{ if(!t.shiftId) return; const d=t.waktu.slice(0,10); const s=shifts.find(x=>x.id===t.shiftId); if(!s) return; const key=d+'|'+s.id; if(!shiftHarianMap[key]) shiftHarianMap[key]={tanggal:d, shift:s.id, toko:outlets.find(o=>o.id===s.outlet)?.nama||s.outlet, admin:s.userNama, n:0, omzet:0, setoran:s.setoran, selisih:s.selisih}; });
  const shiftHarianArr=Object.values(shiftHarianMap).sort((a,b)=> b.tanggal.localeCompare(a.tanggal) || String(b.shift).localeCompare(String(a.shift)));
  const tabelShiftHarian=document.getElementById('tabelShiftHarian');
  if(tabelShiftHarian){
    if(!shiftHarianArr.length) tabelShiftHarian.innerHTML='<tr><td colspan="6" class="p-6 text-center text-[#718096]">Belum ada shift</td></tr>';
    else tabelShiftHarian.innerHTML=shiftHarianArr.map(s=>`<tr class="border-t"><td class="p-2">${s.tanggal}</td><td class="p-2"><div class="font-medium">${s.shift}</div><div class="text-xs text-[#718096]">${s.toko} • ${s.admin}</div></td><td class="p-2 text-center">${s.n}</td><td class="p-2 text-right">${rupiah(s.omzet)}</td><td class="p-2 text-right">${s.setoran!=null?rupiah(s.setoran):'-'}</td><td class="p-2 text-center ${s.selisih? (s.selisih===0?'text-[#059669]':'text-red-600') : ''}">${s.setoran==null?'-':(s.selisih===0?'Pas':(s.selisih>0?'+':'')+rupiah(s.selisih))}</td></tr>`).join('');
  }
  // tabel produk perform
  const tbodyP=document.getElementById('tabelProdukPerform');
  if(tbodyP){
    if(arr.length===0) tbodyP.innerHTML='<tr><td colspan="10" class="p-6 text-center text-[#718096]">Tidak ada data — ganti periode/kategori</td></tr>';
    else tbodyP.innerHTML=arr.map(v=>`
      <tr class="border-t hover:bg-[#f6f7f9]">
        <td class="p-2"><div class="font-medium">${v.nama}</div><div class="text-xs text-[#718096]">${v.sku} • ${v.id}</div></td>
        <td class="p-2 text-center"><span class="bg-[#f6f7f9] border px-2 py-0.5 rounded-full text-xs">${v.kategori}</span></td>
        <td class="p-2 text-center font-semibold">${v.qty}</td>
        <td class="p-2 text-right">${rupiah(v.omzet)}</td>
        <td class="p-2 text-right text-[#718096]">${rupiah(v.hpp)}</td>
        <td class="p-2 text-right text-[var(--cbm-accent)] font-medium">${rupiah(v.laba)}</td>
        <td class="p-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${v.margin>25?'bg-[#ecfdf5] text-[#059669]':v.margin>10?'bg-[#fef9c3] text-[#a16207]':'bg-[#fee2e2] text-[#dc2626]'}">${v.margin.toFixed(1)}%</span></td>
        <td class="p-2 text-center ${v.stok<10?'text-red-600 font-bold':''}">${v.stok}</td>
        <td class="p-2 text-center">${v.turnover.toFixed(2)}x</td>
        <td class="p-2 text-center"><span class="text-xs px-2 py-0.5 rounded-full ${v.status==='Cepat'?'bg-[#ecfdf5] text-[#059669]':v.status==='Lambat'?'bg-[#fee2e2] text-[#dc2626]':'bg-slate-100'}">${v.status}</span></td>
      </tr>`).join('');
  }
  // tabel kategori
  const katMap={};
  list.forEach(t=> t.cart.forEach(it=>{
    const p=produk.find(x=>x.id===it.id); if(!p) return;
    if(!katMap[p.kategori]) katMap[p.kategori]={kategori:p.kategori, qty:0, omzet:0, hpp:0};
    katMap[p.kategori].qty+=it.qty;
    katMap[p.kategori].omzet+=it.harga*it.qty;
    katMap[p.kategori].hpp+=(it.hpp||p.hpp||0)*it.qty;
  }));
  const katArr=Object.values(katMap).map(k=>{
    k.laba=k.omzet - k.hpp;
    k.margin=k.omzet? (k.laba/k.omzet*100):0;
    // turnover kategori = avg turnover produk dalam kategori
    const prodInKat=arr.filter(v=>v.kategori===k.kategori);
    k.turnover=prodInKat.length? (prodInKat.reduce((s,v)=>s+v.turnover,0)/prodInKat.length):0;
    return k;
  }).sort((a,b)=>b.omzet-a.omzet);
  const tbodyK=document.getElementById('tabelKategori');
  if(tbodyK) tbodyK.innerHTML=katArr.length? katArr.map(k=>`<tr class="border-t"><td class="p-2 font-medium">${k.kategori}</td><td class="p-2 text-center font-semibold">${k.qty}</td><td class="p-2 text-right">${rupiah(k.omzet)}</td><td class="p-2 text-right text-[var(--cbm-accent)]">${rupiah(k.laba)}</td><td class="p-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${k.margin>20?'bg-[#ecfdf5] text-[#059669]':'bg-slate-100'}">${k.margin.toFixed(1)}%</span></td><td class="p-2 text-center">${k.turnover.toFixed(2)}x</td></tr>`).join('') : '<tr><td colspan="6" class="p-6 text-center text-[#718096]">Tidak ada data kategori</td></tr>';
  // tabel transaksi detail dengan margin
  const count={}; // untuk top
  const tabelLap=document.getElementById('tabelLap');
  if(tabelLap){
    tabelLap.innerHTML=list.slice(0,120).map(t=>{
      const m=member.find(x=>x.id===t.member);
      const mgn=t.total? ((t.laba||0)/t.total*100).toFixed(1):0;
      return `<tr class="border-t"><td class="p-2 text-xs">${new Date(t.waktu).toLocaleString('id-ID')}</td><td class="p-2 text-right">${rupiah(t.total)}</td><td class="p-2 text-right text-[var(--cbm-accent)]">${rupiah(t.laba||0)}</td><td class="p-2 text-center text-xs">${mgn}%</td><td class="p-2 text-center text-xs">${t.pay}</td><td class="p-2 text-center text-xs">${m?m.nama:'Umum'}</td><td class="p-2 text-center"><button onclick='cetakStruk(${JSON.stringify(t).replace(/'/g,"&#39;")})' class="text-[var(--cbm-accent)] text-xs">Struk</button></td></tr>`;
    }).join('')||'<tr><td colspan="7" class="p-6 text-center text-[#718096]">Belum ada transaksi</td></tr>';
  }
  refreshIcons();
}
function exportExcel(){
  let csv='Waktu,ID,Outlet,Total,Laba,Margin,Bayar,Member,Items\n';
  const {mulai, akhir}=getLaporanPeriode();
  let list=listTrxOutlet(); if(mulai) list=list.filter(t=>t.waktu.slice(0,10)>=mulai); if(akhir) list=list.filter(t=>t.waktu.slice(0,10)<=akhir);
  list.forEach(t=>{
    const mgn=t.total? ((t.laba||0)/t.total*100).toFixed(1):0;
    csv+=`"${t.waktu}","${t.id}","${t.outlet}",${t.total},${t.laba||0},${mgn}%,"${t.pay||''}","${member.find(m=>m.id===t.member)?.nama||''}","${t.cart.map(c=>c.nama+' x'+c.qty).join('; ')}"\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='laporan-transaksi-'+(mulai||todayISO())+'.csv'; a.click(); URL.revokeObjectURL(url);
}
function exportProdukExcel(){
  const {mulai, akhir}=getLaporanPeriode();
  const kategori=document.getElementById('lapKategori')?.value||'';
  let list=listTrxOutlet(); if(mulai) list=list.filter(t=>t.waktu.slice(0,10)>=mulai); if(akhir) list=list.filter(t=>t.waktu.slice(0,10)<=akhir);
  const map={};
  list.forEach(t=> t.cart.forEach(it=>{
    const p=produk.find(x=>x.id===it.id); if(!p) return; if(kategori && p.kategori!==kategori) return;
    if(!map[it.id]) map[it.id]={nama:it.nama, sku:p.sku||p.id, kategori:p.kategori, qty:0, omzet:0, hpp:0, stok:getStok(p)};
    map[it.id].qty+=it.qty; map[it.id].omzet+=it.harga*it.qty; map[it.id].hpp+=(it.hpp||p.hpp||0)*it.qty;
  }));
  let csv='Produk,SKU,Kategori,Terjual,Omzet,HPP,Laba,Margin,Stok,Turnover\n';
  Object.values(map).forEach(v=>{
    const laba=v.omzet-v.hpp; const margin=v.omzet? (laba/v.omzet*100).toFixed(1):0; const turnover=calcTurnover(v.sku||v.nama, v.qty, mulai, akhir).toFixed(2);
    csv+=`"${v.nama}","${v.sku}","${v.kategori}",${v.qty},${v.omzet},${v.hpp},${laba},${margin}%,${v.stok},${turnover}x\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='laporan-produk-'+(mulai||todayISO())+'.csv'; a.click(); URL.revokeObjectURL(url);
}
function switchLaporan(tab){
  ['Ringkasan','Produk','Transaksi','Kategori'].forEach(k=>{
    const el=document.getElementById('lapSub'+k);
    if(el) el.classList.toggle('hidden', k.toLowerCase()!==tab);
    const btn=document.getElementById('lapTab'+k);
    if(btn) btn.className = k.toLowerCase()===tab ? 'px-3 py-1.5 rounded-lg bg-[var(--cbm-accent)] text-white text-xs' : 'px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs';
  });
  refreshIcons();
}
function returTransaksiPrompt(){ if(!needAdmin('retur')) return;
  const id=prompt('Masukkan ID transaksi untuk retur (TRX...):'); if(!id) return;
  const t=trx.find(x=>x.id===id); if(!t) return alert('Tidak ditemukan');
  if(t.outlet!==currentOutlet) return alert('Transaksi toko lain ('+(outlets.find(o=>o.id===t.outlet)?.nama||t.outlet)+'), tidak bisa retur di '+(outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet));
  if(!confirm('Retur transaksi '+id+'? Stok akan dikembalikan')) return;
  // kembalikan stok ke toko asal transaksi
  const prevOutlet=currentOutlet; currentOutlet=t.outlet;
  t.cart.forEach(it=>{ const p=produk.find(x=>x.id===it.id); if(p) setStok(p, getStok(p)+it.qty); pembelian.push({waktu:new Date().toISOString(), outlet:t.outlet, produk:it.id, qty:it.qty, ket:'Retur '+id}); });
  currentOutlet=prevOutlet;
  trx=trx.filter(x=>x.id!==id); saveAll(); renderAll(); alert('Retur berhasil');
}
function getShiftAktif(outletId){ return shifts.find(s=> s.outlet===outletId && s.status==='buka'); }
function bukaShift(){ if(!needAdmin('shift')) return;
  const isOwner=currentUser?.role==='Owner';
  const outletId=isOwner?(document.getElementById('shiftOutlet')?.value || currentOutlet):currentOutlet;
  if(!canAccessOutlet(currentUser,outletId)) return alert('Akses toko ditolak');
  const userId=isOwner?(document.getElementById('shiftUser')?.value || currentUser?.id):currentUser?.id;
  if(!userId) return alert('Pilih admin');
  if(getShiftAktif(outletId)) return alert('Shift sudah buka di toko ini. Tutup dulu.');
  const saldo=Number(document.getElementById('shiftSaldo')?.value||0);
  const user=users.find(u=>u.id===userId);
  const id='SHIFT-'+outletId+'-'+Date.now().toString().slice(-6);
  shifts.unshift({id,outlet:outletId,user:userId,userNama:user?.nama||'',buka:new Date().toISOString(),tutup:null,saldoAwal:saldo,total:0,transaksi:0,omzet:0,status:'buka'});
  saveAll(); renderShift(); alert('Shift dibuka: '+id+' • '+outlets.find(o=>o.id===outletId)?.nama);
}
function shiftPaySummary(shift){
  const rel=trx.filter(t=>t.outlet===shift.outlet && t.waktu>=shift.buka);
  const s={n:rel.length,omzet:0,tunai:0,transfer:0,qris:0,split:0,splitTunai:0};
  rel.forEach(t=>{ s.omzet+=t.total||0;
    if(t.pay==='Tunai') s.tunai+=t.total||0;
    else if(t.pay==='Transfer') s.transfer+=t.total||0;
    else if(t.pay==='QRIS') s.qris+=t.total||0;
    else if(t.pay==='Split'){ s.split+=t.total||0; s.splitTunai+=Number(t.splitTunai||0); }
  });
  s.expected=s.tunai+s.splitTunai;
  return s;
}
function renderTutupInfo(){
  const box=document.getElementById('tutupInfo'); if(!box) return;
  const id=document.getElementById('shiftTutupSelect')?.value;
  const shift=shifts.find(s=>s.id===id);
  if(!shift||shift.status!=='buka'){ box.innerHTML='<span class="text-[#718096]">Pilih shift buka untuk tutup.</span>'; return; }
  const s=shiftPaySummary(shift);
  box.innerHTML=`<div class="grid grid-cols-2 gap-1">
    <span>Omzet</span><b class="text-right">${rupiah(s.omzet)}</b>
    <span>Tunai</span><span class="text-right">${rupiah(s.tunai)}</span>
    <span>Transfer</span><span class="text-right">${rupiah(s.transfer)}</span>
    <span>QRIS</span><span class="text-right">${rupiah(s.qris)}</span>
    <span>Split (tunai ${rupiah(s.splitTunai)})</span><span class="text-right">${rupiah(s.split)}</span>
    <span class="font-bold">Kas Tunai harapan</span><b class="text-right text-[var(--cbm-accent)]">${rupiah(s.expected)}</b>
  </div><div class="text-[11px] text-[#718096] mt-1">Setoran = penjualan Tunai (+ porsi tunai Split). QRIS/Transfer tidak disetor tunai.</div>`;
}
function tutupShift(){ if(!needAdmin('shift')) return;
  const id=document.getElementById('shiftTutupSelect')?.value;
  const shift=shifts.find(s=>s.id===id);
  if(!shift||shift.status!=='buka') return alert('Pilih shift buka dulu');
  if(shift.user!==currentUser?.id && currentUser?.role!=='Owner' && currentUser?.role!=='Spv') return alert('Hanya admin shift atau Owner/SPV yang bisa tutup');
  const s=shiftPaySummary(shift);
  const raw=((document.getElementById('tutupSetoran')?.value)||'').trim();
  if(raw==='') return alert('Isi dulu uang yang disetorkan (Rp)');
  const setor=Number(raw); if(isNaN(setor)||setor<0) return alert('Nominal setoran tidak valid');
  const selisih=setor-s.expected;
  if(selisih!==0 && !confirm('Setoran '+rupiah(setor)+' selisih '+rupiah(selisih)+' dari kas Tunai '+rupiah(s.expected)+'. Tetap tutup shift?')) return;
  shift.tutup=new Date().toISOString(); shift.status='tutup';
  shift.omzet=s.omzet; shift.transaksi=s.n;
  shift.tunaiOmzet=s.tunai; shift.transferOmzet=s.transfer; shift.qrisOmzet=s.qris; shift.splitOmzet=s.split;
  shift.expected=s.expected; shift.setoran=setor; shift.selisih=selisih;
  const inp=document.getElementById('tutupSetoran'); if(inp) inp.value='';
  saveAll(); renderAll();
  alert('Shift ditutup: '+shift.id+' • Setoran '+rupiah(setor)+(selisih?(' • Selisih '+rupiah(selisih)):' • Pas'));
}
function renderShift(){
  const mo=myOutlets();
  const isOwner=currentUser?.role==='Owner';
  const boxPilih=document.getElementById('shiftBukaPilih'); if(boxPilih) boxPilih.style.display=isOwner?'':'none';
  const infoBuka=document.getElementById('shiftBukaInfo');
  if(infoBuka){
    if(isOwner) infoBuka.style.display='none';
    else { infoBuka.style.display=''; infoBuka.innerHTML=`Toko: <b>${outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet}</b> • Admin: <b>${currentUser?.nama||''} (${currentUser?.role||''})</b> — shift otomatis ikut akun ini.`; }
  }
  const selO=document.getElementById('shiftOutlet'); if(selO) selO.innerHTML=mo.map(o=>`<option value="${o.id}">${o.nama}</option>`).join('');
  const selU=document.getElementById('shiftUser'); if(selU) selU.innerHTML=users.map(u=>`<option value="${u.id}">${u.nama} (${u.role})</option>`).join('');
  const selT=document.getElementById('shiftTutupSelect');
  if(selT){
    const prev=selT.value;
    selT.innerHTML=shifts.filter(s=>s.status==='buka' && canAccessOutlet(currentUser,s.outlet)).map(s=>`<option value="${s.id}">${s.id} • ${outlets.find(o=>o.id===s.outlet)?.nama} • ${s.userNama}</option>`).join('') || '<option value="">Tidak ada shift buka</option>';
    const mine=getShiftAktif(currentOutlet);
    if([...selT.options].some(o=>o.value===prev)) selT.value=prev;
    else if(mine && [...selT.options].some(o=>o.value===mine.id)) selT.value=mine.id;
  }
  const selF=document.getElementById('shiftFilterOutlet');
  if(selF){
    const prevF=selF.value;
    selF.innerHTML=(isOwner?'<option value="">Semua Toko</option>':'')+mo.map(o=>`<option value="${o.id}">${o.nama}</option>`).join('');
    if([...selF.options].some(o=>o.value===prevF)) selF.value=prevF;
    else if(!isOwner&&mo.length) selF.value=mo.some(o=>o.id===currentOutlet)?currentOutlet:mo[0].id;
  }
  const rowF=document.getElementById('shiftFilterRow'); if(rowF) rowF.style.display=(!isOwner&&mo.length<=1)?'none':'';
  const filter=document.getElementById('shiftFilterOutlet')?.value;
  renderTutupInfo();
  let list=shifts; if(filter) list=shifts.filter(s=>s.outlet===filter);
  const info=document.getElementById('shiftAktifInfo');
  if(info){
    const aktif=list.filter(s=>s.status==='buka');
    if(aktif.length===0) info.innerHTML='<span class="text-[#718096]">Tidak ada shift buka. Buka shift dulu untuk bisa transaksi.</span>';
    else info.innerHTML=aktif.map(s=>`<div class="flex justify-between"><span>${s.id} • ${outlets.find(o=>o.id===s.outlet)?.nama} • ${s.userNama} • buka ${new Date(s.buka).toLocaleString('id-ID')}</span><span class="text-[var(--cbm-accent)]">BUKA</span></div>`).join('');
  }
  const tb=document.getElementById('shiftTabel');
  if(tb) tb.innerHTML=list.slice(0,100).map(s=>`<tr class="border-t"><td class="p-2 font-mono text-xs">${s.id}</td><td class="p-2">${outlets.find(o=>o.id===s.outlet)?.nama||s.outlet}</td><td class="p-2">${s.userNama}</td><td class="p-2 text-xs">${new Date(s.buka).toLocaleString('id-ID')}</td><td class="p-2 text-xs">${s.tutup? new Date(s.tutup).toLocaleString('id-ID'):'-'}</td><td class="p-2 text-center">${s.transaksi||0}</td><td class="p-2 text-right">${rupiah(s.omzet||0)}</td><td class="p-2 text-right">${s.setoran!=null?rupiah(s.setoran):'-'}</td><td class="p-2 text-center ${s.selisih?'text-red-600 font-bold':''}">${s.setoran==null?'-':(s.selisih===0?'Pas':((s.selisih>0?'+':'')+rupiah(s.selisih)))}</td><td class="p-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${s.status==='buka'?'bg-[var(--cbm-accent-soft)] text-[var(--cbm-accent)]':'bg-slate-100 text-slate-500'}">${s.status}</span></td></tr>`).join('') || '<tr><td colspan="10" class="p-6 text-center text-[#718096]">Belum ada shift</td></tr>';
  refreshIcons();
}
function exportData(){
  const blob=new Blob([JSON.stringify({produk,member,trx,supplier,pembelian,opname,promo,notas,outlets,users,shifts},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='backup-herbal-'+todayISO()+'.json'; a.click(); URL.revokeObjectURL(url);
}

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
function refreshIcons(){ if(window.feather) try{feather.replace({ 'stroke-width': 1.4 })}catch{} }
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{
  const p=b.dataset.page; if(!p) return;
  if(p!=='kasir' && !hasPriv(p)){ alert('Akses ditolak: '+p+' hanya untuk Admin'); return; }
  document.querySelectorAll('.page').forEach(s=>s.classList.add('hidden'));
  const target=document.getElementById('page-'+p); if(target) target.classList.remove('hidden');
  if(p==='opname') renderOpnameKategoriFilter();
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('nav-active')); document.querySelectorAll(`[data-page="${p}"]`).forEach(x=>x.classList.add('nav-active'));
  refreshIcons();
}));
function tryAutoScan(v){
  const code=(v||'').trim(); if(code.length<3) return false;
  const p=produk.find(x=> x.barcode===code || x.sku===code || x.id===code);
  if(p){ addCart(p.id); const el=document.getElementById('cari'); if(el){ el.value=''; el.focus(); } renderProdukGrid(); return true; }
  return false;
}
const debouncedGrid=debounce(()=>{ renderProdukGrid(); const el=document.getElementById('gridInfo'); if(el) el.textContent=produk.length+' SKU • '+member.length+' member • outlet '+currentOutlet; refreshIcons(); },180);
const cariEl=document.getElementById('cari');
cariEl.addEventListener('input', (e)=>{
  PAGER.kasir.page=0;
  const v=e.target.value.trim();
  // auto tanpa klik: jika paste/scan langsung cocok barcode/SKU, tambah
  if(v.length>=4 && tryAutoScan(v)) return;
  debouncedGrid();
});
cariEl.addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){
    const v=e.target.value.trim();
    if(tryAutoScan(v)){ e.preventDefault(); return; }
    // jika tidak auto, tetap filter
  }
});
cariEl.addEventListener('paste', (e)=> setTimeout(()=>{ const v=cariEl.value.trim(); if(v.includes('\n')){ openBulkModal(); document.getElementById('bulkText').value=v; } else tryAutoScan(v); }, 30));
document.getElementById('filterKat').addEventListener('change', ()=>{ PAGER.kasir.page=0; renderProdukGrid(); });
document.getElementById('loginOutlet')?.addEventListener('change', e=>applyTheme(e.target.value));
document.getElementById('pilihMember').addEventListener('change', ()=>{ syncNota(); hitung(); });
document.getElementById('bayar').addEventListener('input', hitung);
document.getElementById('diskonTambahan').addEventListener('change', hitung);
document.getElementById('splitTunai').addEventListener('input', hitung);
document.getElementById('splitTransfer').addEventListener('input', hitung);
document.getElementById('kartuProduk').addEventListener('change', renderStok);
document.addEventListener('keydown', e=>{
  if(e.key==='F1'){e.preventDefault();document.querySelector('[data-page="kasir"]')?.click();document.getElementById('cari')?.focus()}
  if(e.key==='F2'){e.preventDefault();document.querySelector('[data-page="produk"]')?.click()}
  if(e.key==='F3'){e.preventDefault();document.querySelector('[data-page="member"]')?.click()}
  if(e.key==='F4'){e.preventDefault();document.querySelector('[data-page="laporan"]')?.click()}
  if(e.key==='Enter' && e.ctrlKey){e.preventDefault();bayarSekarang()}
});
setInterval(()=>{ const el=document.getElementById('jam'); if(el) el.textContent=new Date().toLocaleString('id-ID');},1000);
const THEMES={OUT001:{accent:'#16a34a',soft:'#dcfce7',line:'#bbf7d0',accent2:'#14b8a6'},OUT002:{accent:'#dc2626',soft:'#fee2e2',line:'#fecaca',accent2:'#f97316'}};
function applyTheme(outletId){ const t=THEMES[outletId]||THEMES.OUT001; const st=document.documentElement.style; st.setProperty('--cbm-accent',t.accent); st.setProperty('--cbm-accent-soft',t.soft); st.setProperty('--cbm-accent-line',t.line); st.setProperty('--cbm-accent2',t.accent2); }
function renderOutlet(){
  applyTheme(currentOutlet);
  const mo=myOutlets();
  const nonKasir=currentUser && currentUser.role!=='Kasir';
  const sw=document.getElementById('outletSwitch'); if(sw) sw.style.display=nonKasir?'':'none';
  const sel=document.getElementById('outletSelect');
  if(sel) sel.innerHTML=mo.map(o=>`<option value="${o.id}" ${o.id===currentOutlet?'selected':''}>${o.nama}</option>`).join('');
  const loginSel=document.getElementById('loginOutlet'); if(loginSel) loginSel.innerHTML=outlets.map(o=>`<option value="${o.id}" ${o.id===currentOutlet?'selected':''}>${o.nama}</option>`).join('');
  const locked=document.getElementById('lockedOutlet'); if(locked) locked.textContent=outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet;
  const lbl=document.getElementById('outletLabel'); if(lbl) lbl.textContent=outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet;
  const list=document.getElementById('outletList'); if(list) list.innerHTML=mo.map(o=>`<div class="flex justify-between border p-2 rounded-xl"><span>${o.id} • ${o.nama}</span>${currentUser?.role==='Owner'?`<button onclick="hapusOutlet('${o.id}')" class="text-red-500 text-xs">Hapus</button>`:''}</div>`).join('');
  const cnt=document.getElementById('tokoCount'); if(cnt) cnt.textContent=(currentUser?mo.length:outlets.length)+' Toko';
  const outletBtn=document.querySelector('[data-page="outlet"]');
  if(outletBtn) outletBtn.style.display = (outlets.length===1 || currentUser?.role==='Kasir') ? 'none' : '';
}
function renderUsers(){
  const sel=document.getElementById('userSelect'); if(sel) sel.innerHTML=users.map(u=>`<option value="${u.id}" ${currentUser?.id===u.id?'selected':''}>${u.nama} (${u.role})</option>`).join('');
  const lockedU=document.getElementById('lockedUser'); if(lockedU) lockedU.textContent=currentUser? `${currentUser.nama} • ${currentUser.role}` : 'Belum login — pilih di awal';
  const lbl=document.getElementById('roleLabel'); if(lbl) lbl.textContent=currentUser? currentUser.role : 'Belum login';
  renderUsersTable();
  applyPrivileges();
}
function gantiOutlet(id){
  if(!currentUser){ currentOutlet=id; saveAll(); renderAll(); return; }
  if(currentUser.role==='Kasir'){ alert('Kasir terikat 1 toko — logout untuk ganti toko.'); return; }
  if(!canAccessOutlet(currentUser,id)){ alert('Anda tidak punya akses ke toko ini'); return; }
  if(id===currentOutlet) return;
  currentOutlet=id; ensureNotaDraft(); saveAll(); renderAll();
}
function gantiUser(id){
  if(currentUser){ alert('User dikunci sejak login. Logout untuk ganti user.'); return; }
  const u=users.find(x=>x.id===id); if(u){ currentUser=u; saveAll(); renderUsers(); applyPrivileges(); }
}
function applyPrivileges(){
  const role=currentUser?.role||'Kasir';
  const boss = role==='Owner' || role==='Spv';
  document.querySelectorAll('.nav-btn').forEach(b=>{
    const p=b.dataset.page;
    const allowed = p==='kasir' || hasPriv(p);
    const ownerOnly = (p==='users' || p==='outlet');
    const vis = allowed || (boss && !ownerOnly);
    b.style.display = vis ? '' : 'none';
    b.disabled = !allowed && !boss;
    if(!allowed && !boss) b.title='Tidak diizinkan';
  });
  document.querySelectorAll('[data-admin-only]').forEach(el=> el.style.display = boss? '' : 'none');
}
function tambahOutlet(){ if(!needAdmin('outlet')) return; const n=document.getElementById('outletNama').value.trim(); if(!n) return; const id='OUT'+String(Date.now()).slice(-3); outlets.push({id,nama:n}); document.getElementById('outletNama').value=''; saveAll(); renderOutlet(); }
function hapusOutlet(id){ if(!needAdmin('outlet')) return; if(outlets.length<=1) return alert('Minimal 1 outlet'); if(!confirm('Hapus outlet?')) return; outlets=outlets.filter(o=>o.id!==id); if(currentOutlet===id) currentOutlet=outlets[0].id; saveAll(); renderAll(); }
function updateLoginUser(){
  const userInput=document.getElementById('loginUsername');
  const sel=document.getElementById('loginOutlet');
  if(!userInput||!sel) return;
  const v=userInput.value.trim().toLowerCase();
  const u=users.find(x=> (x.username||'').toLowerCase()===v);
  const prev=sel.value;
  const opts= u ? myOutlets(u) : outlets;
  sel.innerHTML=opts.map(o=>`<option value="${o.id}" ${o.id===currentOutlet?'selected':''}>${o.nama}</option>`).join('');
  if(u && u.role==='Kasir' && u.outletId) sel.value=u.outletId;
  else if(opts.some(o=>o.id===prev)) sel.value=prev;
  applyTheme(sel.value);
}
function ingatkanShift(){
  if(!currentUser) return;
  if(getShiftAktif(currentOutlet)) return;
  document.querySelector('[data-page="shift"]')?.click();
  setTimeout(()=>alert('Shift belum dibuka di '+(outlets.find(o=>o.id===currentOutlet)?.nama||currentOutlet)+'. Buka shift dulu agar bisa transaksi.'),400);
}
function login(e){
  e.preventDefault();
  const outletId=document.getElementById('loginOutlet')?.value || currentOutlet;
  const username=(document.getElementById('loginUsername')?.value||'').trim().toLowerCase();
  const password=document.getElementById('loginPassword')?.value||'';
  const u=users.find(x=> (x.username||'').toLowerCase()===username && (x.password||x.pin||'')===password);
  if(!u) return alert('Username atau password salah');
  if(!canAccessOutlet(u,outletId)) return alert('Akun @'+(u.username||u.nama)+' tidak punya akses ke toko '+(outlets.find(o=>o.id===outletId)?.nama||outletId));
  currentUser=u; currentOutlet=outletId;
  ensureNotaDraft();
  saveAll(); renderAll(); applyPrivileges();
  if(currentUser.role==='Kasir'){ document.querySelector('[data-page="kasir"]')?.click(); }
  ingatkanShift();
  modalLogin.close();
}
function logout(){
  if(confirm('Keluar dan ganti toko/user?')){
    currentUser=null; saveAll(); renderAll();
    try{ modalLogin.showModal(); }catch{}
  }
}
function copyReferral(code){ navigator.clipboard.writeText(code).then(()=>alert('Referral '+code+' disalin')).catch(()=>prompt('Copy:',code)); }
function hapusProdukAuth(id){ const pass=prompt('Password Owner/SPV untuk hapus:'); const ok=users.some(u=>(u.password||u.pin)===pass && ['Owner','Spv'].includes(u.role)); if(!ok) return alert('Password tidak sah'); hapusProduk(id); }

// Kelola User — Owner (Spv & Kasir)
function renderUserOutletsChecks(){
  const box=document.getElementById('u_outletBox');
  const role=document.getElementById('u_role')?.value;
  if(!box) return;
  if(role==='Kasir'){
    box.innerHTML='<div class="text-xs font-semibold text-[#718096] mb-1">Toko kasir (1 toko)</div><select id="u_outletSingle" class="w-full border rounded-xl px-3 py-2 bg-white">'+outlets.map(o=>`<option value="${o.id}">${o.nama}</option>`).join('')+'</select>';
  } else {
    box.innerHTML='<div class="text-xs font-semibold text-[#718096] mb-1">Toko yang bisa dijaga SPV (centang — semua = handle semua toko)</div><div class="grid grid-cols-1 max-h-[150px] overflow-auto border rounded-xl p-2 bg-white gap-1">'+outlets.map(o=>`<label class="flex items-center gap-2 p-1 hover:bg-[#f6f7f9] rounded-lg text-sm cursor-pointer"><input type="checkbox" value="${o.id}" class="userOutletCheck"> <span>${o.nama}</span></label>`).join('')+'</div>';
  }
}
function renderUsersTable(){
  const tb=document.getElementById('tabelUsers');
  if(!tb) return;
  tb.innerHTML=users.map(u=>{
    const toko = u.role==='Kasir' ? (outlets.find(o=>o.id===u.outletId)?.nama||'-')
      : u.role==='Spv' ? (myOutlets(u).map(o=>o.nama).join(', ')||'-')
      : 'Semua Toko';
    const isMe = u.id===currentUser?.id;
    return `<tr class="border-t">
      <td class="p-2"><div class="font-medium">${u.nama}${isMe?' <span class="text-[10px] bg-[var(--cbm-accent-soft)] text-[var(--cbm-accent)] px-1.5 py-0.5 rounded-full">Anda</span>':''}</div><div class="text-xs text-[#718096]">@${u.username||'-'}</div></td>
      <td class="p-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${u.role==='Owner'?'bg-[var(--cbm-accent-soft)] text-[var(--cbm-accent)]':u.role==='Spv'?'bg-[#ecfdf5] text-[#059669]':'bg-slate-100 text-slate-600'}">${u.role}</span></td>
      <td class="p-2 text-xs">${toko}</td>
      <td class="p-2 text-center"><button onclick="openUserModal('${u.id}')" class="text-[var(--cbm-accent)] text-xs">Edit</button>${u.role==='Owner'?'':' <button onclick="hapusUser(\''+u.id+'\')" class="text-red-500 text-xs ml-2">Hapus</button>'}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="4" class="p-6 text-center text-[#718096]">Belum ada user</td></tr>';
}
function openUserModal(id=null){
  if(!hasPriv('users')) return alert('Akses ditolak: kelola user hanya untuk Owner');
  const setV=(sel,v)=>{ if(sel) sel.value=v||''; };
  setV(document.getElementById('u_id'),'');
  setV(document.getElementById('u_nama'),'');
  setV(document.getElementById('u_username'),'');
  setV(document.getElementById('u_password'),'');
  setV(document.getElementById('u_role'),'Kasir');
  const roleSel=document.getElementById('u_role'); if(roleSel) roleSel.onchange=renderUserOutletsChecks;
  renderUserOutletsChecks();
  if(id){
    const u=users.find(x=>x.id===id);
    if(u){
      setV(document.getElementById('u_id'),u.id);
      setV(document.getElementById('u_nama'),u.nama);
      setV(document.getElementById('u_username'),u.username||u.nama);
      setV(document.getElementById('u_password'),u.password||u.pin||'');
      setV(document.getElementById('u_role'), u.role==='Owner'?'Kasir':u.role);
      renderUserOutletsChecks();
      if(u.role==='Kasir'){
        const s=document.getElementById('u_outletSingle'); if(s) s.value=u.outletId||outlets[0]?.id;
      } else if(u.role==='Spv'){
        (u.outletIds||[]).forEach(oid=>{ const c=document.querySelector(`.userOutletCheck[value="${oid}"]`); if(c) c.checked=true; });
      }
    }
  }
  document.getElementById('modalUser')?.showModal();
}
function hapusUser(id){
  if(!hasPriv('users')) return alert('Akses ditolak');
  const u=users.find(x=>x.id===id); if(!u) return;
  if(u.role==='Owner') return alert('Owner tidak bisa dihapus');
  if(u.id===currentUser?.id) return alert('Tidak bisa hapus user yang sedang dipakai');
  if(!confirm('Hapus user '+u.nama+'?')) return;
  users=users.filter(x=>x.id!==id); saveAll(); renderAll();
}
function simpanUser(e){
  e.preventDefault();
  if(!hasPriv('users')) return alert('Akses ditolak');
  const id=(document.getElementById('u_id')?.value||'').trim();
  const nama=(document.getElementById('u_nama')?.value||'').trim();
  const username=(document.getElementById('u_username')?.value||'').trim().toLowerCase();
  const password=document.getElementById('u_password')?.value||'';
  const role=document.getElementById('u_role')?.value||'Kasir';
  if(!nama||!username||!password) return alert('Lengkapi nama, username, password');
  if(users.some(x=> (x.username||'').toLowerCase()===username && x.id!==id)) return alert('Username sudah dipakai');
  const nid=id||'U'+Date.now().toString().slice(-4);
  if(role==='Kasir'){
    const outletId=document.getElementById('u_outletSingle')?.value||outlets[0]?.id;
    if(!outlets.some(o=>o.id===outletId)) return alert('Pilih toko kasir');
    const obj={id:nid,nama,username,password,role:'Kasir',outletId};
    const idx=users.findIndex(x=>x.id===nid); if(idx>=0) users[idx]=obj; else users.push(obj);
  } else {
    const checks=[...document.querySelectorAll('.userOutletCheck:checked')].map(c=>c.value);
    if(checks.length===0) return alert('Pilih minimal 1 toko untuk SPV');
    const obj={id:nid,nama,username,password,role:'Spv',outletIds:checks};
    const idx=users.findIndex(x=>x.id===nid); if(idx>=0) users[idx]=obj; else users.push(obj);
  }
  saveAll(); document.getElementById('modalUser')?.close(); renderAll();
}

function renderAll(){ renderOutlet(); renderUsers(); renderMemberLevels(); renderKategoriSelects(); renderNota(); renderProdukGrid(); renderMemberSelect(); renderCart(); renderTabelProduk(); renderTabelMember(); renderSupplier(); renderPembelian(); renderStok(); renderOpname(); renderPromo(); renderLaporan(); renderShift(); refreshIcons(); setTimeout(()=>{ const c=document.getElementById('cari'); if(c && !document.getElementById('page-kasir').classList.contains('hidden')) c.focus(); },120); if(!currentUser) setTimeout(()=>{ try{modalLogin.showModal()}catch{} },500); }
loadData().then(()=>{ renderAll(); ingatkanShift(); });
