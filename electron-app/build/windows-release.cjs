const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readdirSync } = require('node:fs');
const path = require('node:path');
const metadata = require('../package.json');

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('Run this release build on the Windows signing machine.');
  }
  const certificateThumbprint = process.env.WINDOWS_SIGNING_THUMBPRINT?.replace(/\s+/g, '').toUpperCase();
  const publisherName = process.env.WINDOWS_SIGNING_PUBLISHER?.trim();
  if (!certificateThumbprint || !/^[0-9A-F]{40}$/.test(certificateThumbprint) || !publisherName) {
    throw new Error('Set WINDOWS_SIGNING_THUMBPRINT and WINDOWS_SIGNING_PUBLISHER to the verified Windows certificate identity.');
  }

  const { Arch, build, Platform } = require('electron-builder');
  const projectDir = path.resolve(__dirname, '..');
  const releaseDir = path.join(projectDir, 'dist', 'windows-release');
  mkdirSync(releaseDir, { recursive: true });
  const output = mkdtempSync(path.join(releaseDir, metadata.version + '-'));
  await build({
    projectDir,
    targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
    publish: 'never',
    config: {
      ...metadata.build,
      forceCodeSigning: true,
      directories: { ...metadata.build.directories, output },
      win: {
        ...metadata.build.win,
        certificateSha1: certificateThumbprint,
        publisherName,
        signingHashAlgorithms: ['sha256'],
        signExts: ['.dll', '.node'],
        verifyUpdateCodeSignature: true,
      },
    },
  });

  const installers = readdirSync(output).filter(file => file.toLowerCase().endsWith('.exe'));
  if (installers.length !== 1) throw new Error('Expected one Windows installer in the release directory.');
  execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'verify-windows-release.ps1'),
    '-InstallerPath', path.join(output, installers[0]),
    '-AppDirectory', path.join(output, 'win-unpacked'),
    '-PublisherName', publisherName,
    '-CertificateThumbprint', certificateThumbprint,
  ], { stdio: 'inherit', windowsHide: true });
  console.log(`Verified Windows release: ${output}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
