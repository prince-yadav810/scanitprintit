[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InstallerPath,
  [string]$AppDirectory,
  [string]$PublisherName,
  [string]$CertificateThumbprint
)

$ErrorActionPreference = 'Stop'

function Assert-AuthenticodeSignature([string]$Path, [bool]$RequirePublisher) {
  $file = Get-Item -LiteralPath $Path
  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
  if ($signature.Status -ne 'Valid' -or $signature.SignatureType -ne 'Authenticode') {
    throw "$($file.Name) has no valid embedded Authenticode signature ($($signature.Status))."
  }
  if (!$signature.TimeStamperCertificate) {
    throw "$($file.Name) has no Authenticode timestamp."
  }

  if ($RequirePublisher) {
    $signer = $signature.SignerCertificate
    $name = $signer.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
    if ($PublisherName -and $name -ne $PublisherName) {
      throw "$($file.Name) was signed by '$name'. Expected '$PublisherName'."
    }
    if ($CertificateThumbprint -and $signer.Thumbprint -ne $CertificateThumbprint) {
      throw "$($file.Name) was signed with a different certificate."
    }
    Write-Host "Verified $($file.Name), signed by $name."
  }
}

Assert-AuthenticodeSignature -Path $InstallerPath -RequirePublisher $true

if ($AppDirectory) {
  $appPath = Join-Path $AppDirectory 'ScanItPrintIt Agent.exe'
  Assert-AuthenticodeSignature -Path $appPath -RequirePublisher $true
  Get-ChildItem -LiteralPath $AppDirectory -Recurse -File |
    Where-Object { $_.FullName -ne $appPath -and $_.Extension -in '.exe', '.dll', '.node' } |
    ForEach-Object { Assert-AuthenticodeSignature -Path $_.FullName -RequirePublisher $false }
}
