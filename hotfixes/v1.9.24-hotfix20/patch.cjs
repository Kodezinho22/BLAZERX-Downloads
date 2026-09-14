const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 20 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const replaceOnce = (text, before, after, label) => {
  must(text.includes(before), label + ' anchor not found');
  return text.replace(before, after);
};

const CLOUD_BASE = 'https://estudexserver-p1t0c2xc.b4a.run';
const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let engine = read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI'), 'Hotfix 19 baseline renderer missing');
must(!engine.includes('ESTUDEX_V193_HOTFIX20_CLOUD_ROOM_TEST'), 'Hotfix 20 already applied');

const roomStateAnchor = `  const roomState = {\n    connected:false,`;
const cloudRuntime = `  /* ESTUDEX_V193_HOTFIX20_CLOUD_ROOM_TEST\n     Temporary friends-test transport. Room membership/signaling is centralized\n     on the Back4App ESTUDEX server; media remains peer-to-peer over WebRTC. */\n  const ESTUDEX_CLOUD_ROOM_DEFAULT_V1924 = '${CLOUD_BASE}';\n  function estudexCloudRoomBaseV1924() {\n    const override = String(localStorage.getItem('estudex-cloud-room-base-v1924') || '').trim().replace(/\\/$/,'');\n    return /^https?:\\/\\//i.test(override) ? override : ESTUDEX_CLOUD_ROOM_DEFAULT_V1924;\n  }\n  try { window.ESTUDEX_CLOUD_ROOM_BASE = estudexCloudRoomBaseV1924(); } catch {}\n\n`;
must(engine.includes(roomStateAnchor), 'room state anchor missing');
engine = engine.replace(roomStateAnchor, cloudRuntime + roomStateAnchor);

engine = replaceOnce(
  engine,
  `  const ROOM_MEDIA_RTC_CONFIG=Object.freeze({iceServers:[],iceCandidatePoolSize:1});`,
  `  const ROOM_MEDIA_RTC_CONFIG=Object.freeze({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}],iceCandidatePoolSize:2});`,
  'Internet WebRTC STUN config'
);

const oldCreate = `  async function createRoom(options = {}) {\n    await registerSocial();\n    const state = await fetchJson('/api/social/radmin-self?userId=' + encodeURIComponent(socialId), {}, 3500);\n    const endpoint = String(state?.endpoint || ownEndpoint || '').replace(/\\/$/, '');\n    if (!endpoint) throw new Error('Conecte o Radmin para criar uma sala.');\n    const profile = await getProfile();\n    const room = randomRoomId();\n    const name = cleanRoomName(options.name || ('Sala de ' + profile.name));\n    const limit = cleanLimit(options.limit);\n    await connectRoom({room,role:'host',signalingBase:endpoint,name,limit});\n    await saveCurrentRoom();\n    return roomSnapshot();\n  }`;
const newCreate = `  async function createRoom(options = {}) {\n    const endpoint = estudexCloudRoomBaseV1924();\n    const profile = await getProfile();\n    const room = randomRoomId();\n    const name = cleanRoomName(options.name || ('Sala de ' + profile.name));\n    const limit = cleanLimit(options.limit);\n    await connectRoom({room,role:'host',signalingBase:endpoint,name,limit});\n    await saveCurrentRoom();\n    return roomSnapshot();\n  }`;
engine = replaceOnce(engine, oldCreate, newCreate, 'cloud createRoom');

const oldCandidate = `    let candidate = null;\n    if (input.hostEndpoint || input.signalingBase) candidate = normalizeSavedRoom({...input,room,role:input.role === 'host' ? 'host':'member'});\n    if (!candidate) {\n      const local = loadSavedCache().find(item => item.room === room) || null;\n      if (local) candidate = normalizeSavedRoom(local);\n    }\n    if (!candidate) {\n      const lan = await listLanRooms().catch(() => []);\n      candidate = lan.find(item => item.room === room) || null;\n    }\n    if (!candidate) {\n      const saved = await listSavedRooms().catch(() => loadSavedCache());\n      candidate = saved.find(item => item.room === room) || null;\n    }\n    if (!candidate) throw new Error('Sala não encontrada na sua rede Radmin.');`;
const newCandidate = `    let candidate = null;\n    if (input.hostEndpoint || input.signalingBase) candidate = normalizeSavedRoom({...input,room,role:input.role === 'host' ? 'host':'member'});\n    if (!candidate) {\n      const local = loadSavedCache().find(item => item.room === room) || null;\n      if (local) candidate = normalizeSavedRoom(local);\n    }\n    if (!candidate) candidate = normalizeSavedRoom({room,role:'member',hostEndpoint:estudexCloudRoomBaseV1924(),name:'Sala ESTUDEX',limit:7,online:true,active:true});\n    candidate = {...candidate, hostEndpoint:estudexCloudRoomBaseV1924()};`;
engine = replaceOnce(engine, oldCandidate, newCandidate, 'cloud join candidate');

