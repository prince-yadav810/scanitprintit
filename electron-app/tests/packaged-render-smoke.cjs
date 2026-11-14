// Tests the actual Windows app.asar using Electron's archive-aware loader.
// No index.js startup, production calls, pairing, or physical print submission.
const { app } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
// The real app keeps a dashboard open between print windows.
app.on('window-all-closed', () => {});
const archive = path.resolve(process.argv.at(-1));
const timeout = setTimeout(() => { console.error('Packaged renderer timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  try {
    const pkg = require(path.join(archive, 'package.json'));
    assert.equal(pkg.version, require('../package.json').version);
    const { verifyRenderer } = require(path.join(archive, 'src/main/renderer-self-test.js'));
    const result = await verifyRenderer();
    assert.equal(result.success, true, result.error);
    let submissions = 0;
    app.on('web-contents-created', (_, contents) => {
      contents.getPrintersAsync = async () => [{ name: 'Canon test stub', isDefault: true }];
      contents.print = (options, callback) => {
        assert.equal(options.deviceName, 'Canon test stub');
        assert.equal(options.copies, 1);
        assert.equal(options.color, false);
        contents.printToPDF({ pageSize: 'A4', printBackground: true }).then(bytes => {
          assert(bytes.length > 500); submissions++; callback(true);
        }, error => callback(false, error.message));
      };
    });
    const os = require('node:os');
    const originalPlatform = os.platform;
    try {
      // Only the agent's Windows guard is simulated. The actual driver is never called.
      os.platform = () => 'win32';
      const agent = require(path.join(archive, 'src/main/agent.js'));
      const testPage = await agent.printTestPage();
      assert.equal(testPage.success, true, testPage.error);
      assert.equal(submissions, 1);
      assert.equal(agent.isPrinting(), false);
    } finally { os.platform = originalPlatform; }
    console.log(`PASS: packaged app ${pkg.version}, archive preload, PDF.js module/worker, rasterization, PDF export, test-page service with simulated submission; no physical printing or production API calls.`);
    clearTimeout(timeout); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1); }
});
