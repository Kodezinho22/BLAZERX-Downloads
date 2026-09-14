const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 19 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const replaceOnce = (text, before, after, label) => {
  must(text.includes(before), label + ' anchor not found');
  return text.replace(before, after);
};

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let server = read('server.js');
must(server.includes('ESTUDEX_V193_HOTFIX18_RESTORE_MINECRAFT_RADMIN_LAN'), 'Hotfix 18 baseline missing');
must(server.includes('const estudexLanSnapshotBaseV187 = estudexLanSnapshotV172;'), 'original V172 snapshot handle missing');
must(server.includes('ESTUDEX_LAN_PRESENCE_V172'), 'original LAN beacon block missing');
must(!server.includes('ESTUDEX_V193_HOTFIX19_DIRECT_RADMIN_LAN'), 'Hotfix 19 already applied');

/* The socket was healthy on affected machines, but the V172 sender was still
   gated by renderer/app-heartbeat state. For Minecraft-style LAN semantics,
   an open ESTUDEX process with a registered local user and a Radmin 26.x
   adapter must advertise itself. Away/Busy remain discoverable. Invisible
   remains private. */
const payloadStart = server.indexOf('  function estudexLanPresencePayloadV172() {');
const payloadEnd = server.indexOf('  function estudexLanAnnounceV172', payloadStart);
must(payloadStart >= 0 && payloadEnd > payloadStart, 'V172 presence payload function missing');
let payloadBlock = server.slice(payloadStart, payloadEnd);
must(payloadBlock.includes('if (!socialOwner || !ip || !estudexSocialPublicOnlineV190()) return null;'), 'V172 public-online gate missing');
payloadBlock = payloadBlock.replace(
  'if (!socialOwner || !ip || !estudexSocialPublicOnlineV190()) return null;',
  'if (!socialOwner || !ip || estudexSocialInvisibleV190()) return null;'
);
server = server.slice(0, payloadStart) + payloadBlock + server.slice(payloadEnd);

const timerStart = server.indexOf('estudexLanHeartbeatTimerV172 = setInterval');
must(timerStart >= 0, 'V172 heartbeat timer missing');
const timerEnd = server.indexOf('}, 2200);', timerStart);
must(timerEnd > timerStart, 'V172 heartbeat timer end missing');
let timerBlock = server.slice(timerStart, timerEnd + '}, 2200);'.length);
const heartbeatGate = "if (typeof isAppHeartbeatOnlineV122 === 'function' && !isAppHeartbeatOnlineV122()) return;";
must(timerBlock.includes(heartbeatGate), 'V172 renderer heartbeat gate missing');
timerBlock = timerBlock.replace(heartbeatGate, '/* H19: process-open LAN discovery does not depend on renderer heartbeat. */');
server = server.slice(0, timerStart) + timerBlock + server.slice(timerEnd + '}, 2200);'.length);

/* Bypass every H15-H18 presence/scanner wrapper in the active network list.
   This path consumes the exact raw V172 peer map captured before those wrappers.
   A peer is Online because a fresh ESTUDEX V172 packet exists; when the remote
   app closes, its packet expires from the original 9-second peer TTL. */
