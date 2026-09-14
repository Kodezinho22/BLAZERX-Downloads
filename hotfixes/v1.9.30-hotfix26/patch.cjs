const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const must = (condition, message) => { if (!condition) throw new Error('ESTUDEX Hotfix 26 patch: ' + message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

must(fs.existsSync(path.join(root, 'estudex-hotfix25-manifest.json')), 'Hotfix 25 baseline manifest missing');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.29', 'expected technical baseline 1.9.29, got ' + pkg.version);

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');
const h25Manifest = JSON.parse(read('estudex-hotfix25-manifest.json'));

// 1) The old H14 watchdog armed itself for the host screen even on the host's
// own local preview. Only allow recovery/failure while a real remote view is open.
const watchdogRel = 'public/js/estudex-v193-hotfix14-connectivity-media-room.js';
let watchdog = read(watchdogRel);
must(watchdog.includes('ESTUDEX_V193_HOTFIX14_STREAM_UX_WATCHDOG_V2'), 'H14 stream watchdog baseline missing');
must(!watchdog.includes('ESTUDEX_V193_HOTFIX26_REMOTE_WATCHDOG_ONLY'), 'H26 watchdog fix already applied');
const oldWatchdogFns = "  const toast=message=>{try{showToast?.(message);}catch{}};\n  function failRemote(id){clearWatch(id);const stage=document.querySelector('#roomStageView');stage?.classList.add('v193-hf14-stream-timeout');const exit=document.querySelector('#roomExitRemoteViewButton');if(exit&&!exit.classList.contains('hidden')){try{exit.click();}catch{}}toast('A transmissão não respondeu. A conexão foi reiniciada; selecione o participante para tentar novamente.');}\n  function arm(id,delay=WATCHDOG_MS,reset=false){id=clean(id);if(!id)return;clearWatch(id);if(reset)attempts.delete(id);timers.set(id,setTimeout(async()=>{timers.delete(id);const state=E.room.getState?.()||{};if(!state.connected||!state.streamLive||hostId(state)!==id){attempts.delete(id);return;}const next=Number(attempts.get(id)||0)+1;attempts.set(id,next);if(next>MAX_RECOVERIES){failRemote(id);return;}try{await E.media.recoverRemote?.(id,'screen');}catch{}arm(id,next===1?2600:3400,false);},Math.max(1200,Number(delay)||WATCHDOG_MS)));}";
const newWatchdogFns = "  const toast=message=>{try{showToast?.(message);}catch{}};\n  /* ESTUDEX_V193_HOTFIX26_REMOTE_WATCHDOG_ONLY */\n  function remoteViewActive(){const exit=document.querySelector('#roomExitRemoteViewButton');if(!exit||exit.classList.contains('hidden'))return false;try{const css=getComputedStyle(exit);return css.display!=='none'&&css.visibility!=='hidden'&&css.opacity!=='0';}catch{return true;}}\n  function failRemote(id){clearWatch(id);if(!remoteViewActive()){attempts.delete(clean(id));return;}const stage=document.querySelector('#roomStageView');stage?.classList.add('v193-hf14-stream-timeout');const exit=document.querySelector('#roomExitRemoteViewButton');if(exit&&!exit.classList.contains('hidden')){try{exit.click();}catch{}}toast('A transmissão não respondeu. A conexão foi reiniciada; selecione o participante para tentar novamente.');}\n  function arm(id,delay=WATCHDOG_MS,reset=false){id=clean(id);if(!id)return;clearWatch(id);if(reset)attempts.delete(id);timers.set(id,setTimeout(async()=>{timers.delete(id);const state=E.room.getState?.()||{};if(!state.connected||!state.streamLive||hostId(state)!==id||!remoteViewActive()){attempts.delete(id);return;}const next=Number(attempts.get(id)||0)+1;attempts.set(id,next);if(next>MAX_RECOVERIES){failRemote(id);return;}try{await E.media.recoverRemote?.(id,'screen');}catch{}arm(id,next===1?2600:3400,false);},Math.max(1200,Number(delay)||WATCHDOG_MS)));}";
must(watchdog.includes(oldWatchdogFns), 'H14 watchdog function anchor missing');
watchdog = watchdog.replace(oldWatchdogFns, newWatchdogFns);
write(watchdogRel, watchdog);

// 2) During cloud auth bootstrap there is intentionally no usable cloud token yet.
// Falling back to the legacy local saved-room store leaks stale room cards for one
// render. Keep recent rooms empty until the cloud session has been restored.
const cloudRel = 'public/js/estudex-v193-cloud-social-v1926.js';
let cloud = read(cloudRel);
must(cloud.includes('ESTUDEX_V193_HOTFIX25_ACCOUNT_LOGIN'), 'H25 account-login baseline missing');
must(!cloud.includes('ESTUDEX_V193_HOTFIX26_RECENT_ROOM_AUTH_GATE'), 'H26 recent-room gate already applied');
const oldSaved = "  async function listSavedRooms(){if(!state.token)return Promise.resolve(roomRegistry.rooms?.listSaved?.()||[]);const data=await request('/api/saved-rooms');";
const newSaved = "  /* ESTUDEX_V193_HOTFIX26_RECENT_ROOM_AUTH_GATE */\n  async function listSavedRooms(){if(!state.token)return[];const data=await request('/api/saved-rooms');";
must(cloud.includes(oldSaved), 'cloud saved-room bootstrap anchor missing');
cloud = cloud.replace(oldSaved, newSaved);
cloud += '\n/* ESTUDEX_V193_HOTFIX26_ROOM_UX */\n';
write(cloudRel, cloud);

// 3) Room QoL runtime: explicit stop-broadcast control, @ prefix presentation and
// consistent Escape handling for closable modal layers. This stays outside the
// canonical V10.10 home assets.
const runtimeRel = 'public/js/estudex-v193-hotfix26-room-qol.js';
must(!fs.existsSync(path.join(root, runtimeRel)), 'H26 QoL runtime already exists');
const runtime = `/* ESTUDEX_V193_HOTFIX26_ROOM_QOL */
(() => {
  'use strict';
  const root=globalThis;
  const E=root.EstudexEngine;
  if(!E)return;
  const q=(selector,scope=document)=>scope?.querySelector?.(selector)||null;
  const qa=(selector,scope=document)=>[...(scope?.querySelectorAll?.(selector)||[])];

  function installStyle(){
    if(document.getElementById('estudexHotfix26Style'))return;
    const style=document.createElement('style');
    style.id='estudexHotfix26Style';
    style.textContent=\`
      #roomStopBroadcastButton{position:absolute;right:66px;top:16px;z-index:18;min-height:38px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,92,112,.55);background:rgba(101,18,36,.92);color:#fff;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer;transition:.14s ease}
      #roomStopBroadcastButton:hover{background:rgba(145,24,49,.98);transform:translateY(-1px)}
      #roomStopBroadcastButton.hidden{display:none!important}
      #roomStageView:fullscreen #roomStopBroadcastButton{top:20px;right:72px}
      .h26-public-tag-wrap{position:relative;display:block;width:100%}
      .h26-public-tag-wrap>.h26-public-tag-prefix{position:absolute;left:14px;top:50%;transform:translateY(-50%);z-index:2;color:#899bb7;font-weight:800;pointer-events:none}
      .h26-public-tag-wrap>input{width:100%!important;padding-left:31px!important;box-sizing:border-box!important}
    \`;
    document.head.appendChild(style);
  }

  function decorateTagInput(input){
    if(!input||input.closest('.h26-public-tag-wrap'))return;
    const parent=input.parentNode;if(!parent)return;
    const wrap=document.createElement('div');wrap.className='h26-public-tag-wrap';
    const prefix=document.createElement('span');prefix.className='h26-public-tag-prefix';prefix.textContent='@';prefix.setAttribute('aria-hidden','true');
    parent.insertBefore(wrap,input);wrap.append(prefix,input);
  }
  function syncTagPresentation(){decorateTagInput(q('#specEditTag'));decorateTagInput(q('#identityTag'));}

  function ensureStopBroadcastButton(){
    const stage=q('#roomStageView'),screen=q('#roomScreenButton');if(!stage||!screen)return null;
    let button=q('#roomStopBroadcastButton',stage);
    if(!button){
      button=document.createElement('button');button.id='roomStopBroadcastButton';button.type='button';button.className='hidden';button.textContent='Encerrar transmissão';button.title='Encerrar seu compartilhamento de tela';button.setAttribute('aria-label','Encerrar transmissão');
      stage.appendChild(button);
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const state=E.media?.getState?.()||{};if(!state.screenShareEnabled)return;screen.click();});
    }
    return button;
  }
  function syncBroadcastControl(){
    const button=ensureStopBroadcastButton(),screen=q('#roomScreenButton');if(!button||!screen)return;
    const state=E.media?.getState?.()||{};const active=Boolean(state.screenShareEnabled);
    button.classList.toggle('hidden',!active);
    const label=active?'Encerrar transmissão':'Compartilhar tela';screen.title=label;screen.setAttribute('aria-label',label);
  }

  function isVisibleLayer(layer){
    if(!layer||layer.classList.contains('hidden')||layer.id==='identityModal')return false;
    try{const css=getComputedStyle(layer);return css.display!=='none'&&css.visibility!=='hidden';}catch{return true;}
  }
  function closeTopModalWithEscape(event){
    if(event.key!=='Escape')return;
    const capture=q('#estudexExactCapturePicker:not(.hidden),.exact-capture-picker:not(.hidden)');if(capture)return;
    const layers=qa('.modal-layer').filter(isVisibleLayer);const layer=layers[layers.length-1];if(!layer)return;
    const close=layer.querySelector('button.close,[id^="close"][type="button"],[id^="close"]');
    event.preventDefault();event.stopImmediatePropagation();
    if(close){close.click();return;}
    layer.classList.add('hidden');
  }

  installStyle();syncTagPresentation();syncBroadcastControl();
  const mediaOff=E.media?.onChange?.(()=>queueMicrotask(syncBroadcastControl));
  const roomOff=E.room?.onChange?.(()=>queueMicrotask(syncBroadcastControl));
  document.addEventListener('keydown',closeTopModalWithEscape,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('#editProfileButton,#openEditProfile,[data-page="profile"],#roomScreenButton'))setTimeout(()=>{syncTagPresentation();syncBroadcastControl();},0);},true);
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>queueMicrotask(()=>{syncTagPresentation();syncBroadcastControl();})):null;
  observer?.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  root.EstudexV193Hotfix26RoomQol=Object.freeze({version:'1.0.0',syncBroadcastControl,syncTagPresentation,destroy(){try{mediaOff?.();}catch{}try{roomOff?.();}catch{}try{observer?.disconnect?.();}catch{}document.removeEventListener('keydown',closeTopModalWithEscape,true);}});
})();
`;
write(runtimeRel, runtime);

let index = read('public/index.html');
must(index.includes('<script src="/js/estudex-v193-hotfix14-connectivity-media-room.js"></script>'), 'H14 script anchor missing');
must(!index.includes('estudex-v193-hotfix26-room-qol.js'), 'H26 script already injected');
index = index.replace(
  '<script src="/js/estudex-v193-hotfix14-connectivity-media-room.js"></script>',
  '<script src="/js/estudex-v193-hotfix14-connectivity-media-room.js"></script>\n<script src="/js/estudex-v193-hotfix26-room-qol.js"></script>'
);
write('public/index.html', index);

pkg.version = '1.9.30';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.29["']/.test(forge), 'Squirrel 1.9.29 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.29["']/, 'version: "1.9.30"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product: 'ESTUDEX',
  productVersion: '1.9.3',
  technicalVersion: '1.9.30',
  hotfix: 26,
  baseTag: 'v1.9.29-hotfix25',
  mode: 'room-stream-qol-and-session-polish',
  fixes: [
    'limit the stream watchdog to an actual remote participant view so local host preview does not show a false timeout',
    'add an explicit Encerrar transmissão button while the local user is sharing the screen',
    'prevent legacy local saved rooms from flashing before the cloud account session is restored',
    'show the public profile tag with a visual @ prefix without changing the stored username',
    'allow Escape to close the top visible closable ESTUDEX modal, including Encontrar pessoas'
  ],
  backend: h25Manifest.backend,
  identity: { ...h25Manifest.identity, publicTagAtPrefix: 'presentation-only' },
  network: h25Manifest.network,
  roomUx: { remoteWatchdogOnly:true, explicitStopBroadcast:true, escapeClosesModals:true, recentRoomsAuthGated:true },
  canonicalHome: { js: homeJsBefore, css: homeCssBefore }
};
fs.writeFileSync(path.join(root, 'estudex-hotfix26-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('ESTUDEX v1.9.3 Hotfix 26 / technical 1.9.30 room stream QoL applied.');
