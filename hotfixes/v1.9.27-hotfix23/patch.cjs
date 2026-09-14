const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 23 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix22-manifest.json')), 'Hotfix 22 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.26', 'expected technical baseline 1.9.26, got ' + pkg.version);

const cloudRel = 'public/js/estudex-v193-cloud-social-v1926.js';
let cloud = read(cloudRel);
must(cloud.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'Hotfix 22 cloud social baseline missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX23_SESSION_RESTORE'), 'Hotfix 23 appears already applied');

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');
const h22Manifest = JSON.parse(read('estudex-hotfix22-manifest.json'));

// H22 can call refreshRoomInvites() during restored-session startup, but the
// published client does not always define that helper. Expose a defensive
// global implementation before the restored session performs social refresh.
// This keeps startup alive and uses the H22 social API when room-invite listing
// is available; otherwise it safely returns an empty list instead of throwing.
const sessionRestoreFix = `\n/* ESTUDEX_V193_HOTFIX23_SESSION_RESTORE */\n(function installHotfix23SessionRestoreGuard(){\n  if (typeof window === 'undefined') return;\n  if (typeof window.refreshRoomInvites === 'function') return;\n\n  window.refreshRoomInvites = async function refreshRoomInvites(){\n    try {\n      const api = window.EstudexCloudSocial;\n      if (api && typeof api.listRoomInvites === 'function') {\n        const result = await api.listRoomInvites();\n        const invites = Array.isArray(result) ? result : (Array.isArray(result?.invites) ? result.invites : []);\n        try {\n          window.dispatchEvent(new CustomEvent('estudex:room-invites-refreshed', { detail: { invites, raw: result } }));\n        } catch (_) {}\n        return invites;\n      }\n    } catch (err) {\n      console.warn('[ESTUDEX H23] room invite refresh failed during session restore', err);\n    }\n    return [];\n  };\n})();\n`;

cloud += sessionRestoreFix;
write(cloudRel, cloud);

pkg.version = '1.9.27';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.26["']/.test(forge), 'Squirrel 1.9.26 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.26["']/, 'version: "1.9.27"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.27',
  hotfix: 23,
  baseTag: 'v1.9.26-hotfix22',
  mode: 'session-restore-fix-test',
  fixes: [
    'define refreshRoomInvites during restored-session startup',
    'prevent Guest session restore from falling back to auth screen on missing room-invite helper',
    'preserve H22 cloud social behavior and canonical V10.10 home assets'
  ],
  backend: h22Manifest.backend,
  identity: h22Manifest.identity,
  network: h22Manifest.network,
  canonicalHome: {
    js: homeJsBefore,
    css: homeCssBefore
  }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix23-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('ESTUDEX v1.9.3 Hotfix 23 / technical 1.9.27 session restore guard applied.');
