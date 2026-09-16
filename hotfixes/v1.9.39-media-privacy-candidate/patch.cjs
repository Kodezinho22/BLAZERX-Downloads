'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const write=(r,t)=>{const f=path.join(root,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,t,'utf8');};
const sha=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r))).digest('hex');
const must=(v,m)=>{if(!v)throw new Error('ESTUDEX media privacy candidate: '+m);};
const once=(text,from,to,label)=>{const n=text.split(from).length-1;must(n===1,`${label}: expected 1 anchor, got ${n}`);return text.replace(from,to);};
const regexOnce=(text,re,to,label)=>{const flags=re.flags.includes('g')?re.flags:re.flags+'g';const hits=text.match(new RegExp(re.source,flags))||[];must(hits.length===1,`${label}: expected 1 match, got ${hits.length}`);return text.replace(re,to);};

const pkgPath=path.join(root,'package.json');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
must(pkg.version==='1.9.38','expected published Hotfix34 baseline 1.9.38');
must(fs.existsSync(path.join(root,'estudex-hotfix34-manifest.json')),'Hotfix34 manifest missing');

const preserved={
  main:sha('main.js'),
  compat:sha('public/js/estudex-engine-socket-compat.js'),
  cloud:sha('public/js/estudex-v193-cloud-social-v1926.js'),
  css:sha('public/css/home.css')
};

