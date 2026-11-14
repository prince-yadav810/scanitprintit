const fs = require('node:fs');
const path = require('node:path');

// Electron's instance lock is scoped to userData. Support must choose its own
// profile before requesting that lock, otherwise an older agent gets focused.
function configureAppProfile(app, support) {
  const installedDirectory = app.getPath('userData');
  if (!support) return { support: false, installedDirectories: [] };

  const appData = app.getPath('appData');
  const directory = path.join(appData, 'ScanItPrintIt Support');
  fs.mkdirSync(directory, { recursive: true });
  app.setPath('userData', directory);
  app.setPath('sessionData', directory);
  app.setName('ScanItPrintIt Support');
  if (process.platform === 'win32') app.setAppUserModelId('in.scanitprintit.support');
  return {
    support: true,
    installedDirectories: [...new Set([
      installedDirectory,
      path.join(appData, 'scanitprintit-agent'),
      path.join(appData, 'ScanItPrintIt Agent'),
    ])].filter(candidate => path.resolve(candidate) !== path.resolve(directory)),
  };
}

function importSupportPairing(store, profile) {
  if (!profile.support || store.get('supportProfileInitialized')) return false;
  let imported = false;
  if (!store.get('token')) {
    for (const directory of profile.installedDirectories) {
      try {
        // Read the old config directly. Opening an electron-store for that
        // profile could migrate or overwrite an app that is still running.
        const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
        if (typeof config.token !== 'string' || !config.token) continue;
        const pairing = {};
        for (const key of ['token', 'shopId', 'shopName', 'shopSlug', 'selectedPrinter']) {
          if (typeof config[key] === 'string' && config[key]) pairing[key] = config[key];
        }
        store.set(pairing);
        imported = true;
        break;
      } catch { /* A missing or unreadable old profile can be paired normally. */ }
    }
  }
  store.set('supportProfileInitialized', true);
  return imported;
}

module.exports = { configureAppProfile, importSupportPairing };