const serverAnchor = '  const server = http.createServer(async (req, res) => {';
const directLan = `  /* ESTUDEX_V193_HOTFIX19_DIRECT_RADMIN_LAN\n     Radmin is only the virtual Ethernet cable. Normal discovery is exclusively\n     ESTUDEX V172 UDP multicast/broadcast over the 26.x adapter, just like a LAN\n     game discovery flow. No Radmin member scraping, ARP candidate guessing,\n     direct-identify proof cache, or authoritative presence cache is consulted. */\n  async function estudexMinecraftLanSnapshotV199(waitMs = 700, options = {}) {\n    const deep = Boolean(options?.deep);\n    try { estudexLanEnsureMembershipV172(); } catch {}\n    /* Query once immediately; the original raw snapshot sends another query.\n       The duplicate small UDP query makes startup/manual refresh less lossy. */\n    try { estudexLanQueryV172(); } catch {}\n    let peers = [];\n    try { peers = await estudexLanSnapshotBaseV187(waitMs); } catch {}\n\n    const selfId = String(socialOwner?.userId || '');\n    const byId = new Map();\n    const accept = (peer, proof) => {\n      const id = String(peer?.id || '').trim();\n      const endpoint = String(peer?.endpoint || '').replace(/\\/$/, '');\n      const radminIp = String(peer?.radminIp || '');\n      if (!id || id === selfId || !endpoint) return;\n      if (radminIp && !/^26(?:\\.\\d{1,3}){3}$/.test(radminIp)) return;\n      byId.set(id, {\n        ...peer, id, endpoint,\n        online:true,\n        status:String(peer?.status || 'Disponível'),\n        lastSeen:Number(peer?.lastSeen || Date.now()),\n        presenceProof:proof\n      });\n    };\n    for (const peer of (Array.isArray(peers) ? peers : [])) accept(peer, 'radmin-v172-lan-v199');\n\n    /* Manual/deep refresh keeps the old ESTUDEX-native fallback only. It is not\n       used by normal polling and does not inspect the Radmin UI/phonebook. */\n    if (deep) {\n      let fallback = [];\n      try { fallback = await estudexBrowseRadminUsersV170(); } catch {}\n      for (const peer of (Array.isArray(fallback) ? fallback : [])) {\n        if (!byId.has(String(peer?.id || ''))) accept(peer, 'radmin-estudex-fallback-v199');\n      }\n    }\n\n    return [...byId.values()]\n      .sort((a,b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));\n  }\n\n  /* Older search/directory/friend reconciliation callers also use the direct\n     LAN snapshot. This override intentionally replaces the H18 wrapper. */\n  estudexLanSnapshotV172 = async function estudexLanSnapshotMinecraftV199(waitMs = 700) {\n    return estudexMinecraftLanSnapshotV199(waitMs, { deep:false });\n  };\n\n`;
must(server.includes(serverAnchor), 'HTTP server anchor missing');
server = server.replace(serverAnchor, directLan + serverAnchor);

server = replaceOnce(
  server,
  '        let users=await estudexMinecraftLanSnapshotV198(deep?1150:700,{deep});',
  '        let users=await estudexMinecraftLanSnapshotV199(deep?1150:700,{deep});',
  'lan-peers primary H18 wrapper'
);
server = replaceOnce(
  server,
  '          const second=await estudexMinecraftLanSnapshotV198(1150,{deep:true});',
  '          const second=await estudexMinecraftLanSnapshotV199(1150,{deep:true});',
  'lan-peers deep H18 wrapper'
);
server = replaceOnce(
  server,
  '        const users = await estudexMinecraftLanSnapshotV198(900,{deep:true});',
  '        const users = await estudexMinecraftLanSnapshotV199(900,{deep:true});',
  'presence debug H18 wrapper'
);
server = replaceOnce(
  server,
  "discovery:deep?'minecraft-radmin-lan-v198-deep':'minecraft-radmin-lan-v198',",
  "discovery:deep?'minecraft-radmin-lan-v199-deep':'minecraft-radmin-lan-v199',",
  'lan-peers discovery marker'
);
write('server.js', server);

/* Hotfix 17 fixed the renderer bug that forced every card online. Preserve it. */
let engine = read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI'), 'Hotfix 17 renderer fix missing');
must(engine.includes('.map(user=>normalizeFriend({...user,online:Boolean(user?.online)}))'), 'renderer no longer preserves server online state');
must(!engine.includes('.map(user=>normalizeFriend({...user,online:true}))'), 'renderer still forces all peers online');
write('public/estudex-engine.js', engine);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.22', 'expected technical version 1.9.22, got ' + pkg.version);
pkg.version = '1.9.23';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.22["']/.test(forge), 'Squirrel 1.9.22 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.22["']/, 'version: "1.9.23"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.23',
  hotfix:19,
  baseTag:'v1.9.22-hotfix18',
  discovery:{
    architecture:'direct Minecraft-style ESTUDEX UDP LAN over Radmin virtual adapter',
    normalPath:'raw V172 peer map only',
    udpPort:8788,
    multicastGroup:'239.255.77.77',
    appOpenMeansDiscoverable:true,
    awayBusyRemainDiscoverable:true,
    invisibleRemainsPrivate:true,
    rendererHeartbeatRequiredForBeacon:false,
    readsRadminMemberUi:false,
    readsRadminPhonebook:false,
    usesPresenceProofCache:false,
    peerExpiryMs:9000
  },
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix19-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 19 / technical 1.9.23 direct Radmin LAN discovery applied.');
