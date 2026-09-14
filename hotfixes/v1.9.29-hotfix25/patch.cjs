const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 25 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix24-manifest.json')), 'Hotfix 24 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.28', 'expected technical baseline 1.9.28, got ' + pkg.version);

const cloudRel = 'public/js/estudex-v193-cloud-social-v1926.js';
let cloud = read(cloudRel);
must(cloud.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'Hotfix 22 cloud social baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX23_SESSION_RESTORE'), 'Hotfix 23 session restore baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX24_GUEST_UPGRADE_PROFILE'), 'Hotfix 24 Guest upgrade baseline missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX25_ACCOUNT_LOGIN'), 'Hotfix 25 appears already applied');
must(cloud.includes('async function writeToken(token)'), 'secure session writer missing');

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');
const h24Manifest = JSON.parse(read('estudex-hotfix24-manifest.json'));

// Backend v0.3.2 verifies the newly registered Guest credentials by performing
// a real password login and returns that verified session. Persist it so the
// renderer and native safeStorage both move to the authenticated account session.
const oldUpgrade = "const data=await request('/api/auth/upgrade-guest',{method:'POST',body:input});setUser(data.user);applyCloudIdentityToCanonical();return data.user;";
const newUpgrade = "const data=await request('/api/auth/upgrade-guest',{method:'POST',body:input});if(data.sessionToken)await writeToken(data.sessionToken);setUser(data.user);applyCloudIdentityToCanonical();return data.user;";
must(cloud.includes(oldUpgrade), 'Hotfix 24 Guest upgrade implementation anchor missing');
cloud = cloud.replace(oldUpgrade, newUpgrade);
cloud += '\n/* ESTUDEX_V193_HOTFIX25_ACCOUNT_LOGIN */\n';
write(cloudRel, cloud);

pkg.version = '1.9.29';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.28["']/.test(forge), 'Squirrel 1.9.28 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.28["']/, 'version: "1.9.29"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.29',
  hotfix: 25,
  baseTag: 'v1.9.28-hotfix24',
  mode: 'verified-guest-account-login',
  fixes: [
    'use the backend verified password-login session after Guest -> registered account conversion',
    'allow the converted account to sign back in with @username or email and password through backend v0.3.2',
    'only accept Guest conversion as successful after backend credential verification',
    'preserve the same immutable user identity and linked profile/social data',
    'preserve Hotfix 24 Guest account UI, Hotfix 23 session restore and canonical V10.10 home assets'
  ],
  backend: { ...h24Manifest.backend, serverVersion: '0.3.2', passwordLoginVerified: true },
  identity: { ...h24Manifest.identity, verifiedUpgradeSession: true },
  network: h24Manifest.network,
  canonicalHome: { js: homeJsBefore, css: homeCssBefore }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix25-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('ESTUDEX v1.9.3 Hotfix 25 / technical 1.9.29 verified Guest account login applied.');
