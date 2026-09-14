/* ESTUDEX_V190_V1010_EXACT_SOCKET_COMPAT */
(() => {
  'use strict';

  const root = globalThis;
  const E = root.EstudexEngine;
  if (!E) throw new Error('ESTUDEX V10.10 exact socket compat requires EstudexEngine.');

  const handlers = new Map();
  const off = [];
  const seenDm = new Set();
  let connected = true;
  let socketId = 'engine-local';
  /* ESTUDEX_V193_OWNED_ROOM_AUTHORITATIVE_OVERLAY */
  /* ESTUDEX_V193_ROOM_STATE_MONOTONIC */
  let refreshIssued=0;
  let refreshCommitted=0;
  let lastCommittedHomeState=null;
  const pinnedOwnedRooms=new Map();
  const deletedOwnedRooms=new Set();
  let refreshInFlight=null;
  let refreshQueued=false;
  let roomRefreshTimer=null;
  const liveRoomGrace=new Map();
  const LIVE_ROOM_GRACE_MS=11000;
  /* ESTUDEX_V193_ROOM_REFRESH_STABILITY */

  const clean = value => String(value ?? '').trim();
  const statusClass = value => {
    const text = clean(value).toLocaleLowerCase('pt-BR');
    if (['away','ausente'].includes(text)) return 'away';
    if (['dnd','não perturbar','nao perturbar'].includes(text)) return 'dnd';
    if (['invisible','invisível','invisivel'].includes(text)) return 'invisible';
    if (['offline','desconectado'].includes(text)) return 'offline';
    return 'available';
  };
  const engineStatus = value => ({
    available:'Disponível',
    away:'Ausente',
    dnd:'Não perturbar',
    invisible:'Invisível',
    offline:'Invisível'
  })[statusClass(value)] || 'Disponível';

  function fire(name, payload) {
    for (const fn of [...(handlers.get(name) || [])]) {
      try { fn(payload); } catch (error) { console.error('[V10.10 socket compat]', name, error); }
    }
  }

  const legacyProfile = profile => ({
    id:clean(profile?.id || profile?.userId),
    username:clean(profile?.name) || 'Usuário',
    name:clean(profile?.name) || 'Usuário',
    about:clean(profile?.bio),
    status:statusClass(profile?.status),
    avatar:typeof profile?.avatar === 'string' ? profile.avatar : null,
    banner:typeof profile?.banner === 'string' ? profile.banner : null,
    connectedAt:Number(profile?.connectedAt || Date.now()),
    createdRooms:Number(profile?.createdRooms || 0)
  });

  const legacyFriend = friend => ({
    id:clean(friend?.id || friend?.userId),
    name:clean(friend?.name) || clean(friend?.id) || 'Usuário',
    username:clean(friend?.id || friend?.userId || friend?.name),
    avatar:typeof friend?.avatar === 'string' ? friend.avatar : null,
    about:clean(friend?.bio || friend?.about),
    status:statusClass(friend?.status),
    state:friend?.online === false ? 'offline' : statusClass(friend?.status),
    online:Boolean(friend?.online),
    relation:'friend',
    endpoint:clean(friend?.endpoint)
  });

  const legacyRoomCard = room => ({
    code:clean(room?.room || room?.roomId || room?.code),
    title:clean(room?.name || room?.roomName || room?.title) || 'Sala ESTUDEX',
    owner:clean(room?.hostName || room?.ownerName || room?.owner) || 'Usuário',
    ownerAvatar:typeof (room?.hostAvatar || room?.ownerAvatar) === 'string' ? (room.hostAvatar || room.ownerAvatar) : null,
    viewers:Number(room?.roomSize || room?.members || room?.viewers || 0),
    subtitle:clean(room?.subtitle) || (room?.online === false ? 'Offline' : 'Agora'),
    active:Boolean(room?.active || room?.online),
    online:Boolean(room?.online),
    isMine:Boolean(room?.isMine || room?.role === 'host'),
    limit:Number(room?.limit || room?.maxMembers || 6),
    createdAt:Number(room?.createdAt || room?.updatedAt || Date.now())
  });

  const legacyMember = member => {
    const isOwner=member?.role === 'host' || Boolean(member?.owner || member?.isOwner);
    const mic=Boolean(member?.voice?.micEnabled ?? member?.media?.mic ?? member?.micEnabled);
    const camera=Boolean(member?.media?.camera ?? member?.cameraEnabled);
    const screen=Boolean(member?.media?.screen ?? member?.screenEnabled);
    return {
      id:clean(member?.clientId || member?.id),
      socketId:clean(member?.clientId || member?.id),
      name:clean(member?.profile?.name || member?.name) || 'Usuário',
      username:clean(member?.profile?.name || member?.name) || 'Usuário',
      avatar:typeof (member?.profile?.avatar || member?.avatar) === 'string' ? (member.profile?.avatar || member.avatar) : null,
      isOwner,
      owner:isOwner,
      role:isOwner ? 'owner' : 'member',
      status:statusClass(member?.profile?.status || member?.status || 'available'),
      statusLabel:clean(member?.statusLabel),
      speaking:Boolean(member?.voice?.speaking ?? member?.speaking),
      media:{mic,camera,screen}
    };
  };

  const legacyMessage = message => {
    const attachment=message?.attachment && typeof message.attachment==='object' ? message.attachment : null;
    const mime=clean(attachment?.mime || attachment?.type || attachment?.contentType).toLowerCase();
    const fileName=clean(attachment?.name || attachment?.fileName || attachment?.filename);
    let kind=clean(message?.kind).toLowerCase();
    if(attachment){
      if(mime.startsWith('image/')) kind='image';
      else if(mime.startsWith('video/')) kind='video';
      else if(mime.startsWith('audio/')) kind=/^mensagem-de-voz-/i.test(fileName) ? 'voice' : 'audio';
    }
    if(!kind) kind=clean(message?.text) ? 'text' : 'system';
    const authorName=clean(message?.profile?.name || message?.senderName || message?.authorName || message?.from) || 'Usuário';
    const authorAvatar=typeof (message?.profile?.avatar || message?.authorAvatar || message?.avatar) === 'string'
      ? (message.profile?.avatar || message.authorAvatar || message.avatar)
      : null;
    return {
      id:clean(message?.id) || `engine-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      kind,
      text:clean(message?.text),
      authorName,
      authorAvatar,
      from:authorName,
      username:authorName,
      avatar:authorAvatar,
      attachment,
      dataUrl:clean(attachment?.url || attachment?.path || message?.dataUrl),
      fileName,
      duration:Number(message?.duration || attachment?.duration || 0),
      createdAt:Number(message?.createdAt || message?.at || Date.now())
    };
  };

  const legacyRoomState = state => {
    if (clean(state?.clientId)) socketId=clean(state.clientId);
    const members = Array.isArray(state?.members) ? state.members.map(legacyMember) : [];
    const owner = members.find(item => item.isOwner) || null;
    return {
      code:clean(state?.roomId || state?.code),
      title:clean(state?.roomName || state?.title) || 'Sala ESTUDEX',
      subject:clean(state?.subject),
      owner:Boolean(state?.role === 'host' || state?.owner),
      ownerName:clean(owner?.name || state?.ownerName) || 'Usuário',
      ownerAvatar:owner?.avatar || state?.ownerAvatar || null,
      connected:Boolean(state?.connected),
      connecting:Boolean(state?.connecting),
      role:state?.role === 'host' ? 'owner' : 'member',
      viewers:members.length,
      limit:Number(state?.roomLimit || state?.limit || 6),
      ping:Number.isFinite(Number(state?.pingMs ?? state?.ping)) ? Number(state?.pingMs ?? state?.ping) : 0,
      live:Boolean(state?.streamLive),
      members,
      messages:(Array.isArray(state?.messages) ? state.messages : []).map(legacyMessage)
    };
  };

  function ownedRoomCard(room, active = Boolean(room?.connected)) {
    const code=clean(room?.code || room?.room || room?.roomId).toUpperCase();
    if(!code)return null;
    const isActive=Boolean(active);
    return {
      code,
      title:clean(room?.title || room?.roomName || room?.name) || 'Sala ESTUDEX',
      owner:clean(room?.ownerName || room?.owner) || 'Usuário',
      ownerAvatar:typeof room?.ownerAvatar === 'string' ? room.ownerAvatar : null,
      viewers:Number(room?.viewers || room?.roomSize || 0),
      subtitle:isActive ? 'Agora' : 'Offline',
      active:isActive,
      online:isActive,
      isMine:true,
      limit:Number(room?.limit || room?.roomLimit || 6),
      createdAt:Number(room?.createdAt || room?.updatedAt || Date.now())
    };
  }
  function cardCode(room){return clean(room?.code || room?.room || room?.roomId).toUpperCase();}
  function mergePinnedOwnedRecent(cards) {
    const byCode=new Map();
    for(const card of Array.isArray(cards)?cards:[]){
      const code=cardCode(card);
      if(code && !deletedOwnedRooms.has(code))byCode.set(code,{...card,code});
    }
    for(const [code,pinned] of pinnedOwnedRooms){
      if(deletedOwnedRooms.has(code))continue;
      const current=byCode.get(code);
      if(current){
        const active=Boolean(current.active || current.online || pinned.active || pinned.online);
        byCode.set(code,{...pinned,...current,code,isMine:true,active,online:active,subtitle:active?'Agora':'Offline'});
      }else byCode.set(code,{...pinned,code,isMine:true});
    }
    return [...byCode.values()].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  }
  function mergePinnedOwnedLive(cards) {
    const now=Date.now();
    const byCode=new Map();
    for(const card of Array.isArray(cards)?cards:[]){
      const code=cardCode(card);
      if(!code||deletedOwnedRooms.has(code))continue;
      const next={...card,code};
      byCode.set(code,next);
      if(next.active||next.online)liveRoomGrace.set(code,{card:{...next},seenAt:now});
    }
    for(const [code,entry] of [...liveRoomGrace]){
      if(deletedOwnedRooms.has(code)){liveRoomGrace.delete(code);continue;}
      if(byCode.has(code))continue;
      if(now-Number(entry?.seenAt||0)<=LIVE_ROOM_GRACE_MS)byCode.set(code,{...entry.card,code,active:true,online:true,subtitle:'Agora'});
      else liveRoomGrace.delete(code);
    }
    for(const [code,pinned] of pinnedOwnedRooms){
      if(deletedOwnedRooms.has(code)||!(pinned.active||pinned.online))continue;
      const current=byCode.get(code);
      byCode.set(code,current?{...current,...pinned,code,isMine:true,active:true,online:true,subtitle:'Agora'}:{...pinned,code,isMine:true,active:true,online:true,subtitle:'Agora'});
    }
    return [...byCode.values()];
  }
  function pinOwnedRoom(room,active,revive=false){
    const card=ownedRoomCard(room,active);
    if(!card)return null;
    /* A close/delete tombstone wins over transient connected state. Only an
       explicit new create may revive an identical code. */
    if(deletedOwnedRooms.has(card.code) && !revive)return null;
    if(revive)deletedOwnedRooms.delete(card.code);
    const previous=pinnedOwnedRooms.get(card.code);
    pinnedOwnedRooms.set(card.code,previous?{...previous,...card,isMine:true}:card);
    return pinnedOwnedRooms.get(card.code);
  }
  function syncAttachedOwnedRoom(){
    const current=E.room.getState?.() || {};
    if(current?.connected && current?.role==='host' && clean(current?.roomId))pinOwnedRoom(legacyRoomState(current),true,false);
  }
  function applyOwnedRoomAuthority(state){
    const source=state && typeof state==='object' ? state : {};
    syncAttachedOwnedRoom();
    return {
      ...source,
      liveRooms:mergePinnedOwnedLive(source.liveRooms || []),
      recentRooms:mergePinnedOwnedRecent(source.recentRooms || [])
    };
  }
  function forgetOwnedRoom(code){
    code=clean(code).toUpperCase();
    if(!code)return false;
    const changed=pinnedOwnedRooms.delete(code);
    liveRoomGrace.delete(code);
    deletedOwnedRooms.add(code);
    if(lastCommittedHomeState){
      lastCommittedHomeState={
        ...lastCommittedHomeState,
        liveRooms:(lastCommittedHomeState.liveRooms||[]).filter(item=>cardCode(item)!==code),
        recentRooms:(lastCommittedHomeState.recentRooms||[]).filter(item=>cardCode(item)!==code)
      };
      fire('state:update',lastCommittedHomeState);
    }
    return changed;
  }
  function publishOwnedRoomAuthority(){
    if(!lastCommittedHomeState)return;
    const next=applyOwnedRoomAuthority(lastCommittedHomeState);
    lastCommittedHomeState=next;
    fire('state:update',next);
  }

  async function homeState() {
    const [profile, lanRooms, savedRooms, friends] = await Promise.all([
      Promise.resolve(E.profile.get()),
      Promise.resolve(E.rooms.listLan()).catch(() => []),
      Promise.resolve(E.rooms.listSaved()).catch(() => []),
      Promise.resolve(E.social.listFriends()).catch(() => [])
    ]);
    const liveByCode=new Map();
    for(const room of lanRooms||[]){
      const card=legacyRoomCard(room);
      if(card.code)liveByCode.set(card.code,card);
    }
    for(const saved of savedRooms||[]){
      if(!(saved?.online || saved?.active))continue;
      const card=legacyRoomCard(saved);
      if(!card.code)continue;
      const previous=liveByCode.get(card.code);
      liveByCode.set(card.code,previous?{...previous,...card,isMine:Boolean(previous.isMine||card.isMine)}:card);
    }
    return {
      me:legacyProfile(profile || {}),
      liveRooms:mergePinnedOwnedLive([...liveByCode.values()]),
      recentRooms:mergePinnedOwnedRecent((savedRooms || []).map(legacyRoomCard)),
      onlineFriends:(friends || []).filter(friend => friend?.online).map(legacyFriend)
    };
  }

  async function refreshState() {
    if(refreshInFlight){refreshQueued=true;return refreshInFlight;}
    const ticket=++refreshIssued;
    refreshInFlight=(async()=>{
      const state=applyOwnedRoomAuthority(await homeState());
      if(ticket<refreshCommitted)return state;
      refreshCommitted=ticket;
      lastCommittedHomeState=state;
      fire('state:update',state);
      return state;
    })().finally(()=>{
      refreshInFlight=null;
      if(refreshQueued){refreshQueued=false;setTimeout(()=>refreshState().catch(()=>{}),80);}
    });
    return refreshInFlight;
  }

  function refreshSocialStateOnly(){
    const friends=Promise.resolve(E.social.listFriends?.()).catch(()=>[]);
    return friends.then(list=>{
      if(!lastCommittedHomeState)return refreshState();
      const next=applyOwnedRoomAuthority({...lastCommittedHomeState,onlineFriends:(Array.isArray(list)?list:[]).filter(friend=>friend?.online).map(legacyFriend)});
      lastCommittedHomeState=next;
      fire('state:update',next);
      return next;
    });
  }

  async function ensureNetworkReady(){
    /* Cloud rooms do not require a VPN or LAN adapter. */
    return true;
  }

  async function updateProfile(payload = {}) {
    const current = await Promise.resolve(E.profile.get());
    const saved = await E.profile.save({
      ...(current || {}),
      name:clean(payload.username ?? payload.name ?? current?.name) || 'Usuário',
      bio:String(payload.about ?? payload.bio ?? current?.bio ?? '').replace(/\r/g,'').slice(0,240),
      status:engineStatus(payload.status ?? current?.status),
      avatar:typeof payload.avatar === 'string' ? payload.avatar : (current?.avatar || ''),
      banner:typeof payload.banner === 'string' ? payload.banner : (current?.banner || '')
    });
    fire('profile:updated', legacyProfile(saved));
    await refreshState();
  }

  async function createRoom(payload = {}) {
    try {
      await ensureNetworkReady();
      const state = await E.rooms.create({name:clean(payload.title || payload.name), limit:Number(payload.limit || 6)});
      const room = legacyRoomState(state || E.room.getState());
      pinOwnedRoom(room,true,true);
      publishOwnedRoomAuthority();
      fire('room:joined', room);
      fire('room:state', room);
      await refreshState();
    } catch (error) {
      fire('room:error',{message:error?.message || 'Não foi possível criar a sala.'});
    }
  }

  /* ESTUDEX_V193_RECENT_ROOM_COMPAT_FAST_PATH */
  async function joinRoom(payload = {}) {
    try {
      const code=clean(typeof payload === 'string' ? payload : (payload.code || payload.room || payload.roomId)).toUpperCase();
      if(!code)throw new Error('Código de sala inválido.');

      /* Opening the room we are already attached to must be navigation, not a
         disconnect + network rediscovery + reconnect cycle. */
      const current=E.room.getState?.() || {};
      if(current?.connected && clean(current?.roomId).toUpperCase()===code){
        const room=legacyRoomState(current);
        fire('room:joined',room);
        fire('room:state',room);
        return room;
      }

      const knownRecent=Boolean(lastCommittedHomeState?.recentRooms?.some?.(item=>clean(item?.code).toUpperCase()===code));
      if(!knownRecent)await ensureNetworkReady();
      const state=await E.rooms.join(code);
      const room=legacyRoomState(state || E.room.getState());
      fire('room:joined',room);
      fire('room:state',room);
      await refreshState();
      return room;
    } catch(error) {
      fire('room:error',{message:error?.message || 'Não foi possível entrar na sala.'});
    }
  }

  async function deleteRoom(payload = {}) {
    const code=clean(typeof payload === 'string' ? payload : (payload.code || payload.room)).toUpperCase();
    if(!code) return;
    try {
      if(typeof E.rooms.close==='function') {
        await E.rooms.close(code);
      } else {
        const current=E.room.getState();
        if(current?.connected && clean(current?.roomId).toUpperCase()===code && current?.role==='host' && typeof E.room.close==='function') {
          await E.room.close();
        }
        await E.rooms.deleteSaved(code);
      }
      /* ESTUDEX_V193_ROOM_DELETE_PURGE */
      forgetOwnedRoom(code);
      fire('room:deleted',{code,message:'Sala removida.'});
      await refreshState();
    } catch(error) {
      fire('room:error',{message:error?.message || 'Não foi possível remover a sala.'});
    }
  }

  async function sendDm(payload = {}) {
    try {
      const profile=await Promise.resolve(E.profile.get());
      const result=await E.dm.send(clean(payload.to), clean(payload.text));
      if(result) fire('dm:message',{
        id:clean(result.id) || `dm-${Date.now()}`,
        from:clean(profile?.name) || 'Usuário',
        to:clean(payload.to),
        text:clean(result.text || payload.text),
        createdAt:Number(result.at || result.createdAt || Date.now()),
        delivered:result.delivered !== false
      });
    } catch(error) {
      fire('dm:error',{message:error?.message || 'Não foi possível enviar a mensagem.'});
    }
  }

  function emitIncomingDm() {
    const threads=E.dm.listThreads?.() || [];
    for(const thread of threads) {
      for(const message of Array.isArray(thread?.messages) ? thread.messages : []) {
        const id=clean(message?.id);
        if(!id || seenDm.has(id)) continue;
        seenDm.add(id);
        if(message?.direction !== 'in') continue;
        fire('dm:message',{
          id,
          from:clean(thread?.id),
          fromId:clean(thread?.id),
          fromName:clean(thread?.user?.name),
          fromAvatar:thread?.user?.avatar || null,
          to:'',
          text:clean(message?.text),
          createdAt:Number(message?.at || Date.now()),
          delivered:true
        });
      }
    }
  }

  const socket = {
    get id(){ return socketId; },
    get connected(){ return connected; },
    on(name, fn) {
      if(typeof fn !== 'function') return socket;
      const set=handlers.get(name) || new Set();
      set.add(fn); handlers.set(name,set); return socket;
    },
    off(name, fn) {
      if(!handlers.has(name)) return socket;
      if(typeof fn === 'function') handlers.get(name).delete(fn); else handlers.delete(name);
      return socket;
    },
    emit(name, ...args) {
      const payload=args[0];
      const ack=[...args].reverse().find(value=>typeof value==='function');
      if(name==='room:ping') {
        queueMicrotask(()=>ack?.({startedAt:Number(payload || Date.now())}));
        return socket;
      }
      Promise.resolve().then(async () => {
        switch(name) {
          case 'presence:join': await updateProfile(payload); break;
          case 'profile:update': await updateProfile(payload); break;
          case 'room:create': await createRoom(payload); break;
          case 'room:join': await joinRoom(payload); break;
          case 'room:request-state': fire('room:state',legacyRoomState(E.room.getState())); break;
          case 'room:leave': {
            const leaving=legacyRoomState(E.room.getState());
            if(leaving?.owner && leaving?.code){
              pinOwnedRoom({...leaving,connected:false},false,false);
              publishOwnedRoomAuthority();
            }
            await E.room.leave();
            await refreshState();
            break;
          }
          case 'room:delete': await deleteRoom(payload); break;
          case 'room:message': await E.room.sendChat({text:clean(payload?.text),attachment:payload?.attachment || null}); break;
          case 'dm:send': await sendDm(payload); break;
          case 'room:media:update': break;
          case 'room:webrtc:signal': break;
          default: break;
        }
      }).catch(error => console.error('[V10.10 socket compat emit]',name,error));
      return socket;
    },
    timeout() {
      return {emit:(name,...args)=>socket.emit(name,...args)};
    },
    disconnect() {
      connected=false;
      fire('disconnect');
    }
  };

  function subscribe() {
    const add=value=>{if(typeof value==='function')off.push(value);};
    add(E.profile.onChange?.(()=>refreshState().catch(()=>{})));
    add(E.social.onChange?.(()=>refreshSocialStateOnly().catch(()=>{})));
    /* ESTUDEX_V193_ROOM_PERFORMANCE_SOCKET */
    add(E.rooms.onChange?.(event=>{
      if(event?.type==='saved-delete'&&event?.room)forgetOwnedRoom(event.room);
      if(E.room.getState?.()?.connected){publishOwnedRoomAuthority();return;}
      refreshState().catch(()=>{});
    }));
    add(E.dm.onChange?.(()=>{emitIncomingDm();}));
    add(E.room.onChange?.(event=>{
      const type=clean(event?.type);
      const raw=event?.state||E.room.getState();
      const state=legacyRoomState(raw);
      if(type!=='ping'&&type!=='voice-message-recording')fire('room:state',state);
      if(type==='joined')fire('room:joined',state);
      if(type==='room-closed')fire('room:ended',{message:'A sala foi encerrada pelo dono.'});
      if(type==='left'&&!state.connected)refreshState().catch(()=>{});
      if(type==='disconnected'&&!state.connected)fire('disconnect');
    }));
  }

  function boot() {
    const threads=E.dm.listThreads?.() || [];
    for(const thread of threads) for(const message of Array.isArray(thread?.messages)?thread.messages:[]) if(message?.id)seenDm.add(String(message.id));
    subscribe();
    /* Match Socket.IO timing: canonical home.js must register connect/state listeners first. */
    setTimeout(()=>{
      fire('connect',{engine:true});
      refreshState().catch(error=>console.error('[V10.10 exact socket initial state]',error));
      if(!roomRefreshTimer)roomRefreshTimer=setInterval(()=>{if(E.room.getState?.()?.connected)return;refreshState().catch(()=>{})},6500);
    },0);
  }

  root.io = function exactV1010IoCompat(){ return socket; };
  root.EstudexV1010ExactSocketCompat = Object.freeze({version:'1.8.0',socket,refreshState,homeState,forgetOwnedRoom,destroy(){for(const fn of off.splice(0)){try{fn();}catch{}}if(roomRefreshTimer)clearInterval(roomRefreshTimer);roomRefreshTimer=null;connected=false;handlers.clear();pinnedOwnedRooms.clear();deletedOwnedRooms.clear();liveRoomGrace.clear();}});
  boot();
})();


/* ESTUDEX_V1010_EXACT_STATUS_STATS_CONTRACT */
(() => {
  'use strict';
  const runtime=globalThis.EstudexV1010ExactSocketCompat;
  const socket=runtime?.socket;
  if(!socket||typeof socket.on!=='function')throw new Error('V10.10 exact socket runtime unavailable for status/stats contract.');

  const clean=value=>String(value??'').trim();
  const statusKey=value=>{
    const text=clean(value).toLocaleLowerCase('pt-BR');
    if(['away','ausente'].includes(text))return 'away';
    if(['dnd','não perturbar','nao perturbar'].includes(text))return 'dnd';
    if(['invisible','invisível','invisivel'].includes(text))return 'invisible';
    if(['offline','desconectado'].includes(text))return 'offline';
    return 'available';
  };
  const statusLabel=value=>({
    available:'Disponível',
    away:'Ausente',
    dnd:'Não perturbar',
    invisible:'Invisível',
    offline:'Offline'
  })[statusKey(value)]||'Disponível';

  const sessionConnectedAt=Date.now();
  const CREATED_ROOM_CODES_KEY='estudex-v1010-created-room-codes-v1';
  const loadCodes=()=>{
    try{
      const raw=JSON.parse(localStorage.getItem(CREATED_ROOM_CODES_KEY)||'[]');
      return new Set((Array.isArray(raw)?raw:[]).map(code=>clean(code).toUpperCase()).filter(Boolean));
    }catch{return new Set();}
  };
  const rememberCode=code=>{
    const value=clean(code).toUpperCase();
    const codes=loadCodes();
    if(value)codes.add(value);
    try{localStorage.setItem(CREATED_ROOM_CODES_KEY,JSON.stringify([...codes]));}catch{}
    return codes;
  };

  const normalizeMember=member=>{
    if(!member||typeof member!=='object')return member;
    const status=statusKey(member.status);
    const label=clean(member.statusLabel||member.statusText)||statusLabel(status);
    return {...member,status,statusLabel:label,statusText:label};
  };
  const normalizeRoom=room=>{
    if(!room||typeof room!=='object')return room;
    if(room.owner)rememberCode(room.code);
    return {
      ...room,
      members:Array.isArray(room.members)?room.members.map(normalizeMember):room.members
    };
  };
  const normalizeHome=state=>{
    if(!state||typeof state!=='object')return state;
    for(const room of state.recentRooms||[])if(room?.isMine)rememberCode(room.code);
    const codes=loadCodes();
    const me=state.me&&typeof state.me==='object'
      ? {
          ...state.me,
          status:statusKey(state.me.status),
          connectedAt:Number(state.me.connectedAt||sessionConnectedAt),
          createdRooms:Math.max(Number(state.me.createdRooms||0),codes.size)
        }
      : state.me;
    return {...state,me};
  };

  const rawOn=socket.on.bind(socket);
  socket.on=function exactV1010ContractOn(name,handler){
    if(typeof handler!=='function')return rawOn(name,handler);
    if(name==='state:update')return rawOn(name,payload=>handler(normalizeHome(payload)));
    if(name==='room:state'||name==='room:joined')return rawOn(name,payload=>handler(normalizeRoom(payload)));
    return rawOn(name,handler);
  };
})();
