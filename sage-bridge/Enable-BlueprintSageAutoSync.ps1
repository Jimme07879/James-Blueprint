param(
  [string]$ConfigPath="$PSScriptRoot\blueprint-sage-bridge-config.json",
  [int]$Minutes=15
)

$ErrorActionPreference="Stop"
$taskName="Blueprint Sage Bridge"
$bridgeScript="$PSScriptRoot\Start-BlueprintSageBridge.ps1"

Write-Host "Blueprint Sage Auto Sync setup" -ForegroundColor Cyan

if(!(Test-Path $bridgeScript)){throw "Missing bridge script: $bridgeScript"}
if(!(Test-Path $ConfigPath)){throw "Missing bridge config: $ConfigPath"}
if(!(Test-Path "$PSScriptRoot\sage-credential.xml")){throw "Missing Sage credentials. Run Install-BlueprintSageBridge.ps1 first."}

$config=Get-Content $ConfigPath -Raw | ConvertFrom-Json
if($config.SyncMinutes){$Minutes=[int]$config.SyncMinutes}
if($Minutes -lt 1){$Minutes=15}

$arguments="-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$bridgeScript`" -ConfigPath `"$ConfigPath`""
$action=New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments

# Run shortly after setup, then repeat continuously while Windows is running.
$repeatTrigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
# Also run immediately whenever this Windows user signs in.
$logonTrigger=New-ScheduledTaskTrigger -AtLogOn

$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($repeatTrigger,$logonTrigger) -Settings $settings -Description "Read-only Sage 50 customer, debtor and transaction sync to Blueprint OS" -Force | Out-Null

Write-Host "Automatic Sage sync installed successfully." -ForegroundColor Green
Write-Host "Blueprint will sync at sign-in and every $Minutes minutes while this PC is running." -ForegroundColor Green
Write-Host "Task name: $taskName" -ForegroundColor DarkGray

Write-Host "Running one sync now..." -ForegroundColor Cyan
& $bridgeScript -ConfigPath $ConfigPath
