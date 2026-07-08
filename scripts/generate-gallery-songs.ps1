# Generate the gallery songs via the MiniMax Music API and save them to public/audio/.
#
# Usage (PowerShell), from the project root:
#   $env:MINIMAX_API_KEY = "sk-api-..."      # your MiniMax key (must have balance)
#   ./scripts/generate-gallery-songs.ps1
#
# Optional overrides:
#   -Model music-2.6   -ApiHost https://api.minimax.io   -Only g1,g4
#
param(
  [string]$ApiKey  = $env:MINIMAX_API_KEY,
  [string]$ApiHost = $(if ($env:MINIMAX_API_HOST) { $env:MINIMAX_API_HOST } else { "https://api.minimax.io" }),
  [string]$Model   = "music-2.6",
  [string]$OutDir  = (Join-Path $PSScriptRoot "..\public\audio"),
  [string]$Config  = (Join-Path $PSScriptRoot "gallery-songs.json"),
  [string[]]$Only  = @()          # e.g. -Only g1,g4  to (re)generate only some
)

$ErrorActionPreference = "Stop"
if (-not $ApiKey) { throw "MINIMAX_API_KEY manquant. Fais: `$env:MINIMAX_API_KEY = 'sk-api-...'  puis relance." }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

# Lecture UTF-8 robuste (les paroles contiennent des accents)
$songs = [System.IO.File]::ReadAllText($Config, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
if ($Only.Count -gt 0) { $songs = $songs | Where-Object { $Only -contains $_.id } }

$ok = 0; $fail = 0; $failed = @()
foreach ($s in $songs) {
  $dest = Join-Path $OutDir $s.file
  Write-Host ("[{0,-3}] {1,-16} {2,-10} ... " -f $s.id, $s.recipient, $s.style) -NoNewline
  $body = @{
    model         = $Model
    prompt        = $s.prompt
    lyrics        = $s.lyrics
    audio_setting = @{ sample_rate = 44100; bitrate = 256000; format = "mp3" }
  } | ConvertTo-Json -Depth 6
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  try {
    $r = Invoke-RestMethod -Uri "$ApiHost/v1/music_generation" -Method Post `
      -Headers @{ Authorization = "Bearer $ApiKey" } -ContentType "application/json" `
      -Body $bytes -TimeoutSec 240 -ErrorAction Stop
    $sc = $r.base_resp.status_code
    if ($sc -ne 0) { throw ("API status " + $sc + " : " + $r.base_resp.status_msg) }
    $hex = $r.data.audio
    if (-not $hex) { throw "reponse sans audio" }
    $ab = New-Object byte[] ($hex.Length / 2)
    for ($i = 0; $i -lt $ab.Length; $i++) { $ab[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }
    [System.IO.File]::WriteAllBytes($dest, $ab)
    $kb = [math]::Round((Get-Item $dest).Length / 1KB, 1)
    Write-Host ("OK  {0} Ko" -f $kb) -ForegroundColor Green
    $ok++
  }
  catch {
    Write-Host ("ECHEC: " + $_.Exception.Message) -ForegroundColor Red
    $fail++; $failed += $s.id
  }
  Start-Sleep -Seconds 2   # petite pause entre les generations
}

Write-Host ""
Write-Host ("Termine: {0} reussis, {1} echoues." -f $ok, $fail)
if ($fail -gt 0) { Write-Host ("A relancer: -Only " + ($failed -join ",")) -ForegroundColor Yellow }
Write-Host ("Fichiers: " + (Resolve-Path $OutDir))
