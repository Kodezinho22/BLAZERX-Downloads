'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const root=path.resolve(process.argv[2]||process.cwd());
const must=(ok,msg)=>{if(!ok)throw new Error('ESTUDEX Hotfix 30 patch: '+msg);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,text)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,'utf8');};
const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const once=(text,from,to,label)=>{const n=text.split(from).length-1;must(n===1,`${label}: expected 1 anchor, got ${n}`);return text.replace(from,to);};
const regexOnce=(text,re,to,label)=>{const m=text.match(re);must(m&&m.length===1,`${label}: anchor missing/ambiguous`);return text.replace(re,to);};

const pkgPath=path.join(root,'package.json');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
must(pkg.version==='1.9.33','expected published Hotfix 29 baseline 1.9.33, got '+pkg.version);
must(fs.existsSync(path.join(root,'estudex-hotfix29-manifest.json')),'Hotfix 29 manifest missing');
const homeJsBefore=sha('public/js/home.js');
const homeCssBefore=sha('public/css/home.css');
const OFFICIAL='https://site--estudex-server--bs292kkyk4sm.code.run';

let cloud=read('public/js/estudex-v193-cloud-social-v1926.js');
must(!cloud.includes('ESTUDEX_V193_HOTFIX30_RESILIENT_BACKEND'),'Hotfix 30 cloud patch already applied');
cloud=once(cloud,
"  const DEFAULT_BASE = 'https://estudexserver-2mccfr6f.b4a.run';",
`  /* ESTUDEX_V193_HOTFIX30_RESILIENT_BACKEND */\n  const DEFAULT_BASE = '${OFFICIAL}';`,
'official backend fallback');

cloud=regexOnce(cloud,/  async function resolveBase\(\)\{[\s\S]*?\n  \}\n  function syncRoomBase/,
`  async function probeBase(candidate,timeout=2800){
    const base=validBase(candidate);if(!base)return'';
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const res=await fetch(base+'/health',{cache:'no-store',signal:controller.signal});
      const data=await res.json().catch(()=>({}));
      if(res.ok&&data?.ok===true&&clean(data?.service).toLowerCase().includes('estudex'))return base;
    }catch{}finally{clearTimeout(timer);}
    return'';
  }
  async function remoteConfiguredBase(){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1600);
    try{
      const res=await fetch(REMOTE_CONFIG_URL,{cache:'no-store',signal:controller.signal});
      const data=await res.json().catch(()=>({}));
      return res.ok?validBase(data?.backendBase||data?.base||data?.url):'';
    }catch{return'';}finally{clearTimeout(timer);}
  }
  async function resolveBase(force=false){
    if(!force&&validBase(state.base))return state.base;
    let stored='';try{stored=validBase(localStorage.getItem(BASE_KEY));}catch{}
    const candidates=[DEFAULT_BASE];
    let live=await probeBase(DEFAULT_BASE);
    if(!live){
      const remote=await remoteConfiguredBase();
      if(remote&&!candidates.includes(remote))candidates.push(remote);
      if(stored&&!candidates.includes(stored))candidates.push(stored);
      for(const candidate of candidates.slice(1)){live=await probeBase(candidate);if(live)break;}
    }
    const chosen=live||DEFAULT_BASE;
    state.base=chosen;syncRoomBase(chosen);
    try{if(live)localStorage.setItem(BASE_KEY,chosen);else localStorage.removeItem(BASE_KEY);}catch{}
    return chosen;
  }
  function syncRoomBase`,
'health-checked backend resolver');

cloud=regexOnce(cloud,/  async function request\(path, options=\{\}\)\{[\s\S]*?\n  \}\n\n  async function readToken/,
`  async function request(path, options={}){
    let base=state.base||await resolveBase();
    let lastTransportError=null;
    for(let attempt=0;attempt<2;attempt++){
      const controller=new AbortController();const timeout=Math.max(2500,Number(options.timeout||8000));const timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const headers={...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...(options.auth===false?{}:authHeaders()),...(options.headers||{})};
        const res=await fetch(base+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),signal:controller.signal,cache:'no-store'});
        const data=await res.json().catch(()=>({}));
        if(!res.ok||data?.ok===false){const error=new Error(data?.error||data?.message||('HTTP '+res.status));error.status=res.status;error.code=data?.code||'';error.data=data;throw error;}
        return data;
      }catch(error){
        if(Number(error?.status)>=400)throw error;
        lastTransportError=error;
        if(attempt===0){
          state.base='';try{localStorage.removeItem(BASE_KEY);}catch{}
          base=await resolveBase(true);
          continue;
        }
      }finally{clearTimeout(timer);}
    }
    const friendly=new Error('Não foi possível conectar aos servidores do ESTUDEX. Verifique sua internet e tente novamente.');
    friendly.code='backend_unreachable';friendly.cause=lastTransportError;throw friendly;
  }

  async function readToken`,
'friendly retrying request layer');

cloud=once(cloud,
"  root.EstudexCloudSocial=Object.freeze({version:'1.9.29'",
"  root.EstudexCloudSocial=Object.freeze({version:'1.9.30'",
'cloud api version');

