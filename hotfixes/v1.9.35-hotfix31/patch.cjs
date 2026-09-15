'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const root=path.resolve(process.argv[2]||process.cwd());
const must=(ok,msg)=>{if(!ok)throw new Error('ESTUDEX Hotfix 31 patch: '+msg);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,text)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,'utf8');};
const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const once=(text,from,to,label)=>{const n=text.split(from).length-1;must(n===1,`${label}: expected 1 anchor, got ${n}`);return text.replace(from,to);};
const regexOnce=(text,re,to,label)=>{const m=text.match(re);must(m&&m.length===1,`${label}: anchor missing/ambiguous`);return text.replace(re,to);};

const pkgPath=path.join(root,'package.json');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
must(pkg.version==='1.9.34','expected published Hotfix 30 baseline 1.9.34, got '+pkg.version);
must(fs.existsSync(path.join(root,'estudex-hotfix30-manifest.json')),'Hotfix 30 manifest missing');
const homeJsBefore=sha('public/js/home.js');
const homeCssBefore=sha('public/css/home.css');
const OFFICIAL='https://site--estudex-server--bs292kkyk4sm.code.run';

// Main-process HTTPS transport: renderer never needs CORS to use ESTUDEX REST APIs.
let main=read('main.js');
must(!main.includes('ESTUDEX_V193_HOTFIX31_NATIVE_CLOUD_TRANSPORT'),'Hotfix 31 main patch already applied');
main=once(main,"const http = require('http');","const http = require('http');\nconst https = require('https');",'https import');
const authClear=`ipcMain.handle('estudex:auth-session:clear-v1926', async () => {\n  try { const file=ESTUDEX_AUTH_SESSION_FILE_V1926(); if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}\n  return { ok:true };\n});`;
const nativeTransport=`${authClear}\n\n/* ESTUDEX_V193_HOTFIX31_NATIVE_CLOUD_TRANSPORT */\nconst ESTUDEX_CLOUD_ORIGIN_V1935 = '${OFFICIAL}';\nipcMain.handle('estudex:cloud-request-v1935', async (_event, input = {}) => {\n  try {\n    const requestPath = String(input?.path || '/').trim();\n    if (!requestPath.startsWith('/')) return { transportOk:false, code:'invalid_path' };\n    const target = new URL(requestPath, ESTUDEX_CLOUD_ORIGIN_V1935);\n    if (target.origin !== ESTUDEX_CLOUD_ORIGIN_V1935) return { transportOk:false, code:'invalid_origin' };\n    const method = String(input?.method || 'GET').toUpperCase();\n    if (!['GET','POST','PATCH','PUT','DELETE'].includes(method)) return { transportOk:false, code:'invalid_method' };\n    const timeout = Math.max(2000, Math.min(20000, Number(input?.timeout || 9000)));\n    const headers = { 'Accept':'application/json' };\n    const sourceHeaders = input?.headers && typeof input.headers === 'object' ? input.headers : {};\n    if (sourceHeaders.Authorization || sourceHeaders.authorization) headers.Authorization = String(sourceHeaders.Authorization || sourceHeaders.authorization);\n    let body = null;\n    if (input?.body !== undefined && input?.body !== null) {\n      body = JSON.stringify(input.body);\n      headers['Content-Type'] = 'application/json';\n      headers['Content-Length'] = Buffer.byteLength(body);\n    }\n    return await new Promise(resolve => {\n      let settled = false;\n      const finish = value => { if (settled) return; settled = true; resolve(value); };\n      const req = https.request(target, { method, headers }, res => {\n        const chunks = []; let size = 0;\n        res.on('data', chunk => {\n          size += chunk.length;\n          if (size > 20 * 1024 * 1024) { req.destroy(new Error('response_too_large')); return; }\n          chunks.push(chunk);\n        });\n        res.on('end', () => {\n          const text = Buffer.concat(chunks).toString('utf8');\n          let data = {}; try { data = text ? JSON.parse(text) : {}; } catch {}\n          finish({ transportOk:true, status:Number(res.statusCode || 0), data, text:text.slice(0,4096) });\n        });\n      });\n      req.setTimeout(timeout, () => req.destroy(new Error('timeout')));\n      req.on('error', error => finish({ transportOk:false, code:error?.message==='timeout'?'timeout':'network_error' }));\n      if (body) req.write(body);\n      req.end();\n    });\n  } catch {\n    return { transportOk:false, code:'network_error' };\n  }\n});`;
main=once(main,authClear,nativeTransport,'native cloud IPC');
write('main.js',main);

