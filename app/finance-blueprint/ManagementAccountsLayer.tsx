"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type MonthTotals = { sales: number; grossProfit: number; runningCosts: number };
type StockItem = { stock_code: string; description?: string | null; quantity: number; average_cost: number; sales_price: number; synced_at?: string };
type StockCount = { stock_code: string; counted_quantity: number; unit_cost: number; provision_percent: number; condition: string; notes?: string | null };
type CloseRecord = {
  status: "draft" | "reviewed" | "locked"; stock_adjustment: number; accruals_adjustment: number;
  prepayments_adjustment: number; payroll_adjustment: number; depreciation: number; other_pnl_adjustment: number;
  creditors: number; bank_balance: number; cash_balance: number; accruals_balance: number; prepayments_balance: number;
  loan_balance: number; hp_balance: number; corporation_tax_provision: number; vat_balance: number;
  other_assets: number; other_liabilities: number; budget_sales: number; budget_gross_profit: number;
  budget_running_costs: number; stock_counted: boolean; bank_reconciled: boolean; debtors_reviewed: boolean;
  creditors_reviewed: boolean; payroll_posted: boolean; accruals_reviewed: boolean; vat_reviewed: boolean;
  loans_reconciled: boolean; accountant_reviewed: boolean; notes: string;
};

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const GBP2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
const money = (value: number) => GBP.format(Number(value) || 0);
const blankClose = (): CloseRecord => ({
  status: "draft", stock_adjustment: 0, accruals_adjustment: 0, prepayments_adjustment: 0, payroll_adjustment: 0,
  depreciation: 0, other_pnl_adjustment: 0, creditors: 0, bank_balance: 0, cash_balance: 0, accruals_balance: 0,
  prepayments_balance: 0, loan_balance: 0, hp_balance: 0, corporation_tax_provision: 0, vat_balance: 0,
  other_assets: 0, other_liabilities: 0, budget_sales: 0, budget_gross_profit: 0, budget_running_costs: 0,
  stock_counted: false, bank_reconciled: false, debtors_reviewed: false, creditors_reviewed: false,
  payroll_posted: false, accruals_reviewed: false, vat_reviewed: false, loans_reconciled: false,
  accountant_reviewed: false, notes: ""
});
const monthEndDate = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
};

