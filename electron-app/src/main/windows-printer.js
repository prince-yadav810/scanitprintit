const { execFile } = require('node:child_process');

// Read-only snapshots: omit document titles, usernames, machine names, and content.
async function getPrinterSnapshot(printerName) {
  if (process.platform !== 'win32') return { available: false, reason: 'Windows only' };
  const name = Buffer.from(printerName || '', 'utf8').toString('base64');
  const script = `
$ErrorActionPreference = 'Stop'
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${name}'))
$printer = Get-CimInstance Win32_Printer | Where-Object { if ($name) { $_.Name -eq $name } else { $_.Default -eq $true } } | Select-Object -First 1 Name, DriverName, PortName, WorkOffline, PrinterStatus, DetectedErrorState, ExtendedPrinterStatus
$jobs = @()
$queueError = $null
try { if ($printer) { $jobs = @(Get-PrintJob -PrinterName $printer.Name | Select-Object -First 20 ID, JobStatus, TotalPages, PagesPrinted) } } catch { $queueError = 'Print queue query unavailable' }
@{ available = $true; printer = $printer; jobs = $jobs; queueError = $queueError } | ConvertTo-Json -Depth 4 -Compress
`;
  return new Promise(resolve => execFile('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
  ], { windowsHide: true, timeout: 8000, maxBuffer: 65536 }, (error, stdout) => {
    if (error) return resolve({ available: false, reason: error.killed ? 'Printer status query timed out' : 'Printer status query unavailable', code: error.code });
    try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); }
    catch { resolve({ available: false, reason: 'Invalid printer status response' }); }
  }));
}
async function getAgentProcessSnapshot() {
  if (process.platform !== 'win32') return { available: false, reason: 'Windows only' };
  const script = `
$ErrorActionPreference = 'Stop'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$items = @(Get-CimInstance Win32_Process -Filter "Name = 'ScanItPrintIt Agent.exe'" | ForEach-Object {
  $sameUser = $null
  try { $sameUser = (Invoke-CimMethod -InputObject $_ -MethodName GetOwnerSid).Sid -eq $sid } catch {}
  $role = 'main'
  if ($_.CommandLine -match '--type=([a-zA-Z-]+)') { $role = $Matches[1] }
  @{ pid = $_.ProcessId; parentPid = $_.ParentProcessId; sessionId = $_.SessionId; sameUser = $sameUser; role = $role }
})
@{ available = $true; currentPid = ${process.pid}; processes = $items; elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } | ConvertTo-Json -Depth 4 -Compress
`;
  return new Promise(resolve => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 10000, maxBuffer: 65536 }, (error, stdout) => {
      if (error) return resolve({ available: false, reason: 'Agent process query unavailable', code: error.code });
      try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); }
      catch { resolve({ available: false, reason: 'Invalid agent process response' }); }
    }));
}
module.exports = { getPrinterSnapshot, getAgentProcessSnapshot };
