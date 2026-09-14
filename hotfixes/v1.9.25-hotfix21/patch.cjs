const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || process.cwd());
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('ESTUDEX Hotfix 21 patch: ' + msg); };
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const replaceOnce = (text, before, after, label) => {
  must(text.includes(before), label + ' anchor not found');
  return text.replace(before, after);
};

const homeJsBefore = sha('public/js/home.js');
const homeCssBefore = sha('public/css/home.css');

let engine = read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_HOTFIX20_CLOUD_ROOM_TEST'), 'Hotfix 20 cloud baseline missing');
must(!engine.includes('ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO'), 'Hotfix 21 already applied');

/* Electron 29 on Windows can return a perfectly valid desktop VIDEO stream with
   no audio track. Capture loopback separately using Chromium's desktop source,
   discard the probe video and graft the system-audio track onto the selected
   screen/window stream. This keeps the existing source picker and WebRTC flow. */
const runtimeAnchor = `  try { window.ESTUDEX_CLOUD_ROOM_BASE = estudexCloudRoomBaseV1924(); } catch {}\n\n  const roomState = {`;
const runtime = `  try { window.ESTUDEX_CLOUD_ROOM_BASE = estudexCloudRoomBaseV1924(); } catch {}\n\n  /* ESTUDEX_V193_HOTFIX21_SYSTEM_AUDIO\n     Windows/Electron system loopback helper. The loopback capture is global PC\n     audio (not per-window), while the selected video source remains unchanged. */\n  async function estudexCaptureSystemAudioV1925() {\n    const devices = navigator?.mediaDevices;\n    if (!devices?.getUserMedia) return null;\n    let probe = null;\n    try {\n      probe = await devices.getUserMedia({\n        audio:{mandatory:{chromeMediaSource:'desktop'}},\n        video:{mandatory:{chromeMediaSource:'desktop'}}\n      });\n      const audioTrack = probe?.getAudioTracks?.().find(track => track.readyState === 'live') || probe?.getAudioTracks?.()[0] || null;\n      for (const track of probe?.getVideoTracks?.() || []) { try { track.stop(); } catch {} }\n      for (const track of probe?.getAudioTracks?.() || []) { if (track !== audioTrack) try { track.stop(); } catch {} }\n      if (!audioTrack) { try { stopTracks(probe); } catch {} return null; }\n      return audioTrack;\n    } catch (error) {\n      try { stopTracks(probe); } catch {}\n      try { root.__estudexLastSystemAudioErrorV1925 = String(error?.message || error || 'system_audio_unavailable'); } catch {}\n      return null;\n    }\n  }\n\n  async function estudexAttachSystemAudioV1925(stream, enabled = true) {\n    if (!stream) return stream;\n    const existing = stream.getAudioTracks?.().find(track => track.readyState === 'live') || null;\n    if (existing) { existing.enabled = Boolean(enabled); return stream; }\n    const track = await estudexCaptureSystemAudioV1925();\n    if (track) {\n      track.enabled = Boolean(enabled);\n      try { stream.addTrack(track); } catch { try { track.stop(); } catch {} }\n    }\n    return stream;\n  }\n\n  /* Canonical V10.10 still calls getDisplayMedia directly. Electron can return\n     video-only there, so enrich that stream without touching the canonical UI. */\n  try {\n    const devices = navigator?.mediaDevices;\n    const originalGetDisplayMedia = devices?.getDisplayMedia?.bind(devices);\n    if (originalGetDisplayMedia && !devices.__estudexSystemAudioWrappedV1925) {\n      Object.defineProperty(devices, '__estudexSystemAudioWrappedV1925', {value:true, configurable:false});\n      devices.getDisplayMedia = async constraints => {\n        const stream = await originalGetDisplayMedia(constraints);\n        if (constraints?.audio && !(stream?.getAudioTracks?.().length)) {\n          await estudexAttachSystemAudioV1925(stream, true);\n        }\n        return stream;\n      };\n    }\n  } catch {}\n\n  const roomState = {`;
engine = replaceOnce(engine, runtimeAnchor, runtime, 'system-audio runtime');