export default function ManagementAccountsLayer({ session, selectedMonth, current, debt, view }: {
  session: Session; selectedMonth: string; current: MonthTotals; debt: number; view: "accounts" | "stock" | "close";
}) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [counts, setCounts] = useState<Record<string, StockCount>>({});
  const [close, setClose] = useState<CloseRecord>(blankClose());
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""); const [search, setSearch] = useState("");
  const monthEnd = monthEndDate(selectedMonth);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setMessage("");
      const [stockResult, countResult, closeResult] = await Promise.all([
        supabase.from("sage_stock_items").select("stock_code,description,quantity,average_cost,sales_price,synced_at").order("stock_code").limit(5000),
        supabase.from("finance_stock_counts").select("stock_code,counted_quantity,unit_cost,provision_percent,condition,notes").eq("month_end", monthEnd),
        supabase.from("finance_month_closes").select("*").eq("month_end", monthEnd).maybeSingle()
      ]);
      if (!active) return;
      const error = stockResult.error || countResult.error || closeResult.error;
      if (error) setMessage(error.message.includes("Could not find") ? "Management accounts tables are not available yet." : error.message);
      setStock((stockResult.data || []) as StockItem[]);
      const nextCounts: Record<string, StockCount> = {};
      ((countResult.data || []) as StockCount[]).forEach(row => { nextCounts[row.stock_code] = row; });
      setCounts(nextCounts);
      setClose(closeResult.data ? ({ ...blankClose(), ...closeResult.data } as CloseRecord) : blankClose());
      setLoading(false);
    }
    load(); return () => { active = false; };
  }, [monthEnd]);

  const valuation = useMemo(() => stock.map(item => {
    const count = counts[item.stock_code];
    const quantity = count ? Number(count.counted_quantity) : Number(item.quantity || 0);
    const unitCost = count ? Number(count.unit_cost) : Number(item.average_cost || 0);
    const provision = count ? Number(count.provision_percent) : 0;
    const gross = quantity * unitCost; const net = gross * (1 - provision / 100);
    return { ...item, count, quantity, unitCost, provision, gross, net };
  }), [stock, counts]);
  const grossStock = valuation.reduce((sum, row) => sum + row.gross, 0);
  const netStock = valuation.reduce((sum, row) => sum + row.net, 0);
  const provision = grossStock - netStock;
  const adjustments = close.stock_adjustment - close.accruals_adjustment + close.prepayments_adjustment - close.payroll_adjustment - close.depreciation + close.other_pnl_adjustment;
  const sageProfit = current.grossProfit - current.runningCosts;
  const adjustedProfit = sageProfit + adjustments;
  const assets = debt + close.bank_balance + close.cash_balance + netStock + close.prepayments_balance + close.other_assets;
  const liabilities = close.creditors + close.accruals_balance + close.loan_balance + close.hp_balance + close.corporation_tax_provision + close.vat_balance + close.other_liabilities;
  const checks = [close.stock_counted, close.bank_reconciled, close.debtors_reviewed, close.creditors_reviewed, close.payroll_posted, close.accruals_reviewed, close.vat_reviewed, close.loans_reconciled, close.accountant_reviewed];
  const completed = checks.filter(Boolean).length;

  const updateNumber = (key: keyof CloseRecord, value: string) => setClose(old => ({ ...old, [key]: Number(value) || 0 }));
  const saveClose = async () => {
    setSaving(true); setMessage("");
    const payload = { ...close, user_id: session.user.id, month_end: monthEnd, reviewed_at: close.status === "draft" ? null : new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("finance_month_closes").upsert(payload, { onConflict: "user_id,month_end" });
    setMessage(error ? error.message : `Saved ${monthEnd}.`); setSaving(false);
  };
  const updateCount = (item: StockItem, field: keyof StockCount, value: string) => {
    const existing = counts[item.stock_code] || { stock_code: item.stock_code, counted_quantity: Number(item.quantity) || 0, unit_cost: Number(item.average_cost) || 0, provision_percent: 0, condition: "good", notes: "" };
    setCounts(old => ({ ...old, [item.stock_code]: { ...existing, [field]: ["counted_quantity", "unit_cost", "provision_percent"].includes(field) ? Number(value) || 0 : value } }));
  };
  const saveCount = async (item: StockItem) => {
    const row = counts[item.stock_code] || { stock_code: item.stock_code, counted_quantity: Number(item.quantity) || 0, unit_cost: Number(item.average_cost) || 0, provision_percent: 0, condition: "good", notes: "" };
    setSaving(true); setMessage("");
    const { error } = await supabase.from("finance_stock_counts").upsert({ ...row, user_id: session.user.id, month_end: monthEnd, updated_at: new Date().toISOString() }, { onConflict: "user_id,month_end,stock_code" });
    if (!error) setCounts(old => ({ ...old, [item.stock_code]: row }));
    setMessage(error ? error.message : `${item.stock_code} saved.`); setSaving(false);
  };

  if (loading) return <div className="fb-banner">Loading management accounts…</div>;

  if (view === "accounts") return <>
    {message && <div className="fb-banner">{message}</div>}
    <section className="fb-kpis fb-kpis-four"><Mini label="Adjusted profit" value={money(adjustedProfit)} bad={adjustedProfit < 0} /><Mini label="Net stock" value={money(netStock)} /><Mini label="Net assets" value={money(assets - liabilities)} bad={assets - liabilities < 0} /><Mini label="Month-end completion" value={`${completed}/9`} /></section>
    <section className="fb-two fb-accounts-grid">
      <div className="fb-card"><div className="fb-eyebrow">MANAGEMENT PROFIT &amp; LOSS</div><h2>Adjusted monthly result</h2><Statement rows={[
        ["Sales", current.sales], ["Gross profit (Sage average cost)", current.grossProfit], ["Running costs", -current.runningCosts],
        ["Sage management profit", sageProfit], ["Stock adjustment", close.stock_adjustment], ["Accrual adjustment", -close.accruals_adjustment],
        ["Prepayment adjustment", close.prepayments_adjustment], ["Payroll adjustment", -close.payroll_adjustment], ["Depreciation", -close.depreciation],
        ["Other P&L adjustment", close.other_pnl_adjustment], ["Adjusted management profit", adjustedProfit]
      ]} totals={[3, 9]} /></div>
      <div className="fb-card"><div className="fb-eyebrow">BALANCE-SHEET SNAPSHOT</div><h2>Assets and liabilities</h2><Statement rows={[
        ["Customer debtors", debt], ["Stock after provision", netStock], ["Bank and cash", close.bank_balance + close.cash_balance],
        ["Prepayments and other assets", close.prepayments_balance + close.other_assets], ["Total assets", assets], ["Supplier creditors", -close.creditors],
        ["Accruals", -close.accruals_balance], ["VAT and corporation tax", -(close.vat_balance + close.corporation_tax_provision)],
        ["Loans and HP", -(close.loan_balance + close.hp_balance)], ["Other liabilities", -close.other_liabilities], ["Net assets", assets - liabilities]
      ]} totals={[4, 10]} /></div>
    </section>
    <section className="fb-card fb-budget"><div className="fb-eyebrow">BUDGET VS ACTUAL</div><h2>Monthly variance</h2><div className="fb-table-wrap"><table><thead><tr><th>Measure</th><th>Actual</th><th>Budget</th><th>Variance</th></tr></thead><tbody>{[
      ["Sales", current.sales, close.budget_sales], ["Gross profit", current.grossProfit, close.budget_gross_profit], ["Running costs", current.runningCosts, close.budget_running_costs]
    ].map(([label, actual, budget]) => <tr key={String(label)}><td><b>{label}</b></td><td>{GBP2.format(Number(actual))}</td><td>{GBP2.format(Number(budget))}</td><td>{Number(budget) ? GBP2.format(String(label) === "Running costs" ? Number(budget) - Number(actual) : Number(actual) - Number(budget)) : "Budget not entered"}</td></tr>)}</tbody></table></div></section>
  </>;

  if (view === "stock") {
    const shown = valuation.filter(row => !search || `${row.stock_code} ${row.description || ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 250);
    return <section className="fb-card"><div className="fb-card-head"><div><div className="fb-eyebrow">STOCK VALUATION</div><h2>Count, cost and provision</h2></div><div className="fb-stock-summary"><span>Gross {money(grossStock)}</span><span>Provision {money(provision)}</span><strong>Net {money(netStock)}</strong></div></div>
      {message && <div className="fb-banner">{message}</div>}
      {!stock.length && <div className="fb-empty">No live stock has synced yet. Install the updated Sage Bridge, or run it once after this release is deployed.</div>}
      {!!stock.length && <><div className="fb-filters"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stock code or description…" /><div className="fb-note">{Object.keys(counts).length} counted lines saved for {monthEnd}</div></div>
      <div className="fb-table-wrap"><table className="fb-stock-table"><thead><tr><th>Stock item</th><th>Sage qty</th><th>Counted qty</th><th>Unit cost</th><th>Provision %</th><th>Condition</th><th>Net value</th><th></th></tr></thead><tbody>{shown.map(item => <tr key={item.stock_code}><td><b>{item.stock_code}</b><small>{item.description || "—"}</small></td><td>{Number(item.quantity).toFixed(2)}</td><td><input type="number" min="0" step="0.01" value={item.count?.counted_quantity ?? item.quantity} onChange={e => updateCount(item, "counted_quantity", e.target.value)} /></td><td><input type="number" min="0" step="0.01" value={item.count?.unit_cost ?? item.average_cost} onChange={e => updateCount(item, "unit_cost", e.target.value)} /></td><td><input type="number" min="0" max="100" step="1" value={item.count?.provision_percent ?? 0} onChange={e => updateCount(item, "provision_percent", e.target.value)} /></td><td><select value={item.count?.condition ?? "good"} onChange={e => updateCount(item, "condition", e.target.value)}><option value="good">Good</option><option value="slow">Slow</option><option value="damaged">Damaged</option><option value="obsolete">Obsolete</option></select></td><td><b>{GBP2.format(item.net)}</b></td><td><button className="fb-small-button" onClick={() => saveCount(item)} disabled={saving}>Save</button></td></tr>)}</tbody></table></div><div className="fb-note">Valuation uses counted quantity × unit cost, less the provision percentage. Uncounted lines use the current live Sage quantity and average cost.</div></>}
    </section>;
  }

  const numberFields: Array<[keyof CloseRecord, string, string]> = [
    ["stock_adjustment", "Stock P&L adjustment", "Positive increases profit"], ["accruals_adjustment", "Accrual P&L adjustment", "Positive reduces profit"],
    ["prepayments_adjustment", "Prepayment P&L adjustment", "Positive increases profit"], ["payroll_adjustment", "Payroll adjustment", "Positive reduces profit"],
    ["depreciation", "Depreciation", "Reduces profit"], ["other_pnl_adjustment", "Other P&L adjustment", "Signed amount"],
    ["creditors", "Supplier creditors", "Balance owed"], ["bank_balance", "Bank balance", "Use negative for overdraft"], ["cash_balance", "Cash on hand", "Month-end cash"],
    ["accruals_balance", "Accruals balance", "Balance-sheet liability"], ["prepayments_balance", "Prepayments balance", "Balance-sheet asset"],
    ["loan_balance", "Loans", "Outstanding balance"], ["hp_balance", "Hire purchase", "Outstanding balance"],
    ["vat_balance", "VAT balance", "Positive when payable"], ["corporation_tax_provision", "Corporation tax provision", "Estimated liability"],
    ["other_assets", "Other assets", "Other current/fixed assets"], ["other_liabilities", "Other liabilities", "Other amounts owed"],
    ["budget_sales", "Budget sales", "Monthly target"], ["budget_gross_profit", "Budget gross profit", "Monthly target"], ["budget_running_costs", "Budget running costs", "Monthly target"]
  ];
  const checkFields: Array<[keyof CloseRecord, string]> = [["stock_counted", "Stock counted and exceptions reviewed"], ["bank_reconciled", "Bank reconciled"], ["debtors_reviewed", "Debtors and bad debts reviewed"], ["creditors_reviewed", "Supplier creditors reviewed"], ["payroll_posted", "Payroll fully posted"], ["accruals_reviewed", "Accruals and prepayments reviewed"], ["vat_reviewed", "VAT position reviewed"], ["loans_reconciled", "Loans and HP reconciled"], ["accountant_reviewed", "Accountant / reviewer sign-off"]];
  return <section className="fb-card"><div className="fb-card-head"><div><div className="fb-eyebrow">MONTH-END CONTROL</div><h2>Close {monthEnd}</h2></div><label className="fb-status">Status<select value={close.status} onChange={e => setClose(old => ({ ...old, status: e.target.value as CloseRecord["status"] }))}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="locked">Locked</option></select></label></div>
    {message && <div className="fb-banner">{message}</div>}
    <div className="fb-close-layout"><div><h3>Adjustments, balances and budgets</h3><div className="fb-form-grid">{numberFields.map(([key, label, hint]) => <label key={key}>{label}<input type="number" step="0.01" value={String(close[key])} onChange={e => updateNumber(key, e.target.value)} disabled={close.status === "locked"} /><small>{hint}</small></label>)}</div></div>
    <div><h3>Close checklist <span>{completed}/9</span></h3><div className="fb-checklist">{checkFields.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(close[key])} onChange={e => setClose(old => ({ ...old, [key]: e.target.checked }))} disabled={close.status === "locked"} /><span>{label}</span></label>)}</div><label className="fb-notes">Month-end notes<textarea value={close.notes} onChange={e => setClose(old => ({ ...old, notes: e.target.value }))} disabled={close.status === "locked"} /></label><button className="fb-primary fb-save" onClick={saveClose} disabled={saving}>{saving ? "Saving…" : close.status === "locked" ? "Save status change" : "Save month end"}</button><div className="fb-note">Lock only after the figures have been reviewed. A locked month disables financial fields until its status is changed.</div></div></div>
  </section>;
}

function Mini({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) { return <article className="fb-kpi"><div>{label}</div><strong className={bad ? "negative" : ""}>{value}</strong></article>; }
function Statement({ rows, totals }: { rows: Array<[string, number]>; totals: number[] }) { return <div className="fb-statement">{rows.map(([label, value], index) => <div key={label} className={totals.includes(index) ? "total" : ""}><span>{label}</span><b className={value < 0 ? "negative" : ""}>{GBP2.format(value)}</b></div>)}</div>; }
