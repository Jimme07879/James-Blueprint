param([string]$ConfigPath="$PSScriptRoot\blueprint-sage-bridge-config.json")
$ErrorActionPreference="Stop"
Write-Host "Blueprint Sage Bridge 6.1 setup" -ForegroundColor Cyan
if(!(Test-Path $ConfigPath)){throw "Missing bridge config: $ConfigPath"}

$config=Get-Content $ConfigPath -Raw | ConvertFrom-Json
try {
  $available=@(Get-OdbcDsn | Where-Object {$_.Name -like "SageLine50*"} | Select-Object -ExpandProperty Name)
  if($available.Count -gt 0){
    Write-Host ("Sage ODBC sources found: " + ($available -join ", "))
    if($available -notcontains $config.Dsn){
      $pick=Read-Host "Enter the Sage DSN to use"
      if($pick){$config.Dsn=$pick;$config|ConvertTo-Json|Set-Content $ConfigPath -Encoding UTF8}
    }
  }
} catch { Write-Host "Could not enumerate DSNs automatically." -ForegroundColor Yellow }

$user=Read-Host "Sage username"
$secure=Read-Host "Sage password" -AsSecureString
[pscredential]::new($user,$secure) | Export-Clixml "$PSScriptRoot\sage-credential.xml"
Write-Host "Credentials encrypted for this Windows user." -ForegroundColor Green

& "$PSScriptRoot\Start-BlueprintSageBridge.ps1" -ConfigPath $ConfigPath

$answer=Read-Host "Install an automatic sync every 15 minutes? (Y/N)"
if($answer -match '^[Yy]'){
  $minutes=15
  if($config.SyncMinutes){$minutes=[int]$config.SyncMinutes}
  $action=New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\Start-BlueprintSageBridge.ps1`" -ConfigPath `"$ConfigPath`""
  $trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $minutes)
  Register-ScheduledTask -TaskName "Blueprint Sage Bridge" -Action $action -Trigger $trigger -Description "Read-only Sage 50 sync to Blueprint OS" -Force | Out-Null
  Write-Host "Automatic Sage sync installed." -ForegroundColor Green
}
