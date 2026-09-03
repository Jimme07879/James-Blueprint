param([string]$ConfigPath="$PSScriptRoot\blueprint-sage-bridge-config.json")
$ErrorActionPreference="Stop"

function Get-Field([hashtable]$row,[string[]]$names){
  foreach($n in $names){if($row.ContainsKey($n) -and $null -ne $row[$n]){return $row[$n]}}
  return $null
}
function Decimal-Or-Zero($value){if($null -eq $value){return [decimal]0};try{return [decimal]$value}catch{return [decimal]0}}
function Int-Or-Null($value){if($null -eq $value){return $null};try{return [int]$value}catch{return $null}}
function Date-Or-Null($value){if($null -eq $value){return $null};try{return ([datetime]$value).ToString('yyyy-MM-dd')}catch{return $null}}
function Read-Table($connection,[string]$sql){$cmd=$connection.CreateCommand();$cmd.CommandText=$sql;$reader=$cmd.ExecuteReader();$rows=@();while($reader.Read()){$row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){$field=$reader.GetName($i).ToUpperInvariant();$row[$field]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$rows+=,$row};$reader.Close();return $rows}
function Send-Blueprint($config,$payload){$body=@{p_bridge_key=$config.BridgeKey;p_payload=$payload}|ConvertTo-Json -Depth 10 -Compress;$headers=@{apikey=$config.SupabaseAnonKey;Authorization="Bearer $($config.SupabaseAnonKey)"};$uri="$($config.SupabaseUrl.TrimEnd('/'))/rest/v1/rpc/sage_bridge_ingest";return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))}
function Send-In-Chunks($config,[array]$items,[int]$chunkSize,[scriptblock]$payloadFactory){$results=@();for($offset=0;$offset -lt $items.Count;$offset+=$chunkSize){$end=[math]::Min($offset+$chunkSize-1,$items.Count-1);$chunk=@($items[$offset..$end]);$results+=Send-Blueprint $config (& $payloadFactory $chunk)};return $results}
function Normalized-Cost([string]$type,$value){
  $n=Decimal-Or-Zero $value
  switch(($type.Trim()).ToUpperInvariant()){
    'PI' {return -$n}
    'BP' {return -$n}
    'PC' {return -$n}
    'BR' {return -$n}
    default {return $n}
  }
}

