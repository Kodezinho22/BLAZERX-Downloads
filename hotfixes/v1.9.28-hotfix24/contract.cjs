const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 24 contract: ' + message); };

const pkg = JSON.parse(read('package.json'));
const forge = read('forge.config.js');
const cloud = read('public/js/estudex-v193-cloud-social-v1926.js');
const index = read('public/index.html');
const manifest = JSON.parse(read('estudex-hotfix24-manifest.json'));

must(pkg.version === '1.9.28', 'package version');
must(/version:\s*["']1\.9\.28["']/.test(forge), 'forge version');
must(cloud.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'H22 cloud social baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX23_SESSION_RESTORE'), 'H23 session restore baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX24_GUEST_UPGRADE_PROFILE'), 'H24 guest upgrade marker missing');
must(cloud.includes("/api/auth/upgrade-guest"), 'Guest upgrade endpoint missing');
must(cloud.includes('applyCloudIdentityToCanonical();return data.user;'), 'canonical identity refresh after upgrade missing');
must(index.includes('id="guestUpgradeProfileCard"'), 'Guest upgrade profile card missing');
must(index.includes('id="profileUpgradeGuest"'), 'Guest upgrade profile button missing');
must(index.includes('id="guestUpgradeModal"'), 'Guest upgrade form modal missing');
must(index.includes('id="guestUpgradePasswordConfirm"'), 'Guest password confirmation missing');
must(index.includes('Dica: procure pelo @usuário exato para encontrar alguém mais rápido.'), 'friend-search guidance missing');
must(!index.includes('As solicitações de amizade são sincronizadas pela internet.'), 'obsolete friend sync notice still present');
must(manifest.baseTag === 'v1.9.27-hotfix23', 'manifest base tag');
must(manifest.identity?.guestPersistent === true, 'persistent Guest flag missing');
must(manifest.identity?.guestUpgradeFromProfile === true, 'Guest profile upgrade flag missing');
must(sha('public/js/home.js') === manifest.canonicalHome.js, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === manifest.canonicalHome.css, 'canonical V10.10 home.css changed');

console.log('ESTUDEX Hotfix 24 Guest account upgrade/search guidance contract passed.');
