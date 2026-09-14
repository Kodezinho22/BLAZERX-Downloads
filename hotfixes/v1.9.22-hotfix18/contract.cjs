const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(c,m)=>{if(!c)throw new Error('Hotfix 18 contract: '+m)};
const server=read('server.js');
const engine=read('public/estudex-engine.js');
const pkg=JSON.parse(read('package.json'));
const forge=read('forge.config.js');
const manifest=JSON.parse(read('estudex-hotfix18-manifest.json'));

assert(pkg.version==='1.9.22','package version must be 1.9.22');
assert(/version:\s*["']1\.9\.22["']/.test(forge),'Squirrel version must be 1.9.22');
assert(server.includes('ESTUDEX_V193_HOTFIX18_RESTORE_MINECRAFT_RADMIN_LAN'),'Hotfix 18 server marker missing');
assert(server.includes('ESTUDEX_LAN_PRESENCE_V172'),'original V172 LAN beacon engine missing');
assert(server.includes("const ESTUDEX_LAN_GROUP_V172 = '239.255.77.77';"),'multicast LAN group missing');
assert(server.includes('const estudexLanSnapshotBaseV187 = estudexLanSnapshotV172;'),'raw V172 snapshot handle missing');
assert(server.includes('beaconUsers = await estudexLanSnapshotBaseV187(waitMs)'),'normal path must consume raw V172 beacon snapshot');
assert(server.includes("presenceProof:'radmin-lan-beacon-v198'") || server.includes("'radmin-lan-beacon-v198'"),'LAN beacon proof missing');
assert(server.includes('fallbackUsers = await estudexBrowseRadminUsersV170()'),'deep LAN fallback missing');
assert(server.includes("presenceProof:'radmin-lan-offline-v198'") || server.includes("'radmin-lan-offline-v198'"),'offline state proof missing');
assert(server.includes('estudexLanSnapshotMinecraftV198'),'final snapshot override missing');
assert(server.includes('let users=await estudexMinecraftLanSnapshotV198(deep?1150:700,{deep});'),'lan-peers must use restored Minecraft LAN snapshot');
assert(server.includes('const second=await estudexMinecraftLanSnapshotV198(1150,{deep:true});'),'deep refresh must use restored path');
assert(server.includes("discovery:deep?'minecraft-radmin-lan-v198-deep':'minecraft-radmin-lan-v198'"),'new discovery marker missing');
assert(server.includes('const radminIp = estudexRadminIpV170();'),'lan-peers must use direct Radmin virtual adapter detection');
assert(manifest.discovery?.normalPathReadsRadminMemberUi===false,'normal path must not read Radmin UI');
assert(manifest.discovery?.normalPathReadsRadminPhonebook===false,'normal path must not read Radmin phonebook');
assert(manifest.discovery?.primary==='raw V172 ESTUDEX UDP presence beacons','manifest primary discovery wrong');
assert(manifest.discovery?.onlineMeaning==='fresh ESTUDEX presence, never Radmin member status','online meaning contract wrong');

/* Preserve the Hotfix 17 renderer fix: the UI respects server presence and never
   promotes every Radmin-discovered card to Online. */
assert(engine.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI'),'Hotfix 17 renderer marker missing');
assert(engine.includes('.map(user=>normalizeFriend({...user,online:Boolean(user?.online)}))'),'listPeers must preserve online state');
assert(!engine.includes('.map(user=>normalizeFriend({...user,online:true}))'),'renderer must not force every peer online');
assert(engine.includes('friend.online=Boolean(live?.online)&&'),'friend refresh must require peer presence');
assert(engine.includes('const publicOnline = Boolean(peer?.online) && isPublicOnlineV194(friend.status);'),'friend reconciliation must require peer presence');

const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
assert(sha('public/js/home.js')===manifest.canonicalHome.js,'canonical home.js changed');
assert(sha('public/css/home.css')===manifest.canonicalHome.css,'canonical home.css changed');
console.log('Hotfix 18 Minecraft-style Radmin LAN discovery contracts passed.');
