param([string]$ConfigPath="$PSScriptRoot\blueprint-sage-bridge-config.json")
$ErrorActionPreference="Stop"

function Get-Field([hashtable]$row,[string[]]$names){
  foreach($n in $names){if($row.ContainsKey($n) -and $null -ne $row[$n]){return $row[$n]}}
  return $null
}
function Decimal-Or-Zero($value){if($null -eq $value){return [decimal]0};try{return [decimal]$value}catch{return [decimal]0}}
function Int-Or-Null($value){if($null -eq $value){return $null};try{return [int]$value}catch{return $null}}
function Date-Or-Null($value){if($null -eq $value){return $null};try{return ([datetime]$value).ToString('yyyy-MM-dd')}catch{return $null}}
function Read-Table($connection,[string]$sql){
  $cmd=$connection.CreateCommand();$cmd.CommandText=$sql;$reader=$cmd.ExecuteReader();$rows=@()
  while($reader.Read()){$row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$field=$reader.GetName($i).ToUpperInvariant();$row[$field]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$rows+=,$row}
  $reader.Close();return $rows
}
function Send-Blueprint($config,$payload){
  $body=@{p_bridge_key=$config.BridgeKey;p_payload=$payload}|ConvertTo-Json -Depth 10
  $headers=@{apikey=$config.SupabaseAnonKey;Authorization="Bearer $($config.SupabaseAnonKey)"}
  $uri="$($config.SupabaseUrl.TrimEnd('/'))/rest/v1/rpc/sage_bridge_ingest"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $body
}

if(!(Test-Path $ConfigPath)){throw "Missing config: $ConfigPath"}
if(!(Test-Path "$PSScriptRoot\sage-credential.xml")){throw "Run Install-BlueprintSageBridge.ps1 first."}
$config=Get-Content $ConfigPath -Raw|ConvertFrom-Json
$cred=Import-Clixml "$PSScriptRoot\sage-credential.xml";$password=$cred.GetNetworkCredential().Password
$conn=New-Object System.Data.Odbc.OdbcConnection("DSN=$($config.Dsn);UID=$($cred.UserName);PWD=$password;")

