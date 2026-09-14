const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 27 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix26-manifest.json')), 'Hotfix 26 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.30', 'expected technical baseline 1.9.30, got ' + pkg.version);

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');
const h26Manifest = JSON.parse(read('estudex-hotfix26-manifest.json'));

// 1) Chromium/Electron may composite the Windows hardware cursor into a desktop
// capture even when the game already renders its own cursor. Request a cursor-free
// video capture so viewers receive only the cursor drawn by the shared content.
const engineRel = 'public/estudex-engine.js';
let engine = read(engineRel);
must(engine.includes('ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO'), 'H21 capture/audio baseline missing');
must(!engine.includes('ESTUDEX_V193_HOTFIX27_CURSOR_DEDUPE'), 'H27 cursor fix already applied');
const oldDisplayCapture = `      devices.getDisplayMedia = async constraints => {\n        const stream = await originalGetDisplayMedia(constraints);`;
const newDisplayCapture = `      /* ESTUDEX_V193_HOTFIX27_CURSOR_DEDUPE */\n      devices.getDisplayMedia = async constraints => {\n        const requested = constraints && typeof constraints === 'object' ? constraints : {};\n        const requestedVideo = requested.video;\n        const cursorFreeVideo = requestedVideo === false\n          ? false\n          : (requestedVideo && typeof requestedVideo === 'object'\n              ? {...requestedVideo, cursor:'never'}\n              : {cursor:'never'});\n        const captureConstraints = {...requested, video:cursorFreeVideo};\n        const stream = await originalGetDisplayMedia(captureConstraints);`;
must(engine.includes(oldDisplayCapture), 'getDisplayMedia wrapper anchor missing');
engine = engine.replace(oldDisplayCapture, newDisplayCapture);
write(engineRel, engine);

// 2) H26 stopped the cloud adapter from falling back to local saved rooms, but
// socket-compat can ask the engine for Home state before the cloud user is ready.
// In this internet build the backend is authoritative: never expose room lists to
// Home until a cloud identity exists, then refresh immediately after auth settles.
const socketRel = 'public/js/estudex-engine-socket-compat.js';
let socket = read(socketRel);
must(socket.includes('ESTUDEX_V193_ROOM_REFRESH_STABILITY'), 'socket room-refresh baseline missing');
must(!socket.includes('ESTUDEX_V193_HOTFIX27_CLOUD_ROOM_BOOTSTRAP_GATE'), 'H27 room bootstrap gate already applied');
const oldHomeState = `  async function homeState() {\n    const [profile, lanRooms, savedRooms, friends] = await Promise.all([\n      Promise.resolve(E.profile.get()),\n      Promise.resolve(E.rooms.listLan()).catch(() => []),\n      Promise.resolve(E.rooms.listSaved()).catch(() => []),\n      Promise.resolve(E.social.listFriends()).catch(() => [])\n    ]);`;
const newHomeState = `  async function homeState() {\n    /* ESTUDEX_V193_HOTFIX27_CLOUD_ROOM_BOOTSTRAP_GATE */\n    let cloudUser=null;\n    try{cloudUser=root.EstudexCloudSocial?.getUser?.() || null;}catch{}\n    const cloudRoomsReady=Boolean(cloudUser?.id);\n    const [profile, lanRooms, savedRooms, friends] = await Promise.all([\n      Promise.resolve(E.profile.get()),\n      cloudRoomsReady ? Promise.resolve(E.rooms.listLan()).catch(() => []) : Promise.resolve([]),\n      cloudRoomsReady ? Promise.resolve(E.rooms.listSaved()).catch(() => []) : Promise.resolve([]),\n      Promise.resolve(E.social.listFriends()).catch(() => [])\n    ]);`;
must(socket.includes(oldHomeState), 'homeState room-list anchor missing');
socket = socket.replace(oldHomeState, newHomeState);
const bootAnchor = `  function boot() {\n    const threads=E.dm.listThreads?.() || [];`;
const bootReplacement = `  function boot() {\n    /* Refresh the Home room lists only after cloud auth/session restore has a real user. */\n    root.addEventListener?.('estudex:cloud-session-ready',()=>refreshState().catch(()=>{}));\n    const threads=E.dm.listThreads?.() || [];`;
must(socket.includes(bootAnchor), 'socket boot anchor missing');
socket = socket.replace(bootAnchor, bootReplacement);
write(socketRel, socket);

const cloudRel = 'public/js/estudex-v193-cloud-social-v1926.js';
let cloud = read(cloudRel);
must(cloud.includes('ESTUDEX_V193_HOTFIX26_RECENT_ROOM_AUTH_GATE'), 'H26 recent-room auth gate missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX27_CLOUD_SESSION_READY'), 'H27 cloud-ready signal already applied');
const afterAuthOld = `  async function afterAuth(){\n    hideAuthOverlay();connectSocket();\n    await Promise.allSettled([refreshFriends(),refreshPending(),refreshBlocked(),refreshDm(),refreshRoomInvites()]);\n    emit('profile',{type:'profile',profile:ownProfile()});\n    emit('social',{type:'refresh'});emit('dm',{type:'refresh'});\n    applyCloudIdentityToCanonical();\n  }`;
const afterAuthNew = `  async function afterAuth(){\n    hideAuthOverlay();connectSocket();\n    await Promise.allSettled([refreshFriends(),refreshPending(),refreshBlocked(),refreshDm(),refreshRoomInvites()]);\n    emit('profile',{type:'profile',profile:ownProfile()});\n    emit('social',{type:'refresh'});emit('dm',{type:'refresh'});\n    applyCloudIdentityToCanonical();\n    /* ESTUDEX_V193_HOTFIX27_CLOUD_SESSION_READY */\n    try{root.dispatchEvent?.(new CustomEvent('estudex:cloud-session-ready',{detail:{userId:state.user?.id||''}}));}catch{}\n  }`;
must(cloud.includes(afterAuthOld), 'afterAuth anchor missing');
cloud = cloud.replace(afterAuthOld, afterAuthNew);
cloud += '\n/* ESTUDEX_V193_HOTFIX27_CAPTURE_RECENT_ROOMS */\n';
write(cloudRel, cloud);

pkg.version = '1.9.31';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.30["']/.test(forge), 'Squirrel 1.9.30 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.30["']/, 'version: "1.9.31"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.31',
  hotfix: 27,
  baseTag: 'v1.9.30-hotfix26',
  mode: 'capture-cursor-and-cloud-room-bootstrap',
  fixes: [
    'request cursor-free display capture to prevent the Windows cursor from being composited over a game cursor for viewers',
    'gate Home room lists until the persistent cloud identity is restored so legacy local recent-room cards cannot flash',
    'force a Home-state refresh when cloud authentication/session restore finishes',
    'preserve Hotfix 26 stop-broadcast/watchdog/modal UX and Hotfix 25 account login'
  ],
  backend: h26Manifest.backend,
  identity: h26Manifest.identity,
  network: h26Manifest.network,
  roomUx: {...h26Manifest.roomUx, cloudRoomBootstrapAuthoritative:true},
  capture: {cursorPolicy:'never', duplicateCursorMitigation:true},
  canonicalHome: { js: homeJsBefore, css: homeCssBefore }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix27-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('ESTUDEX v1.9.3 Hotfix 27 / technical 1.9.31 capture and recent-room fixes applied.');
