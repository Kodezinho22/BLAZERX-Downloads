const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 15 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let server = read('server.js');
must(server.includes('ESTUDEX_V193_HOTFIX14_VERIFIED_DEEP_LAN_ROUTE'), 'Hotfix 14 server baseline not found');
must(server.includes('ESTUDEX_V187_VERIFIED_LAN_IDENTITY'), 'verified LAN identity baseline not found');
must(!server.includes('ESTUDEX_V193_HOTFIX15_PROOF_HYBRID_PRESENCE'), 'Hotfix 15 already applied');

server = server.replace(
  'const ESTUDEX_LAN_VERIFY_TTL_V187 = 12000;',
  'const ESTUDEX_LAN_VERIFY_TTL_V187 = 4000;'
);
must(server.includes('const ESTUDEX_LAN_VERIFY_TTL_V187 = 4000;'), 'verification TTL was not tightened');

const snapshotAnchor = `  estudexLanSnapshotV172 = async function estudexLanSnapshotVerifiedV187(waitMs = 650) {\n    const candidates = await estudexLanSnapshotBaseV187(waitMs);\n    const checked = await Promise.all((Array.isArray(candidates) ? candidates : []).map(estudexVerifyLanCandidateV187));\n    return checked.filter(Boolean);\n  };`;
must(server.includes(snapshotAnchor), 'verified snapshot anchor not found');

const hybridPatch = `${snapshotAnchor}\n\n  /* ESTUDEX_V193_HOTFIX15_PROOF_HYBRID_PRESENCE\n     Radmin is transport only. A peer is online only when a remote ESTUDEX\n     instance proves liveness through /api/social/direct-identify. The verified\n     UDP beacon remains fast-path metadata; Windows neighbours + TCP/8787 are\n     the automatic fallback when UDP/multicast is filtered. */\n  const estudexLanSnapshotProofBeforeV195 = estudexLanSnapshotV172;\n  const ESTUDEX_DIRECT_PRESENCE_CACHE_MS_V195 = 2400;\n  let estudexDirectPresenceCacheV195 = { at:0, users:[], pending:null };\n\n  function estudexClonePresenceUsersV195(users) {\n    return (Array.isArray(users) ? users : [])\n      .filter(user => user && user.id && user.endpoint)\n      .map(user => ({ ...user }));\n  }\n\n  async function estudexDirectPresenceSnapshotV195() {\n    const now = Date.now();\n    if (estudexDirectPresenceCacheV195.at && now - estudexDirectPresenceCacheV195.at < ESTUDEX_DIRECT_PRESENCE_CACHE_MS_V195) {\n      return estudexClonePresenceUsersV195(estudexDirectPresenceCacheV195.users);\n    }\n    if (estudexDirectPresenceCacheV195.pending) return estudexDirectPresenceCacheV195.pending;\n\n    estudexDirectPresenceCacheV195.pending = (async () => {\n      let ips = [];\n      try { ips = await estudexRadminNeighborIpsV170(); } catch {}\n      const observed = await Promise.all((Array.isArray(ips) ? ips : []).map(ip => estudexDirectIdentifyV170(ip)));\n      const users = [];\n      const verifiedAt = Date.now();\n      const selfId = String(socialOwner?.userId || '');\n      for (const user of observed) {\n        const id = String(user?.id || '').trim();\n        if (!id || id === selfId || !user?.endpoint) continue;\n        users.push({\n          ...user,\n          online:true,\n          lastSeen:verifiedAt,\n          verifiedAt,\n          presenceProof:'direct-identify-v195'\n        });\n      }\n      estudexDirectPresenceCacheV195 = { at:verifiedAt, users, pending:null };\n      return estudexClonePresenceUsersV195(users);\n    })();\n\n    try {\n      return await estudexDirectPresenceCacheV195.pending;\n    } finally {\n      estudexDirectPresenceCacheV195.pending = null;\n    }\n  }\n\n  estudexLanSnapshotV172 = async function estudexLanSnapshotProofHybridV195(waitMs = 650) {\n    const directPromise = estudexDirectPresenceSnapshotV195();\n    const beaconUsers = await estudexLanSnapshotProofBeforeV195(waitMs);\n    const directUsers = await directPromise;\n    const merged = new Map();\n    const now = Date.now();\n    const selfId = String(socialOwner?.userId || '');\n\n    for (const user of directUsers) {\n      const id = String(user?.id || '').trim();\n      if (!id || id === selfId || !user?.endpoint) continue;\n      merged.set(id, { ...user, online:true, verifiedAt:Number(user.verifiedAt || now), presenceProof:'direct-identify-v195' });\n    }\n    for (const user of (Array.isArray(beaconUsers) ? beaconUsers : [])) {\n      const id = String(user?.id || '').trim();\n      if (!id || id === selfId || !user?.endpoint) continue;\n      merged.set(id, {\n        ...merged.get(id),\n        ...user,\n        online:true,\n        verifiedAt:now,\n        presenceProof:'verified-beacon-v195'\n      });\n    }\n\n    return [...merged.values()]\n      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));\n  };`;
server = server.replace(snapshotAnchor, hybridPatch);
server = server.replace(
  "discovery:deep?'lan-beacon-v172-deep':'lan-beacon-v172',",
  "discovery:deep?'proof-hybrid-v195-deep':'proof-hybrid-v195',"
);
must(server.includes("discovery:deep?'proof-hybrid-v195-deep':'proof-hybrid-v195'"), 'lan-peers diagnostic source not updated');
write('server.js', server);

let engine = read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX14_RADMIN_PROOF_DEEP_SCAN'), 'Hotfix 14 renderer baseline not found');
must(engine.includes('const RADMIN_PEER_GRACE_MS_V194 = 14000;'), 'Hotfix 14 peer grace anchor not found');
engine = engine.replace(
  'const RADMIN_PEER_GRACE_MS_V194 = 14000;',
  `/* ESTUDEX_V193_HOTFIX15_PROOF_PRESENCE_UI */\n  const RADMIN_PEER_GRACE_MS_V194 = 9000;`
);
write('public/estudex-engine.js', engine);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.18', 'expected technical version 1.9.18, got ' + pkg.version);
pkg.version = '1.9.19';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.18["']/.test(forge), 'Squirrel 1.9.18 version anchor not found');
forge = forge.replace(/version:\s*["']1\.9\.18["']/, 'version: "1.9.19"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.19',
  hotfix:15,
  baseTag:'v1.9.18-hotfix14',
  presence:{
    radminIsTransportOnly:true,
    onlineProof:['verified-udp-candidate + direct-identify','windows-neighbour + direct-identify'],
    verifyCacheMs:4000,
    uiGraceMs:9000
  },
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix15-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 15 / technical 1.9.19 presence patch applied.');
