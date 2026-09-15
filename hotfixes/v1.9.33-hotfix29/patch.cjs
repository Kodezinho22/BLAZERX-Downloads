'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const root=path.resolve(process.argv[2]||process.cwd());
const must=(ok,msg)=>{if(!ok)throw new Error('ESTUDEX Hotfix 29 patch: '+msg);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,text)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,'utf8');};
const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const replaceOnce=(text,from,to,label)=>{const count=text.split(from).length-1;must(count===1,`${label} anchor count expected 1, got ${count}`);return text.replace(from,to);};

const pkgPath=path.join(root,'package.json');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
must(pkg.version==='1.9.32','expected Hotfix 28 technical baseline 1.9.32, got '+pkg.version);
must(fs.existsSync(path.join(root,'estudex-hotfix28-manifest.json')),'Hotfix 28 manifest missing');
const homeJsBefore=sha('public/js/home.js');
const homeCssBefore=sha('public/css/home.css');

let engine=read('public/estudex-engine.js');
must(!engine.includes('ESTUDEX_V193_HOTFIX29_ROOM_RECONNECT'),'Hotfix 29 engine patch already applied');
engine=replaceOnce(engine,
"  let manualLeave = false;",
"  let manualLeave = false;\n  /* ESTUDEX_V193_HOTFIX29_ROOM_RECONNECT */\n  let roomReconnectTimer=null;\n  let roomReconnectAttempts=0;\n  const ROOM_RECONNECT_DELAYS=[650,1200,2200,4000];\n  function cancelRoomReconnect(){if(roomReconnectTimer)clearTimeout(roomReconnectTimer);roomReconnectTimer=null;roomReconnectAttempts=0;}\n  function scheduleRoomReconnect(target){\n    if(manualLeave||!target?.room||!target?.signalingBase)return;\n    const attempt=roomReconnectAttempts++;\n    if(attempt>=ROOM_RECONNECT_DELAYS.length){roomState.connecting=false;roomState.error='reconnect_failed';roomLifecycleToken+=1;for(const kind of ['screen','camera','voice'])Promise.resolve(stopLocalKind(kind,{announce:false})).catch(()=>{});emitRoom('error',{code:'reconnect_failed'});return;}\n    roomState.connecting=true;roomState.error='reconnecting';emitRoom('reconnecting',{attempt:attempt+1});\n    roomReconnectTimer=setTimeout(async()=>{\n      roomReconnectTimer=null;if(manualLeave)return;\n      try{await connectRoom({...target,preserveMedia:true});roomReconnectAttempts=0;emitRoom('reconnected',{attempt:attempt+1});}\n      catch(error){if(!manualLeave)scheduleRoomReconnect(target);}\n    },ROOM_RECONNECT_DELAYS[attempt]);\n  }",
'room reconnect state');

