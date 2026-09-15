const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 28 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix27-manifest.json')), 'Hotfix 27 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.31', 'expected technical baseline 1.9.31, got ' + pkg.version);

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');
const h27Manifest = JSON.parse(read('estudex-hotfix27-manifest.json'));

// The exact Hotfix 27 package has two click paths for the people-search result:
// - the canonical #addFriendResults bubble handler sends the cloud friend request;
// - a capture-phase profile-preview interceptor also sees the same
//   [data-invite-detected] button and calls stopImmediatePropagation first.
// In cloud mode that interceptor then searches only the old detected-network list,
// so the normal "Adicionar amigo" button can be swallowed before the POST runs.
// Keep the preview interceptor for card clicks, but let the canonical add button
// continue to its existing bubble handler, which already sends the immutable user id.
const uxRel = 'public/js/estudex-engine-ux-bindings.js';
let ux = read(uxRel);
must(!ux.includes('ESTUDEX_V193_HOTFIX28_FRIEND_BUTTON_ROUTE'), 'Hotfix 28 appears already applied');
const oldRoute = `    const canonicalInvite=event.target.closest?.('[data-invite-detected]');\n    const card=event.target.closest?.('.network-user-card');\n    if(!canonicalInvite&&!card)return;`;
const newRoute = `    const canonicalInvite=event.target.closest?.('[data-invite-detected]');\n    /* ESTUDEX_V193_HOTFIX28_FRIEND_BUTTON_ROUTE */\n    // Normal cloud-search add buttons belong to the canonical #addFriendResults\n    // bubble handler. Do not swallow them in this capture-phase profile preview.\n    if(canonicalInvite)return;\n    const card=event.target.closest?.('.network-user-card');\n    if(!card)return;`;
must(ux.includes(oldRoute), 'friend-button capture route anchor missing');
ux = ux.replace(oldRoute, newRoute);
write(uxRel, ux);

// Preserve the cloud request contract: search results carry the canonical user id,
// and the cloud adapter POSTs that exact id as receiverId. Hotfix 28 only repairs
// event routing; it must not fall back to display names or @handles.
const cloudRel = 'public/js/estudex-v193-cloud-social-v1926.js';
const cloud = read(cloudRel);
must(cloud.includes(`data-invite-detected="'+escapeHTML(user.id)+'"`), 'cloud result no longer carries canonical user id');
must(cloud.includes(`request('/api/friends/requests',{method:'POST',body:{receiverId:id}})`), 'cloud friend POST receiverId contract missing');

pkg.version = '1.9.32';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.31["']/.test(forge), 'Squirrel 1.9.31 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.31["']/, 'version: "1.9.32"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.32',
  hotfix: 28,
  baseTag: 'v1.9.31-hotfix27',
  mode: 'cloud-friend-button-routing',
  fixes: [
    'allow the normal Add friend button in internet people-search results to reach the canonical friend-request handler instead of being swallowed by the capture-phase profile-preview interceptor',
    'preserve the canonical immutable cloud user id as receiverId for POST /api/friends/requests',
    'preserve Hotfix 27 capture/recent-room fixes, Hotfix 26 room UX and Hotfix 25 persistent account login'
  ],
  backend: h27Manifest.backend,
  identity: h27Manifest.identity,
  network: h27Manifest.network,
  roomUx: h27Manifest.roomUx,
  capture: h27Manifest.capture,
  social: {
    friendButtonCaptureBypass: true,
    canonicalReceiverId: true,
    friendRequestEndpoint: '/api/friends/requests'
  },
  canonicalHome: { js: homeJsBefore, css: homeCssBefore }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix28-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('ESTUDEX v1.9.3 Hotfix 28 / technical 1.9.32 friend-button routing fix applied.');
