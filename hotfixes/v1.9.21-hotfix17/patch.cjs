const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 17 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const replaceOnce = (text, before, after, label) => {
  must(text.includes(before), label + ' anchor not found');
  return text.replace(before, after);
};

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let server = read('server.js');
must(server.includes('ESTUDEX_V193_HOTFIX16_RADMIN_MEMBER_CANDIDATES'), 'Hotfix 16 server baseline not found');
must(server.includes('estudexLanSnapshotProofHybridV195'), 'Hotfix 16 hybrid snapshot not found');
must(!server.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE'), 'Hotfix 17 already applied');

server = replaceOnce(
  server,
  'const ESTUDEX_RADMIN_CANDIDATE_CACHE_MS_V196 = 12000;',
  'const ESTUDEX_RADMIN_CANDIDATE_CACHE_MS_V196 = 4000;',
  'Radmin candidate cache'
);

const candidateAnchor = '  async function estudexRadminCandidateIpsV196() {';
const phonebookHelper = `  /* ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE\n     Radmin only supplies candidate 26.x addresses. An ESTUDEX user is Online\n     only after the ESTUDEX service itself proves liveness. Hotfix 17 also\n     reads Radmin VPN's binary phonebook, which Hotfix 16 skipped. */\n  const ESTUDEX_PRESENCE_ONLINE_TTL_V197 = 7500;\n  const ESTUDEX_PRESENCE_OFFLINE_RETAIN_V197 = 60000;\n  const ESTUDEX_RADMIN_PHONEBOOK_PATHS_V197 = [\n    path.join(process.env.LOCALAPPDATA || '', 'Famatech', 'Radmin VPN', 'phonebook.rpb'),\n    path.join(process.env.LOCALAPPDATA || '', 'Famatech', 'RadminVPN', 'phonebook.rpb'),\n    path.join(process.env.APPDATA || '', 'Famatech', 'Radmin VPN', 'phonebook.rpb')\n  ].filter(Boolean);\n\n  function estudexRadminPhonebookIpsV197() {\n    if (process.platform !== 'win32') return [];\n    const out = new Set();\n    for (const file of ESTUDEX_RADMIN_PHONEBOOK_PATHS_V197) {\n      try {\n        if (!fs.existsSync(file)) continue;\n        const stat = fs.statSync(file);\n        if (!stat.isFile() || stat.size <= 0 || stat.size > 16 * 1024 * 1024) continue;\n        const fd = fs.openSync(file, 'r');\n        const size = Math.min(stat.size, 8 * 1024 * 1024);\n        const buffer = Buffer.alloc(size);\n        fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - size));\n        fs.closeSync(fd);\n        try { estudexExtractRadminIpsV196(buffer.toString('latin1'), out); } catch {}\n        try { estudexExtractRadminIpsV196(buffer.toString('utf16le'), out); } catch {}\n        try { estudexExtractRadminIpsV196(buffer.toString('utf8'), out); } catch {}\n      } catch {}\n    }\n    return [...out];\n  }\n\n`;
server = replaceOnce(server, candidateAnchor, phonebookHelper + candidateAnchor, 'candidate collector');

server = replaceOnce(
  server,
  '      for (const ip of estudexRadminLocalFileIpsV196()) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      const ips = [...found].slice(0, 128);',
  "      for (const ip of estudexRadminLocalFileIpsV196()) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      for (const ip of estudexRadminPhonebookIpsV197()) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      const ips = [...found].slice(0, 192);",
  'phonebook candidate merge'
);

const serverAnchor = '  const server = http.createServer(async (req, res) => {';
const authoritativeWrapper = `  /* One server-side directory owns the visual presence state. The previous\n     hybrid scanner remains the liveness probe; this layer removes flapping by\n     retaining known users as Offline instead of making cards disappear. */\n  const estudexLanSnapshotHybridBeforeV197 = estudexLanSnapshotV172;\n  const estudexPresenceDirectoryV197 = new Map();\n  let estudexStableRadminIpValueV197 = '';\n  let estudexStableRadminIpAtV197 = 0;\n\n  function estudexStableRadminIpV197() {\n    let current = '';\n    try { current = String(estudexRadminIpV170() || '').trim(); } catch {}\n    if (/^26(?:\\.\\d{1,3}){3}$/.test(current)) {\n      estudexStableRadminIpValueV197 = current;\n      estudexStableRadminIpAtV197 = Date.now();\n      return current;\n    }\n    if (estudexStableRadminIpValueV197 && Date.now() - estudexStableRadminIpAtV197 < 30000) return estudexStableRadminIpValueV197;\n    return '';\n  }\n\n  function estudexPresenceEntryV197(user, now, online) {\n    const previous = estudexPresenceDirectoryV197.get(String(user?.id || '')) || {};\n    return {\n      ...previous,\n      ...user,\n      id:String(user?.id || previous.id || '').trim(),\n      endpoint:String(user?.endpoint || previous.endpoint || '').replace(/\\/$/, ''),\n      radminIp:String(user?.radminIp || previous.radminIp || ''),\n      status:online ? String(user?.status || previous.status || 'Disponível') : 'Offline',\n      online:Boolean(online),\n      lastProofAt:online ? now : Number(previous.lastProofAt || 0),\n      lastSeen:online ? now : Number(previous.lastSeen || previous.lastProofAt || 0),\n      presenceProof:online ? String(user?.presenceProof || 'verified-estudex-v197') : 'offline-v197'\n    };\n  }\n\n  estudexLanSnapshotV172 = async function estudexLanSnapshotAuthoritativeV197(waitMs = 650) {\n    const now = Date.now();\n    const fresh = await estudexLanSnapshotHybridBeforeV197(waitMs);\n    const seen = new Set();\n    for (const user of (Array.isArray(fresh) ? fresh : [])) {\n      const id = String(user?.id || '').trim();\n      if (!id || !user?.endpoint) continue;\n      seen.add(id);\n      estudexPresenceDirectoryV197.set(id, estudexPresenceEntryV197(user, now, true));\n    }\n\n    const users = [];\n    for (const [id, entry] of [...estudexPresenceDirectoryV197.entries()]) {\n      const age = now - Number(entry?.lastProofAt || 0);\n      if (seen.has(id) || age <= ESTUDEX_PRESENCE_ONLINE_TTL_V197) {\n        users.push({ ...entry, online:true, status:String(entry.status || 'Disponível'), presenceProof:String(entry.presenceProof || 'verified-estudex-v197') });\n        continue;\n      }\n      if (age <= ESTUDEX_PRESENCE_OFFLINE_RETAIN_V197) {\n        users.push({ ...entry, online:false, status:'Offline', presenceProof:'offline-v197' });\n        continue;\n      }\n      estudexPresenceDirectoryV197.delete(id);\n    }\n    return users.sort((a,b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));\n  };\n\n  async function estudexPresenceDebugCandidatesV197() {\n    const sources = new Map();\n    const add = (source, values) => {\n      for (const value of (Array.isArray(values) ? values : [])) {\n        const ip = estudexCandidateIpV196(value);\n        if (!ip) continue;\n        if (!sources.has(ip)) sources.set(ip, new Set());\n        sources.get(ip).add(source);\n      }\n    };\n    try { add('known-estudex-state', [...estudexKnownStateIpsV196(new Set())]); } catch {}\n    try { add('verified-ip-memory', [...estudexKnownRadminIpsV196]); } catch {}\n    const [neighbours, uiIps, systemIps] = await Promise.all([\n      estudexRadminNeighborIpsV170().catch(() => []),\n      estudexRadminUiIpsV196().catch(() => []),\n      estudexRadminSystemIpsV196().catch(() => [])\n    ]);\n    add('windows-neighbour', neighbours);\n    add('radmin-ui-automation', uiIps);\n    add('windows-netstat-registry', systemIps);\n    try { add('radmin-text-files', estudexRadminLocalFileIpsV196()); } catch {}\n    try { add('radmin-phonebook-rpb', estudexRadminPhonebookIpsV197()); } catch {}\n    return [...sources.entries()].map(([ip, set]) => ({ ip, sources:[...set] })).sort((a,b) => a.ip.localeCompare(b.ip));\n  }\n\n`;
server = replaceOnce(server, serverAnchor, authoritativeWrapper + serverAnchor, 'HTTP server');

const routeAnchor = "      if (url.pathname === '/api/social/lan-peers' && req.method === 'GET') {";
const debugRoute = `      if (url.pathname === '/api/social/presence-debug' && req.method === 'GET') {\n        if (!isLoopbackSocialRequest(req)) return socialJson(res, 403, { ok:false, error:'local_only' });\n        const userId = String(url.searchParams.get('userId') || '').trim();\n        if (!socialOwner || !userId || socialOwner.userId !== userId) return socialJson(res, 403, { ok:false, error:'not_registered' });\n        const startedAt = Date.now();\n        try { estudexRadminCandidateCacheV196.at = 0; } catch {}\n        const candidates = await estudexPresenceDebugCandidatesV197();\n        const users = await estudexLanSnapshotV172(900);\n        return socialJson(res, 200, {\n          ok:true,\n          radminIpLive:String(estudexRadminIpV170() || ''),\n          radminIpStable:estudexStableRadminIpV197(),\n          elapsedMs:Date.now()-startedAt,\n          candidates,\n          users:(Array.isArray(users) ? users : []).map(user => ({\n            id:user.id, name:user.name, radminIp:user.radminIp, endpoint:user.endpoint,\n            online:Boolean(user.online), status:user.status, presenceProof:user.presenceProof, lastSeen:user.lastSeen\n          }))\n        });\n      }\n\n`;
server = replaceOnce(server, routeAnchor, debugRoute + routeAnchor, 'lan-peers HTTP route');

const routeIndex = server.indexOf(routeAnchor);
must(routeIndex >= 0, 'lan-peers route index missing');
const routeTail = server.slice(routeIndex);
const oldRouteIp = '        const radminIp = estudexRadminIpV170();';
must(routeTail.includes(oldRouteIp), 'lan-peers radmin ip line missing');
server = server.slice(0, routeIndex) + routeTail.replace(oldRouteIp, '        const radminIp = estudexStableRadminIpV197();');
server = replaceOnce(
  server,
  "discovery:deep?'radmin-member-proof-v196-deep':'radmin-member-proof-v196',",
  "discovery:deep?'authoritative-presence-v197-deep':'authoritative-presence-v197',",
  'lan-peers discovery marker'
);
write('server.js', server);

let engine = read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX15_PROOF_PRESENCE_UI'), 'Hotfix 15 renderer baseline missing');
must(!engine.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI'), 'Hotfix 17 renderer already applied');

engine = replaceOnce(
  engine,
  '/* ESTUDEX_V193_HOTFIX15_PROOF_PRESENCE_UI */\n  const RADMIN_PEER_GRACE_MS_V194 = 9000;',
  '/* ESTUDEX_V193_HOTFIX15_PROOF_PRESENCE_UI */\n  /* ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI */\n  const RADMIN_PEER_GRACE_MS_V194 = 7500;',
  'renderer presence marker'
);
engine = replaceOnce(engine,
  '.map(user=>normalizeFriend({...user,online:true}))',
  '.map(user=>normalizeFriend({...user,online:Boolean(user?.online)}))',
  'listPeers online normalization');
engine = replaceOnce(engine,
  'for(const user of fresh)radminPeerGraceV194.set(String(user.id),{seenAt,user:{...user,online:true}});',
  'for(const user of fresh)radminPeerGraceV194.set(String(user.id),{seenAt,user:{...user,online:Boolean(user.online)}});',
  'peer grace storage');
engine = replaceOnce(engine,
  'for(const [id,entry] of radminPeerGraceV194.entries())if(id&&entry?.user?.endpoint)merged.set(id,{...entry.user,online:true});',
  'for(const [id,entry] of radminPeerGraceV194.entries())if(id&&entry?.user?.endpoint)merged.set(id,{...entry.user,online:Boolean(entry.user.online)});',
  'peer grace merge');
engine = replaceOnce(engine,
  'for(const user of fresh)merged.set(String(user.id),{...user,online:true});',
  'for(const user of fresh)merged.set(String(user.id),{...user,online:Boolean(user.online)});',
  'fresh peer merge');
engine = replaceOnce(engine,
  'const publicOnline = isPublicOnlineV194(friend.status);',
  'const publicOnline = Boolean(peer?.online) && isPublicOnlineV194(friend.status);',
  'friend reconciliation online');
engine = replaceOnce(engine,
  "friend.online=typeof isPublicOnlineV194==='function'?Boolean(isPublicOnlineV194(friend.status)):true;",
  "friend.online=Boolean(live?.online)&&(typeof isPublicOnlineV194==='function'?Boolean(isPublicOnlineV194(friend.status)):true);",
  'friend refresh online');
engine = replaceOnce(engine,
  'friend.online = isPublicOnlineV194(peer.status || friend.status);',
  'friend.online = Boolean(peer?.online) && isPublicOnlineV194(peer.status || friend.status);',
  'stored friend healing online');
write('public/estudex-engine.js', engine);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.20', 'expected technical version 1.9.20, got ' + pkg.version);
pkg.version = '1.9.21';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.20["']/.test(forge), 'Squirrel 1.9.20 version anchor not found');
forge = forge.replace(/version:\s*["']1\.9\.20["']/, 'version: "1.9.21"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.21',
  hotfix:17,
  baseTag:'v1.9.20-hotfix16',
  presence:{
    authority:'server directory keyed by ESTUDEX user id',
    radminRole:'candidate transport only',
    onlineProof:'verified ESTUDEX direct-identify/beacon from Hotfix 16 scanner',
    onlineTtlMs:7500,
    offlineRetainMs:60000,
    rendererPreservesServerOnline:true
  },
  discovery:{
    addedSource:'%LOCALAPPDATA%/Famatech/Radmin VPN/phonebook.rpb',
    phonebookDecoding:['latin1','utf16le','utf8'],
    candidateCacheMs:4000,
    stableLocalRadminIpMs:30000,
    diagnosticRoute:'/api/social/presence-debug'
  },
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix17-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 17 / technical 1.9.21 authoritative presence patch applied.');