let engine=read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO'),'system-audio baseline missing');
must(engine.includes('ESTUDEX_V193_HOTFIX32_ROOM_INPUT_LATENCY'),'Hotfix32 reconnect baseline missing');
must(!engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_FAIL_CLOSED'),'media privacy engine patch already applied');

engine=once(engine,
`        const captureConstraints = {...requested, video:cursorFreeVideo};\n        const stream = await originalGetDisplayMedia(captureConstraints);\n        if (constraints?.audio && !(stream?.getAudioTracks?.().length)) {\n          await estudexAttachSystemAudioV1925(stream, true);\n        }\n        return stream;`,
`        /* ESTUDEX_V193_MEDIA_PRIVACY_FAIL_CLOSED */\n        const allowMonitorSystemAudio = requested.__estudexAllowMonitorSystemAudio === true;\n        const captureConstraints = {...requested, video:cursorFreeVideo};\n        delete captureConstraints.__estudexAllowMonitorSystemAudio;\n        const stream = await originalGetDisplayMedia(captureConstraints);\n        const videoTrack = stream?.getVideoTracks?.()[0] || null;\n        const displaySurface = String(videoTrack?.getSettings?.().displaySurface || '').toLowerCase();\n        const audioAllowed = displaySurface === 'browser' || (displaySurface === 'monitor' && allowMonitorSystemAudio);\n        if (!audioAllowed) {\n          for (const track of stream?.getAudioTracks?.() || []) {\n            try { stream.removeTrack?.(track); } catch {}\n            try { track.stop(); } catch {}\n          }\n        }\n        try {\n          Object.defineProperty(stream,'__estudexAudioPrivacyV1939',{\n            value:Object.freeze({displaySurface,allowMonitorSystemAudio,audioAllowed}),\n            configurable:false,enumerable:false,writable:false\n          });\n        } catch {}\n        return stream;`,
'getDisplayMedia fail-closed post filter');

engine=once(engine,
`    await estudexAttachSystemAudioV1925(stream, mediaState.audioEnabled);`,
`    /* ESTUDEX_V193_MEDIA_PRIVACY_EXPLICIT_MONITOR_AUDIO */\n    if(mediaState.screenSourceKind==='screen'&&sourceMeta?.allowSystemAudio===true&&mediaState.audioEnabled){\n      await estudexAttachSystemAudioV1925(stream, true);\n    }`,
'room legacy screen audio explicit permission');

engine=once(engine,
`    let sourceId=clean(sourceInput?.id||sourceInput);\n    if(!sourceId){const picked=await mediaApi()?.pickCaptureSource?.();sourceId=clean(picked?.id);}`,
`    let sourceMeta=sourceInput&&typeof sourceInput==='object'?sourceInput:null;\n    let sourceId=clean(sourceMeta?.id||sourceInput);\n    if(!sourceId){const picked=await mediaApi()?.pickCaptureSource?.();sourceMeta=picked&&typeof picked==='object'?picked:null;sourceId=clean(sourceMeta?.id);}`,
'call capture source metadata preservation');

engine=once(engine,
`    await estudexAttachSystemAudioV1925(screenStream, state.audioEnabled);`,
`    const sourceKind=sourceMeta?.kind==='window'?'window':'screen';\n    if(sourceKind==='screen'&&sourceMeta?.allowSystemAudio===true&&state.audioEnabled){\n      await estudexAttachSystemAudioV1925(screenStream, true);\n    }`,
'call legacy screen audio explicit permission');

write('public/estudex-engine.js',engine);

let home=read('public/js/home.js');
must(home.includes('ESTUDEX_V193_HOTFIX34_ROOM_PAINT_COALESCE'),'Hotfix34 navigation baseline missing');
must(!home.includes('ESTUDEX_V193_MEDIA_PRIVACY_SCREEN_POLICY'),'media privacy home patch already applied');

const screenPolicyHelpers=`/* ESTUDEX_V193_MEDIA_PRIVACY_SCREEN_POLICY */\nconst ESTUDEX_WINDOW_AUDIO_PRIVACY_MESSAGE_V1939 = \"Janela selecionada sem áudio isolado disponível. A transmissão continua sem áudio para evitar capturar o som total do sistema.\";\n\nfunction estudexDisplaySurfaceV1939(stream) {\n  const videoTrack = stream?.getVideoTracks?.()[0] || null;\n  return String(videoTrack?.getSettings?.().displaySurface || '').toLowerCase();\n}\n\nfunction estudexStopCapturedAudioV1939(stream) {\n  for (const track of stream?.getAudioTracks?.() || []) {\n    try { stream.removeTrack?.(track); } catch {}\n    try { track.stop(); } catch {}\n  }\n}\n\nfunction estudexProtectCapturedAudioV1939(stream, allowMonitorSystemAudio) {\n  const displaySurface = estudexDisplaySurfaceV1939(stream);\n  const audioTracksBefore = [...(stream?.getAudioTracks?.() || [])];\n  const keepAudio = displaySurface === \"browser\" || (displaySurface === \"monitor\" && allowMonitorSystemAudio === true);\n\n  // Privacy-first: window audio is never trusted merely because a browser supplied a track.\n  // Unknown surfaces also fail closed. Tabs keep only the track returned by getDisplayMedia;\n  // monitors require the explicit ESTUDEX permission collected before capture.\n  if (!keepAudio) estudexStopCapturedAudioV1939(stream);\n\n  return {\n    displaySurface,\n    audioDropped: audioTracksBefore.length > 0 && !keepAudio,\n    audioTracks: stream?.getAudioTracks?.().length || 0\n  };\n}\n\nfunction estudexAskMonitorSystemAudioV1939() {\n  if (!roomLocalState.audioEnabled) return false;\n  return window.confirm(\n    \"Se você escolher Tela inteira, permitir áudio global do sistema?\\n\\n\" +\n    \"OK: o som de outros aplicativos pode ser transmitido.\\n\" +\n    \"Cancelar: o áudio global fica bloqueado. O áudio da guia continua permitido.\"\n  );\n}\n\n`;
home=once(home,'async function toggleRoomScreen() {',screenPolicyHelpers+'async function toggleRoomScreen() {','screen policy helpers');

home=regexOnce(home,
/async function toggleRoomScreen\(\) \{[\s\S]*?\n\}\n\nfunction toggleRoomAudio\(\) \{/,
`async function toggleRoomScreen() {\n  try {\n    if (!roomLocalState.screenEnabled) {\n      const allowMonitorSystemAudio = estudexAskMonitorSystemAudioV1939();\n      const stream = await navigator.mediaDevices.getDisplayMedia({\n        video: buildScreenConstraints(),\n        audio: roomLocalState.audioEnabled,\n        systemAudio: allowMonitorSystemAudio ? \"include\" : \"exclude\",\n        windowAudio: \"window\",\n        __estudexAllowMonitorSystemAudio: allowMonitorSystemAudio\n      });\n\n      const privacy = estudexProtectCapturedAudioV1939(stream, allowMonitorSystemAudio);\n      if (privacy.displaySurface === \"window\") {\n        showToast(ESTUDEX_WINDOW_AUDIO_PRIVACY_MESSAGE_V1939);\n      }\n\n      const [videoTrack] = stream.getVideoTracks();\n      if (videoTrack) {\n        videoTrack.onended = () => {\n          handleScreenShareEnded();\n        };\n      }\n\n      stopSingleStream(roomLocalState.screenStream);\n      roomLocalState.screenStream = stream;\n      roomLocalState.screenEnabled = true;\n    } else {\n      handleScreenShareEnded();\n    }\n\n    updateStagePreview();\n    emitLocalRoomMediaState();\n  } catch (error) {\n    if (error?.name === \"NotAllowedError\" || error?.name === \"AbortError\") return;\n    showToast(\"Não foi possível compartilhar a tela.\");\n  }\n}\n\nfunction toggleRoomAudio() {`,
'screen share capture policy');

const playbackHelpers=`/* ESTUDEX_V193_REMOTE_AUDIO_GESTURE_UNLOCK */\nlet estudexRoomPlaybackToastAtV1939 = 0;\n\nfunction estudexRoomHasRemoteAudioV1939(video) {\n  const selectedId = resolveStageMemberId();\n  if (!selectedId || isOwnRoomMemberId(selectedId)) return false;\n  return Boolean(video?.srcObject?.getAudioTracks?.().some(track => track.readyState === \"live\"));\n}\n\nfunction estudexTryRoomStagePlaybackV1939(video, options = {}) {\n  if (!video) return Promise.resolve(false);\n  try {\n    video.autoplay = true;\n    video.playsInline = true;\n    video.setAttribute(\"playsinline\", \"\");\n    const playResult = video.play();\n    if (!playResult || typeof playResult.then !== \"function\") return Promise.resolve(true);\n    return playResult.then(() => {\n      delete video.dataset.estudexAutoplayBlocked;\n      return true;\n    }).catch(error => {\n      if (error?.name === \"NotAllowedError\") {\n        video.dataset.estudexAutoplayBlocked = \"1\";\n        if (!options.fromGesture && estudexRoomHasRemoteAudioV1939(video)) {\n          const now = Date.now();\n          if (now - estudexRoomPlaybackToastAtV1939 > 3500) {\n            estudexRoomPlaybackToastAtV1939 = now;\n            showToast(\"Toque na transmissão para ativar o áudio.\");\n          }\n        }\n      }\n      return false;\n    });\n  } catch {\n    return Promise.resolve(false);\n  }\n}\n\nfunction estudexUnlockRoomAudioFromGestureV1939() {\n  const video = $(\"#roomStageVideo\");\n  if (!video) return;\n  const selectedId = resolveStageMemberId();\n  if (selectedId && !isOwnRoomMemberId(selectedId) && roomLocalState.audioEnabled) {\n    video.muted = false;\n  }\n  void estudexTryRoomStagePlaybackV1939(video, { fromGesture:true });\n}\n\ndocument.addEventListener(\"click\", event => {\n  const element = event.target instanceof Element ? event.target : null;\n  const trigger = element?.closest?.(\n    \"[data-room-code], [data-recent-code], [data-enter-room], [data-open-own-room], [data-room-member-id], #roomStageVideo, #roomStagePlaceholder\"\n  );\n  if (!trigger) return;\n  estudexUnlockRoomAudioFromGestureV1939();\n}, true);\n\n`;
home=once(home,'function updateStagePreview() {',playbackHelpers+'function updateStagePreview() {','remote playback helpers');
home=once(home,'    video.play().catch(() => {});','    void estudexTryRoomStagePlaybackV1939(video);','stage autoplay rejection handling');

write('public/js/home.js',home);

pkg.version='1.9.39';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n','utf8');
let forge=read('forge.config.js');
must(/version:\s*[\"']1\.9\.38[\"']/.test(forge),'forge 1.9.38 version anchor missing');
forge=forge.replace(/version:\s*[\"']1\.9\.38[\"']/,'version: \"1.9.39\"');
write('forge.config.js',forge);

const manifest={
  product:'ESTUDEX',
  productVersion:'1.9.3',
  technicalVersion:'1.9.39',
  release:false,
  baseTag:'v1.9.38-hotfix34',
  mode:'isolated-media-privacy-and-remote-audio-playback-candidate',
  fixes:[
    'removes automatic global Windows loopback fallback from getDisplayMedia',
    'browser-tab audio keeps only the audio track returned by the selected tab capture',
    'window capture always drops and stops returned audio tracks because per-window isolation cannot be proven at runtime',
    'monitor system audio requires explicit per-share ESTUDEX permission and is still post-filtered after capture',
    'legacy desktop-capturer room/call paths require explicit allowSystemAudio=true and never grant it to window sources',
    'screen sharing does not request microphone capture',
    'remote room media retries HTMLMediaElement.play from explicit watch/open gestures and handles NotAllowedError instead of swallowing it'
  ],
  privacy:{windowAudio:'fail-closed',monitorAudio:'explicit-opt-in',tabAudio:'selected-tab-track-only',microphoneRequestedByScreenShare:false},
  preserved
};
fs.writeFileSync(path.join(root,'estudex-media-privacy-v1939-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');

must(sha('main.js')===preserved.main,'main.js changed');
must(sha('public/js/estudex-engine-socket-compat.js')===preserved.compat,'socket compat changed');
must(sha('public/js/estudex-v193-cloud-social-v1926.js')===preserved.cloud,'cloud social changed');
must(sha('public/css/home.css')===preserved.css,'home.css changed');
console.log('ESTUDEX media privacy/audio playback candidate applied');
