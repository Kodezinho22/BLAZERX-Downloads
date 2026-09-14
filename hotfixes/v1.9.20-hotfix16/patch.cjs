const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 16 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let server = read('server.js');
must(server.includes('ESTUDEX_V193_HOTFIX15_PROOF_HYBRID_PRESENCE'), 'Hotfix 15 server baseline not found');
must(server.includes('async function estudexDirectPresenceSnapshotV195()'), 'Hotfix 15 direct presence function not found');
must(server.includes('ips = await estudexRadminNeighborIpsV170();'), 'Hotfix 15 neighbour-only candidate source not found');
must(!server.includes('ESTUDEX_V193_HOTFIX16_RADMIN_MEMBER_CANDIDATES'), 'Hotfix 16 already applied');

const directAnchor = '  async function estudexDirectPresenceSnapshotV195() {';
const candidateHelpers = `  /* ESTUDEX_V193_HOTFIX16_RADMIN_MEMBER_CANDIDATES\n     Hotfix 15 proved whether a candidate really had ESTUDEX open, but the\n     fallback candidate list still came only from ARP/Windows neighbours.\n     Radmin can show a member in its own UI before Windows creates an ARP row.\n     Hotfix 16 therefore gathers candidate 26.x addresses from multiple local\n     evidence sources, then STILL requires direct-identify on TCP/8787 before\n     anybody is considered Online. */\n  const ESTUDEX_RADMIN_CANDIDATE_CACHE_MS_V196 = 12000;\n  const ESTUDEX_RADMIN_KNOWN_IPS_PATH_V196 = path.join(path.dirname(uploadDir), 'estudex-known-radmin-ips-v1.json');\n  let estudexRadminCandidateCacheV196 = { at:0, ips:[], pending:null };\n  const estudexKnownRadminIpsV196 = new Set();\n\n  function estudexCandidateIpV196(value) {\n    const ip = String(value || '').trim();\n    if (!/^26(?:\\.\\d{1,3}){3}$/.test(ip)) return '';\n    if (ip === '26.255.255.255' || ip === estudexRadminIpV170()) return '';\n    const parts = ip.split('.').map(Number);\n    if (parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return '';\n    return ip;\n  }\n\n  function estudexExtractRadminIpsV196(text, target) {\n    const out = target || new Set();\n    for (const match of String(text || '').matchAll(/\\b26(?:\\.\\d{1,3}){3}\\b/g)) {\n      const ip = estudexCandidateIpV196(match[0]);\n      if (ip) out.add(ip);\n    }\n    return out;\n  }\n\n  function estudexEndpointIpV196(endpoint) {\n    try { return estudexCandidateIpV196(new URL(String(endpoint || '')).hostname); } catch { return ''; }\n  }\n\n  function estudexRememberRadminIpV196(value) {\n    const ip = estudexCandidateIpV196(value);\n    if (!ip || estudexKnownRadminIpsV196.has(ip)) return;\n    estudexKnownRadminIpsV196.add(ip);\n    try {\n      fs.mkdirSync(path.dirname(ESTUDEX_RADMIN_KNOWN_IPS_PATH_V196), { recursive:true });\n      fs.writeFileSync(ESTUDEX_RADMIN_KNOWN_IPS_PATH_V196, JSON.stringify([...estudexKnownRadminIpsV196].slice(-256), null, 2), 'utf8');\n    } catch {}\n  }\n\n  try {\n    if (fs.existsSync(ESTUDEX_RADMIN_KNOWN_IPS_PATH_V196)) {\n      const saved = JSON.parse(fs.readFileSync(ESTUDEX_RADMIN_KNOWN_IPS_PATH_V196, 'utf8'));\n      if (Array.isArray(saved)) for (const value of saved) {\n        const ip = estudexCandidateIpV196(value);\n        if (ip) estudexKnownRadminIpsV196.add(ip);\n      }\n    }\n  } catch {}\n\n  function estudexKnownStateIpsV196(target) {\n    const out = target || new Set();\n    try {\n      for (const friend of socialFriendsV115.values()) {\n        const ip = estudexEndpointIpV196(friend?.endpoint);\n        if (ip) out.add(ip);\n      }\n    } catch {}\n    try {\n      for (const peer of estudexLanPeersV172.values()) {\n        const ip = estudexCandidateIpV196(peer?.radminIp) || estudexEndpointIpV196(peer?.endpoint);\n        if (ip) out.add(ip);\n      }\n    } catch {}\n    try {\n      for (const item of socialInbox || []) {\n        for (const field of ['endpoint','senderEndpoint','host','hostEndpoint']) {\n          const ip = estudexEndpointIpV196(item?.[field] || item?.payload?.[field]);\n          if (ip) out.add(ip);\n        }\n      }\n    } catch {}\n    try {\n      for (const room of savedRoomsV120.values()) {\n        const ip = estudexEndpointIpV196(room?.hostEndpoint || room?.host);\n        if (ip) out.add(ip);\n      }\n    } catch {}\n    for (const ip of estudexKnownRadminIpsV196) out.add(ip);\n    return out;\n  }\n\n  async function estudexRadminUiIpsV196() {\n    if (process.platform !== 'win32') return [];\n    const ps = [\n      \"$ErrorActionPreference='SilentlyContinue'\",\n      \"Add-Type -AssemblyName UIAutomationClient\",\n      \"$ips=New-Object 'System.Collections.Generic.HashSet[string]'\",\n      \"$rx='\\\\b26(?:\\\\.\\\\d{1,3}){3}\\\\b'\",\n      \"$procs=Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.MainWindowTitle -match 'Radmin\\\\s*VPN' -or $_.ProcessName -match 'Radmin') }\",\n      \"foreach($p in $procs){ try { $root=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle); if($root){ $els=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition); foreach($el in $els){ $name=[string]$el.Current.Name; foreach($m in [regex]::Matches($name,$rx)){ [void]$ips.Add($m.Value) } } } } catch {} }\",\n      \"$ips | Sort-Object -Unique\"\n    ].join('; ');\n    try {\n      const encoded = Buffer.from(ps, 'utf16le').toString('base64');\n      const output = await estudexExecHiddenV170('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',encoded], 2200);\n      return [...estudexExtractRadminIpsV196(output)];\n    } catch { return []; }\n  }\n\n  async function estudexRadminSystemIpsV196() {\n    if (process.platform !== 'win32') return [];\n    const outputs = await Promise.all([\n      estudexExecHiddenV170('netstat.exe', ['-ano'], 1600),\n      estudexExecHiddenV170('reg.exe', ['query','HKLM\\\\SOFTWARE\\\\WOW6432Node\\\\Famatech\\\\RadminVPN\\\\1.0','/s'], 1300),\n      estudexExecHiddenV170('reg.exe', ['query','HKLM\\\\SOFTWARE\\\\Famatech\\\\RadminVPN\\\\1.0','/s'], 1300)\n    ]);\n    const out = new Set();\n    for (const text of outputs) estudexExtractRadminIpsV196(text, out);\n    return [...out];\n  }\n\n  function estudexRadminLocalFileIpsV196() {\n    if (process.platform !== 'win32') return [];\n    const roots = [\n      path.join(process.env.ProgramData || 'C:/ProgramData', 'Famatech'),\n      path.join(process.env.LOCALAPPDATA || '', 'Famatech'),\n      path.join(process.env.APPDATA || '', 'Famatech')\n    ].filter(Boolean);\n    const out = new Set();\n    let inspected = 0;\n    const walk = (dir, depth) => {\n      if (!dir || depth > 2 || inspected >= 40) return;\n      let entries = [];\n      try { entries = fs.readdirSync(dir, { withFileTypes:true }); } catch { return; }\n      for (const entry of entries) {\n        if (inspected >= 40) break;\n        const full = path.join(dir, entry.name);\n        if (entry.isDirectory()) { walk(full, depth + 1); continue; }\n        if (!/\\.(?:log|txt|ini|cfg|json|xml)$/i.test(entry.name)) continue;\n        try {\n          const stat = fs.statSync(full);\n          if (!stat.isFile() || stat.size <= 0 || stat.size > 2 * 1024 * 1024) continue;\n          inspected++;\n          const fd = fs.openSync(full, 'r');\n          const size = Math.min(stat.size, 384 * 1024);\n          const buf = Buffer.alloc(size);\n          fs.readSync(fd, buf, 0, size, Math.max(0, stat.size - size));\n          fs.closeSync(fd);\n          estudexExtractRadminIpsV196(buf.toString('utf8'), out);\n        } catch {}\n      }\n    };\n    for (const dir of roots) walk(dir, 0);\n    return [...out];\n  }\n\n  async function estudexRadminCandidateIpsV196() {\n    const now = Date.now();\n    if (estudexRadminCandidateCacheV196.at && now - estudexRadminCandidateCacheV196.at < ESTUDEX_RADMIN_CANDIDATE_CACHE_MS_V196) {\n      return [...estudexRadminCandidateCacheV196.ips];\n    }\n    if (estudexRadminCandidateCacheV196.pending) return estudexRadminCandidateCacheV196.pending;\n    estudexRadminCandidateCacheV196.pending = (async () => {\n      const found = estudexKnownStateIpsV196(new Set());\n      let neighbours = [];\n      try { neighbours = await estudexRadminNeighborIpsV170(); } catch {}\n      for (const ip of neighbours) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      const [uiIps, systemIps] = await Promise.all([estudexRadminUiIpsV196(), estudexRadminSystemIpsV196()]);\n      for (const ip of uiIps) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      for (const ip of systemIps) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      for (const ip of estudexRadminLocalFileIpsV196()) { const clean = estudexCandidateIpV196(ip); if (clean) found.add(clean); }\n      const ips = [...found].slice(0, 128);\n      estudexRadminCandidateCacheV196 = { at:Date.now(), ips, pending:null };\n      return [...ips];\n    })();\n    try { return await estudexRadminCandidateCacheV196.pending; }\n    finally { estudexRadminCandidateCacheV196.pending = null; }\n  }\n\n`;
server = server.replace(directAnchor, candidateHelpers + directAnchor);
server = server.replace('try { ips = await estudexRadminNeighborIpsV170(); } catch {}', 'try { ips = await estudexRadminCandidateIpsV196(); } catch {}');
server = server.replaceAll("presenceProof:'direct-identify-v195'", "presenceProof:'direct-identify-v196'");
server = server.replaceAll("presenceProof:'verified-beacon-v195'", "presenceProof:'verified-beacon-v196'");
server = server.replace(
  "discovery:deep?'proof-hybrid-v195-deep':'proof-hybrid-v195',",
  "discovery:deep?'radmin-member-proof-v196-deep':'radmin-member-proof-v196',"
);

