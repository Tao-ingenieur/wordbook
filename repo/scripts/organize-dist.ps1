$ErrorActionPreference = 'Stop'
$distRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../dist'))
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../node_modules/electron/dist'))
if (Get-Process Wordbook -ErrorAction SilentlyContinue) { throw '请先关闭正在运行的 Wordbook，再整理目录。' }
if (!(Test-Path -LiteralPath $distRoot)) { throw 'dist 目录不存在。' }
function Assert-InDist([string]$candidate) {
  $absolute = [IO.Path]::GetFullPath($candidate)
  if (!$absolute.StartsWith($distRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "路径不在 dist 内：$absolute" }
  return $absolute
}
$moves = @()
if (Test-Path -LiteralPath (Join-Path $distRoot 'Wordbook.exe')) {
  if (!(Test-Path -LiteralPath $runtimeRoot)) { throw '请先安装项目 Electron 依赖，以核对运行库文件清单。' }
  $runtimeNames = @((Get-ChildItem -LiteralPath $runtimeRoot -Force).Name | ForEach-Object { if ($_ -eq 'electron.exe') { 'Wordbook.exe' } else { $_ } }) + '使用说明.txt'
  foreach ($name in $runtimeNames) { $moves += @{ Source = $name; Target = "desktop/$name" } }
}
$moves += @(
  @{ Source = 'previews/desktop-preview.png'; Target = 'reports/desktop/desktop-preview.png' },
  @{ Source = 'previews/desktop-smoke.json'; Target = 'reports/desktop/desktop-smoke.json' },
  @{ Source = 'previews/speech-voices.json'; Target = 'reports/desktop/speech-voices.json' },
  @{ Source = 'previews/pdf-layout-page1.png'; Target = 'reports/import/pdf-layout-page1.png' },
  @{ Source = '.voice-check'; Target = '.cache/voice-check' },
  @{ Source = '.nvue'; Target = '.cache/app-nvue' }
)
$pending = @()
foreach ($move in $moves) {
  $source = Assert-InDist (Join-Path $distRoot $move.Source)
  $target = Assert-InDist (Join-Path $distRoot $move.Target)
  if (!(Test-Path -LiteralPath $source)) { continue }
  if (Test-Path -LiteralPath $target) { throw "目标已经存在，停止以避免覆盖：$target" }
  if ((Get-Item -LiteralPath $source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "不移动链接目录：$source" }
  $pending += @{ Source = $source; Target = $target }
}
# 全部绝对路径及目标冲突已检查；data 和 input 不在移动清单中。
foreach ($move in $pending) {
  New-Item -ItemType Directory -Force (Split-Path -Parent $move.Target) | Out-Null
  Move-Item -LiteralPath $move.Source -Destination $move.Target
  Write-Host "已归档：$($move.Source.Substring($distRoot.Length + 1))"
}
Write-Host '整理完成。原有 data 和 input 保持原位。'
