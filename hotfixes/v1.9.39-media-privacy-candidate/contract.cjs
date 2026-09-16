'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const sha=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r))).digest('hex');
const must=(v,m)=>{if(!v)throw new Error('ESTUDEX media privacy contract: '+m);};

const pkg=JSON.parse(read('package.json'));
must(pkg.version==='1.9.39','technical version');
const manifest=JSON.parse(read('estudex-media-privacy-v1939-manifest.json'));
must(manifest.release===false,'candidate must not be a release');
must(manifest.baseTag==='v1.9.38-hotfix34','must remain based on Hotfix34');
must(manifest.privacy?.monitorFallback==='explicit-monitor-only','monitor fallback policy');

const home=read('public/js/home.js');
const engine=read('public/estudex-engine.js');
const main=read('main.js');
const compat=read('public/js/estudex-engine-socket-compat.js');
const cloud=read('public/js/estudex-v193-cloud-social-v1926.js');

// Preserve the separate input-lag and room-state work.
must(home.includes('ESTUDEX_V193_HOTFIX34_ROOM_PAINT_COALESCE'),'Hotfix34 navigation marker lost');
must(home.includes("scheduleTransmissionRoomRenderV1938('showPage')"),'Hotfix34 scheduled showPage render lost');
must(home.includes("scheduleTransmissionRoomRenderV1938('room:state')"),'Hotfix34 room-state render coalescing lost');
must(main.includes('ESTUDEX_V193_HOTFIX34_LOOPBACK_UI_SERVER'),'Hotfix34 loopback server marker lost');
must(compat.includes('ESTUDEX_V193_HOTFIX33_SINGLE_OWNED_ROOM_OVERLAY'),'Hotfix33 single-room overlay lost');
must(engine.includes('ESTUDEX_V193_HOTFIX32_ROOM_INPUT_LATENCY'),'Hotfix32 reconnect marker lost');
must(engine.includes('ROOM_RECONNECT_DELAYS=[0,350,900,1800]'),'reconnect delays changed');

// Screen-share privacy policy.
must(home.includes('ESTUDEX_V193_MEDIA_PRIVACY_SCREEN_POLICY'),'screen privacy marker');
must(home.includes('videoTrack?.getSettings?.().displaySurface'),'displaySurface post-capture check');
must(home.includes('systemAudio: allowMonitorSystemAudio ? "include" : "exclude"'),'systemAudio explicit hint');
must(home.includes('windowAudio: "window"'),'windowAudio isolation hint');
must(home.includes('__estudexAllowMonitorSystemAudio: allowMonitorSystemAudio'),'explicit monitor permission forwarded');
must(home.includes('displaySurface === "browser" || (displaySurface === "monitor" && allowMonitorSystemAudio === true)'),'post-capture allowlist');
must(home.includes('try { track.stop(); } catch {}'),'discarded audio tracks are stopped');
must(home.includes('Janela selecionada sem áudio isolado disponível. A transmissão continua sem áudio para evitar capturar o som total do sistema.'),'required privacy toast');

const toggleMatch=home.match(/async function toggleRoomScreen\(\) \{[\s\S]*?\n\}\n\nfunction toggleRoomAudio\(\)/);
must(toggleMatch,'toggleRoomScreen function');
must(!toggleMatch[0].includes('getUserMedia'),'screen share must not request microphone/user media');
must(toggleMatch[0].includes('getDisplayMedia'),'screen share must use display capture');

// Engine must never upgrade missing tab/window audio into global desktop loopback.
must(engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_FAIL_CLOSED'),'engine fail-closed marker');
must(engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_MONITOR_FALLBACK_EXPLICIT'),'explicit monitor fallback marker');
must(!engine.includes("if (constraints?.audio && !(stream?.getAudioTracks?.().length))"),'old automatic global audio fallback remains');
must(engine.includes("displaySurface === 'monitor' && allowMonitorSystemAudio && constraints?.audio"),'monitor fallback lacks explicit gate');
must(engine.includes("displaySurface === 'browser' || (displaySurface === 'monitor' && allowMonitorSystemAudio)"),'engine post-capture allowlist');
must(engine.includes("mediaState.screenSourceKind==='screen'&&sourceMeta?.allowSystemAudio===true"),'legacy room monitor audio is not explicit');
must(engine.includes("sourceKind==='screen'&&sourceMeta?.allowSystemAudio===true"),'legacy call monitor audio is not explicit');
const attachCalls=(engine.match(/await estudexAttachSystemAudioV1925\(/g)||[]).length;
must(attachCalls===3,'system loopback helper must exist only behind three explicit monitor gates');

// Remote playback must react to user gestures and handle autoplay rejection.
must(home.includes('ESTUDEX_V193_REMOTE_AUDIO_GESTURE_UNLOCK'),'remote audio unlock marker');
must(home.includes('NotAllowedError'),'autoplay rejection must be handled');
must(home.includes('Toque na transmissão para ativar o áudio.'),'autoplay recovery UX');
must(home.includes('[data-room-member-id]'),'watch-member click participates in audio unlock');
must(home.includes('[data-enter-room]'),'open-room click participates in audio unlock');
must(home.includes('#roomStageVideo'),'stage tap participates in audio unlock');
must(home.includes('void estudexTryRoomStagePlaybackV1939(video);'),'remote track attachment attempts playback');
must(!home.includes('video.play().catch(() => {});'),'silent autoplay rejection remains');

// Files outside the isolated media surfaces must remain byte-identical to the H34 baseline.
must(sha('main.js')===manifest.preserved.main,'main.js changed');
must(sha('public/js/estudex-engine-socket-compat.js')===manifest.preserved.compat,'socket compat changed');
must(sha('public/js/estudex-v193-cloud-social-v1926.js')===manifest.preserved.cloud,'cloud social changed');
must(sha('public/css/home.css')===manifest.preserved.css,'home.css changed');

console.log('ESTUDEX media privacy/audio playback contract OK');
