$ErrorActionPreference = 'Stop'
$runtimeVersion = '39.2.7'
$archiveName = "electron-v$runtimeVersion-win32-x64.zip"
$archiveUri = "https://github.com/electron/electron/releases/download/v$runtimeVersion/$archiveName"
$outputRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../dist'))
$partsRoot = Join-Path $outputRoot '.downloads/electron'
New-Item -ItemType Directory -Force $partsRoot | Out-Null
$probe = Invoke-WebRequest $archiveUri -Method Head -Headers @{ Range = 'bytes=0-0' } -TimeoutSec 30
if ($probe.StatusCode -ne 206) { throw '官方服务器不支持分段下载' }
$archiveSize = [long](($probe.Headers['Content-Range'] -join '') -split '/')[-1]
$partCount = 16
$partSize = [long][Math]::Ceiling($archiveSize / $partCount)
$parts = 0..($partCount - 1) | ForEach-Object -Parallel {
  $partIndex = $_
  $start = $partIndex * $using:partSize
  $end = [Math]::Min($using:archiveSize - 1, $start + $using:partSize - 1)
  $file = Join-Path $using:partsRoot ("part-{0:D2}" -f $partIndex)
  if (!(Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -ne ($end - $start + 1)) {
    $result = Invoke-WebRequest $using:archiveUri -Headers @{ Range = "bytes=$start-$end" } -TimeoutSec 300 -OutFile $file -PassThru
    if ($result.StatusCode -ne 206 -or (Get-Item -LiteralPath $file).Length -ne ($end - $start + 1)) { throw "分段 $partIndex 下载不完整" }
  }
  Write-Host "已下载分段 $($partIndex + 1)/$using:partCount"
  [PSCustomObject]@{ Index = $partIndex; Path = $file }
} -ThrottleLimit 16
if ($parts.Count -ne $partCount) { throw '下载不完整，请重试' }
$archivePath = Join-Path $outputRoot $archiveName
$outputStream = [IO.File]::Create($archivePath)
try {
  foreach ($part in ($parts | Sort-Object Index)) {
    $inputStream = [IO.File]::OpenRead($part.Path)
    try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose() }
  }
} finally { $outputStream.Dispose() }
$checksumFile = Join-Path $partsRoot 'SHASUMS256.txt'
Invoke-WebRequest "https://github.com/electron/electron/releases/download/v$runtimeVersion/SHASUMS256.txt" -TimeoutSec 30 -OutFile $checksumFile
$expected = ((Get-Content -LiteralPath $checksumFile | Where-Object { (($_ -split '\s+', 2)[1]).TrimStart('*') -eq $archiveName }) -split '\s+')[0]
$actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if (!$expected -or $actual.ToLowerInvariant() -ne $expected.ToLowerInvariant()) { throw '校验失败，不可执行该运行时' }
Write-Host "SHA-256 校验通过：$archivePath"
