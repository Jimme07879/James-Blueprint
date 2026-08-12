param([string]$Dsn="SageLine50v32")
Write-Host "Blueprint Sage Bridge ODBC diagnostic" -ForegroundColor Cyan
try{
  Get-OdbcDsn | Where-Object {$_.Name -like "SageLine50*"} | Format-Table Name,Platform -AutoSize
}catch{
  Write-Host "Could not enumerate ODBC data sources." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Configured default DSN: $Dsn"
Write-Host "If the data source points at the wrong company, check Sage > Help > About > Data Directory."