engine=replaceOnce(engine,
"        members.set(id, {\n          clientId:id,\n          role:raw?.role === 'host' ? 'host' : 'viewer',\n          profile:{...(raw?.profile || {})},\n          voice:{micEnabled:false,speaking:false}, media:{}\n        });",
"        const userId=String(raw?.userId || raw?.socialId || raw?.profile?.id || '');\n        members.set(id, {\n          clientId:id,userId,socialId:userId,\n          role:raw?.role === 'host' ? 'host' : 'viewer',\n          profile:{...(raw?.profile || {}),...(userId?{id:userId}:{})},\n          voice:{micEnabled:false,speaking:false}, media:{}\n        });",
'joined member identity');
engine=replaceOnce(engine,
"        members.set(roomState.clientId,{clientId:roomState.clientId,role:roomState.role,profile,voice:{micEnabled:mediaState.microphoneEnabled,speaking:false},media:{}});",
"        members.set(roomState.clientId,{clientId:roomState.clientId,userId:socialId,socialId,role:roomState.role,profile:{...profile,...(socialId?{id:socialId}:{})},voice:{micEnabled:mediaState.microphoneEnabled,speaking:false},media:{}});",
'own member identity');
engine=replaceOnce(engine,
"        members.set(id,{clientId:id,role:raw.role === 'host' ? 'host':'viewer',profile:{...(raw.profile||{})},voice:{micEnabled:false,speaking:false},media});",
"        const userId=String(raw.userId || raw.socialId || raw.profile?.id || '');\n        members.set(id,{clientId:id,userId,socialId:userId,role:raw.role === 'host' ? 'host':'viewer',profile:{...(raw.profile||{}),...(userId?{id:userId}:{})},voice:{micEnabled:false,speaking:false},media});",
'new member identity');
engine=replaceOnce(engine,
"    if (msg.type === 'profile-update') {\n      const id = String(msg.clientId || '');",
"    if (msg.type === 'member-identity') {\n      const id=String(msg.clientId||''),userId=String(msg.userId||'');\n      const member=members.get(id);\n      if(member&&userId){member.userId=userId;member.socialId=userId;member.profile={...(member.profile||{}),id:userId};members.set(id,member);emitRoom('member-identity',{clientId:id,userId});}\n      return;\n    }\n    if (msg.type === 'profile-update') {\n      const id = String(msg.clientId || '');",
'member identity event');

engine=replaceOnce(engine,
"  async function connectRoom(options = {}) {\n    const token = ++connectToken;\n    await leaveRoom({reason:'switch',manual:false,preserveTarget:true});",
"  async function connectRoom(options = {}) {\n    const token = ++connectToken;\n    const preserveMedia=Boolean(options.preserveMedia);\n    if(preserveMedia){\n      if(pingTimer)clearInterval(pingTimer);pingTimer=null;\n      closeAllPeers();\n      try{socket?.close();}catch{}\n      socket=null;\n    }else{\n      cancelRoomReconnect();\n      await leaveRoom({reason:'switch',manual:false,preserveTarget:true});\n    }",
'preserve media reconnect');

const oldMessage=`      currentSocket.addEventListener('message', async event => {\n        if (token !== connectToken) return;\n        let msg = null;\n        try { msg = JSON.parse(event.data); } catch { return; }\n        await handleRoomMessage(msg);\n        if (!settled && msg?.type === 'joined') {\n          settled = true; clearTimeout(timeout); resolve(roomSnapshot());\n        } else if (!settled && msg?.type === 'error') {\n          settled = true; clearTimeout(timeout); reject(new Error(msg.message || msg.code || 'Não foi possível entrar na sala.'));\n        }\n      });`;
const newMessage=`      currentSocket.addEventListener('message', async event => {\n        if (token !== connectToken) return;\n        let msg = null;\n        try { msg = JSON.parse(event.data); } catch { return; }\n        if (!settled && msg?.type === 'joined') {\n          settled = true; clearTimeout(timeout);\n          try { await handleRoomMessage(msg); resolve(roomSnapshot()); }\n          catch(error){ reject(error); }\n          return;\n        }\n        await handleRoomMessage(msg);\n        if (!settled && msg?.type === 'error') {\n          settled = true; clearTimeout(timeout); reject(new Error(msg.message || msg.code || 'Não foi possível entrar na sala.'));\n        }\n      });`;
engine=replaceOnce(engine,oldMessage,newMessage,'join timeout race');

engine=replaceOnce(engine,
"          type:'join', roomId, role, profile, ownerKey:socialId,\n          roomName:role === 'host' ? roomState.roomName : undefined,",
"          type:'join', roomId, role, profile, ownerKey:socialId,\n          sessionToken:String(root.EstudexCloudSocial?.getSessionToken?.() || ''),\n          roomName:role === 'host' ? roomState.roomName : undefined,",
'verified join session token');

