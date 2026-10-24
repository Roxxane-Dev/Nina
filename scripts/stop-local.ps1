# Stops the local backend started by start-local.ps1 and, with -Supabase, the local Supabase containers.
#   powershell -ExecutionPolicy Bypass -File scripts/stop-local.ps1 [-Supabase]
param([switch]$Supabase)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'nest(\.js)? start|start:dev' -and $_.CommandLine -match [regex]::Escape($root) -or $_.CommandLine -match 'nest(\.js)? start --watch' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host 'Backend stopped.'

if ($Supabase) {
  npx --yes supabase@latest stop
}
