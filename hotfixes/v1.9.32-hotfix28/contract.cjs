const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 28 contract: ' + message); };

const pkg = JSON.parse(read('package.json'));
const forge = read('forge.config.js');
const ux = read('public/js/estudex-engine-ux-bindings.js');
const home = read('public/js/home.js');
const cloud = read('public/js/estudex-v193-cloud-social-v1926.js');
const engine = read('public/estudex-engine.js');
const socket = read('public/js/estudex-engine-socket-compat.js');
const h26runtime = read('public/js/estudex-v193-hotfix26-room-qol.js');
const manifest = JSON.parse(read('estudex-hotfix28-manifest.json'));

must(pkg.version === '1.9.32', 'package version');
must(/version:\s*["']1\.9\.32["']/.test(forge), 'forge version');

must(ux.includes('ESTUDEX_V193_HOTFIX28_FRIEND_BUTTON_ROUTE'), 'friend-button route marker missing');
const markerAt = ux.indexOf('ESTUDEX_V193_HOTFIX28_FRIEND_BUTTON_ROUTE');
const returnAt = ux.indexOf('if(canonicalInvite)return;', markerAt);
const cardAt = ux.indexOf("const card=event.target.closest?.('.network-user-card');", markerAt);
const stopAt = ux.indexOf('event.preventDefault();event.stopImmediatePropagation();', markerAt);
must(returnAt > markerAt, 'canonical friend button bypass missing');
must(cardAt > returnAt, 'profile-card route does not follow canonical button bypass');
must(stopAt > cardAt, 'capture interceptor can still stop the canonical add button before bypass');

must(home.includes("document.getElementById('addFriendResults')?.addEventListener('click', event => {"), 'canonical add-friend results click listener missing');
must(home.includes('addDetectedUserAsFriend(inviteBtn.dataset.inviteDetected, true);'), 'canonical add-friend click dispatch missing');
must(cloud.includes(`data-invite-detected="'+escapeHTML(user.id)+'"`), 'cloud search result does not expose canonical user id');
must(cloud.includes(`async function sendFriendRequest(target){const id=clean(target?.id||target);`), 'cloud friend sender canonical id normalization missing');
must(cloud.includes(`request('/api/friends/requests',{method:'POST',body:{receiverId:id}})`), 'cloud friend POST receiverId contract missing');

must(engine.includes('ESTUDEX_V193_HOTFIX27_CURSOR_DEDUPE'), 'Hotfix 27 cursor fix missing');
must(socket.includes('ESTUDEX_V193_HOTFIX27_CLOUD_ROOM_BOOTSTRAP_GATE'), 'Hotfix 27 room bootstrap gate missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX27_CLOUD_SESSION_READY'), 'Hotfix 27 cloud session-ready signal missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX25_ACCOUNT_LOGIN'), 'Hotfix 25 account login preservation marker missing');
must(h26runtime.includes("button.textContent='Encerrar transmissão'"), 'Hotfix 26 stop-broadcast control missing');

must(manifest.baseTag === 'v1.9.31-hotfix27', 'manifest base tag');
must(manifest.technicalVersion === '1.9.32', 'manifest technical version');
must(manifest.hotfix === 28, 'manifest hotfix number');
must(manifest.backend?.serverVersion === '0.3.2', 'backend version');
must(manifest.social?.friendButtonCaptureBypass === true, 'friend button bypass manifest flag');
must(manifest.social?.canonicalReceiverId === true, 'canonical receiver id manifest flag');
must(manifest.social?.friendRequestEndpoint === '/api/friends/requests', 'friend request endpoint manifest');
must(sha('public/js/home.js') === manifest.canonicalHome.js, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === manifest.canonicalHome.css, 'canonical V10.10 home.css changed');

console.log('ESTUDEX Hotfix 28 friend-button routing contract passed.');
