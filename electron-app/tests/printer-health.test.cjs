const test = require('node:test');
const assert = require('node:assert/strict');
const { describePrinter } = require('../src/main/printer-health');

test('an installed idle driver never proves the physical printer is connected', () => {
  const health = describePrinter({ available: true, printer: { Name: 'Canon', PrinterStatus: 3, WorkOffline: false } });
  assert.equal(health.state, 'idle');
  assert.match(health.label, /unverified/);
  assert.equal(health.blocking, false);
});

test('offline, paper, toner, and paused reports prevent submission', () => {
  for (const printer of [{ WorkOffline: true }, { PrinterStatus: 7 }, { ExtendedPrinterStatus: 7 },
    { DetectedErrorState: 9 }, { DetectedErrorState: 4 }, { DetectedErrorState: 6 }, { ExtendedPrinterStatus: 8 }]) {
    const health = describePrinter({ available: true, printer: { Name: 'Canon', ...printer } });
    assert.equal(health.blocking, true, JSON.stringify(printer));
  }
});

test('a query failure is unknown, while a removed selected printer is missing', () => {
  assert.equal(describePrinter({ available: false }, 'Canon').state, 'unknown');
  assert.equal(describePrinter({ available: false }, 'Canon').blocking, false);
  assert.equal(describePrinter({ available: true, printer: null }, 'Canon').state, 'missing');
  assert.equal(describePrinter({ available: true, printer: null }, 'Canon').blocking, true);
});

test('warnings and an incomplete driver report do not block a potentially working printer', () => {
  for (const printer of [{ DetectedErrorState: 3 }, { DetectedErrorState: 5 }, {}]) {
    assert.equal(describePrinter({ available: true, printer }).blocking, false);
  }
});
