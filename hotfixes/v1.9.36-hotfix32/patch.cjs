'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const root=path.resolve(process.argv[2]||process.cwd());
const must=(ok,msg)=>{if(!ok)throw new Error('ESTUDEX Hotfix 32 patch: '+msg);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,text)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,'utf8');};
const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const once=(text,from,to,label)=>{const n=text.split(from).length-1;must(n===1,`${label}: expected 1 anchor, got ${n}`);return text.replace(from,to);};
const regexOnce=(text,re,to,label)=>{const matches=text.match(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))||[];must(matches.length===1,`${label}: expected 1 match, got ${matches.length}`);return text.replace(re,to);};

const pkgPath=path.join(root,'package.json');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
must(pkg.version==='1.9.35','expected published Hotfix 31 baseline 1.9.35, got '+pkg.version);
must(fs.existsSync(path.join(root,'estudex-hotfix31-manifest.json')),'Hotfix 31 manifest missing');
const homeJsBefore=sha('public/js/home.js');
const homeCssBefore=sha('public/css/home.css');

let engine=read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX29_ROOM_RECONNECT'),'Hotfix29 reconnect baseline missing');
must(!engine.includes('ESTUDEX_V193_HOTFIX32_ROOM_INPUT_LATENCY'),'Hotfix32 engine patch already applied');
engine=once(engine,
"  const ROOM_RECONNECT_DELAYS=[650,1200,2200,4000];",
"  /* ESTUDEX_V193_HOTFIX32_ROOM_INPUT_LATENCY */\n  const ROOM_RECONNECT_DELAYS=[0,350,900,1800];",
'immediate first reconnect');
engine=once(engine,
"    if (role === 'host' && !signalingBase) signalingBase = await registerSocial();",
"    if (role === 'host' && !signalingBase) signalingBase = estudexCloudRoomBaseV1924();\n    if (role === 'host' && !signalingBase) signalingBase = await registerSocial();",
'host endpoint fast path');
write('public/estudex-engine.js',engine);

