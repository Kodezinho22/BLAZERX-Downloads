/* ESTUDEX_V190_CLEANROOM_ENGINE_BUNDLE */
/* ESTUDEX_V190_CLEANROOM_ENGINE_ADAPTERS */
/* ESTUDEX_V190_CLEANROOM_INVISIBLE_ENGINE_PRESENCE */
(() => {
  'use strict';

  const root = globalThis;
  const listeners = new Map();
  const emit = (name, payload) => {
    for (const fn of [...(listeners.get(name) || [])]) {
      try { fn(payload); } catch {}
    }
  };
  const subscribe = (name, fn) => {
    if (typeof fn !== 'function') return () => {};
    const set = listeners.get(name) || new Set();
    set.add(fn);
    listeners.set(name, set);
    return () => set.delete(fn);
  };

  const PROFILE_FALLBACK_KEY = 'estudex-cleanroom-profile-v1';
  const ACCENT_KEY = 'estudex-cleanroom-accent-v1';
  const LEGACY_ACCENT_KEYS = ['blazerx-theme-accent','estudex-accent-v181'];
  const LOBBY_IMAGE_KEY = 'estudex-cleanroom-lobby-image-v1';
  const LEGACY_LOBBY_IMAGE_KEY = 'estudex-lobby-image-css-v182';
  const LOBBY_ENABLED_KEY = 'estudex-cleanroom-lobby-enabled-v1';
  const LEGACY_LOBBY_ENABLED_KEY = 'estudex-lobby-background-only-v181';
  const DEFAULT_ACCENT = '#2563EB';

  const SOCIAL_ID_KEY = 'estudex-social-id-v1';
  const FRIENDS_KEY = 'estudex-friends-v1';
  const DM_KEY = 'estudex-dm-threads-v173';
  const BLOCK_KEY = 'estudex-blocked-users-v173';
  const DM_SEEN_KEY = 'estudex-dm-seen-v181';

  const safeJson = (value, fallback) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const normalizeAccent = value => /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
    ? String(value).trim().toUpperCase()
    : '';
  const normalizeProfile = input => ({
    name:String(input?.name || 'Meu perfil').replace(/\s+/g,' ').trim().slice(0,24) || 'Meu perfil',
    avatar:typeof input?.avatar === 'string' && input.avatar.length <= 18000000 ? input.avatar : '',
    banner:typeof input?.banner === 'string' && input.banner.length <= 18000000 ? input.banner : '',
    bio:String(input?.bio || '').replace(/\r/g,'').trim().slice(0,240),
    status:(/* ESTUDEX_V193_SEMANTIC_STATUS_ENGINE */()=>{const raw=String(input?.status || 'Disponível').replace(/\s+/g,' ').trim().slice(0,48) || 'Disponível';const key=raw.toLocaleLowerCase('pt-BR');if(key==='away'||key==='ausente')return'Ausente';if(key==='dnd'||key==='não perturbar'||key==='nao perturbar')return'Não perturbar';if(key==='invisible'||key==='invisível'||key==='invisivel')return'Invisível';return'Disponível';})(),
    tag:String(input?.tag || '').replace(/^@+/,'').replace(/[^A-Za-z0-9._-]/g,'').slice(0,24)
  });
  const normalizeLobbyImage = value => {
    const text = String(value || '').trim();
    if (!text || text === 'none' || text.length > 18000000) return '';
    if (/^data:image\//i.test(text)) return `url("${text.replace(/"/g,'%22')}")`;
    if (/^url\(/i.test(text)) return text;
    return '';
  };
  const boolFromStorage = (key, fallback) => {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw !== '0' && raw !== 'false';
  };
  const uuid = () => {
    try { return crypto.randomUUID(); } catch {}
    return 'ex-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,12);
  };
  const fetchJson = async (url, options = {}, timeoutMs = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {...options, signal:controller.signal});
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        const error = new Error(data?.error || ('HTTP ' + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  };

  let profileCache = null;
  /* ESTUDEX_V193_HF5_REGRESSION_REPAIR */
  const profileFallbackLiteV193=v=>({...normalizeProfile(v),avatar:'',banner:''});
  /* ESTUDEX_V193_DURABLE_PROFILE_MEDIA_REPAIR */
  const profileAssetDataUrlV193=async kind=>{try{const a=root.EstudexNative?.assets;if(!a?.load)return'';const x=await a.load(kind);if(!x?.data)return'';let bytes;if(x.data instanceof Uint8Array)bytes=x.data;else if(x.data?.type==='Buffer'&&Array.isArray(x.data.data))bytes=new Uint8Array(x.data.data);else bytes=new Uint8Array(x.data);const blob=new Blob([bytes],{type:String(x.mime||'image/png')});return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}catch{return''}};
  const saveProfileAssetV193=async(kind,value)=>{try{const a=root.EstudexNative?.assets;const text=String(value||'');if(!a?.save||!/^data:image\//i.test(text))return;const blob=await(await fetch(text)).blob();await a.save(kind,new Uint8Array(await blob.arrayBuffer()),blob.type||'image/png')}catch{}};
  async function getProfile(){if(profileCache)return{...profileCache};let v=null;try{v=await root.EstudexNative?.profile?.get?.()}catch{}if(!v)v=safeJson(localStorage.getItem(PROFILE_FALLBACK_KEY)||'{}',{});profileCache=normalizeProfile(v);let healed=false;if(!profileCache.avatar){const a=await profileAssetDataUrlV193('avatar');if(a){profileCache.avatar=a;healed=true}}if(!profileCache.banner){const b=await profileAssetDataUrlV193('banner');if(b){profileCache.banner=b;healed=true}}if(healed){try{profileCache=normalizeProfile(await root.EstudexNative?.profile?.save?.(profileCache))}catch{}}try{localStorage.setItem(PROFILE_FALLBACK_KEY,JSON.stringify(profileFallbackLiteV193(profileCache)))}catch{}return{...profileCache}}
  async function saveProfile(input){const current=profileCache?{...profileCache}:await getProfile().catch(()=>normalizeProfile({}));const patch=input&&typeof input==='object'?input:{};const merged={...current,...patch};for(const key of ['avatar','banner']){const incoming=patch[key];if(incoming===undefined||(typeof incoming==='string'&&!incoming.trim()&&current[key]))merged[key]=current[key]}const safe=normalizeProfile(merged);let persisted=safe;try{persisted=normalizeProfile(await root.EstudexNative?.profile?.save?.(safe))}catch{}profileCache=persisted;if(profileCache.avatar)saveProfileAssetV193('avatar',profileCache.avatar);if(profileCache.banner)saveProfileAssetV193('banner',profileCache.banner);try{localStorage.setItem(PROFILE_FALLBACK_KEY,JSON.stringify(profileFallbackLiteV193(profileCache)))}catch{}emit('profile',{...profileCache});try{await registerSocial(true)}catch{}return{...profileCache}}

  function getAppearance() {
    let accent = normalizeAccent(localStorage.getItem(ACCENT_KEY));
    if (!accent) {
      for (const key of LEGACY_ACCENT_KEYS) {
        accent = normalizeAccent(localStorage.getItem(key));
        if (accent) break;
      }
    }
    if (!accent) accent = DEFAULT_ACCENT;

    let lobbyImage = normalizeLobbyImage(localStorage.getItem(LOBBY_IMAGE_KEY));
    if (!lobbyImage) lobbyImage = normalizeLobbyImage(localStorage.getItem(LEGACY_LOBBY_IMAGE_KEY));

    const enabled = localStorage.getItem(LOBBY_ENABLED_KEY) != null
      ? boolFromStorage(LOBBY_ENABLED_KEY, true)
      : boolFromStorage(LEGACY_LOBBY_ENABLED_KEY, true);

    return {accent, lobbyImage, lobbyImageEnabled:enabled, defaultAccent:DEFAULT_ACCENT};
  }

  function setAccent(value) {
    const accent = normalizeAccent(value);
    if (!accent) throw new Error('Cor inválida. Use um hexadecimal como #2563EB.');
    localStorage.setItem(ACCENT_KEY, accent);
    localStorage.setItem('blazerx-theme-accent', accent);
    localStorage.setItem('estudex-accent-v181', accent);
    return getAppearance();
  }

  /* ESTUDEX_V193_LOBBY_IMAGE_BOOTSTRAP_GUARD */
  function setLobbyImage(value) {
    const lobbyImage=normalizeLobbyImage(value);
    if(value&&!lobbyImage)throw new Error('Imagem de lobby inválida.');
    if(lobbyImage){localStorage.setItem(LOBBY_IMAGE_KEY,lobbyImage);localStorage.setItem(LEGACY_LOBBY_IMAGE_KEY,lobbyImage);}
    else{const existing=normalizeLobbyImage(localStorage.getItem(LOBBY_IMAGE_KEY))||normalizeLobbyImage(localStorage.getItem(LEGACY_LOBBY_IMAGE_KEY));if(existing&&String(value??'').trim()==='')return getAppearance();localStorage.removeItem(LOBBY_IMAGE_KEY);localStorage.removeItem(LEGACY_LOBBY_IMAGE_KEY);}
    return getAppearance();
  }

  function setLobbyImageEnabled(value) {
    const enabled = Boolean(value);
    localStorage.setItem(LOBBY_ENABLED_KEY, enabled ? '1' : '0');
    localStorage.setItem(LEGACY_LOBBY_ENABLED_KEY, enabled ? '1' : '0');
    return getAppearance();
  }

  function resetAppearance() {
    localStorage.setItem(ACCENT_KEY, DEFAULT_ACCENT);
    localStorage.setItem('blazerx-theme-accent', DEFAULT_ACCENT);
    localStorage.setItem('estudex-accent-v181', DEFAULT_ACCENT);
    localStorage.removeItem(LOBBY_IMAGE_KEY);
    localStorage.removeItem(LEGACY_LOBBY_IMAGE_KEY);
    localStorage.setItem(LOBBY_ENABLED_KEY, '1');
    localStorage.setItem(LEGACY_LOBBY_ENABLED_KEY, '1');
    return getAppearance();
  }

  let socialId = String(localStorage.getItem(SOCIAL_ID_KEY) || '').trim();
  if (!socialId) {
    socialId = uuid();
    localStorage.setItem(SOCIAL_ID_KEY, socialId);
  }
  let ownEndpoint = '';
  let socialRegisteredAt = 0;
  let friendsCache = null;
  let pendingCache = [];
  let blockedCache = null;
  let dmCache = null;
  let dmSeen = null;
  let radminCache = {
    adapter:false, connected:false, radminIp:'', endpoint:'', linkState:'unknown',
    detectionSource:'none', peers:0, peerNames:[], checkedAt:0, error:''
  };
  let inboxBusy = false;
  let radminBusy = false;
  let socialBooted = false;
  let inboxTimer = null;
  let presenceTimer = null;
  let radminTimer = null;
  let socialHeartbeatTimerV194 = null;
  let socialHeartbeatInFlightV194 = false;
  /* ESTUDEX_V194_AUDIT_FOLLOWUP_HARDENING */
  let radminPeersCacheV194 = [];
  let radminPeersFetchedAtV194 = 0;
  let listPeersInFlightV194 = null;
  let radminDeepScanAtV194 = 0;
  const RADMIN_DEEP_SCAN_INTERVAL_V194 = 12000;
  /* ESTUDEX_V193_HOTFIX15_PROOF_PRESENCE_UI */
  /* ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI */
  const RADMIN_PEER_GRACE_MS_V194 = 7500;
  const radminPeerGraceV194 = new Map();
  /* ESTUDEX_V193_HOTFIX14_CONNECTIVITY_MEDIA_ROOM */
  /* ESTUDEX_V193_SOCIAL_RADMIN_STABILITY */
  /* ESTUDEX_V194_UPGRADE_MIGRATION_HARDENING */

  const isInvisibleStatus = value => {
    const normalized = String(value || '').normalize?.('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase() || '';
    return normalized === 'invisivel';
  };
  const publicOnline = input => Boolean(input?.online) && !isInvisibleStatus(input?.status);

  const normalizeFriend = input => ({
    id:String(input?.id || '').trim().slice(0,80),
    name:String(input?.name || 'Usuário').replace(/\s+/g,' ').trim().slice(0,24) || 'Usuário',
    avatar:typeof input?.avatar === 'string' ? input.avatar : '',
    banner:typeof input?.banner === 'string' ? input.banner : '',
    bio:String(input?.bio || '').replace(/\r/g,'').trim().slice(0,240),
    status:String(input?.status || 'Disponível').replace(/\s+/g,' ').trim().slice(0,48) || 'Disponível',
    tag:String(input?.tag || '').replace(/^@+/,'').replace(/[^A-Za-z0-9._-]/g,'').slice(0,24),
    endpoint:String(input?.endpoint || '').replace(/\/$/,''),
    radminIp:String(input?.radminIp || ''),
    online:publicOnline(input),
    addedAt:Number(input?.addedAt || Date.now()),
    updatedAt:Number(input?.updatedAt || Date.now())
  });

  function loadFriends() {
    if (friendsCache) return friendsCache;
    const raw = safeJson(localStorage.getItem(FRIENDS_KEY) || '[]', []);
    friendsCache = (Array.isArray(raw) ? raw : [])
      .map(normalizeFriend)
      .filter(item => item.id && item.id !== socialId)
      .slice(0,500);
    return friendsCache;
  }
  function saveFriends() {
    const data = loadFriends().slice(0,500);
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(data));
    emit('social', {type:'friends', friends:data.map(item => ({...item}))});
  }
  function upsertFriend(input) {
    const next = normalizeFriend(input);
    if (!next.id || next.id === socialId) return null;
    const friends = loadFriends();
    const existing = friends.find(item => item.id === next.id);
    if (existing) {
      Object.assign(existing, {
        ...next,
        avatar:next.avatar || existing.avatar,
        banner:next.banner || existing.banner,
        bio:next.bio || existing.bio,
        tag:next.tag || existing.tag,
        endpoint:next.endpoint || existing.endpoint,
        addedAt:existing.addedAt || next.addedAt,
        updatedAt:Date.now()
      });
      saveFriends();
      return existing;
    }
    next.updatedAt = Date.now();
    friends.push(next);
    saveFriends();
    return next;
  }

  function loadBlocked() {
    if (blockedCache) return blockedCache;
    const raw = safeJson(localStorage.getItem(BLOCK_KEY) || '[]', []);
    blockedCache = new Set((Array.isArray(raw) ? raw : []).map(String).filter(Boolean).slice(0,500));
    return blockedCache;
  }
  function saveBlocked() {
    localStorage.setItem(BLOCK_KEY, JSON.stringify([...loadBlocked()].slice(0,500)));
    emit('social', {type:'blocked', blockedIds:[...loadBlocked()]});
  }

  function loadDm() {
    if (dmCache) return dmCache;
    const raw = safeJson(localStorage.getItem(DM_KEY) || '{}', {});
    dmCache = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return dmCache;
  }
  function loadDmSeen() {
    if (dmSeen) return dmSeen;
    const raw = safeJson(localStorage.getItem(DM_SEEN_KEY) || '[]', []);
    dmSeen = new Set((Array.isArray(raw) ? raw : []).map(String).filter(Boolean).slice(-1200));
    return dmSeen;
  }
  function saveDm() {
    localStorage.setItem(DM_KEY, JSON.stringify(loadDm()));
    localStorage.setItem(DM_SEEN_KEY, JSON.stringify([...loadDmSeen()].slice(-1200)));
    emit('dm', {type:'threads'});
  }
  function resolveKnownUser(id) {
    const key = String(id || '');
    const friend = loadFriends().find(item => item.id === key);
    if (friend) return {...friend};
    const thread = loadDm()[key];
    if (thread?.user) return {...thread.user, id:key};
    return null;
  }
  function ensureThread(user) {
    if (!user?.id) return null;
    const id = String(user.id);
    const threads = loadDm();
    if (!threads[id]) threads[id] = {user:{},messages:[],updatedAt:Date.now()};
    const thread = threads[id];
    thread.user = {
      ...thread.user,
      id,
      name:String(user.name || thread.user?.name || 'Usuário').slice(0,24),
      avatar:typeof user.avatar === 'string' ? user.avatar : (thread.user?.avatar || ''),
      endpoint:String(user.endpoint || thread.user?.endpoint || '').replace(/\/$/,''),
      status:String(user.status || thread.user?.status || 'Disponível'),
      tag:String(user.tag || thread.user?.tag || '').replace(/^@+/,'').slice(0,24),
      online:user.online !== false && !isInvisibleStatus(user.status)
    };
    return thread;
  }
  function pushDm(user, message) {
    const thread = ensureThread(user);
    if (!thread) return null;
    const item = {
      id:String(message?.id || ('dm-' + Date.now() + '-' + Math.random().toString(36).slice(2,8))),
      direction:message?.direction === 'out' ? 'out' : 'in',
      text:String(message?.text || '').slice(0,4000),
      at:Number(message?.at || Date.now())
    };
    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    if (!thread.messages.some(existing => String(existing?.id || '') === item.id)) thread.messages.push(item);
    if (thread.messages.length > 300) thread.messages = thread.messages.slice(-300);
    thread.updatedAt = Date.now();
    saveDm();
    return item;
  }

  async function registerSocial(force = false) {
    if (!force && ownEndpoint && Date.now() - socialRegisteredAt < 10000) return ownEndpoint;
    const current = await getProfile();
    await fetchJson('/api/social/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:socialId, profile:current})
    }, 3500);
    const identity = await fetchJson('/api/social/identity?userId=' + encodeURIComponent(socialId), {}, 3500);
    ownEndpoint = String(identity?.endpoint || '').replace(/\/$/, '');
    socialRegisteredAt = Date.now();
    ensureSocialLoops();
    return ownEndpoint;
  }

  async function sendSocialMessage(endpoint, payload) {
    const base = String(endpoint || '').replace(/\/$/, '');
    if (!base) throw new Error('Usuário sem endereço disponível.');
    if (!ownEndpoint) await registerSocial();
    const current = await getProfile();
    const transportProfile = {
      name:current.name,
      avatar:'', banner:'',
      bio:current.bio,
      status:current.status,
      tag:current.tag
    };
    return fetchJson(base + '/api/social/message', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...payload, senderId:socialId, senderProfile:transportProfile, senderEndpoint:ownEndpoint})
    }, 5000);
  }

  async function refreshRadmin() {
    if (radminBusy) return {...radminCache};
    radminBusy = true;
    try {
      await registerSocial();
      let backend = {};
      try { backend = await fetchJson('/api/social/backend-health', {}, 3000); } catch {}
      let state = null;
      try { state = await fetchJson('/api/social/radmin-self?userId=' + encodeURIComponent(socialId), {}, 3500); }
      catch (error) {
        if (![404,409].includes(Number(error?.status || 0))) throw error;
        state = error?.data || {};
      }
      const radminIp=String(state?.radminIp||backend?.radminIp||'');const endpoint=String(state?.endpoint||backend?.endpoint||'');const validRadminIp=/^26(?:\.\d{1,3}){3}$/.test(radminIp);const adapter=Boolean(state?.adapter??state?.radmin??backend?.radmin??validRadminIp);const connected=typeof state?.connected==='boolean'?state.connected:Boolean(state?.radmin===true&&validRadminIp&&endpoint);
      radminCache={...radminCache,adapter,connected,radminIp,endpoint,
        linkState:String(state?.linkState || (connected ? 'up' : (adapter ? 'unknown' : 'missing'))),
        detectionSource:String(state?.detectionSource || backend?.detectionSource || 'none'),
        checkedAt:Date.now(),
        error:''
      };
    } catch (error) {
      radminCache = {...radminCache, connected:false, checkedAt:Date.now(), error:String(error?.message || error)};
    } finally {
      radminBusy = false;
      emit('radmin', {...radminCache});
    }
    return {...radminCache};
  }

  const isPublicOnlineV194 = value => typeof isInvisibleStatus === 'function' ? !isInvisibleStatus(value) : true;
  function reconcileFriendEndpointsV194(peers) {
    const byId = new Map((Array.isArray(peers) ? peers : []).map(peer => [String(peer?.id || ''), peer]).filter(entry => entry[0]));
    let changed = false;
    for (const friend of loadFriends()) {
      const peer = byId.get(String(friend.id || ''));
      if (!peer) continue;
      const endpoint = String(peer.endpoint || '').trim().replace(/\/$/, '');
      const radminIp = String(peer.radminIp || '').trim();
      if (endpoint && endpoint !== friend.endpoint) { friend.endpoint = endpoint; changed = true; }
      if (radminIp && radminIp !== friend.radminIp) { friend.radminIp = radminIp; changed = true; }
      if (peer.name && peer.name !== friend.name) { friend.name = peer.name; changed = true; }
      if (peer.status && peer.status !== friend.status) { friend.status = peer.status; changed = true; }
      const publicOnline = Boolean(peer?.online) && isPublicOnlineV194(friend.status);
      if (friend.online !== publicOnline) { friend.online = publicOnline; changed = true; }
      friend.updatedAt = Date.now();
    }
    if (changed) saveFriends();
    return changed;
  }

  async function socialHeartbeatV194() {
    if (socialHeartbeatInFlightV194) return false;
    socialHeartbeatInFlightV194 = true;
    try {
      await registerSocial();
      await fetchJson('/api/social/heartbeat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:socialId})
      }, 2600);
      return true;
    } catch (error) {
      if ([403,404].includes(Number(error?.status || 0))) {
        ownEndpoint = '';
        socialRegisteredAt = 0;
        try { await registerSocial(true); } catch {}
      }
      return false;
    } finally {
      socialHeartbeatInFlightV194 = false;
    }
  }

  async function listPeers(force = false) {
    const now=Date.now();
    if(!force&&radminPeersCacheV194.length&&now-radminPeersFetchedAtV194<3200){
      return radminPeersCacheV194.map(user=>({...user}));
    }
    if(listPeersInFlightV194){
      if(!force)return listPeersInFlightV194;
      try{await listPeersInFlightV194;}catch{}
    }
    /* ESTUDEX_V193_HOTFIX14_RADMIN_PROOF_DEEP_SCAN */
    listPeersInFlightV194=(async()=>{
      await registerSocial();
      if(force||!radminCache.checkedAt||Date.now()-Number(radminCache.checkedAt||0)>8000)await refreshRadmin();
      if(!radminCache.adapter){
        radminPeerGraceV194.clear();
        radminPeersCacheV194=[];
        radminPeersFetchedAtV194=Date.now();
        return [];
      }
      try{
        const shouldDeep=Boolean(force)||!radminPeersCacheV194.length||Date.now()-Number(radminDeepScanAtV194||0)>=RADMIN_DEEP_SCAN_INTERVAL_V194;
        const deep=shouldDeep?'&deep=1':'';
        const data=await fetchJson('/api/social/lan-peers?userId='+encodeURIComponent(socialId)+deep,{},shouldDeep?7600:4800);
        if(shouldDeep)radminDeepScanAtV194=Date.now();
        const fresh=(Array.isArray(data?.users)?data.users:[])
          .map(user=>normalizeFriend({...user,online:Boolean(user?.online)}))
          .filter(user=>user.id&&user.endpoint);
        const seenAt=Date.now();
        for(const user of fresh)radminPeerGraceV194.set(String(user.id),{seenAt,user:{...user,online:Boolean(user.online)}});
        for(const [id,entry] of [...radminPeerGraceV194.entries()]){
          if(seenAt-Number(entry?.seenAt||0)>RADMIN_PEER_GRACE_MS_V194)radminPeerGraceV194.delete(id);
        }
        const merged=new Map();
        /* Grace is presentation smoothing only; forced proof contains only peers
           observed in this exact verified snapshot. */
        if(!force){
          for(const [id,entry] of radminPeerGraceV194.entries())if(id&&entry?.user?.endpoint)merged.set(id,{...entry.user,online:Boolean(entry.user.online)});
        }
        for(const user of fresh)merged.set(String(user.id),{...user,online:Boolean(user.online)});
        const users=[...merged.values()].sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR'));
        radminPeersCacheV194=users.map(user=>({...user}));
        radminPeersFetchedAtV194=Date.now();
        reconcileFriendEndpointsV194(radminPeersCacheV194);
        const next={
          ...radminCache,
          peers:users.length,
          peerNames:users.map(user=>user.name).slice(0,24),
          radminIp:String(data?.radminIp||radminCache.radminIp||''),
          endpoint:String(data?.endpoint||radminCache.endpoint||''),
          checkedAt:Date.now(),
          error:''
        };
        const changed=next.peers!==radminCache.peers||next.radminIp!==radminCache.radminIp||next.endpoint!==radminCache.endpoint||next.error!==radminCache.error||String(next.peerNames)!==String(radminCache.peerNames);
        radminCache=next;
        if(changed)emit('radmin',{...radminCache});
        return users.map(user=>({...user}));
      }catch(error){
        const age=Date.now()-Number(radminPeersFetchedAtV194||0);
        if(!force&&radminPeersCacheV194.length&&age<18000)return radminPeersCacheV194.map(user=>({...user}));
        const message=String(error?.message||error);
        const changed=radminCache.peers!==0||radminCache.error!==message;
        radminCache={...radminCache,peers:0,peerNames:[],error:message,checkedAt:Date.now()};
        if(changed)emit('radmin',{...radminCache});
        return [];
      }
    })().finally(()=>{listPeersInFlightV194=null;});
    return listPeersInFlightV194;
  }
  async function refreshFriendPresence(){
    if(presenceRefreshInFlightV193)return presenceRefreshInFlightV193;
    presenceRefreshInFlightV193=(async()=>{
      const friends=loadFriends();
      let peers=[];try{peers=await listPeers();}catch{peers=[];}
      if(typeof reconcileFriendEndpointsV194==='function')reconcileFriendEndpointsV194(peers);
      const liveById=new Map((Array.isArray(peers)?peers:[]).map(peer=>[String(peer?.id||''),peer]).filter(entry=>entry[0]));
      for(const friend of friends){
        const live=liveById.get(String(friend.id||''))||null;
        if(live){
          friend.endpoint=String(live.endpoint||friend.endpoint||'').replace(/\/$/,'');friend.radminIp=String(live.radminIp||friend.radminIp||'');friend.name=live.name||friend.name;friend.status=live.status||friend.status;friend.avatar=live.avatar||friend.avatar;friend.banner=live.banner||friend.banner;friend.bio=live.bio||friend.bio;friend.online=Boolean(live?.online)&&(typeof isPublicOnlineV194==='function'?Boolean(isPublicOnlineV194(friend.status)):true);
        }else friend.online=false;
        friend.updatedAt=Date.now();
      }
      saveFriends();return friends.map(item=>({...item}));
    })();
    try{return await presenceRefreshInFlightV193;}finally{presenceRefreshInFlightV193=null;}
  }

  function listFriends() {
    return loadFriends().map(item => ({...item}));
  }

  function listBlocked() {
    return [...loadBlocked()];
  }

  function listPending(){const blocked=loadBlocked();return pendingCache.filter(item=>!blocked.has(String(item?.senderId||''))).map(item=>({...item}))}

  async function resolveFriendTarget(target) {
    if (target && typeof target === 'object' && target.id && target.endpoint) return normalizeFriend({...target, online:true});
    const text = String(target || '').trim();
    if (!text) throw new Error('Selecione uma pessoa para adicionar.');
    const peers = await listPeers();
    const match = peers.find(item => item.id === text || item.name.toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR'));
    if (match) return match;
    const found = await fetchJson('/api/social/discover?username=' + encodeURIComponent(text), {}, 3200);
    return normalizeFriend({...found?.user, online:true});
  }

  async function sendFriendRequest(target) {
    await registerSocial();
    const user=await resolveFriendTarget(target);
    if(!user.id||!user.endpoint)throw new Error('Pessoa sem endereço disponível.');
    if(user.id===socialId)throw new Error('Esse é o seu próprio usuário.');
    if(loadFriends().some(item=>item.id===user.id))throw new Error('Esse usuário já está na sua lista de amigos.');
    if(pendingCache.some(item=>item?.type==='friend-request'&&String(item?.senderId||'')===String(user.id))){
      throw new Error('Você já recebeu um pedido desse usuário. Aceite em Pendentes.');
    }
    await sendSocialMessage(user.endpoint,{recipientId:user.id,type:'friend-request',payload:{}});
    return {ok:true,user:{...user}};
  }

  /* ESTUDEX_V193_FRIEND_ACCEPT_REPAIR */
  /* ESTUDEX_V193_PENDING_TOMBSTONE_RADMIN_TRUTH */
  const PENDING_DECISION_KEY_V193='estudex-pending-decisions-v193';
  let pendingDecisionCacheV193=null;
  function pendingDecisionsV193(){
    if(pendingDecisionCacheV193)return pendingDecisionCacheV193;
    const raw=safeJson(localStorage.getItem(PENDING_DECISION_KEY_V193)||'{}',{});
    const now=Date.now(),ttl=7*24*60*60*1000,next={};
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
      for(const [id,at] of Object.entries(raw)){const stamp=Number(at||0);if(id&&stamp&&now-stamp<ttl)next[String(id)]=stamp;}
    }
    pendingDecisionCacheV193=next;
    try{localStorage.setItem(PENDING_DECISION_KEY_V193,JSON.stringify(next));}catch{}
    return pendingDecisionCacheV193;
  }
  function rememberPendingDecisionV193(ids){
    const state=pendingDecisionsV193(),now=Date.now();
    for(const id of ids||[]){const key=String(id||'').trim();if(key)state[key]=now;}
    const entries=Object.entries(state).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,600);
    pendingDecisionCacheV193=Object.fromEntries(entries);
    try{localStorage.setItem(PENDING_DECISION_KEY_V193,JSON.stringify(pendingDecisionCacheV193));}catch{}
  }
  function pendingDecisionV193(id){return Boolean(pendingDecisionsV193()[String(id||'')]);}
  async function flushPendingAcksV193(ids){
    const clean=[...new Set((ids||[]).map(String).filter(Boolean))];
    if(!clean.length)return true;
    try{await fetchJson('/api/social/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:socialId,ids:clean})},3000);return true;}catch{return false;}
  }
  async function ackInbox(ids){
    const clean=[...new Set((ids||[]).map(String).filter(Boolean))];
    if(!clean.length)return false;
    rememberPendingDecisionV193(clean);
    const before=JSON.stringify(pendingCache.map(x=>[x?.id,x?.type,x?.senderId]));
    pendingCache=pendingCache.filter(x=>!clean.includes(String(x?.id||'')));
    const after=JSON.stringify(pendingCache.map(x=>[x?.id,x?.type,x?.senderId]));
    if(before!==after)emit('social',{type:'pending',pending:pendingCache.map(x=>({...x}))});
    Promise.resolve().then(()=>flushPendingAcksV193(clean)).catch(()=>{});
    return true;
  }

  /* ESTUDEX_V193_HOTFIX9_TRUE_LOCAL_FRIEND_DECISION */
  async function acceptFriendRequest(input){
    const key=String(input?.id||input||'').trim();
    const message=typeof input==='object'?input:pendingCache.find(item=>String(item?.id||'')===key||String(item?.senderId||'')===key);
    if(!message||message.type!=='friend-request')throw new Error('Solicitação de amizade não encontrada.');
    const senderId=String(message.senderId||'').trim();
    if(!senderId)throw new Error('Solicitação sem identidade do remetente.');
    const sender=message.senderProfile||{};
    const endpoint=String(message.senderEndpoint||'').replace(/\/$/,'');
    const user=upsertFriend({
      id:senderId,name:sender.name,avatar:sender.avatar,banner:sender.banner,bio:sender.bio,status:sender.status,tag:sender.tag,
      endpoint,radminIp:'',online:false
    });
    if(!user)throw new Error('Não foi possível consolidar esse amigo.');
    /* ackInbox is Hotfix-8 local/tombstone first and its remote ACK is detached. */
    await ackInbox([message.id]);
    const localResult={...user,online:false};
    Promise.resolve().then(async()=>{
      await registerSocial().catch(()=>{});
      let live=null,nextEndpoint=endpoint;
      try{
        const peers=await listPeers(true);
        live=(peers||[]).find(peer=>String(peer?.id||'')===senderId)||null;
        if(live?.endpoint)nextEndpoint=String(live.endpoint).replace(/\/$/,'');
      }catch{}
      if(live){
        upsertFriend({
          ...localResult,name:live.name||localResult.name,status:live.status||localResult.status,endpoint:nextEndpoint||localResult.endpoint,
          radminIp:live.radminIp||live.ip||'',online:true
        });
      }
      if(!nextEndpoint)return;
      const current=await getProfile().catch(()=>({}));
      try{
        await fetchJson(nextEndpoint+'/api/social/friends/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipientId:senderId,senderId:socialId,senderProfile:current,senderEndpoint:ownEndpoint})},4200);
        return;
      }catch{}
      try{await sendSocialMessage(nextEndpoint,{recipientId:senderId,type:'friend-accepted',payload:{}});}catch{}
    }).catch(()=>{});
    return localResult;
  }

  async function dismissPending(input) {
    const id = typeof input === 'object' ? input?.id : input;
    if (!id) return false;
    await ackInbox([id]);
    return true;
  }

  async function removeFriend(id) {
    const key=String(id||'').trim();
    if(!key)return false;
    const friend=loadFriends().find(item=>item.id===key)||null;
    const before=loadFriends().length;
    friendsCache=loadFriends().filter(item=>item.id!==key);
    saveFriends();
    try{await registerSocial();}catch{}
    const jobs=[];
    jobs.push(fetchJson('/api/social/friends/local-remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:socialId,friendId:key})},3000).catch(()=>null));
    if(friend?.endpoint)jobs.push(fetchJson((String(friend.endpoint).endsWith('/')?String(friend.endpoint).slice(0,-1):String(friend.endpoint))+'/api/social/friends/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipientId:key,senderId:socialId})},4500).catch(()=>null));
    await Promise.all(jobs);
    return friendsCache.length!==before;
  }

  async function syncBlocked() {
    try {
      await registerSocial();
      const data = await fetchJson('/api/social/blocked', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:socialId, blockedIds:[...loadBlocked()]})
      }, 3000);
      if (Array.isArray(data?.blockedIds)) {
        blockedCache = new Set(data.blockedIds.map(String).filter(Boolean).slice(0,500));
        saveBlocked();
      }
    } catch {}
  }

  async function block(id) {
    const key=String(id||'').trim();
    if(!key)return false;
    loadBlocked().add(key);
    saveBlocked();
    const pendingIds=pendingCache.filter(item=>String(item?.senderId||'')===key&&item?.id).map(item=>String(item.id));
    await Promise.allSettled([syncBlocked(),removeFriend(key),pendingIds.length?ackInbox(pendingIds):Promise.resolve()]);
    pendingCache=pendingCache.filter(item=>String(item?.senderId||'')!==key);
    emit('social',{type:'pending',pending:pendingCache.map(item=>({...item}))});
    return true;
  }

  async function unblock(id) {
    const key = String(id || '').trim();
    const changed = loadBlocked().delete(key);
    saveBlocked();
    await syncBlocked();
    return changed;
  }

  async function getPublicProfile(subject) {
    const id = String(subject?.id || subject || '').trim();
    if (!id) throw new Error('Perfil inválido.');
    if (id === socialId) { const ownProfile=await getProfile(); return {profile:ownProfile, online:!isInvisibleStatus(ownProfile.status), own:true, id:socialId}; }
    let user = typeof subject === 'object' ? normalizeFriend(subject) : resolveKnownUser(id);
    if ((!user || !user.endpoint) && radminCache.adapter) {
      const peers = await listPeers();
      user = peers.find(item => item.id === id) || user;
    }
    if (!user) throw new Error('Perfil não encontrado.');
    if (user.endpoint) {
      try {
        const result = await fetchJson(user.endpoint + '/api/social/public-profile?userId=' + encodeURIComponent(id), {}, 3200);
        if (result?.profile) {
          const profile = normalizeProfile(result.profile);
          const online = result.online !== false && !isInvisibleStatus(profile.status);
          const friend = loadFriends().find(item => item.id === id);
          if (friend) {
            Object.assign(friend, profile, {online, updatedAt:Date.now()});
            saveFriends();
          }
          return {profile, online, own:false, id, endpoint:user.endpoint};
        }
      } catch {}
    }
    const fallbackProfile=normalizeProfile(user);
    return {profile:fallbackProfile, online:Boolean(user.online) && !isInvisibleStatus(fallbackProfile.status), own:false, id, endpoint:user.endpoint || ''};
  }

  function listThreads() {
    const seen = loadDmSeen();
    return Object.entries(loadDm())
      .map(([id,thread]) => ({
        id,
        user:{...(thread?.user || {}), id},
        messages:(Array.isArray(thread?.messages) ? thread.messages : []).map(item => ({...item})),
        updatedAt:Number(thread?.updatedAt || 0),
        unread:(Array.isArray(thread?.messages) ? thread.messages : []).filter(item => item?.direction === 'in' && item?.id && !seen.has(String(item.id))).length
      }))
      .sort((a,b) => b.updatedAt - a.updatedAt);
  }

  function getThread(id) {
    const key = String(id || '');
    const thread = loadDm()[key];
    if (!thread) return null;
    return {
      id:key,
      user:{...(thread.user || {}), id:key},
      messages:(Array.isArray(thread.messages) ? thread.messages : []).map(item => ({...item})),
      updatedAt:Number(thread.updatedAt || 0)
    };
  }

  async function sendDm(id, text) {
    const key = String(id || '').trim();
    const clean = String(text || '').replace(/\r/g,'').trim().slice(0,4000);
    if (!key || !clean) throw new Error('Mensagem vazia.');
    if (loadBlocked().has(key)) throw new Error('Desbloqueie esse usuário para enviar mensagens.');
    let user = resolveKnownUser(key);
    if ((!user || !user.endpoint) && radminCache.adapter) {
      const peers = await listPeers();
      user = peers.find(item => item.id === key) || user;
    }
    if (!user?.endpoint) throw new Error('Esse usuário não está disponível na rede agora.');
    await sendSocialMessage(user.endpoint, {recipientId:key, type:'direct-message', payload:{text:clean}});
    const message = pushDm(user, {direction:'out', text:clean, at:Date.now()});
    return {...message};
  }

  function markDmRead(id) {
    const thread = loadDm()[String(id || '')];
    if (!thread) return false;
    for (const message of Array.isArray(thread.messages) ? thread.messages : []) {
      if (message?.direction === 'in' && message?.id) loadDmSeen().add(String(message.id));
    }
    saveDm();
    return true;
  }

  async function pollInbox(){
    if(inboxBusy)return pendingCache.map(item=>({...item}));
    const pendingBeforeV193=JSON.stringify(pendingCache.map(x=>[x?.id,x?.type,x?.senderId,x?.senderEndpoint,x?.createdAt]));
    inboxBusy=true;
    try {
      await registerSocial();
      const data = await fetchJson('/api/social/inbox?userId=' + encodeURIComponent(socialId), {}, 3000);
      const all = Array.isArray(data?.messages) ? data.messages : [];
      const ack = [];
      const pending = [];
      let dmChanged = false;
      for (const message of all) {
        if (!message?.id) continue;
        if(pendingDecisionV193(message.id)){ack.push(message.id);continue;}
        const senderGuard=String(message?.senderId||'');
        if(senderGuard&&loadBlocked().has(senderGuard)){ack.push(message.id);continue;}
        if (['call-invite','call-answer','call-offer','call-ice','call-reject','call-end'].includes(String(message.type||''))) continue;
        if (message.type === 'direct-message') {
          const senderId = String(message.senderId || '');
          if (!senderId || loadBlocked().has(senderId)) { ack.push(message.id); continue; }
          const known = resolveKnownUser(senderId) || {};
          const sender = message.senderProfile || {};
          const user = normalizeFriend({
            ...known,
            id:senderId,
            name:sender.name || known.name,
            bio:sender.bio || known.bio,
            status:sender.status || known.status,
            endpoint:message.senderEndpoint || known.endpoint,
            online:true
          });
          pushDm(user, {id:message.id, direction:'in', text:message.payload?.text || '', at:message.createdAt || Date.now()});
          dmChanged = true;
          ack.push(message.id);
          continue;
        }
        if (message.type === 'friend-accepted') {
          const sender = message.senderProfile || {};
          upsertFriend({
            id:message.senderId,
            name:sender.name,
            bio:sender.bio,
            status:sender.status,
            endpoint:message.senderEndpoint,
            online:true
          });
          ack.push(message.id);
          continue;
        }
        pending.push(message);
      }
      pendingCache=pending;if(ack.length)await ackInbox(ack);const pendingAfterV193=JSON.stringify(pendingCache.map(x=>[x?.id,x?.type,x?.senderId,x?.senderEndpoint,x?.createdAt]));if(pendingAfterV193!==pendingBeforeV193)emit('social',{type:'pending',pending:pendingCache.map(x=>({...x}))});if(dmChanged)emit('dm',{type:'incoming'});
    } catch {}
    finally { inboxBusy = false; }
    return pendingCache.map(item => ({...item}));
  }

  function ensureSocialLoops() {
    if (socialBooted) return;
    socialBooted = true;
    inboxTimer = setInterval(() => pollInbox().catch(() => {}), 3500);
    presenceTimer = setInterval(() => refreshFriendPresence().catch(() => {}), 6000);
    radminTimer = setInterval(() => refreshRadmin().catch(() => {}), 9000);
    socialHeartbeatTimerV194 = setInterval(() => socialHeartbeatV194().catch(() => {}), 5000);
    Promise.resolve().then(() => socialHeartbeatV194()).catch(() => {});
    Promise.resolve().then(() => pollInbox()).catch(() => {});
    Promise.resolve().then(() => refreshFriendPresence()).catch(() => {});
    Promise.resolve().then(() => refreshRadmin()).catch(() => {});
  }

  root.__estudexCleanroomAdapters = Object.freeze({
    profile:Object.freeze({
      get:getProfile,
      save:saveProfile,
      onChange:fn => subscribe('profile', fn)
    }),
    appearance:Object.freeze({
      get:getAppearance,
      setAccent,
      setLobbyImage,
      setLobbyImageEnabled,
      reset:resetAppearance
    }),
    radmin:Object.freeze({
      getState:() => ({...radminCache}),
      refresh:refreshRadmin,
      listPeers,
      onChange:fn => subscribe('radmin', fn)
    }),
    social:Object.freeze({
      listFriends,
      listPending,
      listBlocked,
      sendFriendRequest,
      acceptFriendRequest,
      dismissPending,
      removeFriend,
      block,
      unblock,
      getPublicProfile,
      onChange:fn => subscribe('social', fn)
    }),
    dm:Object.freeze({
      listThreads,
      getThread,
      send:sendDm,
      markRead:markDmRead,
      onChange:fn => subscribe('dm', fn)
    })
  });

  Promise.resolve().then(() => registerSocial()).catch(() => {});
})();

/* ESTUDEX_V190_CLEANROOM_NATIVE_ADAPTERS */
(() => {
  'use strict';

  const root = globalThis;

  async function ensureReady() {
    const native = root.EstudexNative?.network;
    if (!native?.ensureReady) throw new Error('Bridge nativo do Radmin indisponível.');

    /* ESTUDEX_V194_RADMIN_SERVER_READINESS_TRUTH
       A detected Radmin adapter is not enough: the ESTUDEX local server must
       also be prepared. Do not swallow ensureOnlineServer failures, otherwise
       the UI can look healthy while TCP 8787 is unavailable to Radmin peers. */
    let serverResult = null;
    if (typeof native.ensureOnlineServer === 'function') {
      try {
        serverResult = await native.ensureOnlineServer();
      } catch (cause) {
        const error = new Error(cause?.message || 'Não foi possível iniciar o servidor local do ESTUDEX na rede Radmin.');
        error.code = 'estudex_local_server_unavailable';
        error.cause = cause;
        throw error;
      }
      if (serverResult?.ok === false) {
        const error = new Error(serverResult?.error || serverResult?.message || 'Não foi possível iniciar o servidor local do ESTUDEX na rede Radmin.');
        error.code = 'estudex_local_server_unavailable';
        error.data = serverResult;
        throw error;
      }
    }

    const result = await native.ensureReady();
    if (result?.ok === false) {
      const error = new Error(result?.error || result?.message || 'Não foi possível configurar a rede Radmin.');
      error.data = result;
      throw error;
    }
    return {...(result || {ok:true}), serverReady:serverResult?.ok !== false};
  }

  root.__estudexCleanroomNativeAdapters = Object.freeze({
    radmin:Object.freeze({ensureReady})
  });
})();

/* ESTUDEX_V190_CLEANROOM_ROOM_MEDIA_ADAPTERS */
/* ESTUDEX_V190_CLEANROOM_ROOM_CHAT_ATTACHMENT_ENGINE */
(() => {
  'use strict';

  const root = globalThis;
  const roomListeners = new Set();
  const roomsListeners = new Set();
  const mediaListeners = new Set();
  const subscribe = (set, fn) => {
    if (typeof fn !== 'function') return () => {};
    set.add(fn);
    return () => set.delete(fn);
  };
  const notify = (set, payload) => {
    for (const fn of [...set]) {
      try { fn(payload); } catch {}
    }
  };

  const SOCIAL_ID_KEY = 'estudex-social-id-v1';
  const FRIENDS_KEY = 'estudex-friends-v1';
  const SAVED_CACHE_KEY = 'estudex-saved-rooms-cache-v121';
  const MIC_DEVICE_KEY = 'estudex-mic-device-v181';
  const OUTPUT_DEVICE_KEY = 'estudex-output-device-v181';
  const CAMERA_DEVICE_KEY = 'estudex-camera-device-v130';
  const QUALITY_KEY = 'estudex-video-quality-v187';
  const FPS_KEY = 'estudex-video-fps-v187';
  const MIC_PROFILE_KEY = 'estudex-mic-profile-v150';
  const MIC_SENSITIVITY_KEY = 'estudex-mic-sensitivity-v150';
  const ECHO_KEY = 'estudex-echo-cancellation-v181';
  const NOISE_KEY = 'estudex-noise-suppression-v181';
  const AUTOGAIN_KEY = 'estudex-auto-gain-v181';
  const MIC_VOLUME_KEY = 'blazerx-mic-volume';
  const OUTPUT_VOLUME_KEY = 'blazerx-audio-volume';

  const safeJson = (value, fallback) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const uuid = () => {
    try { return crypto.randomUUID(); } catch {}
    return 'ex-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,12);
  };
  const fetchJson = async (url, options = {}, timeoutMs = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {...options, signal:controller.signal});
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        const error = new Error(data?.error || ('HTTP ' + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  };
  /* ESTUDEX_CLEANROOM_ROOM_ID_PROTOCOL */
  const cleanRoomId = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  const cleanRoomName = value => String(value || 'Sala ESTUDEX').replace(/\s+/g,' ').trim().slice(0,32) || 'Sala ESTUDEX';
  const cleanLimit = value => Math.max(2, Math.min(20, Number.parseInt(value,10) || 6));
  const boolStorage = (key, fallback = true) => {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw !== '0' && raw !== 'false';
  };
  const randomRoomId = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = new Uint32Array(6);
    try { crypto.getRandomValues(values); }
    catch { for (let i=0;i<values.length;i+=1) values[i] = Math.floor(Math.random()*0xffffffff); }
    return [...values].map(value => alphabet[value % alphabet.length]).join('');
  };

  let socialId = String(localStorage.getItem(SOCIAL_ID_KEY) || '').trim();
  if (!socialId) {
    socialId = uuid();
    localStorage.setItem(SOCIAL_ID_KEY, socialId);
  }
  let ownEndpoint = '';
  let registeredAt = 0;

  const getProfile = async () => {
    let value = null;
    try { value = await root.EstudexNative?.profile?.get?.(); } catch {}
    value = value || safeJson(localStorage.getItem('estudex-cleanroom-profile-v1') || '{}', {});
    return {
      name:String(value?.name || 'Usuário').replace(/\s+/g,' ').trim().slice(0,24) || 'Usuário',
      avatar:typeof value?.avatar === 'string' ? value.avatar : '',
      banner:typeof value?.banner === 'string' ? value.banner : '',
      bio:String(value?.bio || '').replace(/\r/g,'').trim().slice(0,240),
      status:String(value?.status || 'Disponível').replace(/\s+/g,' ').trim().slice(0,48) || 'Disponível'
    };
  };
  async function registerSocial(force = false) {
    if (!force && ownEndpoint && Date.now() - registeredAt < 10000) return ownEndpoint;
    const profile = await getProfile();
    await fetchJson('/api/social/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:socialId, profile})
    }, 3500);
    const identity = await fetchJson('/api/social/identity?userId=' + encodeURIComponent(socialId), {}, 3500);
    ownEndpoint = String(identity?.endpoint || '').replace(/\/$/, '');
    registeredAt = Date.now();
    return ownEndpoint;
  }

  /* ESTUDEX_V194_LIVE_ENDPOINT_ROOM_REPAIR */
  let lanPeerCacheV194={at:0,items:[]};
  let lanPeerInFlightV194=null;
  async function freshLanPeersV194(force=false) {
    if(!force&&Date.now()-Number(lanPeerCacheV194.at||0)<4200)return lanPeerCacheV194.items.map(item=>({...item}));
    if(lanPeerInFlightV194)return lanPeerInFlightV194;
    lanPeerInFlightV194=(async()=>{
      await registerSocial();
      const shouldDeep=Boolean(force)||!lanPeerCacheV194.items.length||Date.now()-Number(radminDeepScanAtV194||0)>=RADMIN_DEEP_SCAN_INTERVAL_V194;
      const deep=shouldDeep?'&deep=1':'';
      try{
        const data=await fetchJson('/api/social/lan-peers?userId='+encodeURIComponent(socialId)+deep,{},shouldDeep?7600:4800);
        if(shouldDeep)radminDeepScanAtV194=Date.now();
        const items=(Array.isArray(data?.users)?data.users:[]).map(user=>({...user,id:String(user?.id||'').trim(),endpoint:String(user?.endpoint||'').trim().replace(/\/$/,''),radminIp:String(user?.radminIp||user?.ip||'').trim()})).filter(user=>user.id&&user.endpoint);
        lanPeerCacheV194={at:Date.now(),items};
        return items.map(item=>({...item}));
      }catch(error){
        if(lanPeerCacheV194.items.length&&Date.now()-Number(lanPeerCacheV194.at||0)<12000)return lanPeerCacheV194.items.map(item=>({...item}));
        throw error;
      }
    })().finally(()=>{lanPeerInFlightV194=null;});
    return lanPeerInFlightV194;
  }
  function healStoredFriendEndpointV194(peer) {
    if (!peer?.id || !peer?.endpoint) return false;
    const raw = safeJson(localStorage.getItem(FRIENDS_KEY) || '[]', []);
    if (!Array.isArray(raw)) return false;
    let changed = false;
    for (const friend of raw) {
      if (String(friend?.id || '') !== String(peer.id)) continue;
      const endpoint = String(peer.endpoint || '').replace(/\/$/, '');
      if (endpoint && endpoint !== String(friend.endpoint || '')) { friend.endpoint = endpoint; changed = true; }
      const radminIp = String(peer.radminIp || '');
      if (radminIp && radminIp !== String(friend.radminIp || '')) { friend.radminIp = radminIp; changed = true; }
      if (peer.name && !friend.name) { friend.name = peer.name; changed = true; }
      friend.online = Boolean(peer?.online) && isPublicOnlineV194(peer.status || friend.status);
      friend.updatedAt = Date.now();
    }
    if (changed) localStorage.setItem(FRIENDS_KEY, JSON.stringify(raw));
    return changed;
  }

  const normalizeSavedRoom = input => {
    const room = cleanRoomId(input?.room || input?.roomId);
    if (!room) return null;
    return {
      room,
      name:cleanRoomName(input?.name || input?.roomName),
      limit:cleanLimit(input?.limit ?? input?.roomLimit),
      role:input?.role === 'host' ? 'host' : 'member',
      hostId:String(input?.hostId || '').trim().slice(0,80),
      hostName:String(input?.hostName || 'Usuário').replace(/\s+/g,' ').trim().slice(0,24) || 'Usuário',
      hostAvatar:typeof input?.hostAvatar === 'string' ? input.hostAvatar : '',
      hostEndpoint:String(input?.hostEndpoint || input?.host || '').trim().replace(/\/$/,''),
      members:Array.isArray(input?.members) ? input.members.slice(0,20) : [],
      createdAt:Number(input?.createdAt || Date.now()),
      updatedAt:Number(input?.updatedAt || Date.now()),
      online:Boolean(input?.online),
      active:Boolean(input?.active),
      roomSize:Number(input?.roomSize || 0),
      lan:Boolean(input?.lan)
    };
  };
  let savedCache = null;
  function loadSavedCache() {
    if (savedCache) return savedCache;
    const raw = safeJson(localStorage.getItem(SAVED_CACHE_KEY) || '[]', []);
    savedCache = (Array.isArray(raw) ? raw : []).map(normalizeSavedRoom).filter(Boolean).slice(-120);
    return savedCache;
  }
  function writeSavedCache() {
    localStorage.setItem(SAVED_CACHE_KEY, JSON.stringify(loadSavedCache().slice(-120)));
  }
  function cacheSavedRoom(input) {
    const next = normalizeSavedRoom(input);
    if (!next) return null;
    const list = loadSavedCache();
    const index = list.findIndex(item => item.room === next.room);
    if (index >= 0) {
      const previous = list[index];
      const memberMap = new Map();
      for (const member of [...(previous.members || []), ...(next.members || [])]) {
        const id = String(member?.id || member?.clientId || '');
        if (id) memberMap.set(id, member);
      }
      list[index] = {
        ...previous, ...next,
        hostEndpoint:next.hostEndpoint || previous.hostEndpoint,
        hostId:next.hostId || previous.hostId,
        hostName:next.hostName === 'Usuário' ? previous.hostName : next.hostName,
        hostAvatar:next.hostAvatar || previous.hostAvatar,
        members:[...memberMap.values()].slice(0,20),
        createdAt:Number(previous.createdAt || next.createdAt || Date.now()),
        updatedAt:Date.now()
      };
    } else list.push({...next, updatedAt:Date.now()});
    savedCache = list.slice(-120);
    writeSavedCache();
    notify(roomsListeners, {type:'saved-cache', rooms:savedCache.map(item => ({...item}))});
    return savedCache.find(item => item.room === next.room) || next;
  }
  async function upsertSavedRoom(input) {
    const room = cacheSavedRoom(input);
    if (!room) return null;
    try {
      await registerSocial();
      const result = await fetchJson('/api/rooms/saved/local-upsert', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:socialId, room})
      }, 3500);
      if (result?.room) return cacheSavedRoom(result.room);
    } catch {}
    return room;
  }

  /* ESTUDEX_V190_CLEANROOM_ROOM_READ_EVENT_GUARD */
  async function listLanRooms() {
    await registerSocial();
    let peers=[];
    try{peers=await freshLanPeersV194(false);}
    catch(error){if(Number(error?.status||0)===409)return [];throw error;}
    const map = new Map();
    for (const user of peers) {
      const source = user?.room;
      const room = cleanRoomId(source?.room);
      const endpoint = String(user?.endpoint || '').replace(/\/$/, '');
      if (!room || !endpoint) continue;
      map.set(room, {
        room,
        name:cleanRoomName(source?.name || ('Sala de ' + (user?.name || 'Usuário'))),
        limit:cleanLimit(source?.limit),
        roomSize:Math.max(1, Number(source?.roomSize || 1)),
        role:'member',
        hostId:String(user?.id || ''),
        hostName:String(user?.name || 'Usuário'),
        hostAvatar:typeof user?.avatar === 'string' ? user.avatar : '',
        hostEndpoint:endpoint,
        online:true, active:true, lan:true,
        updatedAt:Date.now()
      });
    }
    const rooms = [...map.values()];
    return rooms;
  }

  async function listSavedRooms() {
    await registerSocial();
    let serverRooms = [];
    try {
      const result = await fetchJson('/api/rooms/saved/list?userId=' + encodeURIComponent(socialId), {}, 3400);
      serverRooms = (Array.isArray(result?.rooms) ? result.rooms : []).map(normalizeSavedRoom).filter(Boolean);
    } catch {}
    const merged = new Map();
    for (const raw of [...loadSavedCache(), ...serverRooms]) {
      const room = normalizeSavedRoom(raw);
      if (!room) continue;
      const previous = merged.get(room.room);
      merged.set(room.room, previous ? {...previous, ...room, hostEndpoint:room.hostEndpoint || previous.hostEndpoint} : room);
    }
    const list = [...merged.values()];
    for (const saved of list) saved.hostEndpoint = estudexCloudRoomBaseV1924();
    await Promise.all(list.map(async saved => {
      if (saved.role === 'host') {
        const localActive = roomState.connected && roomState.role === 'host' && roomState.roomId === saved.room;
        saved.online = localActive;
        saved.active = localActive;
        saved.roomSize = localActive ? Math.max(1, members.size) : 0;
        if (!localActive) {
          try {
            const status = await fetchJson(estudexCloudRoomBaseV1924() + '/api/rooms/saved/status?room=' + encodeURIComponent(saved.room), {}, 2300);
            saved.online = Boolean(status?.available);
            saved.active = Boolean(status?.active);
            saved.roomSize = Number(status?.roomSize || 0);
          } catch {
            saved.online = false;
            saved.active = false;
            saved.roomSize = 0;
          }
        }
        return;
      }
      saved.online = false;
      saved.active = false;
      if (!saved.hostEndpoint) return;
      try {
        const status = await fetchJson(saved.hostEndpoint + '/api/rooms/saved/status?room=' + encodeURIComponent(saved.room), {}, 2300);
        saved.online = Boolean(status?.available);
        saved.active = Boolean(status?.active);
        saved.roomSize = Number(status?.roomSize || 0);
        if (status?.room) Object.assign(saved, normalizeSavedRoom({...saved, ...status.room}) || {});
      } catch {}
    }));
    savedCache = list.sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(-120);
    writeSavedCache();
    return savedCache.map(item => ({...item}));
  }

  /* ESTUDEX_V1010_EXACT_ROOM_LIFECYCLE */
  async function closeOwnedRoom(value) {
    const room = cleanRoomId(value?.room || value?.roomId || value);
    if (!room) throw new Error('Código de sala inválido.');
    await registerSocial();

    if (roomState.connected && roomState.roomId === room) {
      if (roomState.role !== 'host') throw new Error('Somente o dono pode encerrar a sala.');
      await closeRoom();
      await deleteSavedRoom(room);
      return true;
    }

    const savedRooms = await listSavedRooms();
    const saved = savedRooms.find(item => item.room === room && item.role === 'host');
    if (!saved) throw new Error('Somente o dono pode encerrar a sala.');
    const signalingBase = String(saved.hostEndpoint || ownEndpoint || '').trim().replace(/\/$/,'');
    if (!signalingBase) throw new Error('Servidor da sala indisponível.');
    const profile = await getProfile();
    const wsBase = signalingBase.replace(/^http:/i,'ws:').replace(/^https:/i,'wss:');

    await new Promise((resolve,reject) => {
      let settled=false;
      let closeSent=false;
      let ws=null;
      const finish=(error,value) => {
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        try{ws?.close?.();}catch{}
        if(error)reject(error);else resolve(value);
      };
      const timer=setTimeout(()=>finish(new Error('Tempo esgotado ao encerrar a sala.')),7000);
      try{ws=new WebSocket(wsBase);}
      catch(error){finish(error);return;}
      ws.addEventListener('open',()=>{
        try{
          ws.send(JSON.stringify({
            type:'join', roomId:room, role:'host', profile, ownerKey:socialId,
            roomName:saved.name, roomLimit:saved.limit
          }));
        }catch(error){finish(error);}
      });
      ws.addEventListener('message',event=>{
        let msg=null;
        try{msg=JSON.parse(String(event.data||''));}catch{return;}
        if(msg?.type==='joined'){
          if(msg.role!=='host'){
            finish(new Error('Somente o dono pode encerrar a sala.'));
            return;
          }
          try{
            closeSent=true;
            ws.send(JSON.stringify({type:'close-room',ownerKey:socialId}));
          }catch(error){finish(error);}
          return;
        }
        if(msg?.type==='room-closed')finish(null,true);
        if(msg?.type==='error')finish(new Error(msg.message||msg.code||'Não foi possível encerrar a sala.'));
      });
      ws.addEventListener('error',()=>finish(new Error('Não foi possível conectar ao servidor da sala.')));
      ws.addEventListener('close',()=>{if(closeSent)finish(null,true);else finish(new Error('A conexão com a sala foi encerrada.'));});
    });

    await deleteSavedRoom(room);
    return true;
  }

  async function deleteSavedRoom(value) {
    const room = cleanRoomId(value?.room || value);
    if (!room) return false;
    savedCache = loadSavedCache().filter(item => item.room !== room);
    writeSavedCache();
    try {
      await registerSocial();
      await fetchJson('/api/rooms/saved/local-remove', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:socialId, room})
      }, 3000);
    } catch {}
    notify(roomsListeners, {type:'saved-delete', room});
    return true;
  }

  /* ESTUDEX_V193_HOTFIX20_CLOUD_ROOM_TEST
     Temporary friends-test transport. Room membership/signaling is centralized
     on the Back4App ESTUDEX server; media remains peer-to-peer over WebRTC. */
  const ESTUDEX_CLOUD_ROOM_DEFAULT_V1924 = 'https://estudexserver-p1t0c2xc.b4a.run';
  function estudexCloudRoomBaseV1924() {
    const override = String(localStorage.getItem('estudex-cloud-room-base-v1924') || '').trim().replace(/\/$/,'');
    return /^https?:\/\//i.test(override) ? override : ESTUDEX_CLOUD_ROOM_DEFAULT_V1924;
  }
  try { window.ESTUDEX_CLOUD_ROOM_BASE = estudexCloudRoomBaseV1924(); } catch {}

  /* ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO
     Windows/Electron system loopback helper. The loopback capture is global PC
     audio (not per-window), while the selected video source remains unchanged. */
  async function estudexCaptureSystemAudioV1925() {
    const devices = navigator?.mediaDevices;
    if (!devices?.getUserMedia) return null;
    let probe = null;
    try {
      probe = await devices.getUserMedia({
        audio:{mandatory:{chromeMediaSource:'desktop'}},
        video:{mandatory:{chromeMediaSource:'desktop'}}
      });
      const audioTrack = probe?.getAudioTracks?.().find(track => track.readyState === 'live') || probe?.getAudioTracks?.()[0] || null;
      for (const track of probe?.getVideoTracks?.() || []) { try { track.stop(); } catch {} }
      for (const track of probe?.getAudioTracks?.() || []) { if (track !== audioTrack) try { track.stop(); } catch {} }
      if (!audioTrack) { try { stopTracks(probe); } catch {} return null; }
      return audioTrack;
    } catch (error) {
      try { stopTracks(probe); } catch {}
      try { root.__estudexLastSystemAudioErrorV1925 = String(error?.message || error || 'system_audio_unavailable'); } catch {}
      return null;
    }
  }

  async function estudexAttachSystemAudioV1925(stream, enabled = true) {
    if (!stream) return stream;
    const existing = stream.getAudioTracks?.().find(track => track.readyState === 'live') || null;
    if (existing) { existing.enabled = Boolean(enabled); return stream; }
    const track = await estudexCaptureSystemAudioV1925();
    if (track) {
      track.enabled = Boolean(enabled);
      try { stream.addTrack(track); } catch { try { track.stop(); } catch {} }
    }
    return stream;
  }

  /* Canonical V10.10 still calls getDisplayMedia directly. Electron can return
     video-only there, so enrich that stream without touching the canonical UI. */
  try {
    const devices = navigator?.mediaDevices;
    const originalGetDisplayMedia = devices?.getDisplayMedia?.bind(devices);
    if (originalGetDisplayMedia && !devices.__estudexSystemAudioWrappedV1925) {
      Object.defineProperty(devices, '__estudexSystemAudioWrappedV1925', {value:true, configurable:false});
      devices.getDisplayMedia = async constraints => {
        const stream = await originalGetDisplayMedia(constraints);
        if (constraints?.audio && !(stream?.getAudioTracks?.().length)) {
          await estudexAttachSystemAudioV1925(stream, true);
        }
        return stream;
      };
    }
  } catch {}

  const roomState = {
    connected:false,
    connecting:false,
    roomId:'',
    roomName:'',
    roomLimit:6,
    role:'',
    clientId:'',
    signalingBase:'',
    pingMs:null,
    streamLive:false,
    joinedAt:0,
    error:''
  };
  const members = new Map();
  const messages = [];
  const publishers = new Map();
  let socket = null;
  let connectToken = 0;
  let pingTimer = null;
  let pingSentAt = 0;
  let manualLeave = false;

  const memberSnapshot = () => [...members.values()].map(member => ({
    ...member,
    profile:{...(member.profile || {})},
    voice:{...(member.voice || {micEnabled:false,speaking:false})},
    media:{...(member.media || {})}
  }));
  const roomSnapshot = () => ({
    ...roomState,
    members:memberSnapshot(),
    messages:messages.map(item => ({...item, profile:{...(item.profile || {})}}))
  });
  /* ESTUDEX_V193_ROOM_PERFORMANCE_REPAIR */
  const lightRoomEventV193=new Set(['ping','voice-message-recording']);
  const emitRoom=(type,extra={})=>notify(roomListeners,{type,state:lightRoomEventV193.has(type)?{...roomState}:roomSnapshot(),...extra});

  function sendWs(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }

  const mediaState = {
    microphoneEnabled:false,
    audioEnabled:true,
    cameraEnabled:false,
    screenShareEnabled:false,
    microphoneDeviceId:String(localStorage.getItem(MIC_DEVICE_KEY) || localStorage.getItem('blazerx-mic-device') || ''),
    audioOutputDeviceId:String(localStorage.getItem(OUTPUT_DEVICE_KEY) || localStorage.getItem('blazerx-audio-output') || ''),
    cameraDeviceId:String(localStorage.getItem(CAMERA_DEVICE_KEY) || ''),
    quality:[720,1080,1440].includes(Number(localStorage.getItem(QUALITY_KEY))) ? Number(localStorage.getItem(QUALITY_KEY)) : 1080,
    fps:[24,30,60].includes(Number(localStorage.getItem(FPS_KEY))) ? Number(localStorage.getItem(FPS_KEY)) : 60,
    microphoneProfile:['isolation','custom'].includes(localStorage.getItem(MIC_PROFILE_KEY)) ? localStorage.getItem(MIC_PROFILE_KEY) : 'isolation',
    microphoneSensitivity:Math.max(0,Math.min(100,Number(localStorage.getItem(MIC_SENSITIVITY_KEY) ?? 62))),
    echoCancellation:boolStorage(ECHO_KEY,true),
    noiseSuppression:boolStorage(NOISE_KEY,true),
    autoGainControl:boolStorage(AUTOGAIN_KEY,true),
    microphoneVolume:Math.max(0,Math.min(100,Number(localStorage.getItem(MIC_VOLUME_KEY) ?? 100))),
    outputVolume:Math.max(0,Math.min(200,Number(localStorage.getItem(OUTPUT_VOLUME_KEY) ?? 100)))
  };
  const localStreams = new Map();
  const outgoingPeers = new Map();
  const incomingPeers = new Map();
  const remoteStreams = new Map();
  let micPipeline = null;
  let micVadTimer = null;
  let micSpeaking = false;
  let cameraPreviewStream = null;
  /* ESTUDEX_V190_CLEANROOM_MEDIA_RACE_HARDENING */
  /* ESTUDEX_V190_CLEANROOM_ROOM_LIFECYCLE_HARDENING */
  const localCaptureTokens = {voice:0,camera:0,screen:0};
  let previewCaptureToken = 0;
  let roomLifecycleToken = 0;
  let activeScreenSourceId = '';
  const currentRoomCapture = (lifecycle, roomId, clientId) => lifecycle === roomLifecycleToken && roomState.connected && roomState.roomId === roomId && roomState.clientId === clientId;
  let roomAudioRecorder = null;
  let roomAudioRecordingStream = null;
  let roomAudioRecordingPipeline = null;
  let roomAudioChunks = [];
  let roomAudioMime = '';
  const roomAttachmentControllers = new Set();


  const mediaSnapshot = () => ({...mediaState});
  const emitMedia = (type, extra = {}) => notify(mediaListeners, {type, state:mediaSnapshot(), ...extra});
  const mediaKey = (peerId, kind) => String(peerId) + ':' + String(kind);
  const normalizeKind = value => ['screen','camera','voice'].includes(value) ? value : '';
  /* ESTUDEX_V193_TRANSMISSION_PRIVACY_FAST_CONNECT */
  const ROOM_MEDIA_RTC_CONFIG=Object.freeze({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}],iceCandidatePoolSize:2});
  const mediaOfferInFlight=new Map();
  const screenPrewarmInFlightV194=new Map();
  /* ESTUDEX_V193_HOTFIX14_STREAM_PREWARM_WATCHDOG_V2 */

  function stopTracks(stream) {
    try { stream?.getTracks?.().forEach(track => track.stop()); } catch {}
  }
  function closePipeline(pipeline) {
    if (!pipeline) return;
    try { pipeline.source?.disconnect?.(); } catch {}
    try { pipeline.highpass?.disconnect?.(); } catch {}
    try { pipeline.lowpass?.disconnect?.(); } catch {}
    try { pipeline.compressor?.disconnect?.(); } catch {}
    try { pipeline.gate?.disconnect?.(); } catch {}
    try { pipeline.gain?.disconnect?.(); } catch {}
    try { stopTracks(pipeline.raw); } catch {}
    try { pipeline.context?.close?.(); } catch {}
  }
  function closePeer(map,key){
    const peer=map.get(key);if(!peer)return;map.delete(key);
    try{if(peer.disconnectTimer)clearTimeout(peer.disconnectTimer)}catch{}
    try{peer.pc.ontrack=null;peer.pc.onicecandidate=null;peer.pc.onconnectionstatechange=null;peer.pc.oniceconnectionstatechange=null;peer.pc.close()}catch{}
  }
  function closeMediaKind(peerId, kind) {
    const key = mediaKey(peerId, kind);
    closePeer(outgoingPeers, key);
    closePeer(incomingPeers, key);
    const stream = remoteStreams.get(key);
    if (stream) {
      remoteStreams.delete(key);
      emitMedia('remote-stream-ended', {clientId:String(peerId), kind});
    }
  }
  function closeAllPeers() {
    for (const key of [...outgoingPeers.keys()]) closePeer(outgoingPeers,key);
    for (const key of [...incomingPeers.keys()]) closePeer(incomingPeers,key);
    for (const key of [...remoteStreams.keys()]) {
      const [clientId, kind] = key.split(':');
      emitMedia('remote-stream-ended', {clientId, kind});
    }
    remoteStreams.clear();
  }

  function rtcPeer(peerId, kind, side) {
    const key = mediaKey(peerId,kind);
    const map = side === 'out' ? outgoingPeers : incomingPeers;
    const existing = map.get(key);
    if (existing && existing.pc.signalingState !== 'closed') return existing;
    const pc = new RTCPeerConnection(ROOM_MEDIA_RTC_CONFIG);
    const holder = {pc, pendingIce:[], stream:null, peerId:String(peerId), kind, createdAt:Date.now(), offerSentAt:0, retryCount:0, prewarmSender:null, prewarmed:false};
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      sendWs({
        type:'media-signal', target:String(peerId), kind,
        side:side === 'out' ? 'publisher' : 'subscriber',
        data:{candidate:event.candidate}
      });
    };
    pc.onconnectionstatechange = () => {
      const value=String(pc.connectionState||'');
      if(value==='connected'){
        if(holder.disconnectTimer){clearTimeout(holder.disconnectTimer);holder.disconnectTimer=null;}
        return;
      }
      if(value==='closed'){
        if(side==='in'&&remoteStreams.has(key)){remoteStreams.delete(key);emitMedia('remote-stream-ended',{clientId:String(peerId),kind});}
        closePeer(map,key);return;
      }
      if(value==='disconnected'||value==='failed'){
        const retry=Math.max(0,Number(holder.retryCount||0));
        if(side==='out'&&retry<2&&roomState.connected&&localStreams.has(kind)){
          if(holder.disconnectTimer)return;
          holder.disconnectTimer=setTimeout(()=>{
            holder.disconnectTimer=null;
            if(outgoingPeers.get(key)!==holder||!roomState.connected||!localStreams.has(kind))return;
            if(String(holder.pc?.connectionState||'')==='connected')return;
            closePeer(outgoingPeers,key);
            offerMediaTo(peerId,kind,{force:true,retry:retry+1}).catch(error=>emitMedia('error',{operation:value==='failed'?'offer-failed-retry':'offer-disconnected-retry',kind,error:String(error?.message||error)}));
          },value==='failed'?160:1200);
        }else if(value==='failed'){
          if(side==='in'&&remoteStreams.has(key)){remoteStreams.delete(key);emitMedia('remote-stream-ended',{clientId:String(peerId),kind});}
          closePeer(map,key);
        }
      }
    };
    if (side === 'in') {
      pc.ontrack = event => {
        const stream=holder.stream||event.streams?.[0]||new MediaStream();
        holder.stream=stream;
        if(!stream.getTracks().some(track=>track.id===event.track.id)){try{stream.addTrack(event.track);}catch{}}
        const publishRemoteStreamV194=()=>{
          const member=members.get(String(peerId));
          const advertised=Boolean(member?.media?.[kind]);
          const ready=stream.getTracks().some(track=>track.readyState==='live'&&track.muted===false);
          if(!advertised||!ready)return false;
          if(remoteStreams.get(key)!==stream){remoteStreams.set(key,stream);emitMedia('remote-stream',{clientId:String(peerId),kind,stream,member:member||null});}
          return true;
        };
        event.track.addEventListener?.('unmute',publishRemoteStreamV194);
        event.track.addEventListener?.('ended',()=>{const active=stream.getTracks().some(track=>track.readyState==='live');if(!active)closeMediaKind(peerId,kind);},{once:true});
        publishRemoteStreamV194();
      };
    }
    map.set(key, holder);
    return holder;
  }

  async function tuneSender(sender,kind,track){
    if(!sender?.getParameters)return;
    try{
      const params=sender.getParameters();params.encodings??=[{}];const encoding=params.encodings[0];
      if(track?.kind==='audio')encoding.maxBitrate=kind==='voice'?96000:192000;
      if(track?.kind==='video'){
        const q=Number(mediaState.quality||1080),fps=Number(mediaState.fps||60);
        const screenBudget=q>=1440?(fps>=60?12000000:8500000):q>=1080?(fps>=60?8000000:5500000):(fps>=60?5000000:3200000);
        const cameraBudget=q>=1440?(fps>=60?7000000:5000000):q>=1080?(fps>=60?5000000:3500000):(fps>=60?3000000:2200000);
        encoding.maxBitrate=kind==='screen'?screenBudget:cameraBudget;
        encoding.maxFramerate=Math.max(12,Math.min(60,fps));
        try{track.contentHint=kind==='screen'?(fps>=50?'motion':'detail'):'motion'}catch{}
        if('degradationPreference' in params)params.degradationPreference=kind==='screen'?'maintain-resolution':'balanced';
      }
      await sender.setParameters(params);
    }catch{}
  }

  async function offerMediaTo(peerId,kind,options={}){
    kind=normalizeKind(kind);
    const stream=localStreams.get(kind);
    if(!kind||!stream||!stream.getTracks().some(track=>track.readyState==='live'))return false;
    if(!roomState.clientId||String(peerId)===String(roomState.clientId))return false;
    const key=mediaKey(peerId,kind);
    let existing=outgoingPeers.get(key);
    if(kind==='screen'&&existing?.prewarmSender&&existing.pc?.signalingState!=='closed'){
      const track=stream.getVideoTracks().find(item=>item.readyState==='live');
      if(track){try{await existing.prewarmSender.replaceTrack(track);existing.prewarmed=false;existing.createdAt=Date.now();existing.offerSentAt=Date.now();await tuneSender(existing.prewarmSender,kind,track);return true;}catch{closePeer(outgoingPeers,key);existing=null;}}
    }
    if(!options.force&&existing?.pc&&existing.pc.signalingState!=='closed'){const state=String(existing.pc.connectionState||'new');const age=Date.now()-Number(existing.createdAt||0);if(state==='connected'||(['new','connecting'].includes(state)&&age<4500))return true;}
    if(mediaOfferInFlight.has(key))return mediaOfferInFlight.get(key);
    const retry=Math.max(0,Number(options.retry||0));
    const job=(async()=>{
      closePeer(outgoingPeers,key);
      const holder=rtcPeer(peerId,kind,'out');holder.retryCount=retry;
      for(const track of stream.getTracks()){if(track.readyState!=='live')continue;const sender=holder.pc.addTrack(track,stream);await tuneSender(sender,kind,track);}
      const description=await holder.pc.createOffer();await holder.pc.setLocalDescription(description);holder.offerSentAt=Date.now();
      sendWs({type:'media-signal',target:String(peerId),kind,side:'publisher',data:{description:holder.pc.localDescription}});
      if(retry<2)setTimeout(()=>{const current=outgoingPeers.get(key);if(current!==holder||!roomState.connected||!localStreams.has(kind))return;if(['new','connecting','disconnected','failed'].includes(String(current.pc.connectionState||''))){closePeer(outgoingPeers,key);offerMediaTo(peerId,kind,{force:true,retry:retry+1}).catch(error=>emitMedia('error',{operation:'offer-retry',kind,error:String(error?.message||error)}));}},2800);
      return true;
    })().finally(()=>{if(mediaOfferInFlight.get(key)===job)mediaOfferInFlight.delete(key);});
    mediaOfferInFlight.set(key,job);return job;
  }

  /* ESTUDEX_V193_HOTFIX14_EXISTING_MEMBER_MEDIA_OFFER */
  async function prewarmScreenPeerV194(peerId){
    const id=String(peerId||'');
    if(!id||roomState.role!=='host'||!roomState.connected||!roomState.clientId||id===String(roomState.clientId)||localStreams.has('screen'))return false;
    const key=mediaKey(id,'screen');
    const existing=outgoingPeers.get(key);
    if(existing?.prewarmSender&&existing.pc?.signalingState!=='closed'&&!['failed','closed'].includes(String(existing.pc.connectionState||'')))return true;
    if(screenPrewarmInFlightV194.has(key))return screenPrewarmInFlightV194.get(key);
    const job=(async()=>{
      closePeer(outgoingPeers,key);const holder=rtcPeer(id,'screen','out');
      if(typeof holder.pc.addTransceiver!=='function'){closePeer(outgoingPeers,key);return false;}
      const transceiver=holder.pc.addTransceiver('video',{direction:'sendonly'});holder.prewarmSender=transceiver.sender;holder.prewarmed=true;
      const description=await holder.pc.createOffer();await holder.pc.setLocalDescription(description);holder.offerSentAt=Date.now();
      sendWs({type:'media-signal',target:id,kind:'screen',side:'publisher',data:{description:holder.pc.localDescription,prewarm:true}});return true;
    })().catch(error=>{closePeer(outgoingPeers,key);emitMedia('error',{operation:'screen-prewarm',kind:'screen',error:String(error?.message||error)});return false;}).finally(()=>screenPrewarmInFlightV194.delete(key));
    screenPrewarmInFlightV194.set(key,job);return job;
  }
  async function prewarmScreenCurrentMembersV194(){
    if(roomState.role!=='host'||!roomState.connected||localStreams.has('screen'))return false;
    const ids=[...members.values()].map(member=>String(member?.clientId||'')).filter(id=>id&&id!==String(roomState.clientId||''));
    await Promise.allSettled(ids.map(prewarmScreenPeerV194));return true;
  }
  async function offerLiveKindToCurrentMembersV194(kind) {
    kind=normalizeKind(kind);
    if(!kind||!roomState.connected||!localStreams.has(kind))return false;
    const ids=[...members.values()].map(member=>String(member?.clientId||'')).filter(id=>id&&id!==String(roomState.clientId||''));
    if(!ids.length)return true;
    await Promise.allSettled(ids.map(id=>offerMediaTo(id,kind,{force:true})));
    return true;
  }

  async function handleMediaSignal(msg) {
    const peerId = String(msg?.from || '');
    const kind = normalizeKind(msg?.kind);
    const senderSide = String(msg?.side || '');
    const data = msg?.data || {};
    if (!peerId || !kind || !['publisher','subscriber'].includes(senderSide)) return;
    const localSide = senderSide === 'publisher' ? 'in' : 'out';
    const key = mediaKey(peerId,kind);
    let holder = rtcPeer(peerId,kind,localSide);
    if (data.description) {
      if (data.description.type === 'offer' && localSide === 'in') {
        closePeer(incomingPeers,key);
        holder = rtcPeer(peerId,kind,'in');
      }
      await holder.pc.setRemoteDescription(data.description);
      for (const candidate of holder.pendingIce.splice(0)) {
        try { await holder.pc.addIceCandidate(candidate); } catch {}
      }
      if (data.description.type === 'offer') {
        const answer = await holder.pc.createAnswer();
        await holder.pc.setLocalDescription(answer);
        sendWs({type:'media-signal', target:peerId, kind, side:'subscriber', data:{description:holder.pc.localDescription}});
      }
      return;
    }
    if (data.candidate) {
      if (!holder.pc.remoteDescription) holder.pendingIce.push(data.candidate);
      else { try { await holder.pc.addIceCandidate(data.candidate); } catch {} }
    }
  }

  function updateMemberMedia(clientId, kind, live) {
    const id = String(clientId || '');
    if (!id || !kind) return;
    const member = members.get(id);
    if (!member) {
      if (!live) closeMediaKind(id,kind);
      return;
    }
    member.media ??= {};
    member.media[kind] = Boolean(live);
    members.set(id,member);
    if(!live)closeMediaKind(id,kind);
    else{const key=mediaKey(id,kind),holder=incomingPeers.get(key),stream=holder?.stream;const ready=stream?.getTracks?.().some(track=>track.readyState==='live'&&track.muted===false);if(stream&&ready&&remoteStreams.get(key)!==stream){remoteStreams.set(key,stream);emitMedia('remote-stream',{clientId:id,kind,stream,member});}}
  }

  async function handleRoomMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'joined') {
      roomState.connected = true;
      roomState.connecting = false;
      roomState.clientId = String(msg.clientId || '');
      roomState.role = msg.role === 'host' ? 'host' : 'viewer';
      roomState.roomName = cleanRoomName(msg.roomName || roomState.roomName);
      roomState.roomLimit = cleanLimit(msg.roomLimit || roomState.roomLimit);
      roomState.streamLive = Boolean(msg.live);
      roomState.joinedAt = Date.now();
      roomState.error = '';
      members.clear();
      for (const raw of Array.isArray(msg.members) ? msg.members : []) {
        const id = String(raw?.clientId || '');
        if (!id) continue;
        members.set(id, {
          clientId:id,
          role:raw?.role === 'host' ? 'host' : 'viewer',
          profile:{...(raw?.profile || {})},
          voice:{micEnabled:false,speaking:false}, media:{}
        });
      }
      const joinedLifecycle = roomLifecycleToken;
      const profile = await getProfile();
      if (joinedLifecycle !== roomLifecycleToken || !roomState.connected) return;
      if (roomState.clientId && !members.has(roomState.clientId)) {
        members.set(roomState.clientId,{clientId:roomState.clientId,role:roomState.role,profile,voice:{micEnabled:mediaState.microphoneEnabled,speaking:false},media:{}});
      }
      startPingLoop();
      emitRoom('joined');
      if(roomState.role==='host')Promise.resolve().then(()=>prewarmScreenCurrentMembersV194()).catch(()=>{});
      return;
    }
    if (msg.type === 'member-joined') {
      const raw = msg.member || {};
      const id = String(raw.clientId || '');
      if (id) {
        const knownKinds=publishers.get(id) || new Set();
        const media={};
        for (const liveKind of knownKinds) media[liveKind]=true;
        members.set(id,{clientId:id,role:raw.role === 'host' ? 'host':'viewer',profile:{...(raw.profile||{})},voice:{micEnabled:false,speaking:false},media});
      }
      if(id&&id!==roomState.clientId){
        for(const liveKind of ['screen','camera','voice']){
          if(localStreams.has(liveKind))Promise.resolve().then(()=>offerMediaTo(id,liveKind)).catch(error=>emitMedia('error',{operation:'member-joined-offer',kind:liveKind,error:String(error?.message||error)}));
        }
      }
      if(id&&roomState.role==='host'&&!localStreams.has('screen'))Promise.resolve().then(()=>prewarmScreenPeerV194(id)).catch(()=>{});
      emitRoom('member-joined',{clientId:id});
      return;
    }
    if (msg.type === 'member-left') {
      const id = String(msg.clientId || msg.memberId || '');
      members.delete(id);
      for (const kind of ['screen','camera','voice']) closeMediaKind(id,kind);
      emitRoom('member-left',{clientId:id});
      return;
    }
    if (msg.type === 'profile-update') {
      const id = String(msg.clientId || '');
      const member = members.get(id);
      if (member) member.profile = {...(msg.profile || {})};
      emitRoom('profile-update',{clientId:id});
      return;
    }
    if (msg.type === 'chat') {
      const rawItem = msg.message && typeof msg.message === 'object' ? msg.message : msg;
      const item = {...rawItem};
      if (item.attachment) {
        const safeAttachment = normalizeRoomAttachment(item.attachment);
        if (safeAttachment) item.attachment = safeAttachment; else delete item.attachment;
      }
      const id = String(item?.id || '');
      if (!id || !messages.some(existing => String(existing?.id || '') === id)) {
        messages.push({...item});
        if (messages.length > 300) messages.splice(0,messages.length-300);
      }
      emitRoom('chat',{message:{...item}});
      return;
    }
    if(msg.type==='voice-state'){
      const id=String(msg.clientId||''),member=members.get(id),micEnabled=Boolean(msg.micEnabled),speaking=Boolean(msg.micEnabled&&msg.speaking);
      const micChanged=Boolean(member?.voice?.micEnabled)!==micEnabled;
      if(member)member.voice={micEnabled,speaking};
      if(micChanged)emitRoom('voice-state',{clientId:id});
      return;
    }
    if (msg.type === 'media-publisher-status') {
      const id = String(msg.clientId || '');
      const kind = normalizeKind(msg.kind);
      if (id && kind) {
        updateMemberMedia(id,kind,Boolean(msg.live));
        const set = publishers.get(id) || new Set();
        if (msg.live) set.add(kind); else set.delete(kind);
        if (set.size) publishers.set(id,set); else publishers.delete(id);
        if (kind === 'screen' && members.get(id)?.role === 'host') roomState.streamLive = Boolean(msg.live);
      }
      emitRoom('media-status',{clientId:id,kind,live:Boolean(msg.live)});
      return;
    }
    if (msg.type === 'media-subscriber-ready') {
      const subscriberId=String(msg.subscriberId||'');const kind=normalizeKind(msg.kind);const recover=Boolean(msg.recover);
      if(subscriberId&&kind&&localStreams.has(kind)){try{await offerMediaTo(subscriberId,kind,{force:recover});}catch(error){emitMedia('error',{operation:recover?'offer-recover':'offer',kind,error:String(error?.message||error)});}}
      return;
    }
    if (msg.type === 'media-signal') {
      try { await handleMediaSignal(msg); }
      catch (error) { emitMedia('error',{operation:'signal',kind:msg.kind,error:String(error?.message || error)}); }
      return;
    }
    if(msg.type==='stream-status'){
      const next=Boolean(msg.live);if(roomState.streamLive===next)return;roomState.streamLive=next;emitRoom('stream-status',{live:next});return;
    }
    if (msg.type === 'pong') {
      if (pingSentAt) roomState.pingMs = Math.max(0,Date.now()-pingSentAt);
      emitRoom('ping',{pingMs:roomState.pingMs});
      return;
    }
    if (msg.type === 'room-closed') {
      roomState.error = 'room_closed';
      emitRoom('room-closed');
      await leaveRoom({reason:'room-closed',manual:false});
      return;
    }
    if (msg.type === 'host-left') {
      roomState.streamLive = false;
      roomState.error = '';
      emitRoom('host-left',{survived:true});
      return;
    }
    if (msg.type === 'error') {
      roomState.error = String(msg.code || msg.message || 'room_error');
      roomState.connecting = false;
      emitRoom('error',{code:msg.code,message:msg.message});
    }
  }

  function startPingLoop() {
    if (pingTimer) clearInterval(pingTimer);
    const tick = () => {
      if (!roomState.connected || !socket || socket.readyState !== WebSocket.OPEN) return;
      pingSentAt = Date.now();
      sendWs({type:'ping', at:pingSentAt});
    };
    tick();
    pingTimer = setInterval(tick,5000);
  }

  async function connectRoom(options = {}) {
    const token = ++connectToken;
    await leaveRoom({reason:'switch',manual:false,preserveTarget:true});
    const roomId = cleanRoomId(options.room || options.roomId || options.nextRoomId);
    const role = options.role === 'host' || options.nextRole === 'host' ? 'host' : 'viewer';
    let signalingBase = String(options.signalingBase || options.hostEndpoint || options.nextSignalingBase || '').trim().replace(/\/$/, '');
    if (role === 'host' && !signalingBase) signalingBase = await registerSocial();
    if (!roomId) throw new Error('Código de sala inválido.');
    if (!/^https?:\/\//i.test(signalingBase)) throw new Error('Endereço da sala indisponível.');
    const profile = await getProfile();
    manualLeave = false;
    Object.assign(roomState,{
      connected:false,connecting:true,roomId,
      roomName:cleanRoomName(options.name || options.roomName || options.nextRoomName || (role === 'host' ? 'Sala de ' + profile.name : 'Sala ESTUDEX')),
      roomLimit:cleanLimit(options.limit || options.roomLimit || options.nextRoomLimit),
      role,clientId:'',signalingBase,pingMs:null,streamLive:false,joinedAt:0,error:''
    });
    members.clear(); messages.length = 0; publishers.clear();
    emitRoom('connecting');

    const wsBase = signalingBase.replace(/^http:/i,'ws:').replace(/^https:/i,'wss:');
    return new Promise((resolve,reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled || token !== connectToken) return;
        settled = true;
        try { socket?.close(); } catch {}
        roomState.connecting = false;
        roomState.error = 'join_timeout';
        emitRoom('error',{code:'join_timeout'});
        reject(new Error('Tempo esgotado ao entrar na sala.'));
      },7500);
      try { socket = new WebSocket(wsBase); }
      catch (error) { clearTimeout(timeout); roomState.connecting=false; reject(error); return; }
      const currentSocket = socket;
      currentSocket.addEventListener('open', () => {
        if (token !== connectToken) return;
        sendWs({
          type:'join', roomId, role, profile, ownerKey:socialId,
          roomName:role === 'host' ? roomState.roomName : undefined,
          roomLimit:role === 'host' ? roomState.roomLimit : undefined
        });
      });
      currentSocket.addEventListener('message', async event => {
        if (token !== connectToken) return;
        let msg = null;
        try { msg = JSON.parse(event.data); } catch { return; }
        await handleRoomMessage(msg);
        if (!settled && msg?.type === 'joined') {
          settled = true; clearTimeout(timeout); resolve(roomSnapshot());
        } else if (!settled && msg?.type === 'error') {
          settled = true; clearTimeout(timeout); reject(new Error(msg.message || msg.code || 'Não foi possível entrar na sala.'));
        }
      });
      currentSocket.addEventListener('error', () => {
        if(token!==connectToken)return;
        roomState.error='socket_error';
        roomState.connecting=false;
        emitRoom('error',{code:'socket_error'});
        if(!settled){
          settled=true;clearTimeout(timeout);
          const error=new Error('Não foi possível alcançar a sala nesse endereço.');
          error.code='socket_error';
          try{currentSocket.close();}catch{}
          reject(error);
        }
      });
      currentSocket.addEventListener('close', async () => {
        if (token !== connectToken) return;
        clearTimeout(timeout);
        if (socket === currentSocket) socket = null;
        const wasConnected = roomState.connected;
        const unexpected = !manualLeave;
        roomState.connected = false;
        roomState.connecting = false;
        roomState.pingMs = null;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;

        if (unexpected) {
          roomLifecycleToken += 1;
          for (const kind of ['screen','camera','voice']) {
            try { await stopLocalKind(kind,{announce:false}); } catch {}
          }
          closeAllPeers();
          members.clear();
          publishers.clear();
          roomState.streamLive = false;
          roomState.clientId = '';
          roomState.error = wasConnected ? 'socket_closed' : (roomState.error || 'connection_closed');
        }

        if (!settled) {
          settled = true;
          const error = new Error(unexpected ? 'A conexão com a sala foi encerrada.' : 'Entrada na sala cancelada.');
          error.code = roomState.error || 'connection_closed';
          reject(error);
        }
        emitRoom('disconnected',{manual:manualLeave,unexpected,wasConnected});
      });
    });
  }

  async function createRoom(options = {}) {
    const endpoint = estudexCloudRoomBaseV1924();
    const profile = await getProfile();
    const room = randomRoomId();
    const name = cleanRoomName(options.name || ('Sala de ' + profile.name));
    const limit = cleanLimit(options.limit);
    await connectRoom({room,role:'host',signalingBase:endpoint,name,limit});
    await saveCurrentRoom();
    return roomSnapshot();
  }

  /* ESTUDEX_V193_RECENT_ROOM_FAST_JOIN */
  async function joinRoom(input = {}) {
    if (typeof input === 'string') input = {room:input};
    const room = cleanRoomId(input.room || input.roomId);
    if (!room) throw new Error('Código de sala inválido.');

    /* Recent rooms are already durable local knowledge. Do not spend several
       seconds rediscovering LAN/Radmin before trying the endpoint we saved. */
    let candidate = null;
    if (input.hostEndpoint || input.signalingBase) candidate = normalizeSavedRoom({...input,room,role:input.role === 'host' ? 'host':'member'});
    if (!candidate) {
      const local = loadSavedCache().find(item => item.room === room) || null;
      if (local) candidate = normalizeSavedRoom(local);
    }
    if (!candidate) candidate = normalizeSavedRoom({room,role:'member',hostEndpoint:estudexCloudRoomBaseV1924(),name:'Sala ESTUDEX',limit:7,online:true,active:true});
    candidate = {...candidate, hostEndpoint:estudexCloudRoomBaseV1924()};

    const role = candidate.role === 'host' ? 'host' : 'viewer';
    let signalingBase = String(role === 'host' ? (candidate.hostEndpoint || ownEndpoint || '') : (candidate.hostEndpoint || '')).trim().replace(/\/$/, '');

    /* Only touch discovery before the first connection when the stored room
       truly lacks an endpoint. Normal recent-room entry stays instant. */
    if (!signalingBase && role === 'host') signalingBase = String(await registerSocial()).trim().replace(/\/$/, '');
    if (!signalingBase && role !== 'host') {
      try {
        const peers = await freshLanPeersV194(true);
        const live = peers.find(peer => String(peer.id || '') === String(candidate.hostId || '') || cleanRoomId(peer?.room?.room) === room);
        if (live?.endpoint) {
          candidate = {...candidate,hostId:String(live.id || candidate.hostId || ''),hostEndpoint:String(live.endpoint).replace(/\/$/, '')};
          signalingBase=candidate.hostEndpoint;
          cacheSavedRoom(candidate);
        }
      } catch {}
    }
    if (!signalingBase) throw new Error('Endereço da sala indisponível.');

    try {
      await connectRoom({room,role,signalingBase,name:candidate.name,limit:candidate.limit});
    } catch (firstError) {
      throw firstError;
    }

    if (role !== 'host') {
      const profile = await getProfile();
      cacheSavedRoom({...candidate,hostEndpoint:signalingBase,role:'member',members:[...(candidate.members||[]),{id:socialId,name:profile.name,avatar:profile.avatar}]});
      try {
        await fetchJson(signalingBase + '/api/rooms/saved/member-join', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({room,memberId:socialId,memberProfile:profile,memberEndpoint:ownEndpoint || ''})
        },3500);
      } catch {}
    }
    return roomSnapshot();
  }

  /* ESTUDEX_V193_ROOM_PERSISTENCE_LOCAL_FIRST */
  async function saveCurrentRoom() {
    if (!roomState.roomId || !roomState.role) return null;
    /* upsertSavedRoom() writes localStorage synchronously before its network sync.
       Never gate that durable local write on Radmin/social registration. */
    const profile = await getProfile();
    const host = memberSnapshot().find(item => item.role === 'host');
    return upsertSavedRoom({
      room:roomState.roomId,
      name:roomState.roomName,
      limit:roomState.roomLimit,
      role:roomState.role === 'host' ? 'host':'member',
      hostId:roomState.role === 'host' ? socialId : String(host?.profile?.id || host?.socialId || ''),
      hostName:roomState.role === 'host' ? profile.name : String(host?.profile?.name || 'Usuário'),
      hostAvatar:roomState.role === 'host' ? profile.avatar : String(host?.profile?.avatar || ''),
      hostEndpoint:roomState.signalingBase,
      members:memberSnapshot().map(item => ({id:item.profile?.id || item.clientId,name:item.profile?.name || 'Usuário',avatar:item.profile?.avatar || ''})),
      roomSize:members.size,
      active:roomState.connected,
      online:true,
      createdAt:Date.now(),updatedAt:Date.now()
    });
  }

  const ROOM_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
  const ROOM_ATTACHMENT_TYPES = /^(image|video|audio)\//i;
  function cleanAttachmentName(value, type = '') {
    let name = String(value || '').normalize?.('NFKD') || String(value || '');
    name = name.replace(/[^\x20-\x7E]+/g,'_').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,120);
    const extension = ({
      'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif','image/webp':'.webp',
      'video/webm':'.webm','video/mp4':'.mp4','audio/webm':'.webm','audio/ogg':'.ogg',
      'audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav'
    })[String(type || '').toLowerCase()] || '';
    if (!name) name = 'arquivo-' + Date.now() + extension;
    else if (extension && !/\.[a-z0-9]{2,5}$/i.test(name)) name += extension;
    return name;
  }
  /* ESTUDEX_V1010_EXACT_CHAT_MEDIA_URL */
  function normalizeRoomAttachment(value) {
    if (!value || typeof value !== 'object') return null;
    const type = String(value.mime || value.mimeType || value.contentType || value.type || '').trim().toLowerCase();
    if (!ROOM_ATTACHMENT_TYPES.test(type)) return null;
    const base = String(roomState.signalingBase || '').replace(/\/$/,'');
    const rawUrl = String(value.url || value.path || value.href || value.src || '').trim();
    if (!base || !rawUrl) return null;
    let url = '';
    try {
      const host = new URL(base);
      const parsed = new URL(rawUrl, host);
      if (parsed.origin !== host.origin || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(parsed.pathname)) return null;
      url = parsed.href;
    } catch { return null; }
    const size = Math.max(0, Number(value.size || value.bytes || 0));
    if (size > ROOM_ATTACHMENT_MAX_BYTES) return null;
    return {
      ...value,
      url,
      type,
      mime:type,
      name:cleanAttachmentName(value.name || value.fileName || value.filename || value.originalName, type),
      size
    };
  }
  async function uploadAttachment(input, options = {}) {
    if (!roomState.connected || !roomState.roomId || !roomState.signalingBase) throw new Error('Entre em uma sala antes de enviar arquivos.');
    const body = input?.blob && typeof input.blob === 'object' ? input.blob : input;
    const size = Number(body?.size || 0);
    const type = String(options.type || body?.type || '').trim().toLowerCase();
    if (!body || typeof body.arrayBuffer !== 'function') throw new Error('Arquivo inválido.');
    if (!ROOM_ATTACHMENT_TYPES.test(type)) throw new Error('Envie somente imagem, vídeo ou áudio.');
    if (size <= 0) throw new Error('O arquivo está vazio.');
    if (size > ROOM_ATTACHMENT_MAX_BYTES) throw new Error('O arquivo excede o limite de 25 MB.');
    const name = cleanAttachmentName(options.name || body?.name, type);
    const targetRoom = roomState.roomId;
    const base = String(roomState.signalingBase).replace(/\/$/,'');
    const controller = new AbortController();
    roomAttachmentControllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(base + '/api/upload?room=' + encodeURIComponent(targetRoom), {
        method:'POST',
        headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(name)},
        body,
        signal:controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        const error = new Error(data?.error || ('Falha no upload (HTTP ' + response.status + ').'));
        error.status = response.status;
        throw error;
      }
      if (!roomState.connected || roomState.roomId !== targetRoom || String(roomState.signalingBase).replace(/\/$/,'') !== base) throw new Error('A sala mudou durante o upload.');
      const attachment = normalizeRoomAttachment(data?.attachment || data);
      if (!attachment) throw new Error('O servidor retornou um anexo inválido.');
      return attachment;
    } finally { roomAttachmentControllers.delete(controller); clearTimeout(timer); }
  }
  function preferredVoiceMessageMime() {
    const candidates = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg'];
    if (typeof MediaRecorder !== 'function') return '';
    return candidates.find(type => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type)) || '';
  }
  async function startAudioMessageRecording() {
    if (!roomState.connected) throw new Error('Entre em uma sala antes de gravar áudio.');
    if (roomAudioRecorder && roomAudioRecorder.state !== 'inactive') return {recording:true,mimeType:roomAudioMime};
    if (typeof MediaRecorder !== 'function') throw new Error('Gravação de áudio não é suportada neste sistema.');
    const targetRoom = String(roomState.roomId || '');
    let stream = null;
    let pipeline = null;
    const activeVoiceTrack = localStreams.get('voice')?.getAudioTracks?.().find(track => track.readyState === 'live');
    if (activeVoiceTrack?.clone) {
      stream = new MediaStream([activeVoiceTrack.clone()]);
    } else {
      const raw = await navigator.mediaDevices.getUserMedia({audio:micConstraints(),video:false});
      const processed = await createMicPipeline(raw);
      stream = processed.stream;
      pipeline = processed.pipeline;
    }
    if (!roomState.connected || !targetRoom || String(roomState.roomId || '') !== targetRoom) {
      try { stopTracks(stream); } catch {}
      try { closePipeline(pipeline); } catch {}
      throw new Error('A sala mudou durante a abertura do microfone.');
    }
    const mimeType = preferredVoiceMessageMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? {mimeType,audioBitsPerSecond:96000} : {audioBitsPerSecond:96000});
    } catch (error) {
      try { stopTracks(stream); } catch {}
      try { closePipeline(pipeline); } catch {}
      throw error;
    }
    roomAudioRecorder = recorder;
    roomAudioRecordingStream = stream;
    roomAudioRecordingPipeline = pipeline;
    roomAudioChunks = [];
    roomAudioMime = String(recorder.mimeType || mimeType || 'audio/webm').split(';')[0] || 'audio/webm';
    recorder.addEventListener('dataavailable', event => { if (event.data?.size) roomAudioChunks.push(event.data); });
    try {
      recorder.start(250);
    } catch (error) {
      roomAudioRecorder = null;
      roomAudioChunks = [];
      roomAudioMime = '';
      releaseAudioMessageCapture();
      throw error;
    }
    emitRoom('voice-message-recording',{recording:true,mimeType:roomAudioMime});
    return {recording:true,mimeType:roomAudioMime};
  }
  function releaseAudioMessageCapture() {
    try { stopTracks(roomAudioRecordingStream); } catch {}
    try { closePipeline(roomAudioRecordingPipeline); } catch {}
    roomAudioRecordingStream = null;
    roomAudioRecordingPipeline = null;
  }
  async function stopAudioMessageRecording(options = {}) {
    const recorder = roomAudioRecorder;
    if (!recorder) return null;
    const cancel = Boolean(options.cancel);
    const chunks = roomAudioChunks;
    const type = String(roomAudioMime || recorder.mimeType || 'audio/webm').split(';')[0] || 'audio/webm';
    let stopError = null;
    if (recorder.state !== 'inactive') {
      try {
        await new Promise((resolve,reject) => {
          const done = () => { cleanup(); resolve(); };
          const fail = event => { cleanup(); reject(event?.error || new Error('Falha ao finalizar a gravação.')); };
          const cleanup = () => { recorder.removeEventListener('stop',done); recorder.removeEventListener('error',fail); };
          recorder.addEventListener('stop',done,{once:true});
          recorder.addEventListener('error',fail,{once:true});
          try { recorder.stop(); } catch (error) { cleanup(); reject(error); }
        });
      } catch (error) { stopError = error; }
    }
    roomAudioRecorder = null;
    roomAudioChunks = [];
    roomAudioMime = '';
    releaseAudioMessageCapture();
    emitRoom('voice-message-recording',{recording:false});
    if (stopError) throw stopError;
    if (cancel) return null;
    const blob = new Blob(chunks,{type});
    if (!blob.size) throw new Error('A gravação ficou vazia.');
    return uploadAttachment(blob,{type,name:'mensagem-de-voz-' + Date.now() + (type.includes('ogg')?'.ogg':'.webm')});
  }
  async function cancelAudioMessageRecording() {
    try { return await stopAudioMessageRecording({cancel:true}); }
    catch { roomAudioRecorder=null; roomAudioChunks=[]; roomAudioMime=''; releaseAudioMessageCapture(); return null; }
  }

  async function sendChat(input) {
    if (!roomState.connected) throw new Error('Você não está em uma sala.');
    const text = String(typeof input === 'string' ? input : input?.text || '').replace(/\r/g,'').trim().slice(0,500);
    const attachment = typeof input === 'object' && input?.attachment ? normalizeRoomAttachment(input.attachment) : undefined;
    if (input && typeof input === 'object' && input.attachment && !attachment) throw new Error('Anexo inválido.');
    if (!text && !attachment) return false;
    return sendWs({type:'chat',text,attachment});
  }

  async function resolveFriend(input,{deep=false}={}) {
    const id=String(input?.id||input||'').trim();
    const raw=safeJson(localStorage.getItem(FRIENDS_KEY)||'[]',[]);
    const stored=(Array.isArray(raw)?raw:[]).find(item=>String(item?.id||'')===id)||(input&&typeof input==='object'?input:null);
    const cached=lanPeerCacheV194.items.find(peer=>String(peer?.id||'')===id);
    if(cached?.endpoint){healStoredFriendEndpointV194(cached);return {...(stored||{}),...cached,id,endpoint:String(cached.endpoint).replace(/\/$/,''),online:isPublicOnlineV194(cached.status||stored?.status)};}
    if(stored?.endpoint&&!deep)return {...stored,id,endpoint:String(stored.endpoint).replace(/\/$/,'')};
    let peers=[];
    try{peers=await freshLanPeersV194(Boolean(deep));}catch{}
    const live=peers.find(peer=>String(peer?.id||'')===id);
    if(live?.endpoint){healStoredFriendEndpointV194(live);return {...(stored||{}),...live,id,endpoint:String(live.endpoint).replace(/\/$/,''),online:isPublicOnlineV194(live.status||stored?.status)};}
    return stored||null;
  }
  async function sendInvite(input) {
    if(!roomState.connected||roomState.role!=='host')throw new Error('Somente o criador da sala pode enviar convites.');
    await registerSocial();
    const deliver=friend=>fetchJson('/api/social/room-invite/send',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:socialId,friendId:String(friend.id),friendEndpoint:String(friend.endpoint).replace(/\/$/,''),room:roomState.roomId,roomName:roomState.roomName,roomLimit:roomState.roomLimit})
    },8500);
    let friend=await resolveFriend(input,{deep:false});
    if(!friend?.id||!friend?.endpoint)friend=await resolveFriend(input,{deep:true});
    if(!friend?.id||!friend?.endpoint)throw new Error('Amigo indisponível.');
    try{return await deliver(friend);}
    catch(firstError){
      const healed=await resolveFriend(friend.id,{deep:true});
      if(!healed?.endpoint||String(healed.endpoint)===String(friend.endpoint))throw firstError;
      return deliver(healed);
    }
  }

  async function recoverRemoteMediaV194(peerId,kind='screen'){
    const id=String(peerId||'');kind=normalizeKind(kind);if(!roomState.connected||!id||!kind||id===String(roomState.clientId||''))return false;
    const key=mediaKey(id,kind);closePeer(incomingPeers,key);if(remoteStreams.has(key)){remoteStreams.delete(key);emitMedia('remote-stream-ended',{clientId:id,kind,recovering:true});}
    return sendWs({type:'media-recover-request',publisherId:id,kind});
  }

  async function stopLocalKind(kind, {announce = true} = {}) {
    kind = normalizeKind(kind);
    if (kind) localCaptureTokens[kind] = Number(localCaptureTokens[kind] || 0) + 1;
    const stream = localStreams.get(kind);
    if (stream) stopTracks(stream);
    localStreams.delete(kind);
    for (const key of [...outgoingPeers.keys()]) if (key.endsWith(':' + kind)) closePeer(outgoingPeers,key);
    if (announce && roomState.connected) sendWs({type:'media-status',kind,live:false});
    if (kind === 'screen') {
      activeScreenSourceId = '';
      mediaState.screenShareEnabled = false;
      if (roomState.role === 'host' && roomState.connected) sendWs({type:'stream-status',live:false});
    }
    if (kind === 'camera') mediaState.cameraEnabled = false;
    if (kind === 'voice') {
      mediaState.microphoneEnabled = false;
      micSpeaking = false;
      if (micVadTimer) clearInterval(micVadTimer);
      micVadTimer = null;
      closePipeline(micPipeline);
      micPipeline = null;
      if (roomState.connected) sendWs({type:'voice-state',micEnabled:false,speaking:false});
    }
    emitMedia('local-stopped',{kind});
  }

  async function closeRoom() {
    if (!roomState.connected || roomState.role !== 'host') throw new Error('Somente o dono pode encerrar a sala.');
    if (!sendWs({type:'close-room', ownerKey:socialId})) throw new Error('A conexão com a sala está indisponível.');
    return true;
  }

  async function leaveRoom(options = {}) {
    const preserveTarget = Boolean(options.preserveTarget);
    const leavingOwnedRoom = !preserveTarget && roomState.role === 'host' && roomState.roomId ? {
      room:roomState.roomId,
      name:roomState.roomName,
      limit:roomState.roomLimit,
      role:'host',
      hostEndpoint:roomState.signalingBase,
      online:false,
      active:false,
      roomSize:0,
      updatedAt:Date.now()
    } : null;
    roomLifecycleToken += 1;
    manualLeave = options.manual !== false;
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    for (const controller of [...roomAttachmentControllers]) { try { controller.abort(); } catch {} }
    roomAttachmentControllers.clear();
    if (roomAudioRecorder) await cancelAudioMessageRecording();
    for (const kind of ['screen','camera','voice']) await stopLocalKind(kind,{announce:true});
    closeAllPeers();
    try { socket?.close(); } catch {}
    socket = null;
    members.clear(); messages.length = 0; publishers.clear();
    if (!preserveTarget) {
      Object.assign(roomState,{connected:false,connecting:false,roomId:'',roomName:'',roomLimit:6,role:'',clientId:'',signalingBase:'',pingMs:null,streamLive:false,joinedAt:0,error:options.reason || ''});
      emitRoom('left',{reason:options.reason || 'manual'});
    } else {
      roomState.connected=false; roomState.connecting=false; roomState.clientId=''; roomState.pingMs=null;
    }
    /* Leaving is not deleting. Keep the owned room in the durable local list
       immediately; live/survival status is reconciled independently afterward. */
    if (leavingOwnedRoom) cacheSavedRoom(leavingOwnedRoom);
    return true;
  }

  function micConstraints() {
    return {
      echoCancellation:Boolean(mediaState.echoCancellation),
      noiseSuppression:Boolean(mediaState.noiseSuppression),
      autoGainControl:mediaState.microphoneProfile === 'isolation' ? Boolean(mediaState.autoGainControl) : false,
      channelCount:1,
      ...(mediaState.microphoneDeviceId ? {deviceId:{exact:mediaState.microphoneDeviceId}} : {})
    };
  }
  async function createMicPipeline(raw) {
    const AudioCtx = root.AudioContext || root.webkitAudioContext;
    if (!AudioCtx || !raw?.getAudioTracks?.().length) return {stream:raw,pipeline:null};
    const context = new AudioCtx();
    try { await context.resume(); } catch {}
    const source = context.createMediaStreamSource(raw);
    const highpass = context.createBiquadFilter();
    highpass.type='highpass'; highpass.frequency.value=mediaState.microphoneProfile === 'isolation' ? 95 : 70; highpass.Q.value=.7;
    const lowpass = context.createBiquadFilter();
    lowpass.type='lowpass'; lowpass.frequency.value=12500; lowpass.Q.value=.5;
    const compressor = context.createDynamicsCompressor();
    if (mediaState.microphoneProfile === 'isolation') {
      compressor.threshold.value=-42; compressor.knee.value=24; compressor.ratio.value=4.5; compressor.attack.value=.004; compressor.release.value=.18;
    } else {
      compressor.threshold.value=-28; compressor.knee.value=16; compressor.ratio.value=2.2; compressor.attack.value=.006; compressor.release.value=.22;
    }
    const analyser = context.createAnalyser(); analyser.fftSize=512; analyser.smoothingTimeConstant=.58;
    const gate = context.createGain(); gate.gain.value=1;
    const gain = context.createGain(); gain.gain.value=Math.max(0,Math.min(100,Number(mediaState.microphoneVolume)||0))/100;
    const destination = context.createMediaStreamDestination();
    source.connect(highpass); highpass.connect(lowpass); lowpass.connect(compressor); compressor.connect(analyser); compressor.connect(gate); gate.connect(gain); gain.connect(destination);
    return {stream:new MediaStream([destination.stream.getAudioTracks()[0]]),pipeline:{context,source,highpass,lowpass,compressor,analyser,gate,gain,raw}};
  }

  function startVad() {
    if (micVadTimer) clearInterval(micVadTimer);
    if (!micPipeline?.analyser) return;
    const data = new Uint8Array(micPipeline.analyser.fftSize);
    let hotFrames=0,coldFrames=0,noiseFloor=.004,level=0;
    micVadTimer = setInterval(() => {
      if (!mediaState.microphoneEnabled || !roomState.connected) return;
      try {
        micPipeline.analyser.getByteTimeDomainData(data);
        let sum=0;
        for (let i=0;i<data.length;i+=1) { const sample=(data[i]-128)/128; sum += sample*sample; }
        const rms=Math.sqrt(sum/data.length); level=level*.58+rms*.42;
        const sensitivity=Math.max(0,Math.min(100,mediaState.microphoneSensitivity))/100;
        const threshold=mediaState.microphoneProfile === 'custom' ? .0042+Math.pow(1-sensitivity,1.65)*.0218 : Math.max(.007,Math.min(.032,noiseFloor*1.9+.0027));
        const hot=level>threshold;
        if (!hot && !micSpeaking && mediaState.microphoneProfile === 'isolation') noiseFloor=Math.max(.0025,Math.min(.018,noiseFloor*.94+level*.06));
        if (hot) { hotFrames+=1; coldFrames=0; } else { coldFrames+=1; hotFrames=0; }
        let next=micSpeaking;
        if (!next && (hotFrames>=2 || level>threshold*1.45)) next=true;
        if (next && coldFrames>=6) next=false;
        if (next !== micSpeaking) {
          micSpeaking=next;
          sendWs({type:'voice-state',micEnabled:true,speaking:micSpeaking});
          emitMedia('voice-activity',{speaking:micSpeaking,level,threshold});
        }
      } catch {}
    },45);
  }

  async function setMicrophoneEnabled(value) {
    const enabled=Boolean(value);
    if (!enabled) { await stopLocalKind('voice'); return mediaSnapshot(); }
    if (!roomState.connected) throw new Error('Entre em uma sala antes de ativar o microfone.');
    await stopLocalKind('voice',{announce:false});
    const captureToken=++localCaptureTokens.voice;
    const captureLifecycle=roomLifecycleToken;
    const captureRoomId=roomState.roomId;
    const captureClientId=roomState.clientId;
    const raw=await navigator.mediaDevices.getUserMedia({audio:micConstraints(),video:false});
    if (captureToken !== localCaptureTokens.voice || !currentRoomCapture(captureLifecycle,captureRoomId,captureClientId)) { stopTracks(raw); throw new Error('A sala mudou durante a abertura do microfone.'); }
    let processed;
    try { processed=await createMicPipeline(raw); }
    catch (error) { stopTracks(raw); throw error; }
    if (captureToken !== localCaptureTokens.voice || !currentRoomCapture(captureLifecycle,captureRoomId,captureClientId)) { stopTracks(processed.stream); closePipeline(processed.pipeline); throw new Error('A sala mudou durante o processamento do microfone.'); }
    localStreams.set('voice',processed.stream);
    micPipeline=processed.pipeline;
    mediaState.microphoneEnabled=true;
    sendWs({type:'media-status',kind:'voice',live:true});
    sendWs({type:'voice-state',micEnabled:true,speaking:false});
    offerLiveKindToCurrentMembersV194('voice').catch(error=>emitMedia('error',{operation:'existing-members-offer',kind:'voice',error:String(error?.message||error)}));
    startVad();
    emitMedia('local-started',{kind:'voice',stream:processed.stream});
    return mediaSnapshot();
  }

  async function setCameraEnabled(value) {
    const enabled=Boolean(value);
    if (!enabled) { await stopLocalKind('camera'); return mediaSnapshot(); }
    if (!roomState.connected) throw new Error('Entre em uma sala antes de ativar a câmera.');
    await stopLocalKind('camera',{announce:false});
    const captureToken=++localCaptureTokens.camera;
    const captureLifecycle=roomLifecycleToken;
    const captureRoomId=roomState.roomId;
    const captureClientId=roomState.clientId;
    const q=mediaState.quality;
    const stream=await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{width:{ideal:q===1440?2560:(q===1080?1920:1280)},height:{ideal:q===1440?1440:(q===1080?1080:720)},frameRate:{ideal:mediaState.fps,max:mediaState.fps},...(mediaState.cameraDeviceId?{deviceId:{exact:mediaState.cameraDeviceId}}:{})}
    });
    if (captureToken !== localCaptureTokens.camera || !currentRoomCapture(captureLifecycle,captureRoomId,captureClientId)) { stopTracks(stream); throw new Error('A sala mudou durante a abertura da câmera.'); }
    localStreams.set('camera',stream);
    mediaState.cameraEnabled=true;
    stream.getVideoTracks()[0]?.addEventListener?.('ended',()=>stopLocalKind('camera'),{once:true});
    sendWs({type:'media-status',kind:'camera',live:true});
    offerLiveKindToCurrentMembersV194('camera').catch(error=>emitMedia('error',{operation:'existing-members-offer',kind:'camera',error:String(error?.message||error)}));
    emitMedia('local-started',{kind:'camera',stream});
    return mediaSnapshot();
  }

  async function listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices=await navigator.mediaDevices.enumerateDevices();
    return devices.map((device,index)=>({
      id:String(device.deviceId || ''),
      groupId:String(device.groupId || ''),
      kind:String(device.kind || ''),
      label:String(device.label || ({audioinput:'Microfone',audiooutput:'Saída',videoinput:'Câmera'}[device.kind] || 'Dispositivo') + ' ' + (index+1))
    }));
  }
  async function listCaptureSources() {
    const sources=await root.EstudexNative?.media?.getCaptureSources?.();
    return (Array.isArray(sources)?sources:[]).map(source=>({
      id:String(source?.id || ''),
      captureIds:Array.isArray(source?.captureIds)?source.captureIds.map(String):[String(source?.id || '')].filter(Boolean),
      name:String(source?.name || source?.label || 'Fonte'),
      label:String(source?.label || source?.name || 'Fonte'),
      thumbnail:typeof source?.thumbnail === 'string' ? source.thumbnail : '',
      kind:source?.kind === 'screen' ? 'screen':'window',
      displayId:String(source?.displayId || ''),
      displayIndex:Number.isFinite(Number(source?.displayIndex)) ? Number(source.displayIndex) : null,
      width:Number(source?.width || 0), height:Number(source?.height || 0),
      x:Number(source?.x || 0), y:Number(source?.y || 0),
      isPrimary:Boolean(source?.isPrimary), synthetic:Boolean(source?.synthetic), detectedByWindows:Boolean(source?.detectedByWindows)
    })).filter(source=>source.id);
  }

  /* ESTUDEX_V1010_EXACT_MEDIA_CAPABILITIES */
  async function pickCaptureSource() {
    const source = await root.EstudexNative?.media?.pickCaptureSource?.();
    return source && source.id ? source : null;
  }

  async function startScreenShare(sourceInput) {
    if (!roomState.connected) throw new Error('Entre em uma sala antes de compartilhar a tela.');
    /* ESTUDEX_V193_HOTFIX14_SOURCE_METADATA_V2 */
    const sourceMeta=sourceInput&&typeof sourceInput==='object'?sourceInput:null;
    let sourceId=String(sourceMeta?.id||sourceInput||'').trim();
    if(!sourceId)throw new Error('Escolha uma tela ou janela para compartilhar.');
    mediaState.screenSourceKind=sourceMeta?.kind==='window'?'window':'screen';
    mediaState.screenSourceName=String(sourceMeta?.name||sourceMeta?.label||'').slice(0,160);
    await stopLocalKind('screen',{announce:false});
    const captureToken=++localCaptureTokens.screen;
    const captureLifecycle=roomLifecycleToken;
    const captureRoomId=roomState.roomId;
    const captureClientId=roomState.clientId;
    const q=mediaState.quality;
    const mandatory={chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxWidth:q===1440?2560:(q===1080?1920:1280),maxHeight:q===1440?1440:(q===1080?1080:720),maxFrameRate:mediaState.fps};
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory}});
    if(captureToken!==localCaptureTokens.screen||!currentRoomCapture(captureLifecycle,captureRoomId,captureClientId)){stopTracks(stream);throw new Error('A sala mudou durante a abertura da transmissão.');}
    await estudexAttachSystemAudioV1925(stream, mediaState.audioEnabled);
    activeScreenSourceId=sourceId;
    localStreams.set('screen',stream);
    mediaState.screenShareEnabled=true;
    const videoTrack=stream.getVideoTracks()[0];
    videoTrack?.addEventListener?.('ended',()=>stopScreenShare(),{once:true});
    sendWs({type:'media-status',kind:'screen',live:true});
    if (roomState.role === 'host') sendWs({type:'stream-status',live:true});
    offerLiveKindToCurrentMembersV194('screen').catch(error=>emitMedia('error',{operation:'existing-members-offer',kind:'screen',error:String(error?.message||error)}));
    emitMedia('local-started',{kind:'screen',stream,sourceId});
    return mediaSnapshot();
  }
  async function stopScreenShare() { await stopLocalKind('screen'); return mediaSnapshot(); }

  function setAudioEnabled(value) {
    mediaState.audioEnabled=Boolean(value);
    const screen=localStreams.get('screen');
    for (const track of screen?.getAudioTracks?.() || []) track.enabled=mediaState.audioEnabled;
    emitMedia('state',{reason:'audio'});
    return mediaSnapshot();
  }
  function setMicrophoneVolume(value) {
    const next=Math.max(0,Math.min(100,Number(value)||0));
    mediaState.microphoneVolume=next;
    localStorage.setItem(MIC_VOLUME_KEY,String(next));
    try { if (micPipeline?.gain) micPipeline.gain.gain.setTargetAtTime(next/100,micPipeline.context.currentTime,.012); } catch {}
    emitMedia('state',{reason:'microphone-volume'});
    return mediaSnapshot();
  }
  function setOutputVolume(value) {
    const next=Math.max(0,Math.min(200,Number(value)||0));
    mediaState.outputVolume=next;
    localStorage.setItem(OUTPUT_VOLUME_KEY,String(next));
    emitMedia('state',{reason:'output-volume'});
    return mediaSnapshot();
  }
  async function setMicrophoneProfile(value) {
    const next=value === 'custom' ? 'custom':'isolation';
    mediaState.microphoneProfile=next;
    localStorage.setItem(MIC_PROFILE_KEY,next);
    if (mediaState.microphoneEnabled) await setMicrophoneEnabled(true);
    emitMedia('state',{reason:'microphone-profile'});
    return mediaSnapshot();
  }
  function setMicrophoneSensitivity(value) {
    const next=Math.max(0,Math.min(100,Number(value)||0));
    mediaState.microphoneSensitivity=next;
    localStorage.setItem(MIC_SENSITIVITY_KEY,String(next));
    emitMedia('state',{reason:'microphone-sensitivity'});
    return mediaSnapshot();
  }
  async function setEchoCancellation(value) {
    mediaState.echoCancellation=Boolean(value);
    localStorage.setItem(ECHO_KEY,mediaState.echoCancellation?'1':'0');
    if (mediaState.microphoneEnabled) await setMicrophoneEnabled(true);
    emitMedia('state',{reason:'echo-cancellation'});
    return mediaSnapshot();
  }
  async function setNoiseSuppression(value) {
    mediaState.noiseSuppression=Boolean(value);
    localStorage.setItem(NOISE_KEY,mediaState.noiseSuppression?'1':'0');
    if (mediaState.microphoneEnabled) await setMicrophoneEnabled(true);
    emitMedia('state',{reason:'noise-suppression'});
    return mediaSnapshot();
  }
  async function setAutoGainControl(value) {
    mediaState.autoGainControl=Boolean(value);
    localStorage.setItem(AUTOGAIN_KEY,mediaState.autoGainControl?'1':'0');
    if (mediaState.microphoneEnabled) await setMicrophoneEnabled(true);
    emitMedia('state',{reason:'auto-gain-control'});
    return mediaSnapshot();
  }

  async function setMicrophoneDevice(value) {
    mediaState.microphoneDeviceId=String(value || '');
    localStorage.setItem(MIC_DEVICE_KEY,mediaState.microphoneDeviceId);
    localStorage.setItem('blazerx-mic-device',mediaState.microphoneDeviceId);
    if (mediaState.microphoneEnabled) await setMicrophoneEnabled(true);
    emitMedia('state',{reason:'microphone-device'}); return mediaSnapshot();
  }
  function setAudioOutputDevice(value) {
    mediaState.audioOutputDeviceId=String(value || '');
    localStorage.setItem(OUTPUT_DEVICE_KEY,mediaState.audioOutputDeviceId);
    localStorage.setItem('blazerx-audio-output',mediaState.audioOutputDeviceId);
    emitMedia('state',{reason:'audio-output-device'}); return mediaSnapshot();
  }
  async function setCameraDevice(value) {
    const previewWasActive=Boolean(cameraPreviewStream);
    mediaState.cameraDeviceId=String(value || ''); localStorage.setItem(CAMERA_DEVICE_KEY,mediaState.cameraDeviceId);
    if (mediaState.cameraEnabled) await setCameraEnabled(true);
    if (previewWasActive) await startCameraPreview();
    emitMedia('state',{reason:'camera-device'}); return mediaSnapshot();
  }
  async function setQuality(value) {
    const previewWasActive=Boolean(cameraPreviewStream);
    const screenSource=mediaState.screenShareEnabled ? activeScreenSourceId : '';
    const parsed=Number(value); const next=[720,1080,1440].includes(parsed)?parsed:1080; mediaState.quality=next; localStorage.setItem(QUALITY_KEY,String(next));
    if (mediaState.cameraEnabled) await setCameraEnabled(true);
    if (previewWasActive) await startCameraPreview();
    if (screenSource) await startScreenShare(screenSource);
    emitMedia('state',{reason:'quality'}); return mediaSnapshot();
  }
  async function setFps(value) {
    const previewWasActive=Boolean(cameraPreviewStream);
    const screenSource=mediaState.screenShareEnabled ? activeScreenSourceId : '';
    const parsed=Number(value); const next=[24,30,60].includes(parsed)?parsed:60; mediaState.fps=next; localStorage.setItem(FPS_KEY,String(next));
    if (mediaState.cameraEnabled) await setCameraEnabled(true);
    if (previewWasActive) await startCameraPreview();
    if (screenSource) await startScreenShare(screenSource);
    emitMedia('state',{reason:'fps'}); return mediaSnapshot();
  }

  async function startCameraPreview() {
    await stopCameraPreview();
    const captureToken=++previewCaptureToken;
    const activeTrack=localStreams.get('camera')?.getVideoTracks?.().find(track=>track.readyState==='live');
    const q=mediaState.quality;
    const stream=activeTrack?.clone ? new MediaStream([activeTrack.clone()]) : await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:q===1440?2560:(q===1080?1920:1280)},height:{ideal:q===1440?1440:(q===1080?1080:720)},frameRate:{ideal:mediaState.fps,max:mediaState.fps},...(mediaState.cameraDeviceId?{deviceId:{exact:mediaState.cameraDeviceId}}:{})}});
    if (captureToken !== previewCaptureToken) { stopTracks(stream); throw new Error('A prévia da câmera foi fechada durante a abertura.'); }
    cameraPreviewStream=stream;
    emitMedia('preview-started',{stream:cameraPreviewStream});
    return cameraPreviewStream;
  }
  async function stopCameraPreview() {
    previewCaptureToken += 1;
    if (cameraPreviewStream) stopTracks(cameraPreviewStream);
    cameraPreviewStream=null;
    emitMedia('preview-stopped');
    return true;
  }

  root.__estudexCleanroomRoomMediaAdapters = Object.freeze({
    rooms:Object.freeze({
      listLan:listLanRooms,
      listSaved:listSavedRooms,
      create:createRoom,
      join:joinRoom,
      close:closeOwnedRoom,
      deleteSaved:deleteSavedRoom,
      saveCurrent:saveCurrentRoom,
      onChange:fn=>subscribe(roomsListeners,fn)
    }),
    room:Object.freeze({
      getState:()=>roomSnapshot(),
      close:closeRoom,
      leave:()=>leaveRoom({reason:'manual',manual:true}),
      listMembers:()=>memberSnapshot(),
      sendChat,
      uploadAttachment,
      startAudioMessageRecording,
      stopAudioMessageRecording,
      cancelAudioMessageRecording,
      sendInvite,
      onChange:fn=>subscribe(roomListeners,fn)
    }),
    media:Object.freeze({
      getState:()=>mediaSnapshot(),
      listDevices,
      listCaptureSources,
      pickCaptureSource,
      setMicrophoneEnabled,
      setAudioEnabled,
      setCameraEnabled,
      setMicrophoneDevice,
      setAudioOutputDevice,
      setCameraDevice,
      setMicrophoneVolume,
      setOutputVolume,
      setMicrophoneProfile,
      setMicrophoneSensitivity,
      setEchoCancellation,
      setNoiseSuppression,
      setAutoGainControl,
      setQuality,
      setFps,
      startScreenShare,
      stopScreenShare,
      startCameraPreview,
      stopCameraPreview,
      recoverRemote:recoverRemoteMediaV194,
      onChange:fn=>subscribe(mediaListeners,fn)
    })
  });
})();

