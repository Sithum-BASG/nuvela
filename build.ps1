#!/usr/bin/env pwsh
# Nuvela - full build + test runner. See CLAUDE.md.
# Runs lint -> typecheck -> test -> build for backend then frontend,
# skipping any app or script that doesn't exist yet (safe to run pre-code).
#
# Usage:
#   ./build.ps1            # lint/typecheck/test/build both apps
#   ./build.ps1 -Install   # run `npm ci` first in each app
#   ./build.ps1 -SkipTest  # skip the test step (build only)

param(
  [switch]$Install,
  [switch]$SkipTest
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Invoke-Npm([string[]]$NpmArgs) {
  & npm @NpmArgs
  if ($LASTEXITCODE -ne 0) { throw "npm $($NpmArgs -join ' ') failed in $(Get-Location)" }
}

function Invoke-ScriptIfPresent([string]$Script) {
  $pkg = Get-Content 'package.json' -Raw | ConvertFrom-Json
  if ($pkg.scripts -and ($pkg.scripts.PSObject.Properties.Name -contains $Script)) {
    Write-Host "  npm run $Script" -ForegroundColor Gray
    Invoke-Npm @('run', $Script)
  } else {
    Write-Host "  (no '$Script' script - skipped)" -ForegroundColor DarkGray
  }
}

function Build-App([string]$Name) {
  $path = Join-Path $root $Name
  if (-not (Test-Path (Join-Path $path 'package.json'))) {
    Write-Host "skip $Name - not scaffolded yet" -ForegroundColor Yellow
    return
  }
  Write-Host "==> $Name" -ForegroundColor Cyan
  Push-Location $path
  try {
    if ($Install) { Invoke-Npm @('ci') }
    Invoke-ScriptIfPresent 'lint'
    Invoke-ScriptIfPresent 'typecheck'
    if (-not $SkipTest) { Invoke-ScriptIfPresent 'test' }
    Invoke-ScriptIfPresent 'build'
  } finally {
    Pop-Location
  }
}

Build-App 'backend'
Build-App 'frontend'
Write-Host "Full build complete." -ForegroundColor Green
