param(
  [string]$ConfigPath = "$PSScriptRoot\blueprint-sage-bridge-config.json",
  [datetime]$FromDate = [datetime]'2026-08-26',
  [datetime]$ToDate = [datetime]'2026-09-22'
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ConfigPath)) { throw "Missing bridge config: $ConfigPath" }
if (-not (Test-Path "$PSScriptRoot\sage-credential.xml")) { throw 'Missing saved Sage credential.' }
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$cred = Import-Clixml "$PSScriptRoot\sage-credential.xml"
$conn = New-Object System.Data.Odbc.OdbcConnection("DSN=$($config.Dsn);UID=$($cred.UserName);PWD=$($cred.GetNetworkCredential().Password);")

function Read-Rows($connection, [string]$sql) {
  $cmd = $connection.CreateCommand()
  $cmd.CommandText = $sql
  $reader = $cmd.ExecuteReader()
  $result = New-Object System.Collections.ArrayList
  try {
    while ($reader.Read()) {
      $row = @{}
      for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $row[$reader.GetName($i).ToUpperInvariant()] = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) }
      }
      [void]$result.Add($row)
    }
  } finally { $reader.Close(); $cmd.Dispose() }
  return ,$result.ToArray()
}
function Field($row, [string[]]$names) {
  foreach ($name in $names) {
    if ($row.ContainsKey($name) -and $null -ne $row[$name]) { return $row[$name] }
  }
  return $null
}
function Amount($value) {
  if ($null -eq $value) { return [decimal]0 }
  return [decimal]$value
}
function Day($value) {
  if ($null -eq $value) { return '' }
  return ([datetime]$value).ToString('yyyy-MM-dd')
}
function New-Total { return @{ Rows = 0; Net = [decimal]0; Gross = [decimal]0; ItemNet = [decimal]0 } }

$from = $FromDate.ToString('yyyy-MM-dd')
$exclusiveEnd = $ToDate.Date.AddDays(1).ToString('yyyy-MM-dd')
try {
  $conn.Open()
  Write-Host "READ-ONLY Sage sales reconciliation: $from through $($ToDate.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan
  $invoices = Read-Rows $conn "SELECT * FROM INVOICE WHERE INVOICE_DATE >= {d '$from'} AND INVOICE_DATE < {d '$exclusiveEnd'}"
  $items = Read-Rows $conn "SELECT I.INVOICE_NUMBER, II.NET_AMOUNT FROM INVOICE I INNER JOIN INVOICE_ITEM II ON I.INVOICE_NUMBER=II.INVOICE_NUMBER WHERE I.INVOICE_DATE >= {d '$from'} AND I.INVOICE_DATE < {d '$exclusiveEnd'}"
  $audits = Read-Rows $conn "SELECT * FROM AUDIT_HEADER WHERE DATE >= {d '$from'} AND DATE < {d '$exclusiveEnd'}"

  $itemByInvoice = @{}
  foreach ($item in $items) {
    $number = [string](Field $item @('INVOICE_NUMBER'))
    if (-not $itemByInvoice.ContainsKey($number)) { $itemByInvoice[$number] = [decimal]0 }
    $itemByInvoice[$number] += Amount (Field $item @('NET_AMOUNT'))
  }
  $invoiceTotals = @{}
  $dailyInvoiceTotals = @{}
  $withoutItems = New-Total
  foreach ($row in $invoices) {
    $type = [string](Field $row @('INVOICE_OR_CREDIT'))
    if ([string]::IsNullOrWhiteSpace($type)) { $type = '(blank)' }
    $day = Day (Field $row @('INVOICE_DATE'))
    $key = "$day | $type"
    if (-not $invoiceTotals.ContainsKey($type)) { $invoiceTotals[$type] = New-Total }
    if (-not $dailyInvoiceTotals.ContainsKey($key)) { $dailyInvoiceTotals[$key] = New-Total }
    $number = [string](Field $row @('INVOICE_NUMBER'))
    $itemNet = if ($itemByInvoice.ContainsKey($number)) { $itemByInvoice[$number] } else { [decimal]0 }
    $net = Amount (Field $row @('NET_AMOUNT','NET_VALUE','NET'))
    $gross = Amount (Field $row @('GROSS_AMOUNT','GROSS_VALUE','GROSS','INVOICE_TOTAL','TOTAL_AMOUNT'))
    foreach ($total in @($invoiceTotals[$type], $dailyInvoiceTotals[$key])) {
      $total.Rows++
      $total.Net += $net
      $total.Gross += $gross
      $total.ItemNet += $itemNet
    }
    if (-not $itemByInvoice.ContainsKey($number)) {
      $withoutItems.Rows++
      $withoutItems.Net += $net
      $withoutItems.Gross += $gross
    }
  }
  Write-Host "`nINVOICE headers by type (header totals only where these columns exist):" -ForegroundColor Green
  foreach ($key in @($invoiceTotals.Keys | Sort-Object)) {
    $t = $invoiceTotals[$key]
    Write-Host ("{0}: {1} invoices | header net {2:N2} | header gross {3:N2} | joined item net {4:N2}" -f $key,$t.Rows,$t.Net,$t.Gross,$t.ItemNet)
  }
  Write-Host ("INVOICE headers without joined items: {0} | header net {1:N2} | header gross {2:N2}" -f $withoutItems.Rows,$withoutItems.Net,$withoutItems.Gross)
  Write-Host "`nDaily product invoice totals:" -ForegroundColor Green
  foreach ($key in @($dailyInvoiceTotals.Keys | Sort-Object)) {
    $t = $dailyInvoiceTotals[$key]
    Write-Host ("{0}: {1} invoices | item net {2:N2} | header net {3:N2} | header gross {4:N2}" -f $key,$t.Rows,$t.ItemNet,$t.Net,$t.Gross)
  }
  $auditTotals = @{}
  foreach ($row in $audits) {
    $type = ([string](Field $row @('TYPE','TRAN_TYPE','TRANSACTION_TYPE'))).Trim().ToUpperInvariant()
    if ($type -notin @('SI','SC')) { continue }
    if (-not $auditTotals.ContainsKey($type)) { $auditTotals[$type] = New-Total }
    $t = $auditTotals[$type]
    $t.Rows++
    $t.Net += Amount (Field $row @('NET_AMOUNT','NET_VALUE','NET'))
    $t.Gross += Amount (Field $row @('GROSS_AMOUNT','GROSS_VALUE','GROSS'))
  }
  Write-Host "`nAUDIT_HEADER sales ledger by type:" -ForegroundColor Green
  foreach ($key in @($auditTotals.Keys | Sort-Object)) {
    $t = $auditTotals[$key]
    Write-Host ("{0}: {1} entries | net {2:N2} | gross {3:N2}" -f $key,$t.Rows,$t.Net,$t.Gross)
  }
  Write-Host "`nTotals are shown exactly as Sage stores each field. Invoice credit signs and VAT must be reconciled before changing the dashboard." -ForegroundColor Yellow
} finally {
  if ($conn.State -eq 'Open') { $conn.Close() }
  $conn.Dispose()
}