const oldClose=`        if (unexpected) {\n          roomLifecycleToken += 1;\n          for (const kind of ['screen','camera','voice']) {\n            try { await stopLocalKind(kind,{announce:false}); } catch {}\n          }\n          closeAllPeers();\n          members.clear();\n          publishers.clear();\n          roomState.streamLive = false;\n          roomState.clientId = '';\n          roomState.error = wasConnected ? 'socket_closed' : (roomState.error || 'connection_closed');\n        }`;
const newClose=`        if (unexpected) {\n          const reconnectTarget=wasConnected?{room:roomState.roomId,role:roomState.role,signalingBase:roomState.signalingBase,name:roomState.roomName,limit:roomState.roomLimit}:null;\n          closeAllPeers();\n          members.clear();\n          publishers.clear();\n          roomState.streamLive = false;\n          roomState.clientId = '';\n          roomState.error = wasConnected ? 'socket_closed' : (roomState.error || 'connection_closed');\n          if(reconnectTarget)scheduleRoomReconnect(reconnectTarget);\n          else if(!preserveMedia){roomLifecycleToken += 1;for(const kind of ['screen','camera','voice']){try{await stopLocalKind(kind,{announce:false});}catch{}}}\n        }`;
engine=replaceOnce(engine,oldClose,newClose,'unexpected disconnect reconnect');

engine=replaceOnce(engine,
"      emitRoom('joined');\n      if(roomState.role==='host')Promise.resolve().then(()=>prewarmScreenCurrentMembersV194()).catch(()=>{});",
"      cancelRoomReconnect();\n      emitRoom('joined');\n      for(const liveKind of ['screen','camera','voice']){\n        if(!localStreams.has(liveKind))continue;\n        sendWs({type:'media-status',kind:liveKind,live:true});\n        if(liveKind==='screen'&&roomState.role==='host')sendWs({type:'stream-status',live:true});\n        Promise.resolve().then(()=>offerLiveKindToCurrentMembersV194(liveKind)).catch(error=>emitMedia('error',{operation:'reconnect-reoffer',kind:liveKind,error:String(error?.message||error)}));\n      }\n      if(roomState.role==='host')Promise.resolve().then(()=>prewarmScreenCurrentMembersV194()).catch(()=>{});",
'reannounce media after join');

engine=replaceOnce(engine,
"  async function leaveRoom(options = {}) {\n    const preserveTarget = Boolean(options.preserveTarget);",
"  async function leaveRoom(options = {}) {\n    cancelRoomReconnect();\n    const preserveTarget = Boolean(options.preserveTarget);",
'cancel reconnect on leave');

engine=replaceOnce(engine,
"    media: domain('media', ['getState','listDevices','listCaptureSources','pickCaptureSource','setMicrophoneEnabled','setAudioEnabled','setCameraEnabled','setMicrophoneDevice','setAudioOutputDevice','setCameraDevice','setMicrophoneVolume','setOutputVolume','setMicrophoneProfile','setMicrophoneSensitivity','setEchoCancellation','setNoiseSuppression','setAutoGainControl','setQuality','setFps','startScreenShare','stopScreenShare','startCameraPreview','stopCameraPreview','onChange']),",
"    media: domain('media', ['getState','listDevices','listCaptureSources','pickCaptureSource','setMicrophoneEnabled','setAudioEnabled','setCameraEnabled','setMicrophoneDevice','setAudioOutputDevice','setCameraDevice','setMicrophoneVolume','setOutputVolume','setMicrophoneProfile','setMicrophoneSensitivity','setEchoCancellation','setNoiseSuppression','setAutoGainControl','setQuality','setFps','startScreenShare','stopScreenShare','startCameraPreview','stopCameraPreview','recoverRemote','onChange']),",
'public recoverRemote facade');
write('public/estudex-engine.js',engine);

