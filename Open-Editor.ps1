$ErrorActionPreference = 'Stop'
$port = 8768
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs = Join-Path $env:LOCALAPPDATA 'CubeEditor'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$sshCommand = Get-Command ssh.exe -ErrorAction SilentlyContinue
$ssh = if ($sshCommand) { $sshCommand.Source } else {
    @(
        "$env:WINDIR\System32\OpenSSH\ssh.exe",
        "$env:ProgramFiles\Git\usr\bin\ssh.exe",
        'D:\Apps\Git\usr\bin\ssh.exe'
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $ssh) { throw 'OpenSSH was not found. Install the Windows OpenSSH client.' }
$uri = "http://127.0.0.1:$port/editor.html"
$connected = $false
try {
    $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 3
    $connected = $response.StatusCode -eq 200 -and $response.Content -match 'Cube'
} catch {}
if (-not $connected) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connection) { throw "Port $port is occupied by a different service. Close it before opening Cube Editor." }
    $process = Start-Process -FilePath $ssh -ArgumentList @(
        '-N', '-T', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
        '-L', "127.0.0.1:${port}:127.0.0.1:${port}", 'boonbox'
    ) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'tunnel.log') -RedirectStandardError (Join-Path $logs 'tunnel-error.log')
    $process.Id | Set-Content -LiteralPath (Join-Path $logs 'tunnel.pid')
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200 -and $response.Content -match 'Cube') { $connected = $true; break }
        } catch {}
        if ($process.HasExited) { break }
    }
}
if (-not $connected) { throw "Cube Editor did not connect. Check $logs\tunnel-error.log and the BOONBOX cube-primer-editor service." }
Start-Process $uri
