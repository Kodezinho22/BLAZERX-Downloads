const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 24 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix23-manifest.json')), 'Hotfix 23 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.27', 'expected technical baseline 1.9.27, got ' + pkg.version);

const cloudRel = 'public/js/estudex-v193-cloud-social-v1926.js';
let cloud = read(cloudRel);
must(cloud.includes('ESTUDEX_V193_HOTFIX22_CLOUD_SOCIAL'), 'Hotfix 22 cloud social baseline missing');
must(cloud.includes('ESTUDEX_V193_HOTFIX23_SESSION_RESTORE'), 'Hotfix 23 session restore baseline missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX24_GUEST_UPGRADE_PROFILE'), 'Hotfix 24 appears already applied');
must(cloud.includes("/api/auth/upgrade-guest"), 'Guest upgrade API bridge missing');

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');
const h23Manifest = JSON.parse(read('estudex-hotfix23-manifest.json'));

// Make a successful Guest -> account upgrade immediately refresh the canonical
// profile identity too, so the new @handle replaces the temporary guest tag.
const oldUpgrade = "const data=await request('/api/auth/upgrade-guest',{method:'POST',body:input});setUser(data.user);return data.user;";
const newUpgrade = "const data=await request('/api/auth/upgrade-guest',{method:'POST',body:input});setUser(data.user);applyCloudIdentityToCanonical();return data.user;";
must(cloud.includes(oldUpgrade), 'Guest upgrade implementation anchor missing');
cloud = cloud.replace(oldUpgrade, newUpgrade);

let index = read('public/index.html');
const oldHint = 'As solicitações de amizade são sincronizadas pela internet.';
const newHint = 'Dica: procure pelo @usuário exato para encontrar alguém mais rápido. Você também pode buscar pelo nome de exibição.';
must(index.includes(oldHint), 'old friend-search hint anchor missing');
index = index.replace(oldHint, newHint);

const footerAnchor = '    <div class="edit-profile-footer">';
must(index.includes(footerAnchor), 'edit-profile footer anchor missing');
const guestCard = `    <section id="guestUpgradeProfileCard" class="guest-upgrade-profile-card hidden" aria-live="polite">
      <div class="guest-upgrade-profile-copy">
        <strong>Proteja seu perfil</strong>
        <span>Transforme este visitante em uma conta para entrar em outros computadores sem perder seus dados.</span>
      </div>
      <button id="profileUpgradeGuest" class="secondary-button" type="button">Transformar em conta</button>
    </section>

`;
index = index.replace(footerAnchor, guestCard + footerAnchor);

const realtimeAnchor = '<!-- ===============================================================\n     MODAIS REALTIME';
must(index.includes(realtimeAnchor), 'realtime modal anchor missing');
const upgradeModal = `<div id="guestUpgradeModal" class="modal-layer hidden">
  <div class="modal guest-upgrade-modal">
    <button id="closeGuestUpgradeModal" class="close" type="button">×</button>
    <div class="edit-profile-header">
      <h2>Transformar em conta</h2>
      <p>Seu perfil atual será protegido e continuará sendo o mesmo usuário do ESTUDEX.</p>
    </div>
    <div class="guest-upgrade-fields">
      <label class="profile-form-label" for="guestUpgradeUsername">@usuário</label>
      <input class="profile-form-input" id="guestUpgradeUsername" maxlength="24" autocomplete="username" placeholder="ex: criolex">
      <small class="guest-upgrade-field-note">Use letras, números, ponto, traço ou underline.</small>

      <label class="profile-form-label" for="guestUpgradeEmail">E-mail</label>
      <input class="profile-form-input" id="guestUpgradeEmail" type="email" maxlength="160" autocomplete="email" placeholder="voce@exemplo.com">

      <label class="profile-form-label" for="guestUpgradePassword">Senha</label>
      <input class="profile-form-input" id="guestUpgradePassword" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo de 8 caracteres">

      <label class="profile-form-label" for="guestUpgradePasswordConfirm">Confirmar senha</label>
      <input class="profile-form-input" id="guestUpgradePasswordConfirm" type="password" minlength="8" autocomplete="new-password" placeholder="Repita sua senha">
    </div>
    <p id="guestUpgradeError" class="guest-upgrade-error" role="alert"></p>
    <p class="guest-upgrade-keep-note">Amigos, mensagens, perfil e salas salvas continuam vinculados ao mesmo usuário.</p>
    <div class="guest-upgrade-actions">
      <button id="cancelGuestUpgrade" class="ghost-button" type="button">Cancelar</button>
      <button id="confirmGuestUpgrade" class="modal-primary" type="button">Criar conta</button>
    </div>
  </div>
</div>

`;
index = index.replace(realtimeAnchor, upgradeModal + realtimeAnchor);
write('public/index.html', index);

