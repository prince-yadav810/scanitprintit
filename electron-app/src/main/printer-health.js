// Windows driver reports are evidence, not proof of a live cable or paper output.
// Some drivers continue reporting Idle after a USB printer is disconnected.
function describePrinter(snapshot, selectedPrinter) {
  const result = (state, label, blocking = false) => ({
    state, label, blocking, printer: snapshot?.printer?.Name || selectedPrinter || null,
    checkedAt: new Date().toISOString(),
  });
  if (!snapshot?.available) return result('unknown', 'Printer status unavailable');
  const printer = snapshot.printer;
  if (!printer) return result('missing', selectedPrinter ? 'Selected printer is not installed' : 'Select a printer', true);
  if (printer.WorkOffline === true || Number(printer.PrinterStatus) === 7 ||
      Number(printer.ExtendedPrinterStatus) === 7 || Number(printer.DetectedErrorState) === 9) {
    return result('offline', 'Windows reports offline', true);
  }
  const errors = { 4: 'Out of paper', 6: 'Out of toner', 7: 'Printer door open', 8: 'Paper jam', 10: 'Printer needs service', 11: 'Output bin full' };
  if (errors[printer.DetectedErrorState]) return result('error', errors[printer.DetectedErrorState], true);
  if (Number(printer.ExtendedPrinterStatus) === 8) return result('paused', 'Windows queue is paused', true);
  const warnings = { 3: 'Low paper', 5: 'Low toner' };
  if (warnings[printer.DetectedErrorState]) return result('warning', warnings[printer.DetectedErrorState]);
  if (Number(printer.PrinterStatus) === 4) return result('busy', 'Windows reports printing');
  if (Number(printer.PrinterStatus) === 3) return result('idle', 'Windows reports idle · connection unverified');
  return result('unknown', 'Printer installed · connection unverified');
}

module.exports = { describePrinter };
