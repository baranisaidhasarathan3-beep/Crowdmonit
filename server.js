'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000;
const DATA=process.env.DATA_DIR||path.join(__dirname,'data');
const FILE=path.join(DATA,'db.json');
const PUB=path.join(__dirname,'public');
fs.mkdirSync(DATA,{recursive:true});
let db={venues:{}};
try{db=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
let dirty=false;
function flush(){if(!dirty)return;dirty=false;const t=FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,FILE)}
setInterval(flush,2000).unref();
['SIGTERM','SIGINT'].forEach(s=>process.on(s,()=>{flush();process.exit(0)}));
const clean=s=>String(s==null?'':s).replace(/[<>&"'`]/g,'').trim();
const hits=new Map();
function limited(key,max,ms){const now=Date.now();const h=(hits.get(key)||[]).filter(t=>now-t<ms);if(h.length>=max){hits.set(key,h);return true}h.push(now);hits.set(key,h);return false}
setInterval(()=>{const now=Date.now();for(const[k,h]of hits)if(!h.length||now-h[h.length-1]>3600000)hits.delete(k)},600000).unref();
const send=(res,code,obj)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj))};
function body(req){return new Promise((ok,no)=>{let d='';req.on('data',c=>{d+=c;if(d.length>10000){no(new Error('big'));req.destroy()}});req.on('end',()=>{try{ok(JSON.parse(d||'{}'))}catch(e){no(e)}})})}
const view=v=>({name:v.name,zones:v.zones.map(({id,name,cap,n,rep})=>({id,name,cap,n,rep}))});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const ip=req=>(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
http.createServer(async(req,res)=>{
  try{
    const p=new URL(req.url,'http://x').pathname,m=req.method;
    if(p==='/healthz')return send(res,200,{ok:true});
    if(p.startsWith('/api/')){
      if(p==='/api/venues'&&m==='POST'){
        if(limited('c'+ip(req),10,3600000))return send(res,429,{error:'Too many places created. Try again later.'});
        const b=await body(req),name=clean(b.name).slice(0,60);
        const zs=(Array.isArray(b.zones)?b.zones:[]).slice(0,12).map((z,i)=>({id:'z'+String(i+1).padStart(2,'0'),name:clean(z&&z.name).slice(0,40)||'Area',cap:Math.max(10,Math.min(1e6,parseInt(z&&z.cap,10)||500)),n:0,rep:0}));
        if(!name||!zs.length)return send(res,400,{error:'Enter a name and at least one area.'});
        const id=crypto.randomBytes(3).toString('hex'),key=crypto.randomBytes(8).toString('hex');
        db.venues[id]={name,key,created:Date.now(),zones:zs};dirty=true;
        return send(res,201,{id,key});
      }
      const r=p.match(/^\/api\/venues\/([a-f0-9]{6})(?:\/(count|report))?$/);
      const v=r&&db.venues[r[1]];
      if(!v)return send(res,404,{error:'Place not found'});
      if(!r[2]&&m==='GET')return send(res,200,view(v));
      if(r[2]&&m==='POST'){
        const b=await body(req),z=v.zones.find(x=>x.id===b.zone);
        if(!z)return send(res,400,{error:'Unknown area'});
        if(r[2]==='count'){
          const k=String(req.headers['x-staff-key']||'');
          if(k.length!==v.key.length||!crypto.timingSafeEqual(Buffer.from(k),Buffer.from(v.key)))return send(res,403,{error:'Staff link required'});
          const d=Math.max(-100,Math.min(100,parseInt(b.delta,10)||0));
          z.n=Math.max(0,Math.min(Math.round(z.cap*1.1),z.n+d));
        }else{
          if(limited('r'+ip(req)+r[1],6,60000))return send(res,429,{error:'Please wait a moment before reporting again.'});
          z.rep+=1;
        }
        dirty=true;return send(res,200,view(v));
      }
      return send(res,405,{error:'Not allowed'});
    }
    let f=path.normalize(path.join(PUB,p==='/'?'index.html':p));
    if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(PUB,'index.html');
    res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
  }catch(e){send(res,400,{error:'Bad request'})}
}).listen(PORT,'0.0.0.0',()=>console.log('CrowdmoniT running on port '+PORT));
