const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load, settle } = require('./helpers.cjs');

function setup({ ready = Promise.resolve(), readFile } = {}) {
  const registrations = [];
  const handlers = new Map();
  const reads = [];
  const root = path.resolve(__dirname, '..');
  const service = load(path.resolve(__dirname, '../src/main/print-assets.js'), {
    electron: {
      app: { whenReady: () => ready },
      protocol: {
        registerSchemesAsPrivileged: schemes => registrations.push(...schemes),
        handle(scheme, handler) { assert.equal(handlers.has(scheme), false); handlers.set(scheme, handler); },
      },
    },
    'node:fs': { promises: { readFile: async file => {
      reads.push(file);
      return readFile ? readFile(file) : Buffer.from('bundled bytes');
    } } },
  }, { Response });
  return {
    ...service, registrations, handlers, reads, root,
    request: (url, method = 'GET') => handlers.get('scanitprintit-print')({ url, method }),
  };
}

test('registers only required scheme privileges once and installs its handler after readiness', async () => {
  let finish;
  const s = setup({ ready: new Promise(resolve => { finish = resolve; }) });
  await assert.rejects(s.ensurePrintAssetHandler(), /registered before app readiness/);
  s.registerPrintAssetScheme();
  s.registerPrintAssetScheme();
  assert.deepEqual(JSON.parse(JSON.stringify(s.registrations)), [{
    scheme: 'scanitprintit-print',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  }]);
  const first = s.ensurePrintAssetHandler();
  const second = s.ensurePrintAssetHandler();
  await settle();
  assert.equal(s.handlers.size, 0);
  finish();
  await Promise.all([first, second]);
  assert.equal(s.handlers.size, 1);
});

test('serves only the bundled print resources with module MIME types and intact relative URLs', async () => {
  const s = setup();
  s.registerPrintAssetScheme();
  await s.ensurePrintAssetHandler();
  const resources = [
    [s.PRINT_PAGE_URL, 'src/renderer/print.html', 'text/html'],
    [new URL('./print-renderer.js', s.PRINT_PAGE_URL).href, 'src/renderer/print-renderer.js', 'text/javascript'],
    [new URL('../../node_modules/pdfjs-dist/build/pdf.mjs', s.PRINT_PAGE_URL).href, 'node_modules/pdfjs-dist/build/pdf.mjs', 'text/javascript'],
    [new URL('../../node_modules/pdfjs-dist/build/pdf.worker.mjs', s.PRINT_PAGE_URL).href, 'node_modules/pdfjs-dist/build/pdf.worker.mjs', 'text/javascript'],
    ['scanitprintit-print://bundle/node_modules/pdfjs-dist/cmaps/UniJIS-UTF16-H.bcmap', 'node_modules/pdfjs-dist/cmaps/UniJIS-UTF16-H.bcmap', 'application/octet-stream'],
    ['scanitprintit-print://bundle/node_modules/pdfjs-dist/standard_fonts/FoxitFixed.pfb', 'node_modules/pdfjs-dist/standard_fonts/FoxitFixed.pfb', 'application/octet-stream'],
    ['scanitprintit-print://bundle/node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf', 'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf', 'application/octet-stream'],
  ];
  for (const [url, relative, contentType] of resources) {
    const response = await s.request(url);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'bundled bytes');
    assert.equal(response.headers.get('content-type').split(';')[0], contentType);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(s.reads.at(-1), path.join(s.root, relative));
  }
  const head = await s.request(s.PRINT_PAGE_URL, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('rejects other files, hosts, methods and traversal without reading disk', async () => {
  const s = setup();
  s.registerPrintAssetScheme();
  await s.ensurePrintAssetHandler();
  for (const url of [
    'file:///C:/private.pdf',
    'scanitprintit-print://other/src/renderer/print.html',
    'scanitprintit-print://bundle:123/src/renderer/print.html',
    'scanitprintit-print://user@bundle/src/renderer/print.html',
    `${s.PRINT_PAGE_URL}?file=secret`,
    `${s.PRINT_PAGE_URL}#fragment`,
    'scanitprintit-print://bundle/src/main/index.js',
    'scanitprintit-print://bundle/package.json',
    'scanitprintit-print://bundle/src/renderer/../renderer/print.html',
    'scanitprintit-print://bundle/src/renderer/%2e%2e/renderer/print.html',
    'scanitprintit-print://bundle/node_modules/pdfjs-dist/cmaps/%2e%2e/build/pdf.mjs',
    'scanitprintit-print://bundle/node_modules/pdfjs-dist/cmaps/..%2fbuild%2fpdf.mjs',
    'scanitprintit-print://bundle/node_modules/pdfjs-dist/cmaps/nested/font.bcmap',
    'scanitprintit-print://bundle/node_modules/pdfjs-dist/standard_fonts/LICENSE_FOXIT',
    'scanitprintit-print://bundle/node_modules/pdfjs-dist/standard_fonts/font.ttf%00',
    'scanitprintit-print://bundle\\src\\renderer\\print.html',
  ]) assert.equal((await s.request(url)).status, 404, url);
  assert.equal((await s.request(s.PRINT_PAGE_URL, 'POST')).status, 405);
  assert.equal(s.reads.length, 0);
});

test('asset read failures expose no local file paths', async () => {
  for (const [code, status] of [['ENOENT', 404], ['EACCES', 500]]) {
    const s = setup({ readFile: () => { throw Object.assign(new Error('C:\\Users\\private-user\\app.asar denied'), { code }); } });
    s.registerPrintAssetScheme();
    await s.ensurePrintAssetHandler();
    const response = await s.request(s.PRINT_PAGE_URL);
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private-user|app\.asar/);
  }
});
