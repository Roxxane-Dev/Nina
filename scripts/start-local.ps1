# One command to run Nina locally: Docker + Supabase (local) + backend + Flutter app.
#   powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1            # Chrome
#   powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Device windows
#   powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 -SkipApp   # only database + backend
# Everything is LOCAL: the app and the backend use the same Supabase (127.0.0.1), so logins validate.
# Sign in with dev@nina.test (password in docs/LOCAL-DEV.md). Never touches the hosted project.
param(
  [string]$Device = 'chrome',
  [int]$WebPort = 5050,
  [switch]$SkipApp
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logs = Join-Path $root '.local-logs'
New-Item -ItemType Directory -Force $logs | Out-Null

function Wait-Until([scriptblock]$Test, [int]$Seconds, [string]$What) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try { if (& $Test) { return } } catch {}
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for $What"
}

# 1) Docker
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Starting Docker Desktop...'
  $candidates = @("$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe", "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe")
  $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) { throw 'Docker Desktop not found. Start it manually and run this script again.' }
  Start-Process $exe
  Wait-Until { docker info *> $null; $LASTEXITCODE -eq 0 } 240 'Docker'
}

# 2) Local Supabase (idempotent) and the app's local config
Write-Host 'Starting local Supabase...'
npx --yes supabase@latest start | Out-Null
node scripts/make-local-app-env.js

# 3) Backend (reads .env: OpenAI etc.). Already running? leave it.
$apiUp = $false
try { $apiUp = (Invoke-RestMethod http://127.0.0.1:3000/health -TimeoutSec 2).status -eq 'ok' } catch {}
if (-not $apiUp) {
  Write-Host 'Starting the backend...'
  $p = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start:dev' -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'api.log') -RedirectStandardError (Join-Path $logs 'api.err.log') -PassThru
  $p.Id | Set-Content (Join-Path $logs 'api.pid')
  Wait-Until { (Invoke-RestMethod http://127.0.0.1:3000/health -TimeoutSec 2).status -eq 'ok' } 180 'the backend (see .local-logs/api.log)'
}
$health = Invoke-RestMethod http://127.0.0.1:3000/health
Write-Host "Backend OK (Supabase host: $($health.supabaseHost))."
if ($health.supabaseHost -ne '127.0.0.1' -and $health.supabaseHost -ne 'localhost') {
  throw "The backend (.env) points to '$($health.supabaseHost)', not the local Supabase. Fix SUPABASE_URL in .env."
}

if ($SkipApp) { Write-Host 'Done (database + backend). Run the app with: cd nina_app; flutter run -d chrome --dart-define-from-file=env/local.json'; exit 0 }

# 4) The app, always with env/local.json (never env/dev.json)
Set-Location (Join-Path $root 'nina_app')
Write-Host "Starting the app on '$Device'. Sign in with dev@nina.test (see docs/LOCAL-DEV.md)."
if ($Device -eq 'web-server') {
  flutter run -d web-server --web-port $WebPort --web-hostname 127.0.0.1 --dart-define-from-file=env/local.json
} else {
  flutter run -d $Device --dart-define-from-file=env/local.json
}