const rememberAnchor = `        users.push({\n          ...user,\n          online:true,\n          lastSeen:verifiedAt,\n          verifiedAt,\n          presenceProof:'direct-identify-v196'\n        });`;
must(server.includes(rememberAnchor), 'successful direct identify anchor not found');
server = server.replace(rememberAnchor, `${rememberAnchor}\n        estudexRememberRadminIpV196(user?.radminIp || estudexEndpointIpV196(user?.endpoint));`);

must(server.includes('ESTUDEX_V193_HOTFIX16_RADMIN_MEMBER_CANDIDATES'), 'Hotfix 16 marker missing after patch');
must(server.includes('ips = await estudexRadminCandidateIpsV196();'), 'candidate collector not wired into direct presence');
must(server.includes("discovery:deep?'radmin-member-proof-v196-deep':'radmin-member-proof-v196'"), 'diagnostic source not updated');
write('server.js', server);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.19', 'expected technical version 1.9.19, got ' + pkg.version);
pkg.version = '1.9.20';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.19["']/.test(forge), 'Squirrel 1.9.19 version anchor not found');
forge = forge.replace(/version:\s*["']1\.9\.19["']/, 'version: "1.9.20"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.20',
  hotfix:16,
  baseTag:'v1.9.19-hotfix15',
  discovery:{
    candidateSources:['verified UDP beacon','Windows ARP/neighbours','known ESTUDEX endpoints','Radmin GUI accessibility tree','Radmin local text/log/config files','Windows netstat/registry'],
    onlineProof:'TCP 8787 /api/social/direct-identify only',
    candidateCacheMs:12000,
    remembersSuccessfullyVerifiedIps:true
  },
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix16-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 16 / technical 1.9.20 Radmin member discovery patch applied.');