if(!(Test-Path $ConfigPath)){throw "Missing config: $ConfigPath"};if(!(Test-Path "$PSScriptRoot\sage-credential.xml")){throw "Run Install-BlueprintSageBridge.ps1 first."}
$config=Get-Content $ConfigPath -Raw|ConvertFrom-Json;$cred=Import-Clixml "$PSScriptRoot\sage-credential.xml";$password=$cred.GetNetworkCredential().Password;$conn=New-Object System.Data.Odbc.OdbcConnection("DSN=$($config.Dsn);UID=$($cred.UserName);PWD=$password;")
try{
$conn.Open()
$customerRows=Read-Table $conn "SELECT * FROM SALES_LEDGER";$customers=@();foreach($row in $customerRows){$ref=[string](Get-Field $row @('ACCOUNT_REF','ACCOUNT'));if([string]::IsNullOrWhiteSpace($ref)){continue};$customers+=@{account_ref=$ref.Trim();name=[string](Get-Field $row @('NAME','COMPANY_NAME'));balance=(Decimal-Or-Zero (Get-Field $row @('BALANCE','ACCOUNT_BALANCE')));credit_limit=(Decimal-Or-Zero (Get-Field $row @('CREDIT_LIMIT')));email=[string](Get-Field $row @('EMAIL','EMAIL_1','EMAIL1'));telephone=[string](Get-Field $row @('TELEPHONE','TEL_NUMBER','PHONE'));raw=@{account_ref=$ref.Trim();name=[string](Get-Field $row @('NAME','COMPANY_NAME'))}}};$customerRefs=@($customers|ForEach-Object{$_.account_ref});$customerResult=Send-Blueprint $config @{kind='customers';bridge_name='Office Sage 50';bridge_version='6.6-running-costs';message='Read-only SALES_LEDGER sync completed';customers=$customers;active_account_refs=$customerRefs};Write-Host ("Blueprint customer sync complete: {0} customers" -f $customers.Count) -ForegroundColor Green

# This Sage v32.1 AUDIT_HEADER does not expose DELETED_FLAG; keep the previously working header query.
$auditRows=Read-Table $conn "SELECT * FROM AUDIT_HEADER";$transactions=@();foreach($row in $auditRows){$number=[string](Get-Field $row @('HEADER_NUMBER','TRAN_NUMBER','TRANSACTION_NUMBER','NUMBER'));if([string]::IsNullOrWhiteSpace($number)){continue};$account=[string](Get-Field $row @('ACCOUNT_REF','ACCOUNT'));$gross=Decimal-Or-Zero (Get-Field $row @('GROSS_AMOUNT','GROSS_VALUE','GROSS'));$paid=Decimal-Or-Zero (Get-Field $row @('AMOUNT_PAID','PAID_AMOUNT','PAID'));$outField=Get-Field $row @('OUTSTANDING','OUTSTANDING_AMOUNT','AMOUNT_OUTSTANDING');$outstanding=if($null-ne$outField){Decimal-Or-Zero $outField}else{[math]::Max([decimal]0,$gross-$paid)};$transactions+=@{tran_number=$number.Trim();item_count=(Int-Or-Null (Get-Field $row @('ITEM_COUNT','ITEMS')));type=[string](Get-Field $row @('TYPE','TRAN_TYPE','TRANSACTION_TYPE'));transaction_date=(Date-Or-Null (Get-Field $row @('DATE','TRAN_DATE','TRANSACTION_DATE')));account_ref=$account.Trim();inv_ref=[string](Get-Field $row @('INV_REF','INVOICE_REF','REFERENCE'));details=[string](Get-Field $row @('DETAILS','DESCRIPTION'));due_date=(Date-Or-Null (Get-Field $row @('DUE_DATE')));net_amount=(Decimal-Or-Zero (Get-Field $row @('NET_AMOUNT','NET_VALUE','NET')));tax_amount=(Decimal-Or-Zero (Get-Field $row @('TAX_AMOUNT','TAX_VALUE','VAT_AMOUNT','VAT')));gross_amount=$gross;amount_paid=$paid;outstanding=$outstanding;paid_flag=(Int-Or-Null (Get-Field $row @('PAID_FLAG','PAID_STATUS_FLAG')));paid_status=[string](Get-Field $row @('PAID_STATUS','STATUS'));raw=@{tran_number=$number.Trim();account_ref=$account.Trim()}}};$txRefs=@($transactions|ForEach-Object{$_.tran_number});$txResults=Send-In-Chunks $config $transactions 500 {param($chunk) @{kind='transactions';bridge_name='Office Sage 50';bridge_version='6.6-running-costs';message='Read-only AUDIT_HEADER transaction chunk synced';transactions=$chunk}};$txCleanupResult=Send-Blueprint $config @{kind='transactions';bridge_name='Office Sage 50';bridge_version='6.6-running-costs';message='Transaction cleanup completed';transactions=@();active_transaction_refs=$txRefs};Write-Host ("Blueprint debtor sync complete: {0} transactions" -f $transactions.Count) -ForegroundColor Green

# Sage INVOICE types validated locally: Product Invoice=Invoice; Product Credit Note=Credit Note; Product Quotation=Quotation.
# Include invoices and credit notes only. Credits reverse both sales and cost so GP reconciles on the same commercial basis; quotations are excluded.
$profitFromDate=(Get-Date).Date.AddDays(-89).ToString('yyyy-MM-dd')
$profitSql="SELECT I.INVOICE_DATE AS INVOICE_DATE, I.INVOICE_OR_CREDIT AS INVOICE_OR_CREDIT, II.NET_AMOUNT, II.QUANTITY, II.STOCK_CODE, S.AVERAGE_COST_PRICE FROM (INVOICE I INNER JOIN INVOICE_ITEM II ON I.INVOICE_NUMBER=II.INVOICE_NUMBER) LEFT JOIN STOCK S ON II.STOCK_CODE=S.STOCK_CODE WHERE I.INVOICE_DATE >= {d '$profitFromDate'} AND (I.INVOICE_OR_CREDIT='Invoice' OR I.INVOICE_OR_CREDIT='Credit Note')"
Write-Host ("Blueprint gross profit scan: {0} to today - invoices minus credit notes" -f $profitFromDate) -ForegroundColor Cyan
$profitRows=Read-Table $conn $profitSql;$daily=@{};foreach($row in $profitRows){$date=Date-Or-Null (Get-Field $row @('INVOICE_DATE'));if([string]::IsNullOrWhiteSpace($date)){continue};$docType=[string](Get-Field $row @('INVOICE_OR_CREDIT'));$sign=if($docType.Trim().ToUpperInvariant() -eq 'CREDIT NOTE'){[decimal]-1}else{[decimal]1};$net=(Decimal-Or-Zero (Get-Field $row @('NET_AMOUNT')))*$sign;$qty=Decimal-Or-Zero (Get-Field $row @('QUANTITY'));$avg=Decimal-Or-Zero (Get-Field $row @('AVERAGE_COST_PRICE'));$cost=($qty*$avg)*$sign;if(!$daily.ContainsKey($date)){$daily[$date]=@{sales=[decimal]0;cost=[decimal]0;lines=0}};$daily[$date].sales+=$net;$daily[$date].cost+=$cost;$daily[$date].lines++};$snapshots=@();foreach($date in $daily.Keys){$sales=[decimal]$daily[$date].sales;$cost=[decimal]$daily[$date].cost;$gp=$sales-$cost;$pct=if($sales-ne0){($gp/$sales)*100}else{0};$snapshots+=@{snapshot_date=$date;sales_net=[math]::Round($sales,2);cost_of_goods=[math]::Round($cost,2);gross_profit=[math]::Round($gp,2);gross_profit_pct=[math]::Round($pct,2);line_count=$daily[$date].lines;cost_basis='STOCK.AVERAGE_COST_PRICE'}};$profitResult=Send-Blueprint $config @{kind='profit_snapshots';bridge_name='Office Sage 50';bridge_version='6.6-running-costs';message='Read-only Sage 90-day invoice/credit gross-profit snapshot sync completed';snapshots=$snapshots};Write-Host ("Blueprint gross profit sync complete: {0} daily snapshots from {1} invoice/credit lines" -f $snapshots.Count,$profitRows.Count) -ForegroundColor Green

# Management running costs: actual Sage nominal movements, with lumpy rent/electricity replaced by trailing-12-month daily accruals.
# Stock purchases/COGS are excluded because product cost is already reflected in gross profit. Corporation tax/dividends are outside this range.
# Interest and depreciation are excluded from management running costs; bank/card charges remain operating costs.
$costFromDate=(Get-Date).Date.AddDays(-89).ToString('yyyy-MM-dd')
$annualFromDate=(Get-Date).Date.AddDays(-364).ToString('yyyy-MM-dd')
$costRows=Read-Table $conn "SELECT DATE, TYPE, NOMINAL_CODE, NET_AMOUNT FROM AUDIT_SPLIT WHERE DATE >= {d '$costFromDate'} AND NOMINAL_CODE >= '7000' AND NOMINAL_CODE < '9000'"
$annualRows=Read-Table $conn "SELECT DATE, TYPE, NOMINAL_CODE, NET_AMOUNT FROM AUDIT_SPLIT WHERE DATE >= {d '$annualFromDate'} AND (NOMINAL_CODE='7100' OR NOMINAL_CODE='7200')"
$annualRent=[decimal]0;$annualElectricity=[decimal]0
foreach($row in $annualRows){$code=[string](Get-Field $row @('NOMINAL_CODE'));$value=Normalized-Cost ([string](Get-Field $row @('TYPE'))) (Get-Field $row @('NET_AMOUNT'));if($code-eq'7100'){$annualRent+=$value}elseif($code-eq'7200'){$annualElectricity+=$value}}
$dailyRent=$annualRent/[decimal]365;$dailyElectricity=$annualElectricity/[decimal]365
$costDaily=@{}
$startDate=(Get-Date).Date.AddDays(-89);$endDate=(Get-Date).Date
for($d=$startDate;$d-le$endDate;$d=$d.AddDays(1)){$key=$d.ToString('yyyy-MM-dd');$costDaily[$key]=@{staff=[decimal]0;premises=[decimal]0;vehicle=[decimal]0;admin=[decimal]0;finance=[decimal]0;lines=0}}
foreach($row in $costRows){
  $date=Date-Or-Null (Get-Field $row @('DATE'));if([string]::IsNullOrWhiteSpace($date)-or!$costDaily.ContainsKey($date)){continue}
  $code=[string](Get-Field $row @('NOMINAL_CODE'));$type=[string](Get-Field $row @('TYPE'))
  if($code-eq'7100'-or$code-eq'7200'){continue}
  if($code-ge'7900'-and$code-le'7906' -and $code-ne'7901' -and $code-ne'7902' -and $code-ne'7905'){continue}
  if($code-ge'8000'-and$code-lt'8200'){continue}
  $value=Normalized-Cost $type (Get-Field $row @('NET_AMOUNT'))
  if($code-ge'7000'-and$code-le'7015' -and $code-ne'7013'){$costDaily[$date].staff+=$value}
  elseif(($code-ge'7100'-and$code-le'7203')){$costDaily[$date].premises+=$value}
  elseif($code-ge'7300'-and$code-le'7308'){$costDaily[$date].vehicle+=$value}
  elseif($code-eq'7901'-or$code-eq'7902'-or$code-eq'7905'){$costDaily[$date].finance+=$value}
  else{$costDaily[$date].admin+=$value}
  $costDaily[$date].lines++
}
$costSnapshots=@();foreach($date in $costDaily.Keys){$staff=[decimal]$costDaily[$date].staff;$prem=[decimal]$costDaily[$date].premises+$dailyRent+$dailyElectricity;$vehicle=[decimal]$costDaily[$date].vehicle;$admin=[decimal]$costDaily[$date].admin;$finance=[decimal]$costDaily[$date].finance;$total=$staff+$prem+$vehicle+$admin+$finance;$costSnapshots+=@{snapshot_date=$date;running_costs=[math]::Round($total,2);staff_costs=[math]::Round($staff,2);premises_costs=[math]::Round($prem,2);vehicle_costs=[math]::Round($vehicle,2);admin_costs=[math]::Round($admin,2);finance_costs=[math]::Round($finance,2);rent_accrual=[math]::Round($dailyRent,2);electricity_accrual=[math]::Round($dailyElectricity,2);line_count=$costDaily[$date].lines;cost_basis='Actual Sage nominal movements; rent/electricity smoothed from trailing 365 days; interest/depreciation excluded'}}
$costResult=Send-Blueprint $config @{kind='running_cost_snapshots';bridge_name='Office Sage 50';bridge_version='6.6-running-costs';message='Read-only Sage 90-day management running-cost snapshot sync completed';snapshots=$costSnapshots};Write-Host ("Blueprint running cost sync complete: {0} daily snapshots | annual rent {1:N2} | annual electricity {2:N2}" -f $costSnapshots.Count,$annualRent,$annualElectricity) -ForegroundColor Green

@{customers=$customerResult;transaction_batches=$txResults.Count;transactions_cleanup=$txCleanupResult;profit=$profitResult;running_costs=$costResult}|ConvertTo-Json -Depth 5
}finally{if($conn.State-eq'Open'){$conn.Close()}}