let preload=read('preload.js');
must(!preload.includes('estudex:cloud-request-v1935'),'Hotfix 31 preload patch already applied');
preload=once(preload,
"  network:Object.freeze({\n    ensureOnlineServer:() => ipcRenderer.invoke('network:ensure-online-server')\n  }),",
"  network:Object.freeze({\n    ensureOnlineServer:() => ipcRenderer.invoke('network:ensure-online-server')\n  }),\n  /* ESTUDEX_V193_HOTFIX31_NATIVE_CLOUD_TRANSPORT */\n  cloud:Object.freeze({\n    request:payload => ipcRenderer.invoke('estudex:cloud-request-v1935', payload)\n  }),",
'native cloud preload bridge');
write('preload.js',preload);

let cloud=read('public/js/estudex-v193-cloud-social-v1926.js');
must(cloud.includes('ESTUDEX_V193_HOTFIX30_RESILIENT_BACKEND'),'Hotfix 30 cloud baseline missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX31_SIMPLE_HANDLE_UI'),'Hotfix 31 cloud patch already applied');

cloud=regexOnce(cloud,/  async function probeBase\(candidate,timeout=2800\)\{[\s\S]*?\n  function syncRoomBase/,
`  /* ESTUDEX_V193_HOTFIX31_SIMPLE_HANDLE_UI */\n  async function resolveBase(){\n    state.base=DEFAULT_BASE;syncRoomBase(DEFAULT_BASE);\n    try{localStorage.setItem(BASE_KEY,DEFAULT_BASE);}catch{}\n    return DEFAULT_BASE;\n  }\n  function syncRoomBase`,
'fixed official backend resolver');

cloud=regexOnce(cloud,/  async function request\(path, options=\{\}\)\{[\s\S]*?\n  \}\n\n  async function readToken/,
`  async function request(path, options={}){\n    await resolveBase();\n    const headers={...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...(options.auth===false?{}:authHeaders()),...(options.headers||{})};\n    const method=options.method||'GET';\n    const timeout=Math.max(2500,Number(options.timeout||9000));\n    const nativeRequest=root.EstudexNative?.cloud?.request;\n    if(typeof nativeRequest==='function'){\n      let result;\n      try{result=await nativeRequest({path,method,headers,body:options.body,timeout});}catch{}\n      if(!result?.transportOk){const error=new Error('Os servidores do ESTUDEX não responderam. Tente novamente em instantes.');error.code=result?.code||'backend_unreachable';throw error;}\n      const data=result?.data&&typeof result.data==='object'?result.data:{};\n      const status=Number(result?.status||0);\n      if(status<200||status>=300||data?.ok===false){const error=new Error(data?.error||data?.message||('HTTP '+status));error.status=status;error.code=data?.code||'';error.data=data;throw error;}\n      return data;\n    }\n    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);\n    try{\n      const res=await fetch(DEFAULT_BASE+path,{method,headers,body:options.body===undefined?undefined:JSON.stringify(options.body),signal:controller.signal,cache:'no-store'});\n      const data=await res.json().catch(()=>({}));\n      if(!res.ok||data?.ok===false){const error=new Error(data?.error||data?.message||('HTTP '+res.status));error.status=res.status;error.code=data?.code||'';error.data=data;throw error;}\n      return data;\n    }catch(error){\n      if(Number(error?.status)>=400)throw error;\n      const friendly=new Error('Os servidores do ESTUDEX não responderam. Tente novamente em instantes.');friendly.code='backend_unreachable';throw friendly;\n    }finally{clearTimeout(timer);}\n  }\n\n  async function readToken`,
'native-first request layer');

// Public identity is the @handle only. Internal Parse objectId stays hidden.
cloud=once(cloud,
"      name:clean(user.displayName||user.name||user.handle||user.username)||'Usuário',\n      username:clean(user.handle||user.username)||id,\n      tag:clean(user.handle||user.username),",
"      name:(clean(user.handle||user.username)?'@'+clean(user.handle||user.username):'@usuario'),\n      username:clean(user.handle||user.username)||id,\n      tag:'',",
'public @ identity');
cloud=once(cloud,
"    return {name:clean(u.displayName||u.name)||'Usuário',avatar:u.avatar||'',banner:u.banner||'',bio:u.bio||'',status:statusLabel(u.status),tag:clean(u.handle||u.username)};",
"    const handle=clean(u.handle||u.username);return {name:handle?'@'+handle:'@usuario',avatar:u.avatar||'',banner:u.banner||'',bio:u.bio||'',status:statusLabel(u.status),tag:''};",
'own @ identity');
cloud=once(cloud,
"      try{localStorage.setItem('estudex-profile-username-v193',clean(state.user.displayName||state.user.name)||'Usuário');localStorage.setItem('estudex-profile-ready-v193','1');}catch{}",
"      try{const handle=clean(state.user.handle||state.user.username);localStorage.setItem('estudex-profile-username-v193',handle?'@'+handle:'@usuario');localStorage.setItem('estudex-profile-ready-v193','1');}catch{}",
'local @ profile name');

cloud=once(cloud,
"  async function upgradeGuest(input){",
`  async function quickIdentity(usernameInput){\n    const username=clean(usernameInput).replace(/^@+/,'').toLowerCase();\n    if(!/^[a-z0-9_.-]{2,24}$/.test(username))throw new Error('Use de 2 a 24 caracteres no @usuário: letras, números, ponto, traço ou underline.');\n    const data=await request('/api/auth/quick',{method:'POST',auth:false,body:{username}});\n    await writeToken(data.sessionToken);setUser(data.user);await afterAuth();return data.user;\n  }\n  async function upgradeGuest(input){`,
'quick identity function');
cloud=once(cloud,"disconnectSocket();setUser(null);showAuthOverlay('login');","disconnectSocket();setUser(null);showAuthOverlay();",'simple logout onboarding');

cloud=regexOnce(cloud,/  function ensureAuthOverlay\(\)\{[\s\S]*?\n    return layer;\n  \}/,
`  function ensureAuthOverlay(){installStyle();let layer=document.getElementById('cloudAuthLayerV1926');if(layer)return layer;layer=document.createElement('div');layer.id='cloudAuthLayerV1926';layer.className='cloud-auth-layer hidden';layer.innerHTML=\`<div class="cloud-auth-card"><div class="cloud-auth-brand"><img src="/assets/avatars/logo.png" alt=""><strong>ESTUDEX</strong></div><h1 id="cloudAuthTitle">Escolha seu @usuário</h1><p id="cloudAuthSubtitle">É assim que seus amigos vão encontrar você.</p><form class="cloud-auth-form" id="cloudQuickHandleForm"><label>@usuário<input name="username" maxlength="24" autocomplete="username" placeholder="CRIOLEX" required></label><button class="cloud-auth-submit" type="submit">Continuar</button></form><div class="cloud-auth-error" id="cloudAuthError"></div></div>\`;document.body.appendChild(layer);\n    layer.querySelector('#cloudQuickHandleForm').addEventListener('submit',async event=>{event.preventDefault();const fd=new FormData(event.currentTarget);await authAction(()=>quickIdentity(fd.get('username')));});\n    return layer;\n  }`,
'simple onboarding overlay');
cloud=regexOnce(cloud,/  function showAuthOverlay\(mode='login'\)\{[^\n]*\}/,
"  function showAuthOverlay(){const layer=ensureAuthOverlay();layer.classList.remove('hidden');setAuthError('');setTimeout(()=>layer.querySelector('#cloudQuickHandleForm input')?.focus(),0);}",
'simple onboarding show');

cloud=once(cloud,"if(addCopy)addCopy.textContent='Busque pelo @usuário ou pelo nome de exibição.';","if(addCopy)addCopy.textContent='Digite o @usuário do seu amigo.';",'friend search copy');
cloud=once(cloud,"if(addInput)addInput.placeholder='Buscar por @usuário ou nome';","if(addInput)addInput.placeholder='@usuario';",'friend search placeholder');
cloud=once(cloud,
"          return '<div class=\"network-user-card\">'+avatar+'<div class=\"friend-main-copy\"><strong>'+escapeHTML(user.name)+'</strong><div class=\"friend-secondary-line\"><span>@'+escapeHTML(user.username)+'</span> · <span>'+escapeHTML(user.online?'Online':'Offline')+'</span></div><small>'+escapeHTML(user.about||'')+'</small></div><div class=\"network-user-actions\"><button class=\"social-primary-button\" data-invite-detected=\"'+escapeHTML(user.id)+'\" type=\"button\" '+(disabled?'disabled':'')+'>'+escapeHTML(label)+'</button></div></div>';",
"          return '<div class=\"network-user-card\">'+avatar+'<div class=\"friend-main-copy\"><strong>@'+escapeHTML(user.username)+'</strong><div class=\"friend-secondary-line\"><span>'+escapeHTML(user.online?'Online':'Offline')+'</span></div></div><div class=\"network-user-actions\"><button class=\"social-primary-button\" data-invite-detected=\"'+escapeHTML(user.id)+'\" type=\"button\" '+(disabled?'disabled':'')+'>'+escapeHTML(label)+'</button></div></div>';",
'friend result @ only');
cloud=once(cloud,"button.textContent='Conta';","button.textContent='Usuário';",'settings user label');
cloud=regexOnce(cloud,/  function updateAccountPanel\(\)\{[^\n]*\}\n/,
`  function updateAccountPanel(){const panel=document.getElementById('specSettingsAccount');if(!panel)return;const u=state.user;if(!u){panel.innerHTML='<div class="settings-card-title"><h2>Usuário</h2><p>Escolha seu @usuário para usar os recursos com seus amigos.</p></div><button class="cloud-account-action" id="cloudSettingsLogin">Escolher @usuário</button>';panel.querySelector('#cloudSettingsLogin')?.addEventListener('click',()=>showAuthOverlay());return;}const handle=clean(u.handle||u.username);panel.innerHTML='<div class="settings-card-title"><h2>Usuário</h2><p>Seu identificador no ESTUDEX.</p></div><div class="cloud-account-card"><div class="cloud-account-id"><span class="cloud-account-avatar">'+(u.avatar?'<img src="'+escapeHTML(u.avatar)+'" alt="">':escapeHTML(initials(handle||'U')))+'</span><div class="cloud-account-copy"><strong>@'+escapeHTML(handle||'usuario')+'</strong></div></div><div class="cloud-account-actions"><button class="cloud-account-action danger" id="cloudLogout">Trocar @usuário neste PC</button></div></div>';panel.querySelector('#cloudLogout')?.addEventListener('click',()=>logout().catch(()=>{}));}\n`,
'simple user settings');

cloud=once(cloud,
"    const name=clean(state.user.displayName||state.user.name)||'Usuário';\n    try{localStorage.setItem('estudex-profile-username-v193',name);localStorage.setItem('estudex-test-username',name);localStorage.setItem('estudex-profile-ready-v193','1');localStorage.setItem('estudex-public-tag',clean(state.user.handle||state.user.username));}catch{}",
"    const handle=clean(state.user.handle||state.user.username);const name=handle?'@'+handle:'@usuario';\n    try{localStorage.setItem('estudex-profile-username-v193',name);localStorage.setItem('estudex-test-username',name);localStorage.setItem('estudex-profile-ready-v193','1');localStorage.setItem('estudex-public-tag','');}catch{}",
'canonical @ identity');

cloud=regexOnce(cloud,/  async function bootstrap\(\)\{[\s\S]*?\n    state.ready=true;\n  \}/,
`  async function bootstrap(){\n    ensureAuthOverlay();const restored=await restoreSession();\n    if(restored){hideAuthOverlay();await afterAuth();}\n    else showAuthOverlay();\n    state.ready=true;\n  }`,
'simple bootstrap');
cloud=once(cloud,"root.EstudexCloudSocial=Object.freeze({version:'1.9.30'","root.EstudexCloudSocial=Object.freeze({version:'1.9.31'",'cloud version');
cloud=once(cloud,"request,login,register,guest,upgradeGuest,forgotPassword,logout,searchUsers","request,quickIdentity,login,register,guest,upgradeGuest,forgotPassword,logout,searchUsers",'export quick identity');
cloud=once(cloud,"bootstrap().catch(error=>{console.error('[ESTUDEX H22 cloud social]',error);showAuthOverlay('login');setAuthError(error?.message||'Falha ao conectar ao backend ESTUDEX.');});","bootstrap().catch(error=>{console.error('[ESTUDEX H31 cloud social]',error);showAuthOverlay();setAuthError(error?.message||'Falha ao iniciar o ESTUDEX.');});",'bootstrap error UI');

// Old guest-to-account UI stays in the bundle only for historical compatibility, but is never installed or shown.
cloud=once(cloud,
"(function installHotfix24GuestUpgradeProfile(){\n  if (typeof window === 'undefined' || typeof document === 'undefined') return;",
"(function installHotfix24GuestUpgradeProfile(){\n  if (typeof window === 'undefined' || typeof document === 'undefined') return;\n  /* ESTUDEX_V193_HOTFIX31_DISABLE_ACCOUNT_UPGRADE_UI */ return;",
'disable account upgrade UI');
write('public/js/estudex-v193-cloud-social-v1926.js',cloud);

pkg.version='1.9.35';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n','utf8');
let forge=read('forge.config.js');
must(/version:\s*["']1\.9\.34["']/.test(forge),'Squirrel 1.9.34 version anchor missing');
forge=forge.replace(/version:\s*["']1\.9\.34["']/,'version: "1.9.35"');
write('forge.config.js',forge);

const h30=JSON.parse(read('estudex-hotfix30-manifest.json'));
const manifest={
  product:'ESTUDEX',productVersion:'1.9.3',technicalVersion:'1.9.35',hotfix:31,baseTag:'v1.9.34-hotfix30',
  mode:'simple-handle-identity-native-cloud-transport',
  fixes:[
    'first-run onboarding now asks only for a unique @usuario',
    'removes visible login, create-account, guest, email, password and tag flows',
    'friend discovery is presented only by @usuario with Add friend',
    'keeps Parse objectId internal and never exposes it as user identity',
    'moves REST traffic to a restricted main-process HTTPS bridge to bypass renderer CORS/fetch failures',
    'uses one official ESTUDEX backend with no renderer health/fallback loop',
    'keeps existing sessions working while presenting them only as @usuario'
  ],
  backend:{version:'0.3.5',officialBase:OFFICIAL,quickHandleEndpoint:'/api/auth/quick'},
  preserved:{hotfix30:h30.hotfix||30,homeJs:homeJsBefore,homeCss:homeCssBefore}
};
fs.writeFileSync(path.join(root,'estudex-hotfix31-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
must(sha('public/js/home.js')===homeJsBefore,'canonical V10.10 home.js changed');
must(sha('public/css/home.css')===homeCssBefore,'canonical V10.10 home.css changed');
console.log('ESTUDEX v1.9.3 Hotfix 31 / technical 1.9.35 applied.');
