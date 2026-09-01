param([string]$ConfigPath="$PSScriptRoot\blueprint-sage-bridge-config.json")
$ErrorActionPreference="Stop"

if(!(Test-Path $ConfigPath)){throw "Missing config: $ConfigPath"}
if(!(Test-Path "$PSScriptRoot\sage-credential.xml")){throw "Missing Sage credential file."}
$config=Get-Content $ConfigPath -Raw|ConvertFrom-Json
$cred=Import-Clixml "$PSScriptRoot\sage-credential.xml"
$password=$cred.GetNetworkCredential().Password
$conn=New-Object System.Data.Odbc.OdbcConnection("DSN=$($config.Dsn);UID=$($cred.UserName);PWD=$password;")

function Get-Columns($connection,[string]$table){
  $schema=$connection.GetSchema('Columns',@($null,$null,$table,$null))
  $schema | Sort-Object ORDINAL_POSITION | ForEach-Object { [string]$_.COLUMN_NAME }
}

function Show-Relevant([string]$table,[string[]]$columns){
  Write-Host "`n=== $table ===" -ForegroundColor Cyan
  $terms='COST|PRICE|NET|GROSS|PROFIT|MARGIN|QUANTITY|QTY|VALUE|AMOUNT|NOMINAL|CODE|DATE|TYPE|INVOICE|STOCK|ACCOUNT|DESCRIPTION|NAME|DELETED'
  $hits=@($columns | Where-Object { $_ -match $terms })
  if($hits.Count){$hits | ForEach-Object { Write-Host $_ }} else { Write-Host '(no matching columns)' }
}

try{
  $conn.Open()
  Write-Host 'Blueprint Sage profit-field inspection (READ ONLY)' -ForegroundColor Green
  Write-Host 'No Sage data will be changed.' -ForegroundColor DarkGray
  foreach($table in @('INVOICE','INVOICE_ITEM','STOCK','AUDIT_SPLIT','NOMINAL_LEDGER')){
    try{Show-Relevant $table @(Get-Columns $conn $table)}catch{Write-Host "Could not inspect $table : $($_.Exception.Message)" -ForegroundColor Yellow}
  }
  Write-Host "`nFinished. Copy or photograph this output and send it to Steve." -ForegroundColor Green
}
finally{if($conn.State -eq 'Open'){$conn.Close()}}
