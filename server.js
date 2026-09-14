const http=require('http'),fs=require('fs'),path=require('path');
const dir=__dirname;
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
let phoneQueue=[];
const os=require('os');
function getLanIp(){
  const nets=os.networkInterfaces();
  for(const name of Object.keys(nets)){
    for(const net of nets[name]){
      if(net.family==='IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}
const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }
  if(req.url==='/api/ip'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ip:getLanIp(), port:8088}));
    return;
  }
  if(req.url.startsWith('/api/phone-scan')){
    if(req.method==='POST'){
      let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
        try{ const j=JSON.parse(b||'{}'); const code=(j.code||'').trim(); if(code){ phoneQueue.push({code, waktu:Date.now()}); if(phoneQueue.length>20) phoneQueue.shift(); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true})); } else { res.writeHead(400); res.end('no code'); } }catch(e){ res.writeHead(400); res.end('bad json'); }
      }); return;
    }
    if(req.method==='GET'){
      try{
        const since=Number(new URL(req.url,'http://x').searchParams.get('since')||0);
        const items=phoneQueue.filter(x=>x.waktu>since);
        res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(items)); return;
      }catch(e){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(phoneQueue)); return; }
    }
  }
  if(req.method==='GET'){
    let p= req.url==='/'?'/index.html': req.url.split('?')[0];
    let fp=path.join(dir, decodeURIComponent(p));
    if(!fs.existsSync(fp) || fs.statSync(fp).isDirectory()){ fp=path.join(dir,'index.html'); }
    let ext=path.extname(fp);
    res.writeHead(200,{'Content-Type':mime[ext]||'text/plain'});
    const stream=fs.createReadStream(fp);
    stream.on('error',()=>{ res.writeHead(404); res.end('404'); });
    stream.pipe(res);
  } else {res.writeHead(404); res.end();}
});
server.on('error',(e)=>{ console.error('Server 8088 error', e.code, e.message); });
server.listen(8088,'0.0.0.0',()=>console.log('POS Herbal http://127.0.0.1:8088'));