let cloud=read('public/js/estudex-v193-cloud-social-v1926.js');
must(!cloud.includes('ESTUDEX_V193_HOTFIX29_LIVE_ROOM_DIRECTORY'),'Hotfix 29 cloud patch already applied');
const oldSaved="  /* ESTUDEX_V193_HOTFIX26_RECENT_ROOM_AUTH_GATE */\n  async function listSavedRooms(){if(!state.token)return[];const data=await request('/api/saved-rooms');const base=state.base||await resolveBase();return(data.rooms||[]).map(r=>({room:r.room,name:r.name,role:r.role==='host'?'host':'member',hostId:r.hostId||'',hostEndpoint:base,online:true,active:true,updatedAt:Date.parse(r.updatedAt)||Date.now(),createdAt:Date.parse(r.createdAt)||Date.now()}));}";
const newSaved=`  /* ESTUDEX_V193_HOTFIX26_RECENT_ROOM_AUTH_GATE */\n  /* ESTUDEX_V193_HOTFIX29_LIVE_ROOM_DIRECTORY */\n  async function listSavedRooms(){\n    if(!state.token)return[];\n    const data=await request('/api/saved-rooms');\n    const base=state.base||await resolveBase();\n    return Promise.all((data.rooms||[]).map(async r=>{\n      const item={room:r.room,name:r.name,role:r.role==='host'?'host':'member',hostId:r.hostId||'',hostEndpoint:base,online:false,active:false,roomSize:0,updatedAt:Date.parse(r.updatedAt)||Date.now(),createdAt:Date.parse(r.createdAt)||Date.now()};\n      try{const status=await request('/api/rooms/saved/status?room='+encodeURIComponent(r.room),{auth:false,timeout:3200});const live=status?.room||{};item.online=Boolean(status?.available);item.active=Boolean(status?.active);item.roomSize=Number(status?.roomSize||live.roomSize||0);item.name=clean(live.name||item.name)||'Sala ESTUDEX';item.hostId=clean(live.hostUserId||item.hostId);item.hostName=clean(live.hostProfile?.name||'');item.hostAvatar=typeof live.hostProfile?.avatar==='string'?live.hostProfile.avatar:'';}catch{}\n      return item;\n    }));\n  }\n  async function listLiveRooms(){\n    const base=state.base||await resolveBase();\n    try{\n      const data=await request('/api/rooms/live',{auth:false,timeout:3500});\n      return (data.rooms||[]).map(r=>({room:clean(r.room||r.roomId).toUpperCase(),name:clean(r.name)||'Sala ESTUDEX',limit:Number(r.limit||6),roomSize:Number(r.roomSize||0),role:'member',hostId:clean(r.hostUserId),hostName:clean(r.hostProfile?.name)||'Usuário',hostAvatar:typeof r.hostProfile?.avatar==='string'?r.hostProfile.avatar:'',hostEndpoint:base,online:Boolean(r.online!==false),active:Boolean(r.active!==false),live:Boolean(r.live),screenLive:Boolean(r.screenLive),updatedAt:Number(r.updatedAt||Date.now()),createdAt:Number(r.createdAt||Date.now())})).filter(r=>r.room);\n    }catch{return [];}\n  }`;
cloud=replaceOnce(cloud,oldSaved,newSaved,'live/saved room directory');
cloud=replaceOnce(cloud,
"  const cloudRooms=Object.freeze({listLan:async()=>[],listSaved:listSavedRooms,saveCurrent:saveCurrentRoom,deleteSaved:deleteSavedRoom});",
"  const cloudRooms=Object.freeze({listLan:listLiveRooms,listSaved:listSavedRooms,saveCurrent:saveCurrentRoom,deleteSaved:deleteSavedRoom});",
'cloud room live list');
cloud=replaceOnce(cloud,
"  root.EstudexCloudSocial=Object.freeze({version:'1.9.26',getBase:()=>state.base,getUser:()=>state.user?{...state.user}:null,getCachedFriends:()=>friendsCache.map(x=>({...x})),request,login,register,guest,upgradeGuest,forgotPassword,logout,searchUsers,listRoomInvites,sendRoomInvite,respondRoomInvite,sendSocialEvent,listSocialEvents,ackSocialEvents,refreshFriends,refreshPending,refreshDm,listFriends,listPending,listBlocked,onAuth:fn=>on('auth',fn)});",
"  root.EstudexCloudSocial=Object.freeze({version:'1.9.29',getBase:()=>state.base,getSessionToken:()=>state.token,getUser:()=>state.user?{...state.user}:null,getCachedFriends:()=>friendsCache.map(x=>({...x})),request,login,register,guest,upgradeGuest,forgotPassword,logout,searchUsers,listRoomInvites,sendRoomInvite,respondRoomInvite,sendSocialEvent,listSocialEvents,ackSocialEvents,refreshFriends,refreshPending,refreshDm,listFriends,listPending,listBlocked,onAuth:fn=>on('auth',fn)});",
'cloud session token bridge');
write('public/js/estudex-v193-cloud-social-v1926.js',cloud);

