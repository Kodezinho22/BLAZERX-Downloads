'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||process.cwd());
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const write=(r,t)=>fs.writeFileSync(path.join(root,r),t,'utf8');
const must=(v,m)=>{if(!v)throw new Error('Hotfix34: '+m)};
const once=(text,from,to,label)=>{const count=text.split(from).length-1;must(count===1,`${label}: expected 1 anchor, got ${count}`);return text.replace(from,to);};

const pkgPath=path.join(root,'package.json');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
must(pkg.version==='1.9.37','expected 1.9.37 baseline');
must(fs.existsSync(path.join(root,'estudex-hotfix33-manifest.json')),'Hotfix33 manifest missing');

let home=read('public/js/home.js');
must(!home.includes('ESTUDEX_V193_HOTFIX34_ROOM_PAINT_COALESCE'),'room paint patch already applied');
const navAnchor=`/* =========================================================\n   NAVEGAÇÃO\n========================================================= */\n\nfunction showPage(page) {`;
const navPatch=`/* =========================================================\n   NAVEGAÇÃO\n========================================================= */\n\n/* ESTUDEX_V193_HOTFIX34_ROOM_PAINT_COALESCE */\nlet roomRenderScheduledV1938 = false;\nfunction scheduleTransmissionRoomRenderV1938(reason = 'state') {\n  if (roomRenderScheduledV1938) return;\n  roomRenderScheduledV1938 = true;\n\n  // Two animation frames intentionally let Chromium paint the page switch\n  // before the expensive room reconciliation/message/media pass runs.\n  requestAnimationFrame(() => {\n    requestAnimationFrame(() => {\n      roomRenderScheduledV1938 = false;\n      if (document.body.dataset.currentPage !== \"room\") return;\n\n      const startedAt = performance.now();\n      renderTransmissionRoom();\n      const elapsed = performance.now() - startedAt;\n      if (elapsed > 24) {\n        console.debug('[ESTUDEX][room-render]', { reason, ms: Math.round(elapsed) });\n      }\n    });\n  });\n}\n\nfunction showPage(page) {`;
home=once(home,navAnchor,navPatch,'navigation scheduler');
home=once(home,
`  if (page === \"room\") {\n    renderTransmissionRoom();\n  }`,
`  if (page === \"room\") {\n    scheduleTransmissionRoomRenderV1938('showPage');\n  }`,
'showPage room render');
home=once(home,
`  showPage(\"room\");\n  socket.emit(\"room:request-state\");\n  renderTransmissionRoom();\n});`,
`  showPage(\"room\");\n  socket.emit(\"room:request-state\");\n});`,
'room joined duplicate render');
home=once(home,
`  activeRoomState = data;\n  renderTransmissionRoom();\n});`,
`  activeRoomState = data;\n  scheduleTransmissionRoomRenderV1938('room:state');\n});`,
'room state coalescing');
write('public/js/home.js',home);

let main=read('main.js');
must(!main.includes('ESTUDEX_V193_HOTFIX34_LOOPBACK_UI_SERVER'),'loopback patch already applied');
main=once(main,
`async function createWindow() {\n  // v1.0.0: one server only. The same HTTP/WebSocket server that serves\n  // the BLAZERX UI is also the Radmin room host on TCP 8787.\n  // If the app UI opened from this server, the Radmin host is alive too.\n  try {\n    shareServer = await createShareServer({\n      port: 8787,\n      host: '0.0.0.0',`,
`async function createWindow() {\n  /* ESTUDEX_V193_HOTFIX34_LOOPBACK_UI_SERVER */\n  // The desktop HTTP/WebSocket server is an internal UI transport.\n  // Cloud room signaling remains external; keeping this listener on loopback\n  // avoids exposing TCP 8787 on every versioned Squirrel executable path.\n  try {\n    shareServer = await createShareServer({\n      port: 8787,\n      host: '127.0.0.1',`,
'loopback UI server');
write('main.js',main);

pkg.version='1.9.38';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n','utf8');
let forge=read('forge.config.js');
must(/version:\s*[\"']1\.9\.37[\"']/.test(forge),'forge version anchor missing');
forge=forge.replace(/version:\s*[\"']1\.9\.37[\"']/,'version: \"1.9.38\"');
write('forge.config.js',forge);

const manifest={
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.38',
  hotfix:34,
  baseTag:'v1.9.37-hotfix33',
  mode:'room-input-paint-and-firewall-loopback',
  fixes:[
    'room navigation paints before expensive room reconciliation',
    'room render requests from showPage/room:joined/room:state are coalesced instead of synchronously repeating the full render',
    'internal desktop UI server binds to 127.0.0.1 instead of exposing TCP 8787 on all interfaces',
    'avoids the legacy always-on inbound listener that caused Windows Firewall to treat each versioned Squirrel executable path as a new network app'
  ],
  preserved:{
    oneActiveHostedRoomPerUser:true,
    cloudRoomSignaling:true,
    persistence:'supabase',
    hotfix33:true
  }
};
fs.writeFileSync(path.join(root,'estudex-hotfix34-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log('ESTUDEX Hotfix34 candidate applied');