try{
  $conn.Open()

  $customerRows=Read-Table $conn "SELECT * FROM SALES_LEDGER"
  $customers=@()
  foreach($row in $customerRows){
    $ref=[string](Get-Field $row @('ACCOUNT_REF','ACCOUNT'));if([string]::IsNullOrWhiteSpace($ref)){continue}
    $customers+=@{account_ref=$ref.Trim();name=[string](Get-Field $row @('NAME','COMPANY_NAME'));balance=(Decimal-Or-Zero (Get-Field $row @('BALANCE','ACCOUNT_BALANCE')));credit_limit=(Decimal-Or-Zero (Get-Field $row @('CREDIT_LIMIT')));email=[string](Get-Field $row @('EMAIL','EMAIL_1','EMAIL1'));telephone=[string](Get-Field $row @('TELEPHONE','TEL_NUMBER','PHONE'));raw=@{account_ref=$ref.Trim();name=[string](Get-Field $row @('NAME','COMPANY_NAME'))}}
  }
  $customerRefs=@($customers|ForEach-Object{$_.account_ref})
  $customerResult=Send-Blueprint $config @{kind='customers';bridge_name='Office Sage 50';bridge_version='6.3-profit';message='Read-only SALES_LEDGER sync completed';customers=$customers;active_account_refs=$customerRefs}
  Write-Host ("Blueprint customer sync complete: {0} customers" -f $customers.Count) -ForegroundColor Green

  # Only active audit transactions. Sage documents DELETED_FLAG=0 as active.
  $auditRows=Read-Table $conn "SELECT * FROM AUDIT_HEADER WHERE DELETED_FLAG=0"
  $transactions=@()
  foreach($row in $auditRows){
    $number=[string](Get-Field $row @('HEADER_NUMBER','TRAN_NUMBER','TRANSACTION_NUMBER','NUMBER'));if([string]::IsNullOrWhiteSpace($number)){continue}
    $account=[string](Get-Field $row @('ACCOUNT_REF','ACCOUNT'))
    $gross=Decimal-Or-Zero (Get-Field $row @('GROSS_AMOUNT','GROSS_VALUE','GROSS'))
    $paid=Decimal-Or-Zero (Get-Field $row @('AMOUNT_PAID','PAID_AMOUNT','PAID'))
    $outField=Get-Field $row @('OUTSTANDING','OUTSTANDING_AMOUNT','AMOUNT_OUTSTANDING')
    $outstanding=if($null -ne $outField){Decimal-Or-Zero $outField}else{[math]::Max([decimal]0,$gross-$paid)}
    $transactions+=@{tran_number=$number.Trim();item_count=(Int-Or-Null (Get-Field $row @('ITEM_COUNT','ITEMS')));type=[string](Get-Field $row @('TYPE','TRAN_TYPE','TRANSACTION_TYPE'));transaction_date=(Date-Or-Null (Get-Field $row @('DATE','TRAN_DATE','TRANSACTION_DATE')));account_ref=$account.Trim();inv_ref=[string](Get-Field $row @('INV_REF','INVOICE_REF','REFERENCE'));details=[string](Get-Field $row @('DETAILS','DESCRIPTION'));due_date=(Date-Or-Null (Get-Field $row @('DUE_DATE')));net_amount=(Decimal-Or-Zero (Get-Field $row @('NET_AMOUNT','NET_VALUE','NET')));tax_amount=(Decimal-Or-Zero (Get-Field $row @('TAX_AMOUNT','TAX_VALUE','VAT_AMOUNT','VAT')));gross_amount=$gross;amount_paid=$paid;outstanding=$outstanding;paid_flag=(Int-Or-Null (Get-Field $row @('PAID_FLAG','PAID_STATUS_FLAG')));paid_status=[string](Get-Field $row @('PAID_STATUS','STATUS'));raw=@{tran_number=$number.Trim();account_ref=$account.Trim()}}
  }
  $txRefs=@($transactions|ForEach-Object{$_.tran_number})
  $txResult=Send-Blueprint $config @{kind='transactions';bridge_name='Office Sage 50';bridge_version='6.3-profit';message='Read-only active AUDIT_HEADER transaction sync completed';transactions=$transactions;active_transaction_refs=$txRefs}
  Write-Host ("Blueprint debtor sync complete: {0} active transactions" -f $transactions.Count) -ForegroundColor Green

  # Gross-profit snapshot: actual invoice-line net sales less quantity x current Sage average cost.
  # Sage's documented links are INVOICE.INVOICE_NUMBER -> INVOICE_ITEM.INVOICE_NUMBER and INVOICE_ITEM.STOCK_CODE -> STOCK.STOCK_CODE.
  $profitRows=Read-Table $conn "SELECT I.DATE AS INVOICE_DATE, II.NET_AMOUNT, II.QUANTITY, II.STOCK_CODE, S.AVERAGE_COST_PRICE FROM (INVOICE I INNER JOIN INVOICE_ITEM II ON I.INVOICE_NUMBER=II.INVOICE_NUMBER) LEFT JOIN STOCK S ON II.STOCK_CODE=S.STOCK_CODE"
  $daily=@{}
  foreach($row in $profitRows){
    $date=Date-Or-Null (Get-Field $row @('INVOICE_DATE','DATE'));if([string]::IsNullOrWhiteSpace($date)){continue}
    $net=Decimal-Or-Zero (Get-Field $row @('NET_AMOUNT'))
    $qty=Decimal-Or-Zero (Get-Field $row @('QUANTITY'))
    $avg=Decimal-Or-Zero (Get-Field $row @('AVERAGE_COST_PRICE'))
    $cost=$qty*$avg
    if(!$daily.ContainsKey($date)){$daily[$date]=@{sales=[decimal]0;cost=[decimal]0;lines=0}}
    $daily[$date].sales+=$net;$daily[$date].cost+=$cost;$daily[$date].lines++
  }
  $snapshots=@()
  foreach($date in $daily.Keys){
    $sales=[decimal]$daily[$date].sales;$cost=[decimal]$daily[$date].cost;$gp=$sales-$cost;$pct=if($sales-ne0){($gp/$sales)*100}else{0}
    $snapshots+=@{snapshot_date=$date;sales_net=[math]::Round($sales,2);cost_of_goods=[math]::Round($cost,2);gross_profit=[math]::Round($gp,2);gross_profit_pct=[math]::Round($pct,2);line_count=$daily[$date].lines;cost_basis='STOCK.AVERAGE_COST_PRICE'}
  }
  $profitResult=Send-Blueprint $config @{kind='profit_snapshots';bridge_name='Office Sage 50';bridge_version='6.3-profit';message='Read-only Sage invoice gross-profit snapshot sync completed';snapshots=$snapshots}
  Write-Host ("Blueprint gross profit sync complete: {0} daily snapshots" -f $snapshots.Count) -ForegroundColor Green

  @{customers=$customerResult;transactions=$txResult;profit=$profitResult}|ConvertTo-Json -Depth 5
}
finally{if($conn.State -eq 'Open'){$conn.Close()}}
