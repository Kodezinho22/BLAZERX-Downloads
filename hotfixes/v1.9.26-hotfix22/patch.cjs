const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 22 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix21-manifest.json')), 'Hotfix 21 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.25', 'expected technical baseline 1.9.25, got ' + pkg.version);
const engineBefore = read('public/estudex-engine.js');
must(engineBefore.includes('ESTUDEX_V193_HOTFIX20_CLOUD_ROOM_TEST'), 'Hotfix 20 cloud room baseline missing');
must(engineBefore.includes('ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO'), 'Hotfix 21 system audio baseline missing');
must(!engineBefore.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'Hotfix 22 appears already applied');
const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

const payloadFile = path.join(__dirname, 'payload-v1926.json.gz.b64');
let packed = '';
if (fs.existsSync(payloadFile)) {
  packed = fs.readFileSync(payloadFile, 'utf8').trim();
} else {
  const payloadParts = fs.readdirSync(__dirname)
    .filter(name => /^payload-v1926\.part\d+$/.test(name))
    .sort();
  must(payloadParts.length === 10, 'replacement payload missing');
  packed = payloadParts.map(name => fs.readFileSync(path.join(__dirname, name), 'utf8')).join('').trim();
}
const payloadRaw = zlib.gunzipSync(Buffer.from(packed, 'base64'));
must(crypto.createHash('sha256').update(payloadRaw).digest('hex') === 'd1c2902ff08cf55aadcc8c184cf870767321ab47c48fe9efe9f259a1c411f5d0', 'replacement payload SHA mismatch');
const payload = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
must(payload?.format === 'estudex-hotfix22-replacement-v1', 'unexpected payload format');
must(payload.files && typeof payload.files === 'object', 'payload files missing');
for (const [rel, text] of Object.entries(payload.files)) {
  must(typeof text === 'string' && rel && !rel.includes('..'), 'invalid payload entry ' + rel);
  write(rel, text);
}

const obsoleteRadminBinding = path.join(root, 'public/js/estudex-v193-spec-radmin.js');
if (fs.existsSync(obsoleteRadminBinding)) fs.unlinkSync(obsoleteRadminBinding);

pkg.version = '1.9.26';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.25["']/.test(forge), 'Squirrel 1.9.25 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.25["']/, 'version: "1.9.26"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.26',
  hotfix: 22,
  baseTag: 'v1.9.25-hotfix21',
  mode: 'cloud-social-test',
  backend: {
    serverVersion: '0.3.0',
    remoteConfig: 'https://raw.githubusercontent.com/Kodezinho22/BLAZERX-Downloads/main/config/estudex-cloud.json',
    defaultTemporaryBase: 'https://estudexserver-2mccfr6f.b4a.run',
    persistence: 'Back4App Parse'
  },
  identity: {
    guestPersistent: true,
    guestUpgradePreservesUserId: true,
    secureNativeSession: 'Electron safeStorage with renderer fallback'
  },
  social: [
    'persistent-guest', 'register-login', 'guest-upgrade', 'user-search',
    'friend-requests', 'blocks', 'presence', 'persistent-dm',
    'room-invites', 'saved-rooms', 'private-call-cloud-signaling'
  ],
  network: {
    radminUiRemoved: true,
    radminRendererBridgeRemoved: true,
    legacyLanDiscoveryNotStarted: true,
    rooms: 'cloud signaling',
    media: 'WebRTC P2P',
    stun: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    turnConfigured: false
  },
  canonicalHome: { js: homeJsBefore, css: homeCssBefore }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix22-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 22 / technical 1.9.26 cloud social migration applied.');
