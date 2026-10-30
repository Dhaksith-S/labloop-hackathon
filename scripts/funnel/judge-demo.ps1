param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('Prepare','Configure','Start','Stop','Status','Backup')]
    [string]$Action,
    [string]$PublicUrl,
    [switch]$LocalPreflight
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$runtime = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'LabLoop/judge-demo'))
$profileFile = Join-Path $runtime 'profile.json'
$secretFile = Join-Path $runtime 'session-secret.dpapi'
$processFile = Join-Path $runtime 'processes.json'
$node = (Get-Command node -ErrorAction Stop).Source

foreach ($syncRoot in @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial, $repoRoot)) {
    if ($syncRoot -and $runtime.StartsWith(([IO.Path]::GetFullPath($syncRoot).TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Judge data must be outside the repository and OneDrive.'
    }
}
function Read-Profile {
    if (-not (Test-Path -LiteralPath $profileFile)) { throw 'Run -Action Prepare first.' }
    return Get-Content -LiteralPath $profileFile -Raw | ConvertFrom-Json
}
function Find-Tailscale {
    $command = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $standard = Join-Path $env:ProgramFiles 'Tailscale/tailscale.exe'
    if (Test-Path -LiteralPath $standard) { return $standard }
    throw 'Tailscale is not installed. Installation requires separate user approval.'
}
function Start-Record($process) {
    return @{ pid=$process.Id; startedAt=$process.StartTime.ToUniversalTime().ToString('o') }
}
function Stop-OwnedProcesses {
    if (-not (Test-Path -LiteralPath $processFile)) { return }
    $record = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
    foreach ($entry in @($record.ingress, $record.app)) {
        if (-not $entry) { continue }
        $ownedProcess = Get-Process -Id ([int]$entry.pid) -ErrorAction SilentlyContinue
        if (-not $ownedProcess) { continue }
        if ($ownedProcess.StartTime.ToUniversalTime().ToString('o') -ne $entry.startedAt) {
            throw 'Saved PID was reused; refusing to stop an unrelated process.'
        }
        & taskkill.exe /PID ([string]$ownedProcess.Id) /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop the recorded judge process tree.' }
    }
    Remove-Item -LiteralPath $processFile
}

if ($Action -eq 'Prepare') {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.next/BUILD_ID'))) { throw 'An existing production build is required.' }
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    $userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & icacls.exe $runtime /inheritance:r /grant:r "*${userSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the private runtime directory ACL.' }
    foreach ($folder in @('logs','backups')) { New-Item -ItemType Directory -Path (Join-Path $runtime $folder) -Force | Out-Null }
    if (-not (Test-Path -LiteralPath $secretFile)) {
        $random = New-Object byte[] 32
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($random) } finally { $generator.Dispose() }
        $secret = [Convert]::ToBase64String($random).TrimEnd('=').Replace('+','-').Replace('/','_')
        ConvertTo-SecureString -String $secret -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $secretFile -Encoding utf8
        $secret = $null
    }
    if (-not (Test-Path -LiteralPath $profileFile)) {
        @{ repoRoot=$repoRoot; dbPath=(Join-Path $runtime 'fictional-judge.db');
           publicUrl=$null; appPort=3210; ingressPort=3211;
           buildId=(Get-Content -LiteralPath (Join-Path $repoRoot '.next/BUILD_ID') -Raw).Trim();
           createdAt=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $profileFile -Encoding utf8
    }
    $profile = Read-Profile
    $previousDb = $env:LABLOOP_DB_PATH; $previousSeed = $env:LABLOOP_SEED_DEMO
    try {
        $env:LABLOOP_DB_PATH=$profile.dbPath; $env:LABLOOP_SEED_DEMO='1'
        Push-Location -LiteralPath $repoRoot
        try { & $node --import tsx scripts/setup-db.ts; if ($LASTEXITCODE -ne 0) { throw 'Judge database setup failed.' } }
        finally { Pop-Location }
    } finally { $env:LABLOOP_DB_PATH=$previousDb; $env:LABLOOP_SEED_DEMO=$previousSeed }
    Write-Output "Private fictional demo prepared at $runtime. Existing records and secret are preserved on repeated preparation."
    return
}

$profile = Read-Profile
if ($Action -eq 'Configure') {
    $uri = [Uri]$PublicUrl
    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or -not $uri.IsDefaultPort -or
        $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.UserInfo -or
        $uri.Host -notmatch '^[a-z0-9.-]+\.ts\.net$') { throw 'Provide only the exact device HTTPS .ts.net origin.' }
    $tailscale = Find-Tailscale
    $statusText = & $tailscale status --json
    if ($LASTEXITCODE -ne 0) { throw 'Could not read Tailscale authentication status.' }
    $tailStatus = $statusText | ConvertFrom-Json
    if ($tailStatus.BackendState -ne 'Running' -or $tailStatus.Self.DNSName.TrimEnd('.') -ne $uri.Host) {
        throw 'The URL must match the authenticated device DNS name.'
    }
    if (Test-Path -LiteralPath $processFile) { throw 'Stop the judge processes before changing their origin.' }
    $profile.publicUrl=$uri.GetLeftPart([UriPartial]::Authority)
    $profile | ConvertTo-Json | Set-Content -LiteralPath $profileFile -Encoding utf8
    Write-Output "Configured exact judge origin: $($profile.publicUrl). Public access is still disabled until separately approved."
    return
}
if ($Action -eq 'Stop') { Stop-OwnedProcesses; Write-Output 'Recorded app and ingress processes stopped. This does not change Tailscale Funnel settings.'; return }
if ($Action -eq 'Status') {
    [PSCustomObject]@{ Runtime=$runtime; Database=$profile.dbPath; PublicUrl=$profile.publicUrl;
        BuildId=$profile.buildId; SecretProtected=(Test-Path -LiteralPath $secretFile);
        ProcessesRecorded=(Test-Path -LiteralPath $processFile) }
    Get-NetTCPConnection -LocalPort $profile.appPort,$profile.ingressPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object LocalAddress,LocalPort,OwningProcess
    return
}
if ($Action -eq 'Backup') {
    $destination = Join-Path $runtime ('backups/judge-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '.db')
    $previousDb=$env:LABLOOP_DB_PATH
    try {
        $env:LABLOOP_DB_PATH=$profile.dbPath; Push-Location -LiteralPath $repoRoot
        try { & $node --import tsx scripts/backup-db.ts $destination; if ($LASTEXITCODE -ne 0) { throw 'Backup failed.' } }
        finally { Pop-Location }
    } finally { $env:LABLOOP_DB_PATH=$previousDb }
    return
}
if ($Action -eq 'Start') {
    if ((Get-Content -LiteralPath (Join-Path $repoRoot '.next/BUILD_ID') -Raw).Trim() -ne $profile.buildId) {
        throw 'Production build identity changed. Revalidate the new build before updating the judge profile.'
    }
    if (Test-Path -LiteralPath $processFile) { throw 'Judge process record already exists; inspect Status and use Stop before restarting.' }
    if (Get-NetTCPConnection -LocalPort $profile.appPort,$profile.ingressPort -State Listen -ErrorAction SilentlyContinue) {
        throw 'A selected loopback port is occupied. Refusing to reuse or expose another service.'
    }
    $selectedUrl=$profile.publicUrl
    if ($LocalPreflight) { $selectedUrl='https://labloop-preflight.invalid' }
    if (-not $selectedUrl) { throw 'Authenticate and configure the real device URL, or explicitly choose -LocalPreflight.' }
    $secure = ConvertTo-SecureString -String ((Get-Content -LiteralPath $secretFile -Raw).Trim())
    $credential = New-Object Management.Automation.PSCredential('LabLoopSession', $secure)
    $settings = @{ LABLOOP_DB_PATH=$profile.dbPath; LABLOOP_SESSION_SECRET=$credential.GetNetworkCredential().Password;
        LABLOOP_SEED_DEMO='0'; LABLOOP_INSECURE_COOKIES='0'; LABLOOP_BIND_HOST='127.0.0.1';
        PORT=[string]$profile.appPort; LABLOOP_INGRESS_PORT=[string]$profile.ingressPort;
        NEXT_PUBLIC_APP_URL=$selectedUrl; NEXT_TELEMETRY_DISABLED='1';
        LABLOOP_FUNNEL_PREFLIGHT=$(if ($LocalPreflight) {'1'} else {'0'}) }
    $previous=@{}; foreach ($key in $settings.Keys) { $previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
    $record=@{ app=$null; ingress=$null; mode=$(if ($LocalPreflight) {'local-preflight'} else {'configured'}); origin=$selectedUrl }
    try {
        foreach ($key in $settings.Keys) { [Environment]::SetEnvironmentVariable($key,[string]$settings[$key],'Process') }
        $app=Start-Process -FilePath $node -ArgumentList @('--import','tsx','scripts/start-production.ts') -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'logs/app.out.log') -RedirectStandardError (Join-Path $runtime 'logs/app.err.log')
        $record.app=Start-Record $app
        $record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $processFile -Encoding utf8
        # The ingress needs no database path or session secret.
        [Environment]::SetEnvironmentVariable('LABLOOP_SESSION_SECRET',$null,'Process')
        [Environment]::SetEnvironmentVariable('LABLOOP_DB_PATH',$null,'Process')
        $ingress=Start-Process -FilePath $node -ArgumentList @('--import','tsx','scripts/start-funnel-proxy.ts') -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'logs/ingress.out.log') -RedirectStandardError (Join-Path $runtime 'logs/ingress.err.log')
        $record.ingress=Start-Record $ingress
        $record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $processFile -Encoding utf8
        $ready=$false
        for ($attempt=0; $attempt -lt 80; $attempt++) {
            try { $response=Invoke-WebRequest -Uri "http://127.0.0.1:$($profile.appPort)/login" -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready=$true; break } } catch { }
            Start-Sleep -Milliseconds 250
        }
        if (-not $ready -or -not (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $profile.ingressPort -State Listen -ErrorAction SilentlyContinue)) {
            throw 'Judge processes did not become ready. Inspect private logs.'
        }
        Write-Output "Judge production build running on 127.0.0.1:$($profile.appPort); ingress on 127.0.0.1:$($profile.ingressPort). Mode: $($record.mode)."
        Write-Output 'This command does not enable Funnel or expose anything publicly.'
    } catch { Stop-OwnedProcesses; throw }
    finally {
        foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
        $settings.LABLOOP_SESSION_SECRET=$null; $credential=$null; $secure=$null
    }
}
