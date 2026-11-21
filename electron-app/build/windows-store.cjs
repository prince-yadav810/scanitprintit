const path = require('node:path');
const { Arch, build, Platform } = require('electron-builder');
const metadata = require('../package.json');
const storeIdentity = require('./store-identity.json');

async function main() {
  if (process.platform !== 'win32') throw new Error('Build the Store package on Windows.');

  await build({
    projectDir: path.resolve(__dirname, '..'),
    targets: Platform.WINDOWS.createTarget(['appx'], Arch.x64),
    publish: 'never',
    config: {
      ...metadata.build,
      directories: { ...metadata.build.directories, output: 'dist/windows-store' },
      extraResources: [],
      extraMetadata: { description: 'Desktop print agent and shop dashboard for ScanItPrintIt' },
      publish: null,
      appx: {
        ...storeIdentity,
        artifactName: 'ScanItPrintIt-Store-${version}-${arch}.${ext}',
        backgroundColor: '#fcf7f0',
        customExtensionsPath: 'build/store-startup.xml',
      },
    },
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
