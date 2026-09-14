const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(c,m)=>{if(!c)throw new Error('Hotfix 19 contract: '+m)};
const section=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,'missing section '+a);const j=s.indexOf(b,i+a.length);assert(j>i,'missing section end '+b);return s.slice(i,j);};
const server=read('server.js');
const engine=read('public/estudex-engine.js');
const pkg=JSON.parse(read('package.json'));
const forge=read('forge.config.js');
const manifest=JSON.parse(read('estudex-hotfix19-manifest.json'));
assert(pkg.version==='1.9.23','package version must be 1.9.23');
assert(/version:\s*["']1\.9\.23["']/.test(forge),'Squirrel version must be 1.9.23');
assert(server.includes('ESTUDEX_V193_HOTFIX19_DIRECT_RADMIN_LAN'),'H19 server marker missing');
assert(server.includes('estudexMinecraftLanSnapshotV199'),'H19 direct LAN snapshot missing');
assert(server.includes('await estudexLanSnapshotBaseV187(waitMs)'),'H19 must consume raw pre-wrapper V172 snapshot');
assert(server.includes("accept(peer, 'radmin-v172-lan-v199')"),'V172 LAN proof wiring missing');
assert(server.includes("discovery:deep?'minecraft-radmin-lan-v199-deep':'minecraft-radmin-lan-v199'"),'H19 route marker missing');

const payload=section(server,'function estudexLanPresencePayloadV172() {','function estudexLanAnnounceV172');
assert(!payload.includes('estudexSocialPublicOnlineV190()'),'V172 payload still depends on public-online heartbeat state');
assert(payload.includes('estudexSocialInvisibleV190()'),'Invisible privacy gate must remain');
const timer=section(server,'estudexLanHeartbeatTimerV172 = setInterval','}, 2200);');
assert(!timer.includes('!isAppHeartbeatOnlineV122()'),'V172 sender still depends on renderer heartbeat');
assert(timer.includes('estudexLanAnnounceV172()'),'V172 timer must still announce');

const h19=section(server,'ESTUDEX_V193_HOTFIX19_DIRECT_RADMIN_LAN','const server = http.createServer');
assert(!h19.includes('estudexPresenceDirectoryV197'),'H19 normal path must not use H17 presence directory');
assert(!h19.includes('estudexRadminCandidateIpsV196'),'H19 normal path must not use Radmin candidate scanner');
assert(!h19.includes('estudexDirectPresenceSnapshotV195'),'H19 normal path must not use direct-identify proof cache');
assert(!h19.includes('estudexRadminPhonebookIpsV197'),'H19 normal path must not read Radmin phonebook');
assert(!h19.includes('estudexRadminUiIpsV196'),'H19 normal path must not scrape Radmin UI');

assert(engine.includes('ESTUDEX_V193_HOTFIX17_AUTHORITATIVE_PRESENCE_UI'),'renderer online-state fix must be preserved');
assert(engine.includes('.map(user=>normalizeFriend({...user,online:Boolean(user?.online)}))'),'renderer must preserve server online state');
assert(!engine.includes('.map(user=>normalizeFriend({...user,online:true}))'),'renderer must not force peers online');
assert(manifest.discovery?.normalPath==='raw V172 peer map only','manifest normal path mismatch');
assert(manifest.discovery?.appOpenMeansDiscoverable===true,'app-open discovery contract missing');
assert(manifest.discovery?.rendererHeartbeatRequiredForBeacon===false,'heartbeat independence missing');

const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
assert(sha('public/js/home.js')===manifest.canonicalHome.js,'canonical home.js changed');
assert(sha('public/css/home.css')===manifest.canonicalHome.css,'canonical home.css changed');
console.log('Hotfix 19 direct Radmin LAN contracts passed.');
