module.exports = {
  packagerConfig: {
    // ESTUDEX_WIN32_METADATA_V101
    executableName: 'ESTUDEX',
    win32metadata: {
      CompanyName: 'ESTUDEX',
      FileDescription: 'ESTUDEX',
      ProductName: 'ESTUDEX',
      InternalName: 'ESTUDEX',
      OriginalFilename: 'ESTUDEX.exe'
    },
    asar: true,
    extraResource: ['resources/BLAZERX-NetworkHelper.exe', 'resources/BLAZERX-UpdateRelay.exe'],
    name: 'BLAZERX',
    executableName: 'ESTUDEX',
    icon: './resources/estudex.ico',
    win32metadata: {
      CompanyName: 'BLAZERX',
      FileDescription: 'BLAZERX Desktop',
      ProductName: 'BLAZERX',
      InternalName: 'BLAZERX',
      OriginalFilename: 'BLAZERX.exe'
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // ESTUDEX_SQUIRREL_LEGACY_ID_V102
        name: 'blazerx',
        name: 'blazerx',
        setupExe: 'ESTUDEX-Setup.exe',
iconUrl: 'https://github.com/Kodezinho22/BLAZERX-Downloads/releases/download/v1.0.0/ESTUDEX.ico',
      }
    }
  ]
};


/* ESTUDEX_FINAL_WINDOWS_ID_V103 */
if (module && module.exports) {
  module.exports.packagerConfig = module.exports.packagerConfig || {};
  module.exports.packagerConfig.executableName = 'ESTUDEX';
  module.exports.packagerConfig.icon = './resources/estudex.ico';
  module.exports.packagerConfig.win32metadata = {
    CompanyName: 'ESTUDEX',
    FileDescription: 'ESTUDEX',
    ProductName: 'ESTUDEX',
    InternalName: 'ESTUDEX',
    OriginalFilename: 'ESTUDEX.exe'
  };

  const squirrelMaker = Array.isArray(module.exports.makers)
    ? module.exports.makers.find(m => m && m.name === '@electron-forge/maker-squirrel')
    : null;
  if (squirrelMaker) {
    squirrelMaker.config = squirrelMaker.config || {};
    // Keep only the updater/install identity legacy so existing installs update in place.
    squirrelMaker.config.name = 'blazerx';
    squirrelMaker.config.setupExe = 'ESTUDEX-Setup.exe';
    squirrelMaker.config.iconUrl = 'https://github.com/Kodezinho22/BLAZERX-Downloads/releases/download/v1.1.0/ESTUDEX.ico';
    delete squirrelMaker.config.setupIcon;
  }
}


/* ESTUDEX_V190_CLEANROOM_SQUIRREL_BRANDING */
;(() => {
  const makers = Array.isArray(module.exports?.makers) ? module.exports.makers : [];
  const squirrel = makers.find(item => String(item?.name || '').includes('maker-squirrel'));
  if (!squirrel) throw new Error('ESTUDEX installer branding: Squirrel maker not found.');
  squirrel.config = {
    ...(squirrel.config || {}),
    setupExe: 'ESTUDEX-Setup.exe',

    loadingGif: require('path').join(__dirname, 'resources', 'estudex-installing.gif')
  };
})();


/* ESTUDEX_V1010_EXACT_SQUIRREL_PACKAGE_IDENTITY */
;(() => {
  const makers = Array.isArray(module.exports?.makers) ? module.exports.makers : [];
  const squirrel = makers.find(item => String(item?.name || '').includes('maker-squirrel'));
  if (!squirrel) throw new Error('ESTUDEX V10.10 exact Squirrel identity: maker-squirrel not found.');
  const clean = {...(squirrel.config || {})};
  delete clean.iconUrl;
  squirrel.config = {
    ...clean,
    name: 'estudex',
    title: 'ESTUDEX',
    authors: 'ESTUDEX',
    exe: 'ESTUDEX.exe',
    description: 'ESTUDEX 1.9 with canonical V10.10 renderer'
  };
})();


/* ESTUDEX_V1010_EXACT_PACKAGER_ICON */
(() => {
  const path=require('path');
  const config=module.exports;
  config.packagerConfig={
    ...(config.packagerConfig||{}),
    icon:path.join(__dirname,'resources','estudex.ico'),
    executableName:'ESTUDEX'
  };
  const makers=Array.isArray(config.makers)?config.makers:[];
  const squirrel=makers.find(item=>String(item?.name||'').includes('maker-squirrel'));
  if(squirrel){
    squirrel.config={...(squirrel.config||{}),exe:'ESTUDEX.exe',setupExe:'ESTUDEX-Setup.exe'};
  }
})();


/* ESTUDEX_V190_CLEANROOM_SQUIRREL_CANDIDATE_VERSION_APPLIED */
(() => {
  const maker = (module.exports.makers || []).find(item => String(item?.name || '').includes('maker-squirrel'));
  if (!maker) throw new Error('ESTUDEX Squirrel candidate version: maker-squirrel not found.');
  maker.config = {...(maker.config || {}), version:"1.9.1-cleanroom2"};
})();


/* ESTUDEX_V1010_EXACT_STABLE_SQUIRREL_VERSION_APPLIED */
(() => {
  const maker = (module.exports.makers || []).find(item => String(item?.name || '').includes('maker-squirrel'));
  if (!maker) throw new Error('ESTUDEX stable version: maker-squirrel not found.');
  maker.config = {
    ...(maker.config || {}),
    version: "1.9.30",
    name: "blazerx",
    title: 'ESTUDEX',
    authors: 'ESTUDEX',
    exe: 'ESTUDEX.exe',
    setupExe: 'ESTUDEX-Setup.exe'
  };
  delete maker.config.iconUrl;
})();
