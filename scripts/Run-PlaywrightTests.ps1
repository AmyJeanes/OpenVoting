[CmdletBinding()]
param(
    [ValidateSet('Smoke', 'Full')]
    [string]$TestType = 'Smoke',
    [string]$ContainerName = 'openvoting-playwright-postgres',
    [int]$PostgresPort = 55432,
    [string]$DatabaseName = 'openvoting_smoke',
    [string]$PostgresUser = 'postgres',
    [string]$PostgresPassword = 'postgres',
    [int]$FrontendPort = 54197,
    [int]$ApiPort = 7192,
    [string]$JwtSigningKey = 'smoke-test-signing-key-1234567890',
    [string]$GuildId = 'smoke-guild',
    [string]$AdminRoleId = 'smoke-admin',
    [switch]$KeepContainer,
    [switch]$InstallBrowsers
)

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH"
    }
}

function Invoke-Docker {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Test-ContainerExists {
    param([string]$Name)

    & docker container inspect $Name *> $null
    return $LASTEXITCODE -eq 0
}

function Get-ContainerRunning {
    param([string]$Name)

    $running = & docker inspect --format '{{.State.Running}}' $Name 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $false
    }

    return $running.Trim() -eq 'true'
}

function Get-ContainerHostPort {
    param([string]$Name)

    $hostPort = & docker inspect --format '{{(index (index .HostConfig.PortBindings "5432/tcp") 0).HostPort}}' $Name 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hostPort)) {
        throw "Could not determine the published PostgreSQL port for container '$Name'"
    }

    return [int]$hostPort.Trim()
}

function Test-TcpPortAvailable {
    param([int]$Port)

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    try {
        $listener.Start()
        return $true
    }
    catch [System.Net.Sockets.SocketException] {
        return $false
    }
    finally {
        $listener.Stop()
    }
}

function Get-AvailableTcpPort {
    param([int]$PreferredPort)

    for ($port = $PreferredPort; $port -lt ($PreferredPort + 100); $port++) {
        if (Test-TcpPortAvailable -Port $port) {
            return $port
        }
    }

    throw "Could not find a free TCP port starting at $PreferredPort"
}

function New-PlaywrightPostgresContainer {
    param(
        [string]$Name,
        [int]$PreferredPort,
        [string]$Database,
        [string]$User,
        [string]$Password
    )

    $availablePort = Get-AvailableTcpPort -PreferredPort $PreferredPort
    Invoke-Docker run --detach --name $Name --publish "${availablePort}:5432" --env "POSTGRES_DB=$Database" --env "POSTGRES_USER=$User" --env "POSTGRES_PASSWORD=$Password" postgres:17 | Out-Null
    return $availablePort
}

function Wait-ForPostgres {
    param(
        [string]$Name,
        [string]$User,
        [string]$Database,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        & docker exec $Name pg_isready -U $User -d $Database *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }

        Start-Sleep -Seconds 1
    }

    throw "PostgreSQL container '$Name' did not become ready within $TimeoutSeconds seconds"
}

Require-Command docker
Require-Command dotnet
Require-Command npm

$repoRoot = Split-Path -Parent $PSScriptRoot
$clientRoot = Join-Path $repoRoot 'OpenVoting.Client'

$containerExistedBefore = Test-ContainerExists -Name $ContainerName
$containerWasRunningBefore = $false
if ($containerExistedBefore) {
    $containerWasRunningBefore = Get-ContainerRunning -Name $ContainerName
}

$createdContainer = $false
$startedContainer = $false
$envBackup = @{}
$resolvedPostgresPort = $PostgresPort

$baseUrl = "https://localhost:$FrontendPort"
$apiBaseUrl = "http://127.0.0.1:$ApiPort"

try {
    if ($containerExistedBefore) {
        if (Get-ContainerRunning -Name $ContainerName) {
            $resolvedPostgresPort = Get-ContainerHostPort -Name $ContainerName
        }
        else {
            $existingPort = Get-ContainerHostPort -Name $ContainerName

            if (-not (Test-TcpPortAvailable -Port $existingPort)) {
                Invoke-Docker rm --force $ContainerName | Out-Null
                $resolvedPostgresPort = New-PlaywrightPostgresContainer -Name $ContainerName -PreferredPort $PostgresPort -Database $DatabaseName -User $PostgresUser -Password $PostgresPassword
                $createdContainer = $true
            }
            else {
                try {
                    Invoke-Docker start $ContainerName | Out-Null
                    $startedContainer = $true
                    $resolvedPostgresPort = $existingPort
                }
                catch {
                    Invoke-Docker rm --force $ContainerName | Out-Null
                    $resolvedPostgresPort = New-PlaywrightPostgresContainer -Name $ContainerName -PreferredPort $PostgresPort -Database $DatabaseName -User $PostgresUser -Password $PostgresPassword
                    $createdContainer = $true
                    $startedContainer = $false
                }
            }
        }
    }
    else {
        $resolvedPostgresPort = New-PlaywrightPostgresContainer -Name $ContainerName -PreferredPort $PostgresPort -Database $DatabaseName -User $PostgresUser -Password $PostgresPassword
        $createdContainer = $true
    }

    Wait-ForPostgres -Name $ContainerName -User $PostgresUser -Database $DatabaseName

    $dbConnection = "Host=127.0.0.1;Port=$resolvedPostgresPort;Database=$DatabaseName;Username=$PostgresUser;Password=$PostgresPassword"
    $envValues = @{
        PLAYWRIGHT_BASE_URL = $baseUrl
        PLAYWRIGHT_DB_CONNECTION = $dbConnection
        PLAYWRIGHT_API_BASE_URL = $apiBaseUrl
        PLAYWRIGHT_SERVER_URLS = $apiBaseUrl
        PLAYWRIGHT_FRONTEND_PORT = "$FrontendPort"
        PLAYWRIGHT_JWT_SIGNING_KEY = $JwtSigningKey
        PLAYWRIGHT_ADMIN_ROLE_ID = $AdminRoleId
        PLAYWRIGHT_GUILD_ID = $GuildId
    }

    if ($InstallBrowsers) {
        Push-Location $clientRoot
        try {
            $playwrightInstallArgs = @('playwright', 'install')
            if ($env:CI -eq 'true') {
                $playwrightInstallArgs += '--with-deps'
            }

            $playwrightInstallArgs += 'chromium'

            & npx @playwrightInstallArgs
            if ($LASTEXITCODE -ne 0) {
                throw "Playwright browser installation failed with exit code $LASTEXITCODE"
            }
        }
        finally {
            Pop-Location
        }
    }

    foreach ($entry in $envValues.GetEnumerator()) {
        $envBackup[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }

    Push-Location $clientRoot
    try {
        switch ($TestType) {
            'Smoke' {
                & npm run smoke
                if ($LASTEXITCODE -ne 0) {
                    throw "Playwright Smoke tests failed with exit code $LASTEXITCODE"
                }
            }
            'Full' {
                & npm run full
                if ($LASTEXITCODE -ne 0) {
                    throw "Playwright Full tests failed with exit code $LASTEXITCODE"
                }
            }
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($envValues) {
        foreach ($entry in $envValues.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, $envBackup[$entry.Key], 'Process')
        }
    }

    if (-not $KeepContainer) {
        if ($createdContainer -or $startedContainer -or -not $containerWasRunningBefore) {
            & docker rm --force $ContainerName *> $null
        }
        elseif ($containerWasRunningBefore) {
            # Leave pre-existing running infrastructure alone.
        }
    }
}