const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 25 contract: ' + message); };

const pkg = JSON.parse(read('package.json'));
const forge = read('forge.config.js');
const cloud = read('public/js/estudex-v193-cloud-social-v1926.js');
const index = read('public/index.html');
const manifest = JSON.parse(read('estudex-hotfix25-manifest.json'));

must(pkg.version === '1.9.29', 'package version');
must(/version:\s*["']1\.9\.29["']/.test(forge), 'forge version');
must(cloud.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'H22 cloud social baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX23_SESSION_RESTORE'), 'H23 session restore baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX24_GUEST_UPGRADE_PROFILE'), 'H24 Guest upgrade marker missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX25_ACCOUNT_LOGIN'), 'H25 account login marker missing');
must(cloud.includes('async function writeToken(token)'), 'secure session writer missing');
must(cloud.includes("const data=await request('/api/auth/upgrade-guest',{method:'POST',body:input});if(data.sessionToken)await writeToken(data.sessionToken);setUser(data.user);applyCloudIdentityToCanonical();return data.user;"), 'verified Guest upgrade session bridge missing');
must(index.includes('id="guestUpgradeProfileCard"'), 'Guest upgrade profile card missing');
must(index.includes('id="guestUpgradeModal"'), 'Guest upgrade modal missing');
must(index.includes('Dica: procure pelo @usuário exato para encontrar alguém mais rápido.'), 'friend-search guidance missing');
must(manifest.baseTag === 'v1.9.28-hotfix24', 'manifest base tag');
must(manifest.technicalVersion === '1.9.29', 'manifest technical version');
must(manifest.hotfix === 25, 'manifest hotfix number');
must(manifest.backend?.serverVersion === '0.3.2', 'backend version');
must(manifest.backend?.passwordLoginVerified === true, 'backend password-login verification flag');
must(manifest.identity?.verifiedUpgradeSession === true, 'verified upgrade session flag');
must(manifest.identity?.guestPersistent === true, 'persistent Guest flag missing');
must(sha('public/js/home.js') === manifest.canonicalHome.js, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === manifest.canonicalHome.css, 'canonical V10.10 home.css changed');

console.log('ESTUDEX Hotfix 25 verified Guest account login contract passed.');