/* ESTUDEX_V190_CLEANROOM_UPDATER_ADAPTER */
(() => {
  'use strict';

  const root = globalThis;
  const listeners = new Set();
  let state = {
    currentVersion:'',
    checking:false,
    available:false,
    version:'',
    packaged:false,
    error:''
  };
  let nativeUnsubscribe = null;

  const snapshot = () => ({...state});
  const emit = (type, extra = {}) => {
    const payload = {type, state:snapshot(), ...extra};
    for (const fn of [...listeners]) {
      try { fn(payload); } catch {}
    }
  };
  const merge = value => {
    state = {
      ...state,
      ...(value && typeof value === 'object' ? value : {}),
      currentVersion:String(value?.currentVersion ?? state.currentVersion ?? ''),
      version:String(value?.version ?? state.version ?? ''),
      checking:Boolean(value?.checking),
      available:Boolean(value?.available),
      packaged:Boolean(value?.packaged),
      error:String(value?.error || '')
    };
    return snapshot();
  };

  async function getState() {
    try {
      const result = await root.EstudexNative?.updater?.getState?.();
      merge(result);
    } catch (error) {
      state.error = String(error?.message || error || 'update_state_error');
    }
    return snapshot();
  }

  async function check() {
    state.checking = true;
    state.error = '';
    emit('checking');
    try {
      const result = await root.EstudexNative?.updater?.check?.();
      merge(result);
      emit(state.available ? 'available' : 'checked');
      return snapshot();
    } catch (error) {
      state.checking = false;
      state.error = String(error?.message || error || 'update_check_error');
      emit('error',{error:state.error});
      throw error;
    }
  }

  async function install() {
    if (!state.available) await getState();
    if (!state.available) throw new Error('Nenhuma atualização pronta para instalar.');
    emit('installing');
    const result = await root.EstudexNative?.updater?.install?.();
    if (!result?.ok) {
      const error = new Error('Não foi possível iniciar a instalação da atualização.');
      state.error = error.message;
      emit('error',{error:error.message});
      throw error;
    }
    return result;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  try {
    nativeUnsubscribe = root.EstudexNative?.updater?.onReady?.(async payload => {
      try {
        await getState();
        if (payload?.version && !state.version) state.version = String(payload.version);
        state.available = true;
        emit('available',{version:state.version || String(payload?.version || '')});
      } catch {}
    }) || null;
  } catch {}

  root.addEventListener?.('unload', () => {
    try { nativeUnsubscribe?.(); } catch {}
  }, {once:true});

  root.__estudexCleanroomUpdaterAdapters = Object.freeze({
    updater:Object.freeze({getState,check,install,onChange})
  });

  getState().then(() => emit('ready')).catch(() => {});
})();

/* ESTUDEX_V190_CLEANROOM_ENGINE_FACADE */
(() => {
  'use strict';

  const root = globalThis;
  const registries = () => [
    root.__estudexCleanroomAdapters,
    root.__estudexCleanroomNativeAdapters,
    root.__estudexCleanroomRoomMediaAdapters,
    root.__estudexCleanroomUpdaterAdapters,
    root.__estudexSpecAdapters
  ].filter(Boolean);

  const invoke = (domain, method, ...args) => {
    for (const registry of registries()) {
      const fn = registry?.[domain]?.[method];
      if (typeof fn === 'function') return fn(...args);
    }
    const error = new Error(`ESTUDEX cleanroom engine adapter missing: ${domain}.${method}`);
    error.code = 'ESTUDEX_ENGINE_ADAPTER_MISSING';
    throw error;
  };

  const domain = (name, methods) => Object.freeze(Object.fromEntries(
    methods.map(method => [method, (...args) => invoke(name, method, ...args)])
  ));

  const api = Object.freeze({
    version: '1.9-cleanroom',
    profile: domain('profile', ['get','save','onChange']),
    appearance: domain('appearance', ['get','setAccent','setLobbyImage','setLobbyImageEnabled','reset']),
    radmin: domain('radmin', ['getState','refresh','listPeers','ensureReady','onChange']),
    social: domain('social', ['listFriends','listPending','listBlocked','sendFriendRequest','acceptFriendRequest','dismissPending','removeFriend','block','unblock','getPublicProfile','onChange']),
    dm: domain('dm', ['listThreads','getThread','send','markRead','onChange']),
    rooms: domain('rooms', ['listLan','listSaved','create','join','close','deleteSaved','saveCurrent','onChange']),
    room: domain('room', ['getState','close','leave','listMembers','sendChat','uploadAttachment','startAudioMessageRecording','stopAudioMessageRecording','cancelAudioMessageRecording','sendInvite','onChange']),
    media: domain('media', ['getState','listDevices','listCaptureSources','pickCaptureSource','setMicrophoneEnabled','setAudioEnabled','setCameraEnabled','setMicrophoneDevice','setAudioOutputDevice','setCameraDevice','setMicrophoneVolume','setOutputVolume','setMicrophoneProfile','setMicrophoneSensitivity','setEchoCancellation','setNoiseSuppression','setAutoGainControl','setQuality','setFps','startScreenShare','stopScreenShare','startCameraPreview','stopCameraPreview','onChange']),
    updater: domain('updater', ['getState','check','install','onChange']),
    calls: domain('calls', ['getState','start','accept','reject','end','setMicrophoneEnabled','setAudioEnabled','setCameraEnabled','startScreenShare','stopScreenShare','onChange'])
  });

  Object.defineProperty(root, 'EstudexEngine', {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false
  });
})();


/* ESTUDEX_V193_SPEC_DIRECT_CALL_ENGINE */
(function specCallsRuntime(){
  'use strict';
  const root=globalThis;
  const callTypes=new Set(['call-invite','call-answer','call-offer','call-ice','call-reject','call-end']);
  const listeners=new Set();
  const clean=value=>String(value??'').trim();
  const ownSocialId=()=>clean(root.EstudexCloudSocial?.getUser?.()?.id||localStorage.getItem('estudex-social-id-v1'));
  const baseSocial=()=>root.__estudexCleanroomAdapters?.social;
  const cloudSocial=()=>root.EstudexCloudSocial;
  const profileApi=()=>root.__estudexCleanroomAdapters?.profile;
  const mediaApi=()=>root.EstudexEngine?.media;
  const state={status:'idle',callId:'',peerId:'',peerName:'',peerAvatar:'',mode:'voice',direction:'',microphoneEnabled:false,audioEnabled:true,cameraEnabled:false,screenShareEnabled:false,startedAt:0,error:''};
  let peer=null,peerEndpoint='',pendingInvite=null,pollBusy=false,ownEndpointCache='';
  let micStream=null,cameraStream=null,screenStream=null,remoteStream=null;
  let micRawStream=null,micAudioContext=null,micGainNode=null;
  let makingOffer=false,ignoreNegotiation=false,ignoredOffer=false,localSignalReady=false;
  let callRecoveryTimer=null,callRecoveryCount=0;
  const queuedRemoteIce=[],queuedLocalIce=[];
  const processedCloudCallEvents=new Set();

  const snapshot=()=>({...state,remoteStream,localCameraStream:cameraStream,localScreenStream:screenStream});
  const emit=(type,extra={})=>{const event={type,state:snapshot(),...extra};for(const fn of [...listeners]){try{fn(event);}catch{}}};
  const subscribe=fn=>{if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);};
  const uuid=()=>{try{return crypto.randomUUID();}catch{return 'call-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}};
  const friendById=id=>(cloudSocial()?.getCachedFriends?.()||[]).find(item=>clean(item?.id)===clean(id))||null;
  const stopStream=stream=>{for(const track of stream?.getTracks?.()||[]){try{track.stop();}catch{}}};

  async function ownEndpoint(){ return state.base||''; }

  async function send(peerId,type,payload,_endpointOverride=''){
    const api=cloudSocial();
    if(!api?.sendSocialEvent)throw new Error('Backend online indisponível.');
    return api.sendSocialEvent(clean(peerId),type,payload||{});
  }

  async function ack(ids){
    if(!ids.length)return;
    try{await cloudSocial()?.ackSocialEvents?.(ids);}catch{}
  }

  function removeSenders(stream){
    if(!peer||!stream)return;
    const tracks=new Set(stream.getTracks?.()||[]);
    for(const sender of peer.getSenders?.()||[])if(sender.track&&tracks.has(sender.track)){try{peer.removeTrack(sender);}catch{}}
  }
  function addStream(stream){if(!peer||!stream)return;for(const track of stream.getTracks())peer.addTrack(track,stream);}
  function closePeer(){if(callRecoveryTimer){clearTimeout(callRecoveryTimer);callRecoveryTimer=null;}callRecoveryCount=0;if(peer){try{peer.onicecandidate=peer.ontrack=peer.onconnectionstatechange=peer.onnegotiationneeded=null;}catch{}try{peer.close();}catch{}}peer=null;makingOffer=false;ignoreNegotiation=false;ignoredOffer=false;localSignalReady=false;queuedRemoteIce.length=0;queuedLocalIce.length=0;}
  function closeMedia(){
    stopStream(micStream);
    if(micRawStream&&micRawStream!==micStream)stopStream(micRawStream);
    stopStream(cameraStream);stopStream(screenStream);
    try{micAudioContext?.close?.();}catch{}
    micStream=cameraStream=screenStream=micRawStream=null;
    micAudioContext=micGainNode=null;remoteStream=null;
  }
  function reset(reason=''){Object.assign(state,{status:'idle',callId:'',peerId:'',peerName:'',peerAvatar:'',mode:'voice',direction:'',microphoneEnabled:false,audioEnabled:true,cameraEnabled:false,screenShareEnabled:false,startedAt:0,error:reason||''});peerEndpoint='';pendingInvite=null;ownEndpointCache='';}
  function cleanup(reason='',type='ended'){closePeer();closeMedia();reset(reason);emit(type,{reason});}

  function prefs(){try{return mediaApi()?.getState?.()||{};}catch{return{};}}
  async function captureMic(){
    if(micStream)return micStream;
    const p=prefs();
    const raw=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:p.echoCancellation!==false,noiseSuppression:p.noiseSuppression!==false,autoGainControl:p.autoGainControl!==false,...(p.microphoneDeviceId?{deviceId:{exact:p.microphoneDeviceId}}:{})},video:false});
    const AudioCtx=root.AudioContext||root.webkitAudioContext;
    if(AudioCtx&&raw?.getAudioTracks?.().length){
      try{
        const ctx=new AudioCtx();try{await ctx.resume?.();}catch{}
        const source=ctx.createMediaStreamSource(raw),gain=ctx.createGain(),destination=ctx.createMediaStreamDestination();
        gain.gain.value=Math.max(0,Math.min(1,Number(p.microphoneVolume??100)/100));
        source.connect(gain);gain.connect(destination);
        micRawStream=raw;micAudioContext=ctx;micGainNode=gain;
        micStream=new MediaStream([destination.stream.getAudioTracks()[0]]);
      }catch{micRawStream=null;micAudioContext=null;micGainNode=null;micStream=raw;}
    }else micStream=raw;
    state.microphoneEnabled=true;return micStream;
  }
  async function captureCamera(){
    if(cameraStream)return cameraStream;
    const p=prefs(),quality=[720,1080,1440].includes(Number(p.quality))?Number(p.quality):1080,fps=[24,30,60].includes(Number(p.fps))?Number(p.fps):60;
    cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:quality===1440?2560:(quality===1080?1920:1280)},height:{ideal:quality===1440?1440:(quality===1080?1080:720)},frameRate:{ideal:fps,max:fps},...(p.cameraDeviceId?{deviceId:{exact:p.cameraDeviceId}}:{})}});
    state.cameraEnabled=true;
    cameraStream.getVideoTracks()[0]?.addEventListener?.('ended',()=>setCameraEnabled(false),{once:true});
    return cameraStream;
  }
  async function captureScreen(sourceInput){
    if(screenStream)return screenStream;
    let sourceId=clean(sourceInput?.id||sourceInput);
    if(!sourceId){const picked=await mediaApi()?.pickCaptureSource?.();sourceId=clean(picked?.id);}
    if(!sourceId)throw new Error('Escolha uma tela ou janela para compartilhar.');
    const p=prefs(),quality=[720,1080,1440].includes(Number(p.quality))?Number(p.quality):1080,fps=[24,30,60].includes(Number(p.fps))?Number(p.fps):60;
    const mandatory={chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxWidth:quality===1440?2560:(quality===1080?1920:1280),maxHeight:quality===1440?1440:(quality===1080?1080:720),maxFrameRate:fps};
    screenStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory}});
    await estudexAttachSystemAudioV1925(screenStream, state.audioEnabled);
    state.screenShareEnabled=true;
    screenStream.getVideoTracks()[0]?.addEventListener?.('ended',()=>stopScreenShare(),{once:true});
    return screenStream;
  }

  async function flushRemoteIce(){if(!peer?.remoteDescription)return;while(queuedRemoteIce.length){const candidate=queuedRemoteIce.shift();try{await peer.addIceCandidate(candidate);}catch{}}}
  async function flushLocalIce(){if(!localSignalReady||!state.callId||!state.peerId)return;for(const candidate of queuedLocalIce.splice(0))await send(state.peerId,'call-ice',{callId:state.callId,candidate},peerEndpoint).catch(()=>{});}

  function makePeer(){
    closePeer();remoteStream=new MediaStream();peer=new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}],iceCandidatePoolSize:2});
    peer.onicecandidate=event=>{
      if(!event.candidate||!state.callId||!state.peerId)return;
      const candidate=event.candidate.toJSON?.()||event.candidate;
      if(!localSignalReady){queuedLocalIce.push(candidate);return;}
      send(state.peerId,'call-ice',{callId:state.callId,candidate},peerEndpoint).catch(()=>{});
    };
    peer.ontrack=event=>{
      const source=event.streams?.[0];
      if(source){for(const track of source.getTracks())if(!remoteStream.getTracks().some(item=>item.id===track.id))remoteStream.addTrack(track);}
      else if(event.track&&!remoteStream.getTracks().some(item=>item.id===event.track.id))remoteStream.addTrack(event.track);
      emit('remote-track',{track:event.track,stream:remoteStream});
    };
    const recoverCallConnection=reason=>{
      if(!peer||!state.callId||!state.peerId||state.status==='idle')return;
      if(callRecoveryTimer)return;
      if(callRecoveryCount>=2){cleanup(reason||'connection_lost','ended');return;}
      const currentPeer=peer;
      callRecoveryTimer=setTimeout(async()=>{
        callRecoveryTimer=null;
        if(peer!==currentPeer||!peer||['connected','closed'].includes(String(peer.connectionState||'')))return;
        callRecoveryCount+=1;
        try{
          ignoreNegotiation=true;makingOffer=true;localSignalReady=false;
          try{peer.restartIce?.();}catch{}
          const offer=await peer.createOffer({iceRestart:true});
          await peer.setLocalDescription(offer);
          await send(state.peerId,'call-offer',{callId:state.callId,description:peer.localDescription},peerEndpoint);
          localSignalReady=true;await flushLocalIce();
        }catch(error){
          localSignalReady=true;state.error=error?.message||'Falha ao recuperar a chamada.';emit('error',{error});
          if(callRecoveryCount>=2)cleanup('connection_lost','ended');else recoverCallConnection('failed');
        }finally{makingOffer=false;ignoreNegotiation=false;}
      },reason==='failed'?180:1400);
    };
    peer.onconnectionstatechange=()=>{
      const value=peer?.connectionState||'';
      if(value==='connected'){
        if(callRecoveryTimer){clearTimeout(callRecoveryTimer);callRecoveryTimer=null;}callRecoveryCount=0;
        if(state.status!=='connected'){state.status='connected';state.startedAt=state.startedAt||Date.now();emit('connected');}
      }else if(value==='disconnected'||value==='failed')recoverCallConnection(value);
      else if(value==='closed')cleanup(value,'ended');
    };
    peer.onnegotiationneeded=async()=>{
      if(ignoreNegotiation||!state.callId||!state.peerId||state.status==='calling')return;
      try{
        makingOffer=true;localSignalReady=false;
        const offer=await peer.createOffer();await peer.setLocalDescription(offer);
        await send(state.peerId,'call-offer',{callId:state.callId,description:peer.localDescription},peerEndpoint);
        localSignalReady=true;await flushLocalIce();
      }catch(error){localSignalReady=true;state.error=error?.message||'Falha ao atualizar a chamada.';emit('error',{error});}
      finally{makingOffer=false;}
    };
    return peer;
  }

  async function installInitialMedia(mode,source){
    addStream(await captureMic());
    if(mode==='video')addStream(await captureCamera());
    if(mode==='screen'&&state.direction==='outgoing')addStream(await captureScreen(source));
  }

  async function start(peerId,mode='voice',screenSource){
    const target=friendById(peerId);
    if(!target||target.online===false)throw new Error('Usuário indisponível.');
    if(state.status!=='idle')throw new Error('Já existe uma chamada em andamento.');
    const nextMode=['voice','video','screen'].includes(String(mode))?String(mode):'voice';
    Object.assign(state,{status:'calling',callId:uuid(),peerId:clean(target.id),peerName:clean(target.name)||'Usuário',peerAvatar:target.avatar||'',mode:nextMode,direction:'outgoing',startedAt:0,error:'',audioEnabled:true});
    peerEndpoint='';emit('calling');
    try{
      makePeer();ignoreNegotiation=true;await installInitialMedia(nextMode,screenSource);
      const offer=await peer.createOffer();localSignalReady=false;await peer.setLocalDescription(offer);
      await send(state.peerId,'call-invite',{callId:state.callId,mode:nextMode,offer:peer.localDescription},peerEndpoint);
      localSignalReady=true;await flushLocalIce();ignoreNegotiation=false;emit('state');return snapshot();
    }catch(error){ignoreNegotiation=false;cleanup(error?.message||'Falha ao iniciar chamada.','error');throw error;}
  }

  async function accept(){
    if(state.status!=='ringing'||!pendingInvite)throw new Error('Nenhuma chamada aguardando resposta.');
    const invite=pendingInvite;
    try{
      state.status='connecting';emit('state');makePeer();ignoreNegotiation=true;
      await peer.setRemoteDescription(invite.offer);await installInitialMedia(state.mode);await flushRemoteIce();
      const answer=await peer.createAnswer();localSignalReady=false;await peer.setLocalDescription(answer);
      await send(state.peerId,'call-answer',{callId:state.callId,description:peer.localDescription},peerEndpoint);
      localSignalReady=true;await flushLocalIce();ignoreNegotiation=false;state.status='connected';state.startedAt=Date.now();pendingInvite=null;emit('connected');return snapshot();
    }catch(error){ignoreNegotiation=false;await reject('error').catch(()=>{});throw error;}
  }

  async function reject(reason='rejected'){if(state.status==='ringing'&&state.peerId&&state.callId)await send(state.peerId,'call-reject',{callId:state.callId,reason},peerEndpoint).catch(()=>{});cleanup(reason,'rejected');return true;}
  async function end(reason='ended'){const id=state.callId,peerId=state.peerId,endpoint=peerEndpoint;if(id&&peerId)await send(peerId,'call-end',{callId:id,reason},endpoint).catch(()=>{});cleanup(reason,'ended');return true;}
  async function setMicrophoneEnabled(value){const enabled=Boolean(value);if(enabled&&!micStream)addStream(await captureMic());for(const track of micStream?.getAudioTracks?.()||[])track.enabled=enabled;state.microphoneEnabled=enabled;emit('state');return snapshot();}
  function setAudioEnabled(value){state.audioEnabled=Boolean(value);for(const track of screenStream?.getAudioTracks?.()||[])track.enabled=state.audioEnabled;emit('state');return snapshot();}
  async function setCameraEnabled(value){const enabled=Boolean(value);if(enabled&&!cameraStream)addStream(await captureCamera());else if(!enabled&&cameraStream){removeSenders(cameraStream);stopStream(cameraStream);cameraStream=null;}if(cameraStream)for(const track of cameraStream.getVideoTracks())track.enabled=enabled;state.cameraEnabled=enabled;emit('state');return snapshot();}
  async function startScreenShare(sourceInput){if(!screenStream)addStream(await captureScreen(sourceInput));state.screenShareEnabled=true;emit('state');return snapshot();}
  async function stopScreenShare(){if(screenStream){removeSenders(screenStream);stopStream(screenStream);screenStream=null;}state.screenShareEnabled=false;emit('state');return snapshot();}

  async function handleMessage(message){
    const type=String(message?.type||'');if(!callTypes.has(type))return false;
    const payload=message?.payload||{},callId=clean(payload.callId),senderId=clean(message?.senderId);if(!callId||!senderId)return true;
    if(type==='call-invite'){
      const friend=friendById(senderId);
      if(!friend){await send(senderId,'call-reject',{callId,reason:'not-friend'}).catch(()=>{});return true;}
      if(state.status!=='idle'){await send(senderId,'call-reject',{callId,reason:'busy'}).catch(()=>{});return true;}
      pendingInvite={offer:payload.offer,senderId};peerEndpoint='';
      Object.assign(state,{status:'ringing',callId,peerId:senderId,peerName:clean(message.sender?.name||message.sender?.displayName||friend.name)||'Usuário',peerAvatar:friend.avatar||'',mode:['voice','video','screen'].includes(payload.mode)?payload.mode:'voice',direction:'incoming',startedAt:0,error:'',audioEnabled:true});
      emit('incoming',{profile:message.sender||{}});return true;
    }
    if(callId!==state.callId||senderId!==state.peerId)return true;
    if(type==='call-answer'&&peer&&payload.description){ignoredOffer=false;await peer.setRemoteDescription(payload.description);await flushRemoteIce();state.status='connected';state.startedAt=state.startedAt||Date.now();emit('connected');return true;}
    if(type==='call-offer'&&peer&&payload.description){
      const collision=makingOffer||peer.signalingState!=='stable';
      const polite=String(ownSocialId()).localeCompare(String(state.peerId))>0;
      if(collision&&!polite){ignoredOffer=true;return true;}
      try{
        ignoredOffer=false;ignoreNegotiation=true;if(collision)try{await peer.setLocalDescription({type:'rollback'});}catch{}
        await peer.setRemoteDescription(payload.description);await flushRemoteIce();
        const answer=await peer.createAnswer();localSignalReady=false;await peer.setLocalDescription(answer);
        await send(state.peerId,'call-answer',{callId:state.callId,description:peer.localDescription},peerEndpoint);
        localSignalReady=true;await flushLocalIce();
      }finally{ignoreNegotiation=false;}
      return true;
    }
    if(type==='call-ice'&&payload.candidate){if(ignoredOffer)return true;if(peer?.remoteDescription&&peer.signalingState!=='have-local-offer')try{await peer.addIceCandidate(payload.candidate);}catch{}else queuedRemoteIce.push(payload.candidate);return true;}
    if(type==='call-reject'){cleanup(payload.reason||'rejected','rejected');return true;}
    if(type==='call-end'){cleanup(payload.reason||'ended','ended');return true;}
    return true;
  }

  async function poll(){
    if(pollBusy)return;
    const api=cloudSocial();
    if(!api?.listSocialEvents){return;}
    pollBusy=true;
    try{
      const messages=await api.listSocialEvents([...callTypes]);
      const ids=[];
      const blockedCallers=new Set((await Promise.resolve(baseSocial()?.listBlocked?.()||[]).catch(()=>[])).map(item=>clean(item?.id||item)).filter(Boolean));
      for(const message of Array.isArray(messages)?messages:[]){
        if(!callTypes.has(String(message?.type||'')))continue;
        const eventId=clean(message?.id);if(eventId&&processedCloudCallEvents.has(eventId)){ids.push(eventId);continue;}
        const senderId=clean(message?.senderId);
        if(senderId&&blockedCallers.has(senderId)){if(message?.id)ids.push(String(message.id));continue;}
        let handledSuccessfully=false;
        try{await handleMessage(message);handledSuccessfully=true;}
        catch(error){state.error=error?.message||'Falha na sinalização da chamada.';emit('error',{error});}
        if(handledSuccessfully&&message?.id){processedCloudCallEvents.add(String(message.id));ids.push(String(message.id));if(processedCloudCallEvents.size>500)processedCloudCallEvents.delete(processedCloudCallEvents.values().next().value);}
      }
      await ack(ids);
    }catch{}finally{pollBusy=false;}
  }

  root.addEventListener?.('estudex:cloud-social-event',event=>{
    const message=event?.detail||{};const id=clean(message?.id);
    if(!callTypes.has(String(message?.type||''))||(id&&processedCloudCallEvents.has(id)))return;
    Promise.resolve(handleMessage(message)).then(()=>{if(id){processedCloudCallEvents.add(id);if(processedCloudCallEvents.size>500)processedCloudCallEvents.delete(processedCloudCallEvents.values().next().value);return ack([id]);}}).catch(error=>{state.error=error?.message||'Falha na sinalização da chamada.';emit('error',{error});});
  });

  const syncCallMicGain=()=>{if(!micGainNode?.gain)return;const p=prefs();micGainNode.gain.value=Math.max(0,Math.min(1,Number(p.microphoneVolume??100)/100));};
  try{mediaApi()?.onChange?.(()=>syncCallMicGain());}catch{}
  let callPollTimerV193=null;
  const scheduleCallPollV193=delay=>{if(callPollTimerV193)clearTimeout(callPollTimerV193);callPollTimerV193=setTimeout(async()=>{callPollTimerV193=null;await poll().catch(()=>{});scheduleCallPollV193(state.status==='idle'?2400:650)},Math.max(250,Number(delay)||2400));};
  poll().catch(()=>{}).finally(()=>scheduleCallPollV193(state.status==='idle'?2400:650));
  root.__estudexSpecAdapters=Object.freeze({calls:Object.freeze({getState:snapshot,start,accept,reject,end,setMicrophoneEnabled,setAudioEnabled,setCameraEnabled,startScreenShare,stopScreenShare,onChange:subscribe})});
})();

/* ESTUDEX_V193_SPEC_CALL_ENGINE_HARDENED */

/* ESTUDEX_V193_PRE_RELEASE_ENGINE_HARDENING */

/* ESTUDEX_V193_PRE_RELEASE_FRIEND_REMOVE_ENDPOINT */
