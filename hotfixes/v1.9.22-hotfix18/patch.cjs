const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 18 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const replaceOnce = (text, before, after, label) => {
  must(text.includes(before), label + ' anchor not found');
  return text.replace(before, after);
};

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let server = read('server.js');
must(server.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE'), 'Hotfix 17 server baseline missing');
must(server.includes('const estudexLanSnapshotBaseV187 = estudexLanSnapshotV172;'), 'raw Minecraft LAN snapshot handle missing');
must(server.includes('ESTUDEX_LAN_PRESENCE_V172'), 'Minecraft-style LAN beacon baseline missing');
must(server.includes('estudexBrowseRadminUsersV170'), 'legacy LAN fallback missing');
must(!server.includes('ESTUDEX_V193_HOTFIX18_RESTORE_MINECRAFT_RADMIN_LAN'), 'Hotfix 18 already applied');

const serverAnchor = '  const server = http.createServer(async (req, res) => {';
const minecraftRestore = `  /* ESTUDEX_V193_HOTFIX18_RESTORE_MINECRAFT_RADMIN_LAN\n     Restore the original Minecraft-style model: Radmin is only a virtual LAN\n     adapter. ESTUDEX instances discover each other by their own UDP presence\n     beacons over the 26.x interface. No Radmin UI/phonebook/registry scraping\n     participates in the normal discovery path. A fresh ESTUDEX beacon is the\n     liveness proof. Deep/manual refresh may additionally use the older LAN\n     browse + direct-identify fallback, but never replaces the LAN beacon path. */\n  const ESTUDEX_MINECRAFT_OFFLINE_RETAIN_V198 = 60000;\n  const estudexMinecraftKnownPeersV198 = new Map();\n\n  function estudexMinecraftStoreLiveV198(user, proof, now) {\n    const id = String(user?.id || '').trim();\n    const selfId = String(socialOwner?.userId || '');\n    const endpoint = String(user?.endpoint || '').replace(/\\/$/, '');\n    if (!id || id === selfId || !endpoint) return null;\n    const previous = estudexMinecraftKnownPeersV198.get(id) || {};\n    const live = {\n      ...previous,\n      ...user,\n      id,\n      endpoint,\n      online:true,\n      status:String(user?.status || previous.status || 'Disponível'),\n      lastProofAt:now,\n      lastSeen:Number(user?.lastSeen || now),\n      presenceProof:proof\n    };\n    estudexMinecraftKnownPeersV198.set(id, live);\n    return live;\n  }\n\n  async function estudexMinecraftLanSnapshotV198(waitMs = 650, options = {}) {\n    const deep = Boolean(options?.deep);\n    const now = Date.now();\n    const online = new Map();\n\n    /* PRIMARY: the untouched V172 UDP beacon snapshot captured before the\n       V187 verifier and all later scanners wrapped estudexLanSnapshotV172. */\n    let beaconUsers = [];\n    try { beaconUsers = await estudexLanSnapshotBaseV187(waitMs); } catch {}\n    for (const peer of (Array.isArray(beaconUsers) ? beaconUsers : [])) {\n      const live = estudexMinecraftStoreLiveV198(peer, 'radmin-lan-beacon-v198', now);\n      if (live) online.set(live.id, live);\n    }\n\n    /* SECONDARY ONLY ON DEEP/MANUAL REFRESH: use the pre-wrapper ESTUDEX LAN\n       browser. It broadcasts over the Radmin interface and can direct-identify\n       neighbour addresses. It does not scrape Radmin's UI or member database. */\n    if (deep) {\n      let fallbackUsers = [];\n      try { fallbackUsers = await estudexBrowseRadminUsersV170(); } catch {}\n      for (const peer of (Array.isArray(fallbackUsers) ? fallbackUsers : [])) {\n        const id = String(peer?.id || '').trim();\n        if (!id) continue;\n        if (online.has(id)) {\n          const current = online.get(id);\n          const merged = estudexMinecraftStoreLiveV198({ ...peer, ...current }, 'radmin-lan-beacon-v198', now);\n          if (merged) online.set(id, merged);\n          continue;\n        }\n        const live = estudexMinecraftStoreLiveV198(peer, 'radmin-lan-fallback-v198', now);\n        if (live) online.set(live.id, live);\n      }\n    }\n\n    const result = [...online.values()];\n    for (const [id, previous] of [...estudexMinecraftKnownPeersV198.entries()]) {\n      if (online.has(id)) continue;\n      const age = now - Number(previous?.lastProofAt || previous?.lastSeen || 0);\n      if (!Number.isFinite(age) || age > ESTUDEX_MINECRAFT_OFFLINE_RETAIN_V198) {\n        estudexMinecraftKnownPeersV198.delete(id);\n        continue;\n      }\n      result.push({\n        ...previous,\n        online:false,\n        status:'Offline',\n        presenceProof:'radmin-lan-offline-v198'\n      });\n    }\n\n    return result.sort((a,b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));\n  }\n\n  /* Every older caller (search, directory, friends reconciliation) now lands\n     on the restored Minecraft-style path instead of H15/H16/H17 scanners. */\n  estudexLanSnapshotV172 = async function estudexLanSnapshotMinecraftV198(waitMs = 650) {\n    return estudexMinecraftLanSnapshotV198(waitMs, { deep:false });\n  };\n\n`;
server = replaceOnce(server, serverAnchor, minecraftRestore + serverAnchor, 'HTTP server anchor');

const routeAnchor = "      if (url.pathname === '/api/social/lan-peers' && req.method === 'GET') {";
const routeIndex = server.indexOf(routeAnchor);
must(routeIndex >= 0, 'lan-peers route missing');
let head = server.slice(0, routeIndex);
let tail = server.slice(routeIndex);

must(tail.includes('        const radminIp = estudexStableRadminIpV197();'), 'Hotfix 17 lan-peers Radmin IP line missing');
tail = tail.replace('        const radminIp = estudexStableRadminIpV197();', '        const radminIp = estudexRadminIpV170();');

must(tail.includes('        let users=await estudexLanSnapshotV172(deep?1150:700);'), 'Hotfix 17 primary snapshot line missing');
tail = tail.replace(
  '        let users=await estudexLanSnapshotV172(deep?1150:700);',
  '        let users=await estudexMinecraftLanSnapshotV198(deep?1150:700,{deep});'
);

must(tail.includes('          const second=await estudexLanSnapshotV172(1150);'), 'Hotfix 17 deep second snapshot line missing');
tail = tail.replace(
  '          const second=await estudexLanSnapshotV172(1150);',
  '          const second=await estudexMinecraftLanSnapshotV198(1150,{deep:true});'
);

must(tail.includes("discovery:deep?'authoritative-presence-v197-deep':'authoritative-presence-v197',"), 'Hotfix 17 discovery marker missing');
tail = tail.replace(
  "discovery:deep?'authoritative-presence-v197-deep':'authoritative-presence-v197',",
  "discovery:deep?'minecraft-radmin-lan-v198-deep':'minecraft-radmin-lan-v198',"
);
server = head + tail;

/* Make presence-debug show the restored LAN result first; candidate-scraper data\n   remains diagnostic only and is no longer part of normal discovery. */
server = replaceOnce(
  server,
  '        const users = await estudexLanSnapshotV172(900);',
  '        const users = await estudexMinecraftLanSnapshotV198(900,{deep:true});',
  'presence debug snapshot'
);
write('server.js', server);

let engine = read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI'), 'Hotfix 17 renderer presence fix missing');
must(engine.includes('.map(user=>normalizeFriend({...user,online:Boolean(user?.online)}))'), 'renderer must preserve server online state');
must(!engine.includes('.map(user=>normalizeFriend({...user,online:true}))'), 'renderer still forces all peers online');
/* Hotfix 18 intentionally leaves the corrected Hotfix 17 renderer untouched. */
write('public/estudex-engine.js', engine);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.21', 'expected technical version 1.9.21, got ' + pkg.version);
pkg.version = '1.9.22';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.21["']/.test(forge), 'Squirrel 1.9.21 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.21["']/, 'version: "1.9.22"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.22',
  hotfix:18,
  baseTag:'v1.9.21-hotfix17',
  discovery:{
    architecture:'Minecraft-style ESTUDEX UDP LAN over Radmin virtual adapter',
    primary:'raw V172 ESTUDEX UDP presence beacons',
    deepFallback:'legacy ESTUDEX LAN browse + direct-identify',
    normalPathReadsRadminMemberUi:false,
    normalPathReadsRadminPhonebook:false,
    onlineMeaning:'fresh ESTUDEX presence, never Radmin member status',
    offlineRetainMs:60000
  },
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix18-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 18 / technical 1.9.22 Minecraft-style Radmin LAN discovery restored.');
