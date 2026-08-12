param([string]$ConfigPath="$PSScriptRoot\blueprint-sage-bridge-config.json")
$ErrorActionPreference="Stop"

function Get-Field([hashtable]$row,[string[]]$names){
  foreach($n in $names){
    if($row.ContainsKey($n) -and $null -ne $row[$n]){return $row[$n]}
  }
  return $null
}
function Decimal-Or-Zero($value){
  if($null -eq $value){return [decimal]0}
  try{return [decimal]$value}catch{return [decimal]0}
}

if(!(Test-Path $ConfigPath)){throw "Missing config: $ConfigPath"}
if(!(Test-Path "$PSScriptRoot\sage-credential.xml")){throw "Run Install-BlueprintSageBridge.ps1 first."}

$config=Get-Content $ConfigPath -Raw | ConvertFrom-Json
$cred=Import-Clixml "$PSScriptRoot\sage-credential.xml"
$password=$cred.GetNetworkCredential().Password
$conn=New-Object System.Data.Odbc.OdbcConnection("DSN=$($config.Dsn);UID=$($cred.UserName);PWD=$password;")

try {
  $conn.Open()
  $cmd=$conn.CreateCommand()
  $cmd.CommandText="SELECT * FROM SALES_LEDGER"
  $reader=$cmd.ExecuteReader()
  $customers=@()

  while($reader.Read()){
    $row=@{}
    for($i=0;$i -lt $reader.FieldCount;$i++){
      $field=$reader.GetName($i).ToUpperInvariant()
      $row[$field]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}
    }

    $ref=[string](Get-Field $row @("ACCOUNT_REF","ACCOUNT"))
    if([string]::IsNullOrWhiteSpace($ref)){continue}

    $customers += @{
      account_ref=$ref.Trim()
      name=[string](Get-Field $row @("NAME","COMPANY_NAME"))
      balance=(Decimal-Or-Zero (Get-Field $row @("BALANCE","ACCOUNT_BALANCE")))
      credit_limit=(Decimal-Or-Zero (Get-Field $row @("CREDIT_LIMIT")))
      email=[string](Get-Field $row @("EMAIL","EMAIL_1","EMAIL1"))
      telephone=[string](Get-Field $row @("TELEPHONE","TEL_NUMBER","PHONE"))
      raw=@{account_ref=$ref;name=[string](Get-Field $row @("NAME","COMPANY_NAME"))}
    }
  }
  $reader.Close()

  $body=@{
    p_bridge_key=$config.BridgeKey
    p_payload=@{
      kind="customers"
      bridge_name="Office Sage 50"
      bridge_version="6.1-odbc"
      message="Read-only SALES_LEDGER sync completed"
      customers=$customers
    }
  } | ConvertTo-Json -Depth 8

  $headers=@{
    apikey=$config.SupabaseAnonKey
    Authorization="Bearer $($config.SupabaseAnonKey)"
  }
  $uri="$($config.SupabaseUrl.TrimEnd('/'))/rest/v1/rpc/sage_bridge_ingest"
  $result=Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $body
  Write-Host ("Blueprint Sage sync complete: {0} customers" -f $customers.Count) -ForegroundColor Green
  $result | ConvertTo-Json -Depth 4
}
finally {
  if($conn.State -eq "Open"){$conn.Close()}
}