let cloud=read('public/js/estudex-v193-cloud-social-v1926.js');
must(cloud.includes('ESTUDEX_V193_HOTFIX31_SIMPLE_HANDLE_UI'),'Hotfix31 cloud baseline missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX32_INLINE_ROOM_STATUS'),'Hotfix32 cloud patch already applied');
cloud=regexOnce(cloud,
/  async function listSavedRooms\(\)\{[\s\S]*?\n  \}\n  async function listLiveRooms\(\)\{/,
`  /* ESTUDEX_V193_HOTFIX32_INLINE_ROOM_STATUS */\n  async function listSavedRooms(){\n    if(!state.token)return[];\n    const data=await request('/api/saved-rooms');\n    const base=state.base||await resolveBase();\n    return (data.rooms||[]).map(r=>{\n      const live=r?.liveRoom&&typeof r.liveRoom==='object'?r.liveRoom:{};\n      const hasInline=data?.statusInline===true;\n      const online=hasInline?Boolean(r.online):Boolean(live?.online);\n      const active=hasInline?Boolean(r.active):Boolean(live?.active);\n      return {\n        room:clean(r.room||r.roomId).toUpperCase(),\n        name:clean(live.name||r.name)||'Sala ESTUDEX',\n        role:r.role==='host'?'host':'member',\n        hostId:clean(live.hostUserId||r.hostId),\n        hostName:clean(live.hostProfile?.name||''),\n        hostAvatar:typeof live.hostProfile?.avatar==='string'?live.hostProfile.avatar:'',\n        hostEndpoint:base,online,active,roomSize:Number(r.roomSize||live.roomSize||0),\n        live:Boolean(live.live),screenLive:Boolean(live.screenLive),\n        updatedAt:Date.parse(r.updatedAt)||Number(live.updatedAt)||Date.now(),\n        createdAt:Date.parse(r.createdAt)||Number(live.createdAt)||Date.now()\n      };\n    }).filter(r=>r.room);\n  }\n  async function listLiveRooms(){`,
'inline saved-room status');

cloud=once(cloud,
`  async function restoreSession(){
    await resolveBase();state.token=await readToken();
    if(!state.token)return false;
    try{const data=await request('/api/me');setUser(data.user,{emitProfile:false});return true;}
    catch{await clearToken();return false;}
  }`,
`  /* ESTUDEX_V193_HOTFIX32_SESSION_PRESERVATION */
  let restoreRetryTimerV1936=null;
  const invalidStoredSessionV1936=error=>{
    const status=Number(error?.status||0),code=clean(error?.code).toLowerCase();
    return status===401||status===403||code==='invalid_session'||code==='auth_required';
  };
  async function restoreSession(){
    await resolveBase();state.token=await readToken();
    if(!state.token)return false;
    let lastError=null;
    for(const delay of [0,180,520]){
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      try{const data=await request('/api/me',{timeout:5500});setUser(data.user,{emitProfile:false});return true;}
      catch(error){
        lastError=error;
        if(invalidStoredSessionV1936(error)){await clearToken();return false;}
      }
    }
    // A timeout/network/5xx error is not proof that the saved profile is invalid.
    // Keep the encrypted token on disk and retry in the background instead of forcing a new @.
    clearTimeout(restoreRetryTimerV1936);
    restoreRetryTimerV1936=setTimeout(async()=>{
      if(!state.token||state.user)return;
      try{const data=await request('/api/me',{timeout:7000});setUser(data.user,{emitProfile:false});await afterAuth();}
      catch(error){if(invalidStoredSessionV1936(error)){await clearToken();showAuthOverlay();}}
    },1400);
    const pending=new Error(lastError?.message||'Reconectando seu perfil salvo…');
    pending.code='saved_session_pending';
    throw pending;
  }`,
'preserve saved session on transient startup failure');

cloud=once(cloud,
`  async function bootstrap(){
    ensureAuthOverlay();const restored=await restoreSession();
    if(restored){hideAuthOverlay();await afterAuth();}
    else showAuthOverlay();
    state.ready=true;
  }`,
`  async function bootstrap(){
    ensureAuthOverlay();
    try{
      const restored=await restoreSession();
      if(restored){hideAuthOverlay();await afterAuth();}
      else showAuthOverlay();
    }catch(error){
      if(error?.code==='saved_session_pending'&&state.token){
        // Preserve the already-saved local profile while cloud restoration retries.
        hideAuthOverlay();
        try{const local=await previous.profile?.get?.();if(local?.name){
          const localName=clean(local.name||local.username);
          try{localStorage.setItem('estudex-profile-username-v193',localName);localStorage.setItem('estudex-test-username',localName);localStorage.setItem('estudex-profile-ready-v193','1');}catch{}
          try{setIdentityUI?.({...(currentUser||{}),username:localName,about:local.bio||'',status:statusKey(local.status)});}catch{}
        }}catch{}
      }else throw error;
    }
    state.ready=true;
  }`,
'non-destructive bootstrap restore');

cloud=once(cloud,"version:'1.9.31'","version:'1.9.32'",'cloud API version');
write('public/js/estudex-v193-cloud-social-v1926.js',cloud);

let compat=read('public/js/estudex-engine-socket-compat.js');
must(compat.includes('ESTUDEX_V193_RECENT_ROOM_COMPAT_FAST_PATH'),'same-room fast path baseline missing');
must(!compat.includes('ESTUDEX_V193_HOTFIX32_CREATE_FEEDBACK'),'Hotfix32 compat patch already applied');
compat=regexOnce(compat,
/  async function createRoom\(payload = \{\}\) \{[\s\S]*?\n  \}\n\n  \/\* ESTUDEX_V193_RECENT_ROOM_COMPAT_FAST_PATH \*\//,
`  /* ESTUDEX_V193_HOTFIX32_CREATE_FEEDBACK */\n  let createRoomInFlightV1936=false;\n  async function createRoom(payload = {}) {\n    if(createRoomInFlightV1936)return;\n    createRoomInFlightV1936=true;\n    const createButton=document.getElementById('confirmCreateRoom');\n    const previousLabel=createButton?.textContent||'Criar sala';\n    if(createButton){createButton.disabled=true;createButton.textContent='Criando...';createButton.setAttribute('aria-busy','true');}\n    try {\n      await ensureNetworkReady();\n      const state = await E.rooms.create({name:clean(payload.title || payload.name), limit:Number(payload.limit || 6)});\n      const room = legacyRoomState(state || E.room.getState());\n      pinOwnedRoom(room,true,true);\n      publishOwnedRoomAuthority();\n      fire('room:joined', room);\n      fire('room:state', room);\n      Promise.resolve().then(()=>refreshState()).catch(()=>{});\n    } catch (error) {\n      fire('room:error',{message:error?.message || 'Não foi possível criar a sala.'});\n    } finally {\n      createRoomInFlightV1936=false;\n      if(createButton){createButton.disabled=false;createButton.textContent=previousLabel;createButton.removeAttribute('aria-busy');}\n    }\n  }\n\n  /* ESTUDEX_V193_RECENT_ROOM_COMPAT_FAST_PATH */`,
'immediate create feedback / duplicate-click guard');
write('public/js/estudex-engine-socket-compat.js',compat);

pkg.version='1.9.36';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n','utf8');
let forge=read('forge.config.js');
must(/version:\s*["']1\.9\.35["']/.test(forge),'Squirrel 1.9.35 version anchor missing');
forge=forge.replace(/version:\s*["']1\.9\.35["']/,'version: "1.9.36"');
write('forge.config.js',forge);

const h31=JSON.parse(read('estudex-hotfix31-manifest.json'));
const manifest={
  product:'ESTUDEX',productVersion:'1.9.3',technicalVersion:'1.9.36',hotfix:32,baseTag:'v1.9.35-hotfix31',
  mode:'room-input-latency-single-room-and-session-preservation',
  fixes:[
    'first reconnect attempt starts immediately instead of waiting 650ms',
    'room creation gives instant UI feedback and rejects duplicate create clicks while in flight',
    'host connection uses the official room endpoint immediately before any legacy discovery fallback',
    'saved room list consumes backend inline presence/status and removes per-room N+1 status requests',
    'same-room navigation fast path remains preserved so reopening an attached room does not reconnect',
    'backend 0.3.8 caches validated sessions briefly and prefers already-authenticated socket identity',
    'backend keeps a hard one-active-hosted-room-per-authenticated-user invariant',
    'saved profile/session is never erased by a temporary network or backend failure during startup',
    'only an explicit invalid/expired session can send an existing user back to the choose-@ onboarding'
  ],
  backend:{version:'0.3.8',oneActiveHostedRoomPerUser:true,sessionUserCacheMs:30000,inlineSavedRoomStatus:true},
  preserved:{hotfix31:h31.hotfix||31,homeJs:homeJsBefore,homeCss:homeCssBefore}
};
fs.writeFileSync(path.join(root,'estudex-hotfix32-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
must(sha('public/js/home.js')===homeJsBefore,'canonical V10.10 home.js changed');
must(sha('public/css/home.css')===homeCssBefore,'canonical V10.10 home.css changed');
console.log('ESTUDEX v1.9.3 Hotfix 32 / technical 1.9.36 applied.');
