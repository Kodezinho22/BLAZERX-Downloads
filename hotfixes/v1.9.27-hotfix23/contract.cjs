const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 23 contract: ' + message); };

const pkg = JSON.parse(read('package.json'));
const forge = read('forge.config.js');
const cloud = read('public/js/estudex-v193-cloud-social-v1926.js');
const engine = read('public/estudex-engine.js');
const preload = read('preload.js');
const main = read('main.js');
const localServer = read('server.js');
const settings = read('public/js/estudex-v193-spec-settings.js');
const manifest = JSON.parse(read('estudex-hotfix23-manifest.json'));

must(pkg.version === '1.9.27', 'package version');
must(/version:\s*["']1\.9\.27["']/.test(forge), 'forge version');
must(cloud.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'H22 cloud social baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX23_SESSION_RESTORE'), 'H23 session restore marker missing');
must(cloud.includes('window.refreshRoomInvites = async function refreshRoomInvites'), 'refreshRoomInvites guard missing');
must(cloud.includes('typeof api.listRoomInvites === \'function\''), 'room invite API bridge missing');
must(cloud.includes("return [];"), 'safe room invite fallback missing');
must(engine.includes('ESTUDEX_V193_HOTFIX20_CLOUD_ROOM_TEST'), 'cloud room baseline missing');
must(engine.includes('ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO'), 'screen audio baseline missing');
must(main.includes('safeStorage') && main.includes('estudex:auth-session:get-v1926'), 'secure native session bridge missing');
must(localServer.includes('ESTUDEX_V193_HOTFIX22_CLOUD_ONLY_SOCIAL_TRANSPORT'), 'cloud-only social transport baseline missing');
must(!/radmin/i.test(settings), 'Radmin settings unexpectedly returned');
must(manifest.baseTag === 'v1.9.26-hotfix22', 'manifest base tag');
must(manifest.identity?.guestPersistent === true, 'persistent Guest flag missing');
must(sha('public/js/home.js') === manifest.canonicalHome.js, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === manifest.canonicalHome.css, 'canonical V10.10 home.css changed');

console.log('ESTUDEX Hotfix 23 session restore contract passed.');