const enhancement = `\n/* ESTUDEX_V193_HOTFIX24_GUEST_UPGRADE_PROFILE */\n(function installHotfix24GuestUpgradeProfile(){\n  if (typeof window === 'undefined' || typeof document === 'undefined') return;\n\n  const q = selector => document.querySelector(selector);\n  const cloud = () => window.EstudexCloudSocial;\n  const currentUser = () => { try { return cloud()?.getUser?.() || null; } catch (_) { return null; } };\n\n  function installStyle(){\n    if (q('#estudexHotfix24Style')) return;\n    const style = document.createElement('style');\n    style.id = 'estudexHotfix24Style';\n    style.textContent = \`\n      #guestUpgradeProfileCard{margin:16px 0 2px;padding:14px 15px;border:1px solid color-mix(in srgb,var(--theme-color,#6d45d8) 38%,rgba(132,162,202,.18));border-radius:12px;background:color-mix(in srgb,var(--theme-color,#6d45d8) 10%,#091624);display:flex;align-items:center;justify-content:space-between;gap:16px}\n      #guestUpgradeProfileCard.hidden{display:none!important}.guest-upgrade-profile-copy{display:grid;gap:4px;min-width:0}.guest-upgrade-profile-copy strong{color:#f4f7fb;font-size:13px}.guest-upgrade-profile-copy span{color:#92a4bc;font-size:10px;line-height:1.45}.guest-upgrade-profile-card .secondary-button{flex:0 0 auto;min-height:38px;white-space:nowrap}\n      #guestUpgradeModal .guest-upgrade-modal{width:min(500px,calc(100vw - 34px));max-height:92vh;overflow:auto;padding:22px;text-align:left}.guest-upgrade-fields{display:grid;gap:6px}.guest-upgrade-fields .profile-form-label{margin:9px 0 2px}.guest-upgrade-fields .profile-form-input{width:100%;box-sizing:border-box}.guest-upgrade-field-note{display:block;margin:-1px 0 2px;color:#72859f;font-size:9px}.guest-upgrade-error{min-height:18px;margin:11px 0 0;color:#ff7787;font-size:10px}.guest-upgrade-keep-note{margin:8px 0 0;padding:10px 12px;border:1px solid rgba(132,162,202,.14);border-radius:9px;background:#091624;color:#8fa2ba;font-size:9.5px;line-height:1.45}.guest-upgrade-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:14px}.guest-upgrade-actions button{min-width:120px}\n      @media(max-width:620px){#guestUpgradeProfileCard{align-items:stretch;flex-direction:column}.guest-upgrade-profile-card .secondary-button{width:100%}.guest-upgrade-actions{flex-direction:column-reverse}.guest-upgrade-actions button{width:100%}}\n    \`;\n    document.head.appendChild(style);\n  }\n\n  function setError(message){\n    const node = q('#guestUpgradeError');\n    if (node) node.textContent = String(message || '');\n  }\n\n  function syncGuestUi(){\n    const user = currentUser();\n    const card = q('#guestUpgradeProfileCard');\n    if (card) card.classList.toggle('hidden', !user || user.accountType !== 'guest');\n    if (user?.accountType === 'registered') q('#guestUpgradeModal')?.classList.add('hidden');\n  }\n\n  function openUpgrade(){\n    const user = currentUser();\n    if (!user || user.accountType !== 'guest') return;\n    const modal = q('#guestUpgradeModal');\n    if (!modal) return;\n    const handle = String(user.handle || user.username || '').replace(/^guest_/i,'');\n    const username = q('#guestUpgradeUsername');\n    if (username && !username.value) username.value = handle && !/^guest/i.test(handle) ? handle : '';\n    if (q('#guestUpgradePassword')) q('#guestUpgradePassword').value = '';\n    if (q('#guestUpgradePasswordConfirm')) q('#guestUpgradePasswordConfirm').value = '';\n    setError('');\n    modal.classList.remove('hidden');\n    setTimeout(() => q('#guestUpgradeUsername')?.focus(), 0);\n  }\n\n  function closeUpgrade(){ q('#guestUpgradeModal')?.classList.add('hidden'); setError(''); }\n\n  async function submitUpgrade(){\n    const api = cloud();\n    const userBefore = currentUser();\n    if (!api?.upgradeGuest || !userBefore || userBefore.accountType !== 'guest') { setError('Esta identidade não é mais um visitante.'); syncGuestUi(); return; }\n    const username = String(q('#guestUpgradeUsername')?.value || '').trim().replace(/^@+/,'').toLowerCase();\n    const email = String(q('#guestUpgradeEmail')?.value || '').trim().toLowerCase();\n    const password = String(q('#guestUpgradePassword')?.value || '');\n    const confirm = String(q('#guestUpgradePasswordConfirm')?.value || '');\n    if (!/^[a-z0-9_.-]{3,24}$/.test(username)) { setError('O @usuário precisa ter de 3 a 24 caracteres e usar apenas letras, números, ponto, traço ou underline.'); return; }\n    if (!/^\\S+@\\S+\\.\\S+$/.test(email)) { setError('Informe um e-mail válido.'); return; }\n    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }\n    if (password !== confirm) { setError('As senhas não coincidem.'); return; }\n    const button = q('#confirmGuestUpgrade');\n    if (button) { button.disabled = true; button.textContent = 'Criando conta…'; }\n    setError('');\n    try {\n      const upgraded = await api.upgradeGuest({ username, email, password });\n      try { localStorage.setItem('estudex-public-tag', String(upgraded?.handle || upgraded?.username || username)); } catch (_) {}\n      const tagInput = q('#specEditTag');\n      if (tagInput) tagInput.value = String(upgraded?.handle || upgraded?.username || username);\n      syncGuestUi();\n      closeUpgrade();\n      try { window.showToast?.('Conta criada. Seu perfil e seus dados foram mantidos.'); } catch (_) {}\n      try { window.dispatchEvent(new CustomEvent('estudex:guest-upgraded', { detail: { user: upgraded, previousUserId: userBefore.id } })); } catch (_) {}\n    } catch (error) {\n      setError(error?.message || 'Não foi possível transformar este perfil em conta.');\n    } finally {\n      if (button) { button.disabled = false; button.textContent = 'Criar conta'; }\n    }\n  }\n\n  function wire(){\n    installStyle();\n    const open = q('#profileUpgradeGuest');\n    if (open && !open.dataset.h24Bound) { open.dataset.h24Bound = '1'; open.addEventListener('click', openUpgrade); }\n    const close = q('#closeGuestUpgradeModal');\n    if (close && !close.dataset.h24Bound) { close.dataset.h24Bound = '1'; close.addEventListener('click', closeUpgrade); }\n    const cancel = q('#cancelGuestUpgrade');\n    if (cancel && !cancel.dataset.h24Bound) { cancel.dataset.h24Bound = '1'; cancel.addEventListener('click', closeUpgrade); }\n    const confirm = q('#confirmGuestUpgrade');\n    if (confirm && !confirm.dataset.h24Bound) { confirm.dataset.h24Bound = '1'; confirm.addEventListener('click', submitUpgrade); }\n    const modal = q('#guestUpgradeModal');\n    if (modal && !modal.dataset.h24BackdropBound) { modal.dataset.h24BackdropBound = '1'; modal.addEventListener('click', event => { if (event.target === modal) closeUpgrade(); }); }\n    syncGuestUi();\n    try { cloud()?.onAuth?.(syncGuestUi); } catch (_) {}\n  }\n\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once:true });\n  else setTimeout(wire, 0);\n})();\n`;
cloud += enhancement;
write(cloudRel, cloud);

pkg.version = '1.9.28';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.27["']/.test(forge), 'Squirrel 1.9.27 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.27["']/, 'version: "1.9.28"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.28',
  hotfix: 24,
  baseTag: 'v1.9.27-hotfix23',
  mode: 'guest-account-upgrade-and-search-guidance',
  fixes: [
    'surface Guest -> registered account conversion directly in Editar perfil',
    'keep the same backend user identity while adding @username, email and password',
    'refresh canonical public tag after Guest account upgrade',
    'replace technical friend-request sync notice with useful @usuario search guidance',
    'preserve Hotfix 23 session restore and canonical V10.10 home assets'
  ],
  backend: h23Manifest.backend,
  identity: { ...h23Manifest.identity, guestUpgradeFromProfile: true },
  network: h23Manifest.network,
  canonicalHome: { js: homeJsBefore, css: homeCssBefore }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix24-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('ESTUDEX v1.9.3 Hotfix 24 / technical 1.9.28 Guest account upgrade UI applied.');
