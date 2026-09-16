'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||process.cwd());
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const write=(r,t)=>fs.writeFileSync(path.join(root,r),t,'utf8');
const must=(v,m)=>{if(!v)throw new Error('ESTUDEX explicit monitor audio: '+m);};
const once=(text,from,to,label)=>{const n=text.split(from).length-1;must(n===1,`${label}: expected 1 anchor, got ${n}`);return text.replace(from,to);};

const pkg=JSON.parse(read('package.json'));
must(pkg.version==='1.9.39','media privacy patch must run first');
let engine=read('public/estudex-engine.js');
must(engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_FAIL_CLOSED'),'privacy patch missing');
must(!engine.includes('ESTUDEX_V193_MEDIA_PRIVACY_MONITOR_FALLBACK_EXPLICIT'),'already patched');

engine=once(engine,
`        const stream = await originalGetDisplayMedia(captureConstraints);\n        const videoTrack = stream?.getVideoTracks?.()[0] || null;\n        const displaySurface = String(videoTrack?.getSettings?.().displaySurface || '').toLowerCase();\n        const audioAllowed = displaySurface === 'browser' || (displaySurface === 'monitor' && allowMonitorSystemAudio);`,
`        const stream = await originalGetDisplayMedia(captureConstraints);\n        const videoTrack = stream?.getVideoTracks?.()[0] || null;\n        const displaySurface = String(videoTrack?.getSettings?.().displaySurface || '').toLowerCase();\n        /* ESTUDEX_V193_MEDIA_PRIVACY_MONITOR_FALLBACK_EXPLICIT */\n        if (displaySurface === 'monitor' && allowMonitorSystemAudio && constraints?.audio && !(stream?.getAudioTracks?.().length)) {\n          // Electron may return video-only for monitor capture. Global loopback is\n          // permitted only after the ESTUDEX per-share opt-in and only for a monitor.\n          await estudexAttachSystemAudioV1925(stream, true);\n        }\n        const audioAllowed = displaySurface === 'browser' || (displaySurface === 'monitor' && allowMonitorSystemAudio);`,
'explicit monitor-only system audio fallback');
write('public/estudex-engine.js',engine);

const manifestPath='estudex-media-privacy-v1939-manifest.json';
const manifest=JSON.parse(read(manifestPath));
manifest.fixes=[...(manifest.fixes||[]),'monitor capture may use the Windows system-loopback helper only after explicit per-share permission and only when getDisplayMedia returned no audio'];
manifest.privacy={...(manifest.privacy||{}),monitorFallback:'explicit-monitor-only'};
write(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('ESTUDEX explicit monitor audio gate applied');