let socketCompat=read('public/js/estudex-engine-socket-compat.js');
socketCompat=replaceOnce(socketCompat,
"      id:clean(member?.clientId || member?.id),\n      socketId:clean(member?.clientId || member?.id),",
"      id:clean(member?.clientId || member?.id),\n      socketId:clean(member?.clientId || member?.id),\n      userId:clean(member?.userId || member?.socialId || member?.profile?.id),\n      socialId:clean(member?.userId || member?.socialId || member?.profile?.id),",
'legacy member social id');
write('public/js/estudex-engine-socket-compat.js',socketCompat);

const runtimeSource=fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8');
write('public/js/estudex-v193-hotfix29-room-network.js',runtimeSource);
let index=read('public/index.html');
index=replaceOnce(index,
'<script src="/js/estudex-v193-hotfix26-room-qol.js"></script>',
'<script src="/js/estudex-v193-hotfix26-room-qol.js"></script>\n<script src="/js/estudex-v193-hotfix29-room-network.js"></script>',
'Hotfix 29 runtime script');
write('public/index.html',index);

pkg.version='1.9.33';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n','utf8');
let forge=read('forge.config.js');
must(/version:\s*["']1\.9\.32["']/.test(forge),'Squirrel 1.9.32 version anchor missing');
forge=forge.replace(/version:\s*["']1\.9\.32["']/,'version: "1.9.33"');
write('forge.config.js',forge);

const h28=JSON.parse(read('estudex-hotfix28-manifest.json'));
const manifest={
  product:'ESTUDEX',productVersion:'1.9.3',technicalVersion:'1.9.33',hotfix:29,baseTag:'v1.9.32-hotfix28',
  mode:'room-network-reconnect-directory-media-recovery',
  fixes:[
    'expose remote-media recovery through the public engine facade so the screen watchdog can renegotiate a stalled P2P stream',
    'reconnect automatically to the same room after a short unexpected signaling drop while preserving local capture tracks and re-announcing live media',
    'settle room join immediately when the server joined frame arrives so profile hydration cannot trigger a false join timeout',
    'load live room directory from the central server and reconcile saved-room online/offline state against the live room status endpoint',
    'send the authenticated cloud session token on room join and preserve verified immutable user ids on room participants',
    'add an in-room Add friend action backed by the canonical cloud friend-request endpoint'
  ],
  backend:{version:'0.3.3',roomDirectory:'/api/rooms/live',verifiedRoomIdentity:true,memberIdentityBroadcast:true},
  preserved:{hotfix28:h28.hotfix||28,homeJs:homeJsBefore,homeCss:homeCssBefore}
};
fs.writeFileSync(path.join(root,'estudex-hotfix29-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
must(sha('public/js/home.js')===homeJsBefore,'canonical V10.10 home.js changed');
must(sha('public/css/home.css')===homeCssBefore,'canonical V10.10 home.css changed');
console.log('ESTUDEX v1.9.3 Hotfix 29 / technical 1.9.33 applied.');