const oldRetry = `    try {\n      await connectRoom({room,role,signalingBase,name:candidate.name,limit:candidate.limit});\n    } catch (firstError) {\n      /* Stored endpoints can legitimately become stale after a Radmin/IP change.\n         Pay the discovery cost only after the fast path actually fails. */\n      let refreshed='';\n      if (role === 'host') {\n        try { refreshed=String(await registerSocial(true)).trim().replace(/\\/$/, ''); } catch {}\n      } else {\n        try {\n          const peers=await freshLanPeersV194(true);\n          const live=peers.find(peer=>String(peer.id||'')===String(candidate.hostId||'')||cleanRoomId(peer?.room?.room)===room);\n          refreshed=String(live?.endpoint||'').trim().replace(/\\/$/, '');\n          if(refreshed){\n            candidate={...candidate,hostId:String(live?.id||candidate.hostId||''),hostEndpoint:refreshed};\n            cacheSavedRoom(candidate);\n          }\n        } catch {}\n      }\n      if(!refreshed || refreshed===signalingBase)throw firstError;\n      signalingBase=refreshed;\n      if(role==='host')cacheSavedRoom({...candidate,hostEndpoint:signalingBase});\n      await connectRoom({room,role,signalingBase,name:candidate.name,limit:candidate.limit});\n    }`;
const newRetry = `    try {\n      await connectRoom({room,role,signalingBase,name:candidate.name,limit:candidate.limit});\n    } catch (firstError) {\n      throw firstError;\n    }`;
engine = replaceOnce(engine, oldRetry, newRetry, 'remove Radmin join retry');

engine = replaceOnce(
  engine,
  `      hostEndpoint:roomState.role === 'host' ? (ownEndpoint || roomState.signalingBase) : roomState.signalingBase,`,
  `      hostEndpoint:roomState.signalingBase,`,
  'save cloud room endpoint'
);

const migrationBlock = `    let migrationPeersV194 = [];\n    try { migrationPeersV194 = await freshLanPeersV194(false); } catch {}\n    for (const saved of list) {\n      if (saved.role === 'host') continue;\n      const live = migrationPeersV194.find(peer => String(peer.id || '') === String(saved.hostId || '') || cleanRoomId(peer?.room?.room) === saved.room);\n      if (live?.endpoint) saved.hostEndpoint = String(live.endpoint).replace(/\\/$/, '');\n    }`;
const cloudSaved = `    for (const saved of list) saved.hostEndpoint = estudexCloudRoomBaseV1924();`;
engine = replaceOnce(engine, migrationBlock, cloudSaved, 'disable Radmin saved-room endpoint migration');

engine = replaceOnce(
  engine,
  `            const status = await fetchJson('/api/rooms/saved/status?room=' + encodeURIComponent(saved.room), {}, 2300);`,
  `            const status = await fetchJson(estudexCloudRoomBaseV1924() + '/api/rooms/saved/status?room=' + encodeURIComponent(saved.room), {}, 2300);`,
  'host saved-room cloud status'
);

write('public/estudex-engine.js', engine);

let compat = read('public/js/estudex-engine-socket-compat.js');
compat = replaceOnce(
  compat,
  `  async function ensureNetworkReady(){\n    if(typeof E.radmin?.ensureReady==='function')await E.radmin.ensureReady();\n  }`,
  `  async function ensureNetworkReady(){\n    /* Hotfix 20: cloud room tests do not require Radmin. */\n    return true;\n  }`,
  'socket compat Radmin gate'
);
write('public/js/estudex-engine-socket-compat.js', compat);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.23', 'expected technical version 1.9.23, got ' + pkg.version);
pkg.version = '1.9.24';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.23["']/.test(forge), 'Squirrel 1.9.23 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.23["']/, 'version: "1.9.24"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX', productVersion:'1.9.3', technicalVersion:'1.9.24', hotfix:20,
  baseTag:'v1.9.23-hotfix19', mode:'cloud-friends-test',
  cloud:{base:CLOUD_BASE, websocket:'root', signaling:'ESTUDEX room protocol', media:'WebRTC P2P', stun:true, turn:false, maxTesters:7},
  radminRequiredForRooms:false,
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix20-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 20 / technical 1.9.24 cloud friends-test applied.');