const oldRoomCapture = `    const q=mediaState.quality;\n    const mandatory={chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxWidth:q===1440?2560:(q===1080?1920:1280),maxHeight:q===1440?1440:(q===1080?1080:720),maxFrameRate:mediaState.fps};\n    /* Electron/Chromium desktop audio on Windows is system loopback, not\n       per-window application audio. Never attach it implicitly to a share. */\n    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory}});\n    if(captureToken!==localCaptureTokens.screen||!currentRoomCapture(captureLifecycle,captureRoomId,captureClientId)){stopTracks(stream);throw new Error('A sala mudou durante a abertura da transmissão.');}\n    for(const track of stream.getAudioTracks()){try{stream.removeTrack(track);}catch{}try{track.stop();}catch{}}\n    activeScreenSourceId=sourceId;`;
const newRoomCapture = `    const q=mediaState.quality;\n    const mandatory={chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxWidth:q===1440?2560:(q===1080?1920:1280),maxHeight:q===1440?1440:(q===1080?1080:720),maxFrameRate:mediaState.fps};\n    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory}});\n    if(captureToken!==localCaptureTokens.screen||!currentRoomCapture(captureLifecycle,captureRoomId,captureClientId)){stopTracks(stream);throw new Error('A sala mudou durante a abertura da transmissão.');}\n    await estudexAttachSystemAudioV1925(stream, mediaState.audioEnabled);\n    activeScreenSourceId=sourceId;`;
engine = replaceOnce(engine, oldRoomCapture, newRoomCapture, 'room screen system audio');

const oldCallCapture = `    const p=prefs(),quality=[720,1080,1440].includes(Number(p.quality))?Number(p.quality):1080,fps=[24,30,60].includes(Number(p.fps))?Number(p.fps):60;\n    const mandatory={chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxWidth:quality===1440?2560:(quality===1080?1920:1280),maxHeight:quality===1440?1440:(quality===1080?1080:720),maxFrameRate:fps};\n    screenStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory}});\n    for(const track of screenStream.getAudioTracks()){try{screenStream.removeTrack(track);}catch{}try{track.stop();}catch{}}\n    state.screenShareEnabled=true;`;
const newCallCapture = `    const p=prefs(),quality=[720,1080,1440].includes(Number(p.quality))?Number(p.quality):1080,fps=[24,30,60].includes(Number(p.fps))?Number(p.fps):60;\n    const mandatory={chromeMediaSource:'desktop',chromeMediaSourceId:sourceId,maxWidth:quality===1440?2560:(quality===1080?1920:1280),maxHeight:quality===1440?1440:(quality===1080?1080:720),maxFrameRate:fps};\n    screenStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory}});\n    await estudexAttachSystemAudioV1925(screenStream, state.audioEnabled);\n    state.screenShareEnabled=true;`;
engine = replaceOnce(engine, oldCallCapture, newCallCapture, 'direct-call screen system audio');

engine = replaceOnce(
  engine,
  `  function setAudioEnabled(value){state.audioEnabled=Boolean(value);emit('state');return snapshot();}`,
  `  function setAudioEnabled(value){state.audioEnabled=Boolean(value);for(const track of screenStream?.getAudioTracks?.()||[])track.enabled=state.audioEnabled;emit('state');return snapshot();}`,
  'direct-call audio toggle'
);

write('public/estudex-engine.js', engine);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
must(pkg.version === '1.9.24', 'expected technical version 1.9.24, got ' + pkg.version);
pkg.version = '1.9.25';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

let forge = read('forge.config.js');
must(/version:\s*["']1\.9\.24["']/.test(forge), 'Squirrel 1.9.24 version anchor missing');
forge = forge.replace(/version:\s*["']1\.9\.24["']/, 'version: "1.9.25"');
write('forge.config.js', forge);

must(sha('public/js/home.js') === homeJsBefore, 'canonical V10.10 home.js changed');
must(sha('public/css/home.css') === homeCssBefore, 'canonical V10.10 home.css changed');

const manifest = {
  product:'ESTUDEX', productVersion:'1.9.3', technicalVersion:'1.9.25', hotfix:21,
  baseTag:'v1.9.24-hotfix20', mode:'cloud-screen-audio-fix',
  screenAudio:{platform:'Windows',capture:'system-loopback',videoSource:'selected-window-or-screen',perWindowAudio:false,fallback:'video-only-if-loopback-unavailable'},
  cloud:{base:'https://estudexserver-p1t0c2xc.b4a.run',media:'WebRTC P2P'},
  canonicalHome:{js:homeJsBefore,css:homeCssBefore}
};
fs.writeFileSync(path.join(root, 'estudex-hotfix21-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('ESTUDEX v1.9.3 Hotfix 21 / technical 1.9.25 system-audio fix applied.');