// Defensive client-side de-duplication even if an older backend briefly exposes stale rooms.
cloud=once(cloud,
"      return (data.rooms||[]).map(r=>({room:clean(r.room||r.roomId).toUpperCase(),name:clean(r.name)||'Sala ESTUDEX',limit:Number(r.limit||6),roomSize:Number(r.roomSize||0),role:'member',hostId:clean(r.hostUserId),hostName:clean(r.hostProfile?.name)||'Usuário',hostAvatar:typeof r.hostProfile?.avatar==='string'?r.hostProfile.avatar:'',hostEndpoint:base,online:Boolean(r.online!==false),active:Boolean(r.active!==false),live:Boolean(r.live),screenLive:Boolean(r.screenLive),updatedAt:Number(r.updatedAt||Date.now()),createdAt:Number(r.createdAt||Date.now())})).filter(r=>r.room);",
"      const mapped=(data.rooms||[]).map(r=>({room:clean(r.room||r.roomId).toUpperCase(),name:clean(r.name)||'Sala ESTUDEX',limit:Number(r.limit||6),roomSize:Number(r.roomSize||0),role:'member',hostId:clean(r.hostUserId),hostName:clean(r.hostProfile?.name)||'Usuário',hostAvatar:typeof r.hostProfile?.avatar==='string'?r.hostProfile.avatar:'',hostEndpoint:base,online:Boolean(r.online!==false),active:Boolean(r.active!==false),live:Boolean(r.live),screenLive:Boolean(r.screenLive),updatedAt:Number(r.updatedAt||Date.now()),createdAt:Number(r.createdAt||Date.now())})).filter(r=>r.room);\n      const seen=new Set();return mapped.filter(r=>{const key=r.hostId?'host:'+r.hostId:'room:'+r.room;if(seen.has(key))return false;seen.add(key);return true;});",
'client live room dedupe');
write('public/js/estudex-v193-cloud-social-v1926.js',cloud);

let engine=read('public/estudex-engine.js');
engine=once(engine,
"const ESTUDEX_CLOUD_ROOM_DEFAULT_V1924 = 'https://estudexserver-p1t0c2xc.b4a.run';",
`const ESTUDEX_CLOUD_ROOM_DEFAULT_V1924 = '${OFFICIAL}';`,
'room backend fallback');
engine=once(engine,
"      catch(error){if(!manualLeave)scheduleRoomReconnect(target);}",
"      catch(error){if(error?.code==='host_room_exists'){roomState.connecting=false;roomState.error='host_room_exists';emitRoom('error',{code:'host_room_exists',roomId:error?.roomId||''});return;}if(!manualLeave)scheduleRoomReconnect(target);}",
'stop duplicate-host reconnect loop');
engine=once(engine,
"          settled = true; clearTimeout(timeout); reject(new Error(msg.message || msg.code || 'Não foi possível entrar na sala.'));",
"          settled = true; clearTimeout(timeout); const joinError=new Error(msg.message || msg.code || 'Não foi possível entrar na sala.');joinError.code=msg.code||'';joinError.roomId=msg.roomId||'';reject(joinError);",
'preserve room error code');
write('public/estudex-engine.js',engine);

pkg.version='1.9.34';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n','utf8');
let forge=read('forge.config.js');
must(/version:\s*["']1\.9\.33["']/.test(forge),'Squirrel 1.9.33 version anchor missing');
forge=forge.replace(/version:\s*["']1\.9\.33["']/,'version: "1.9.34"');
write('forge.config.js',forge);

const h29=JSON.parse(read('estudex-hotfix29-manifest.json'));
const manifest={
  product:'ESTUDEX',productVersion:'1.9.3',technicalVersion:'1.9.34',hotfix:30,baseTag:'v1.9.33-hotfix29',
  mode:'auth-transport-resilience-and-room-lifecycle-guard',
  fixes:[
    'replace obsolete b4a auth fallback with the official Northflank backend embedded in the app',
    'health-check backend selection and discard stale saved backend addresses automatically',
    'retry one transport failure through the canonical resolver without an infinite retry loop',
    'never expose raw Failed to fetch or AbortError in auth UI; preserve exact backend validation errors',
    'align the room engine fallback with the same official backend',
    'deduplicate live rooms by canonical host id as a client-side safety net',
    'preserve host_room_exists server errors and stop reconnect loops instead of multiplying host rooms'
  ],
  backend:{version:'0.3.4',officialBase:OFFICIAL,oneActiveHostedRoomPerUser:true,parseTransportErrors:true,liveRoomDedupe:true,hostlessRoomReaper:true},
  preserved:{hotfix29:h29.hotfix||29,homeJs:homeJsBefore,homeCss:homeCssBefore}
};
fs.writeFileSync(path.join(root,'estudex-hotfix30-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
must(sha('public/js/home.js')===homeJsBefore,'canonical V10.10 home.js changed');
must(sha('public/css/home.css')===homeCssBefore,'canonical V10.10 home.css changed');
console.log('ESTUDEX v1.9.3 Hotfix 30 / technical 1.9.34 applied.');
