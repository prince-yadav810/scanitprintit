const fs = require('node:fs');
const path = require('node:path');
const { app, protocol } = require('electron');

const SCHEME = 'scanitprintit-print';
const PRINT_PAGE_URL = `${SCHEME}://bundle/src/renderer/print.html`;
const assetRoot = path.resolve(__dirname, '../..');
const fixedAssets = new Map([
  ['/src/renderer/print.html', 'text/html; charset=utf-8'],
  ['/src/renderer/print-renderer.js', 'text/javascript; charset=utf-8'],
  ['/node_modules/pdfjs-dist/build/pdf.mjs', 'text/javascript; charset=utf-8'],
  ['/node_modules/pdfjs-dist/build/pdf.worker.mjs', 'text/javascript; charset=utf-8'],
]);
let schemeRegistered = false;
let handlerInstalled = false;

// Electron requires scheme privileges before app readiness. Register only the
// web features used by PDF.js; CSP and the renderer sandbox remain enforced.
function registerPrintAssetScheme() {
  if (schemeRegistered) return;
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  }]);
  schemeRegistered = true;
}

function resolveAsset(urlString) {
  let url;
  try { url = new URL(urlString); } catch { return null; }
  // Requiring a canonical URL also rejects queries, credentials, ports, encoded
  // traversal, backslashes and dot segments before a local path is constructed.
  if (url.protocol !== `${SCHEME}:` || url.host !== 'bundle'
      || urlString !== `${SCHEME}://bundle${url.pathname}`) return null;
  let contentType = fixedAssets.get(url.pathname);
  if (!contentType && /^\/node_modules\/pdfjs-dist\/cmaps\/[A-Za-z0-9_-]+\.bcmap$/.test(url.pathname)) {
    contentType = 'application/octet-stream';
  }
  if (!contentType && /^\/node_modules\/pdfjs-dist\/standard_fonts\/[A-Za-z0-9_-]+\.(?:pfb|ttf)$/.test(url.pathname)) {
    contentType = 'application/octet-stream';
  }
  return contentType ? { relativePath: url.pathname.slice(1), contentType } : null;
}

async function servePrintAsset(request) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const asset = resolveAsset(request.url);
  if (!asset) return new Response('Not found', { status: 404 });
  try {
    // Read bundled bytes directly in the main process, including inside ASAR.
    // Do not delegate to net.fetch(file://), which retains file navigation.
    const bytes = await fs.promises.readFile(path.join(assetRoot, asset.relativePath));
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: { 'Content-Type': asset.contentType, 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    return new Response('Bundled print asset unavailable', { status: error.code === 'ENOENT' ? 404 : 500 });
  }
}

async function ensurePrintAssetHandler() {
  if (!schemeRegistered) throw new Error('Print asset scheme must be registered before app readiness.');
  await app.whenReady();
  if (!handlerInstalled) {
    protocol.handle(SCHEME, servePrintAsset);
    handlerInstalled = true;
  }
}

module.exports = { registerPrintAssetScheme, ensurePrintAssetHandler, PRINT_PAGE_URL };
