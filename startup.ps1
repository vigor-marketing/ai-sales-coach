<#
.SYNOPSIS
  AI sales coach startup script (silent)
.DESCRIPTION
  Start backend (Express) and frontend (Vite) services, no console output
#>

$ProjectRoot = "C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15"
$LogFile = "$env:TEMP\ai-sales-coach-startup.log"
$FrontendPort = 5174
$BackendPort = 3000
$NodePath = "C:\Users\Monk Chen\.workbuddy\binaries\node\versions\22.22.2\node.exe"

function Write-Log {
    param([string]$Message)
    $time = Get-Date -Format "HH:mm:ss"
    "$time $Message" | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

Write-Log "===== AI Sales Coach Startup ====="

# === 1. Check Node.js ====
if (-not (Test-Path $NodePath)) {
    Write-Log "[ERROR] Node.js not found: $NodePath"
    exit 1
}
$nodeVer = & $NodePath --version
Write-Log "[OK] Node.js: $nodeVer"

# === 2. Clean up occupied ports ====
$ports = @($BackendPort, $FrontendPort)
foreach ($port in $ports) {
    $found = netstat -ano | Select-String ":${port} " | Select-String "LISTENING"
    if ($found) {
        $targetPid = ($found -split '\s+')[-1]
        try {
            Stop-Process -Id $targetPid -Force -ErrorAction Stop
            Write-Log "  [CLEAN] Port $port - killed PID $targetPid"
        } catch {
            Write-Log "  [CLEAN] Port $port - no process"
        }
    }
}
Start-Sleep -Seconds 2

# === 3. Start backend (Express) ====
$serverDir = Join-Path $ProjectRoot "apps\server"
$env:JWT_SECRET = "ai-sales-coach-prod-2026"
try {
    $p = Start-Process -FilePath $NodePath -ArgumentList "dist/index.js" -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru
    Write-Log "  [START] Backend PID $($p.Id)"
    $backendOk = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 2
        try {
            $req = Invoke-WebRequest -Uri "http://localhost:$BackendPort/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($req.StatusCode -eq 200) {
                Write-Log "[OK] Backend ready (port $BackendPort)"
                $backendOk = $true
                break
            }
        } catch { }
    }
    if (-not $backendOk) { Write-Log "[WARN] Backend startup timeout" }
} catch {
    Write-Log "[ERROR] Backend startup failed: $_"
}

# === 4. Start frontend (Vite) ====
$webDir = Join-Path $ProjectRoot "apps\web"
try {
    $p = Start-Process -FilePath $NodePath -ArgumentList "node_modules/vite/bin/vite.js --host 0.0.0.0 --port $FrontendPort" -WorkingDirectory $webDir -WindowStyle Hidden -PassThru
    Write-Log "  [START] Frontend PID $($p.Id)"
    $frontendOk = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 2
        try {
            $req = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($req.StatusCode -eq 200) {
                Write-Log "[OK] Frontend ready (port $FrontendPort)"
                $frontendOk = $true
                break
            }
        } catch { }
    }
    if (-not $frontendOk) { Write-Log "[WARN] Frontend startup timeout" }
} catch {
    Write-Log "[ERROR] Frontend startup failed: $_"
}

# === 5. Network info ====
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -ne 'Loopback Pseudo-Interface 1' -and $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -First 1).IPAddress
    if ($ip) { Write-Log "[ACCESS] LAN: http://${ip}:${FrontendPort}/" }
} catch { }

Write-Log "[ACCESS] Local: http://localhost:${FrontendPort}/"
Write-Log "========== Startup Complete =========="
