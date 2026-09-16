'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const sha=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r))).digest('hex');
const must=(v,m)=>{if(!v)throw new Error('Hotfix35 contract: '+m);};
const pkg=JSON.parse(read('package.json'));
must(pkg.version==='1.9.39','technical version');
const manifest=JSON.parse(read('estudex-media-privacy-v1939-manifest.json'));
must(manifest.release===true,'release flag');
must(manifest.hotfix===35,'hotfix number');
must(manifest.tag==='v1.9.39-hotfix35','release tag');
must(manifest.baseTag==='v1.9.38-hotfix34','base tag');
must(manifest.privacy?.monitorFallback==='explicit-monitor-only','monitor fallback policy');

const home=read('public/js/home.js');
const engine=read('public/estudex-engine.js');
const main=read('main.js');
const compat=read('public/js/estudex-engine-socket-compat.js');

must(home.includes('ESTUDEX_V193_HOTFIX34_ROOM_PAINT_COALESCE'),'Hotfix34 input-lag work lost');
must(home.includes("scheduleTransmissionRoomRenderV1938('showPage')"),'Hotfix34 showPage scheduler lost');
must(home.includes("scheduleTransmissionRoomRenderV1938('room:state')"),'Hotfix34 room-state scheduler lost');
must(main.includes('ESTUDEX_V193_HOTFIX34_LOOPBACK_UI_SERVER'),'Hotfix34 loopback server lost');
must(compat.includes('ESTUDEX_V193_HOTFIX33_SINGLE_OWNED_ROOM_OVERLAY'),'Hotfix33 single-room overlay lost');
must(engine.includes('ESTUDEX_V193_HOTFIX32_ROOM_INPUT_LATENCY'),'Hotfix32 reconnect marker lost');
must(engine.includes('ROOM_RECONNECT_DELAYS=[0,350,900,1800]'),'reconnect delays changed');

must(home.includes('ESTUDEX_V193_MEDIA_PRIVACY_SCREEN_POLICY'),'screen privacy marker');
must(home.includes('videoTrack?.getSettings?.().displaySurface'),'displaySurface check');
must(home.includes('systemAudio: allowMonitorSystemAudio ? "include" : "exclude"'),'systemAudio hint');
must(home.includes('windowAudio: "window"'),'windowAudio hint');
must(home.includes('Janela selecionada sem áudio isolado disponível. A transmissão continua sem áudio para evitar capturar o som total do sistema.'),'privacy toast');
must(engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_FAIL_CLOSED'),'fail-closed marker');
must(engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_MONITOR_FALLBACK_EXPLICIT'),'monitor fallback marker');
must(!engine.includes("if (constraints?.audio && !(stream?.getAudioTracks?.().length))"),'unsafe automatic fallback remains');
must(engine.includes("displaySurface === 'monitor' && allowMonitorSystemAudio && constraints?.audio"),'monitor explicit gate missing');
const attachCalls=(engine.match(/await estudexAttachSystemAudioV1925\(/g)||[]).length;
must(attachCalls===3,'unexpected system-loopback call count');

const toggleMatch=home.match(/async function toggleRoomScreen\(\) \{[\s\S]*?\n\}\n\nfunction toggleRoomAudio\(\)/);
must(toggleMatch,'toggleRoomScreen');
must(!toggleMatch[0].includes('getUserMedia'),'screen share requests user media');
must(toggleMatch[0].includes('getDisplayMedia'),'display capture missing');

must(home.includes('ESTUDEX_V193_REMOTE_AUDIO_GESTURE_UNLOCK'),'remote playback marker');
must(home.includes('NotAllowedError'),'autoplay rejection handling missing');
must(home.includes('Toque na transmissão para ativar o áudio.'),'autoplay recovery UX missing');
must(home.includes('estudexUnlockRoomAudioFromGestureV1939();\n});'),'gesture retry order incorrect');
must(!home.includes('video.play().catch(() => {});'),'silent autoplay rejection remains');

must(sha('main.js')===manifest.preserved.main,'main.js changed from H34 baseline');
must(sha('public/js/estudex-engine-socket-compat.js')===manifest.preserved.compat,'socket compat changed from H34 baseline');
must(sha('public/js/estudex-v193-cloud-social-v1926.js')===manifest.preserved.cloud,'cloud social changed from H34 baseline');
must(sha('public/css/home.css')===manifest.preserved.css,'home.css changed from H34 baseline');
console.log('Hotfix35 contract OK');
