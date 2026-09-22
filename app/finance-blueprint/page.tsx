"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import ManagementAccountsLayer from "./ManagementAccountsLayer";
import "./finance-blueprint.css";

type ProfitRow = { snapshot_date: string; sales_net: number; cost_of_goods?: number; gross_profit: number };
type CostSnapshot = {
  snapshot_date: string; running_costs: number; staff_costs: number; premises_costs: number;
  vehicle_costs: number; admin_costs: number; finance_costs: number;
};
type CostTransaction = {
  cost_key: string; transaction_date: string; transaction_number?: string | null; type?: string | null;
  nominal_code: string; nominal_name?: string | null; reference?: string | null; details?: string | null;
  normalized_cost: number; category: string; included_in_management: boolean; exclusion_reason?: string | null;
};
type Customer = { account_ref: string; name?: string | null; balance?: number | null };
type Month = {
  key: string; sales: number; productCost: number; grossProfit: number; runningCosts: number;
  staff: number; premises: number; vehicles: number; admin: number; finance: number;
};
type Insight = { level: "priority" | "watch" | "positive" | "info"; title: string; detail: string };

const START_DATE = "2026-04-01";
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const GBP2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
const money = (value: number) => GBP.format(Number(value) || 0);
const monthName = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const pct = (value: number) => Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : "—";
const changePct = (current: number, previous: number) => previous ? ((current - previous) / Math.abs(previous)) * 100 : 0;
const todayKey = () => new Date().toISOString().slice(0, 7);

function emptyMonth(key: string): Month {
  return { key, sales: 0, productCost: 0, grossProfit: 0, runningCosts: 0, staff: 0, premises: 0, vehicles: 0, admin: 0, finance: 0 };
}

function buildLocalInsights(current: Month, previous?: Month): Insight[] {
  if (!previous) return [{ level: "info", title: "Baseline month", detail: "There is no earlier month in the connected Sage data to compare with this period." }];
  const insights: Insight[] = [];
  const categories = [
    ["Staff", current.staff, previous.staff], ["Premises", current.premises, previous.premises],
    ["Vehicles", current.vehicles, previous.vehicles], ["Administration and technology", current.admin, previous.admin],
    ["Finance and bank charges", current.finance, previous.finance]
  ] as const;
  const net = current.grossProfit - current.runningCosts;
  const previousNet = previous.grossProfit - previous.runningCosts;
  if (current.staff === 0 && previous.staff > 0) insights.push({ level: "priority", title: "Payroll may not be posted", detail: `Staff cost is £0 compared with ${money(previous.staff)} last month. Do not treat the current profit figure as final until payroll is checked.` });
  if (current.runningCosts > previous.runningCosts && current.sales <= previous.sales) insights.push({ level: "priority", title: "Costs rose while sales did not", detail: `Running costs increased by ${money(current.runningCosts - previous.runningCosts)}, while sales changed by ${money(current.sales - previous.sales)}.` });
  categories.map(([name, now, before]) => ({ name, now, before, pounds: now - before, percent: changePct(now, before) }))
    .filter(item => item.pounds > 100 && item.percent > 10)
    .sort((a, b) => b.pounds - a.pounds)
    .slice(0, 3)
    .forEach(item => insights.push({ level: item.pounds > 500 ? "priority" : "watch", title: `${item.name} increased`, detail: `${money(item.pounds)} higher than the previous month (${pct(item.percent)}). Open the transaction drill-down before deciding whether this is recurring or a one-off posting.` }));
  if (current.grossProfit && previous.grossProfit) {
    const margin = current.sales ? current.grossProfit / current.sales * 100 : 0;
    const priorMargin = previous.sales ? previous.grossProfit / previous.sales * 100 : 0;
    if (margin < priorMargin - 1) insights.push({ level: "priority", title: "Gross margin weakened", detail: `Gross margin is ${margin.toFixed(1)}%, down ${(priorMargin - margin).toFixed(1)} percentage points. Check selling prices, product costs and low-margin customers.` });
    else if (margin > priorMargin + 1) insights.push({ level: "positive", title: "Gross margin improved", detail: `Gross margin increased from ${priorMargin.toFixed(1)}% to ${margin.toFixed(1)}%. Check which products or customers produced the improvement.` });
  }
  if (net > previousNet) insights.push({ level: "positive", title: "Management profit improved", detail: `${money(net - previousNet)} better than the previous month before corporation tax, dividends, interest and depreciation.` });
  if (!insights.length) insights.push({ level: "info", title: "No major movement detected", detail: "The main monthly cost categories are broadly stable. Review the largest individual transactions and recurring supplier costs next." });
  return insights.slice(0, 5);
}

export default function FinanceBlueprintPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  if (authLoading) return <div className="fb-centre">Loading Finance Blueprint…</div>;
  if (!session) return <FinanceLogin />;
  return <FinanceApp session={session} />;
}

function FinanceLogin() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
  };
  return <main className="fb-login"><form onSubmit={submit} className="fb-login-card">
    <div className="fb-mark">F</div><h1>Finance Blueprint</h1><p>Sage financial command centre</p>
    <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
    <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
    <button type="submit">Sign in</button>{error && <div className="fb-error">{error}</div>}
  </form></main>;
}

function FinanceApp({ session }: { session: Session }) {
  const [profits, setProfits] = useState<ProfitRow[]>([]); const [costs, setCosts] = useState<CostSnapshot[]>([]);
  const [transactions, setTransactions] = useState<CostTransaction[]>([]); const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedMonth, setSelectedMonth] = useState("");
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("All"); const [tab, setTab] = useState<"overview" | "accounts" | "stock" | "close" | "costs" | "transactions">("overview");
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null); const [aiBusy, setAiBusy] = useState(false); const [aiNote, setAiNote] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    const [profitResult, costResult, customerResult] = await Promise.all([
      supabase.from("sage_profit_snapshots").select("snapshot_date,sales_net,cost_of_goods,gross_profit").gte("snapshot_date", START_DATE).order("snapshot_date"),
      supabase.from("sage_running_cost_snapshots").select("snapshot_date,running_costs,staff_costs,premises_costs,vehicle_costs,admin_costs,finance_costs").gte("snapshot_date", START_DATE).order("snapshot_date"),
      supabase.from("sage_customers").select("account_ref,name,balance").limit(2500)
    ]);
    let allTransactions: CostTransaction[] = [];
    for (let from = 0; from < 10000; from += 1000) {
      const result = await supabase.from("sage_cost_transactions")
        .select("cost_key,transaction_date,transaction_number,type,nominal_code,nominal_name,reference,details,normalized_cost,category,included_in_management,exclusion_reason")
        .gte("transaction_date", START_DATE).order("transaction_date", { ascending: false }).range(from, from + 999);
      if (result.error) { if (!result.error.message.includes("Could not find")) setError(result.error.message); break; }
      const page = (result.data || []) as CostTransaction[]; allTransactions = allTransactions.concat(page); if (page.length < 1000) break;
    }
    const firstError = profitResult.error || costResult.error || customerResult.error;
    if (firstError) setError(firstError.message);
    setProfits((profitResult.data || []) as ProfitRow[]); setCosts((costResult.data || []) as CostSnapshot[]);
    setCustomers((customerResult.data || []) as Customer[]); setTransactions(allTransactions); setLoading(false);
  };
  useEffect(() => { load(); const timer = window.setInterval(load, 15 * 60 * 1000); return () => window.clearInterval(timer); }, []);

  const months = useMemo(() => {
    const map = new Map<string, Month>();
    profits.forEach(row => { const key = row.snapshot_date.slice(0, 7); const month = map.get(key) || emptyMonth(key); month.sales += Number(row.sales_net) || 0; month.productCost += Number(row.cost_of_goods) || 0; month.grossProfit += Number(row.gross_profit) || 0; map.set(key, month); });
    costs.forEach(row => { const key = row.snapshot_date.slice(0, 7); const month = map.get(key) || emptyMonth(key); month.runningCosts += Number(row.running_costs) || 0; month.staff += Number(row.staff_costs) || 0; month.premises += Number(row.premises_costs) || 0; month.vehicles += Number(row.vehicle_costs) || 0; month.admin += Number(row.admin_costs) || 0; month.finance += Number(row.finance_costs) || 0; map.set(key, month); });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [profits, costs]);
  useEffect(() => { if (!selectedMonth && months.length) { const closed = months.filter(m => m.key < todayKey()); setSelectedMonth((closed.at(-1) || months.at(-1))!.key); } }, [months, selectedMonth]);
  const currentIndex = months.findIndex(month => month.key === selectedMonth); const current = months[currentIndex] || emptyMonth(selectedMonth || todayKey()); const previous = currentIndex > 0 ? months[currentIndex - 1] : undefined;
  const localInsights = useMemo(() => buildLocalInsights(current, previous), [current, previous]);
  const displayedInsights = aiInsights || localInsights;
  const netProfit = current.grossProfit - current.runningCosts; const gpMargin = current.sales ? current.grossProfit / current.sales * 100 : 0; const netMargin = current.sales ? netProfit / current.sales * 100 : 0;
  const debt = customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.balance) || 0), 0);
  const stockCost = current.sales - current.grossProfit;
  const previousStockCost = previous ? previous.sales - previous.grossProfit : 0;
  const monthTransactions = useMemo(() => transactions.filter(row => row.transaction_date.startsWith(selectedMonth) && row.included_in_management), [transactions, selectedMonth]);
  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return monthTransactions.filter(row => (category === "All" || row.category === category) && (!query || [row.nominal_code, row.nominal_name, row.reference, row.details, row.transaction_number].some(value => (value || "").toLowerCase().includes(query))));
  }, [monthTransactions, category, search]);
  const categories = [
    { name: "Staff", value: current.staff, previous: previous?.staff || 0 }, { name: "Premises", value: current.premises, previous: previous?.premises || 0 },
    { name: "Vehicles", value: current.vehicles, previous: previous?.vehicles || 0 }, { name: "Admin / tech", value: current.admin, previous: previous?.admin || 0 },
    { name: "Finance", value: current.finance, previous: previous?.finance || 0 }
  ];

  const requestAi = async () => {
    setAiBusy(true); setAiNote("");
    try {
      const response = await fetch("/api/finance-insights", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ current, previous, largestTransactions: monthTransactions.slice().sort((a, b) => Math.abs(b.normalized_cost) - Math.abs(a.normalized_cost)).slice(0, 15) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI analysis is not configured yet.");
      setAiInsights(body.insights); setAiNote("AI analysis generated from the Sage totals shown on this page.");
    } catch (problem: any) { setAiInsights(null); setAiNote(`${problem.message} Showing the built-in financial checks instead.`); }
    setAiBusy(false);
  };

  return <main className="fb-shell">
    <aside className="fb-side"><div><div className="fb-brand">FINANCE<br /><span>BLUEPRINT</span></div><p>Sage command centre</p></div>
      <nav><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button><button className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}>Management accounts</button><button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>Stock valuation</button><button className={tab === "close" ? "active" : ""} onClick={() => setTab("close")}>Month-end close</button><button className={tab === "costs" ? "active" : ""} onClick={() => setTab("costs")}>Monthly costs</button><button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>Sage transactions</button></nav>
      <div className="fb-account">Read-only Sage view<br /><span>{session.user.email}</span><button onClick={() => supabase.auth.signOut()}>Sign out</button></div>
    </aside>
    <section className="fb-main">
      <header className="fb-top"><div><div className="fb-eyebrow">N&amp;J WHOLESALE</div><h1>{{ overview: "Financial overview", accounts: "Management accounts", stock: "Stock valuation", close: "Month-end close", costs: "Monthly cost control", transactions: "Sage cost transactions" }[tab]}</h1><p>Financial year from 1 April 2026 · refreshed from the read-only Sage Bridge</p></div><div className="fb-period"><label>Reporting month<select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setAiInsights(null); }}>{months.map(month => <option key={month.key} value={month.key}>{monthName(month.key)}{month.key === todayKey() ? " (part month)" : ""}</option>)}</select></label></div></header>
      {error && <div className="fb-banner error">{error}</div>}{loading && <div className="fb-banner">Refreshing Sage figures…</div>}

      {tab === "overview" && <>
        <section className="fb-kpis"><Kpi label="Sales" value={money(current.sales)} sub={previous ? `${pct(changePct(current.sales, previous.sales))} vs ${monthName(previous.key)}` : "First connected month"} /><Kpi label="Gross profit" value={money(current.grossProfit)} sub={`${gpMargin.toFixed(1)}% GP margin`} /><Kpi label="Running costs" value={money(current.runningCosts)} sub={previous ? `${pct(changePct(current.runningCosts, previous.runningCosts))} vs previous month` : "Sage management basis"} bad={!!previous && current.runningCosts > previous.runningCosts} /><Kpi label="Stock cost" value={money(stockCost)} sub={previous ? `${pct(changePct(stockCost, previousStockCost))} vs previous month · sales less gross profit` : "Sales less gross profit"} /><Kpi label="Management profit" value={money(netProfit)} sub={`${netMargin.toFixed(1)}% net margin`} bad={netProfit < 0} /><Kpi label="Customer debt" value={money(debt)} sub={`${customers.filter(c => Number(c.balance) > 0).length} accounts with a balance`} /></section>
        <section className="fb-two">
          <div className="fb-card"><div className="fb-card-head"><div><div className="fb-eyebrow">AI FINANCE INSIGHTS</div><h2>What changed and what to watch</h2></div><button className="fb-primary" onClick={requestAi} disabled={aiBusy}>{aiBusy ? "Analysing…" : "Run AI analysis"}</button></div>
            <div className="fb-insights">{displayedInsights.map((insight, index) => <article key={`${insight.title}-${index}`} className={`fb-insight ${insight.level}`}><span>{insight.level === "priority" ? "!" : insight.level === "positive" ? "✓" : insight.level === "watch" ? "↑" : "i"}</span><div><h3>{insight.title}</h3><p>{insight.detail}</p></div></article>)}</div>
            {aiNote && <div className="fb-note">{aiNote}</div>}<div className="fb-note">AI explains the Sage figures; it does not change transactions or replace accounting review.</div>
          </div>
          <div className="fb-card"><div className="fb-eyebrow">MONTHLY PROFIT PATH</div><h2>Since April 2026</h2><div className="fb-month-list">{months.map(month => { const net = month.grossProfit - month.runningCosts; return <button key={month.key} className={month.key === selectedMonth ? "selected" : ""} onClick={() => { setSelectedMonth(month.key); setAiInsights(null); }}><span>{monthName(month.key)}</span><b className={net < 0 ? "negative" : ""}>{money(net)}</b><small>{month.sales ? `${(net / month.sales * 100).toFixed(1)}% net margin` : "No sales posted"}</small></button>; })}</div></div>
        </section>
      </>}

      {tab === "costs" && <section className="fb-card"><div className="fb-card-head"><div><div className="fb-eyebrow">COST MOVEMENT</div><h2>{monthName(current.key)} against {previous ? monthName(previous.key) : "baseline"}</h2></div><div className="fb-total">Total <strong>{money(current.runningCosts)}</strong></div></div>
        <div className="fb-table-wrap"><table><thead><tr><th>Cost area</th><th>Current month</th><th>Previous month</th><th>£ movement</th><th>% movement</th><th>% of sales</th><th>Signal</th></tr></thead><tbody>{categories.map(item => { const delta = item.value - item.previous; const movement = changePct(item.value, item.previous); const signal = delta > 500 && movement > 10 ? "Investigate" : delta > 100 && movement > 10 ? "Watch" : delta < -100 ? "Improving" : "Stable"; return <tr key={item.name}><td><b>{item.name}</b></td><td>{GBP2.format(item.value)}</td><td>{GBP2.format(item.previous)}</td><td className={delta > 0 ? "negative" : delta < 0 ? "positive-text" : ""}>{delta >= 0 ? "+" : ""}{GBP2.format(delta)}</td><td>{item.previous ? pct(movement) : "—"}</td><td>{current.sales ? `${(item.value / current.sales * 100).toFixed(1)}%` : "—"}</td><td><span className={`fb-signal ${signal.toLowerCase()}`}>{signal}</span></td></tr>; })}</tbody></table></div>
        <div className="fb-note">A monthly increase is a prompt to investigate, not automatically a saving opportunity. Timing differences, quarterly bills and credits can move between months.</div>
      </section>}

      {(tab === "accounts" || tab === "stock" || tab === "close") && <ManagementAccountsLayer session={session} selectedMonth={selectedMonth} current={current} debt={debt} view={tab} />}

      {tab === "transactions" && <section className="fb-card"><div className="fb-card-head"><div><div className="fb-eyebrow">AUDITABLE DRILL-DOWN</div><h2>Individual Sage cost entries</h2></div><div className="fb-total">Filtered <strong>{money(filteredTransactions.reduce((sum, row) => sum + Number(row.normalized_cost || 0), 0))}</strong></div></div>
        <div className="fb-filters"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier, reference, description or nominal…" /><select value={category} onChange={e => setCategory(e.target.value)}><option>All</option><option>Staff</option><option>Premises</option><option>Vehicles</option><option>Admin / tech</option><option>Finance</option></select></div>
        <div className="fb-table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Nominal</th><th>Reference / details</th><th>Type</th><th>Cost</th></tr></thead><tbody>{filteredTransactions.map(row => <tr key={row.cost_key}><td>{new Date(`${row.transaction_date}T12:00:00`).toLocaleDateString("en-GB")}</td><td>{row.category}</td><td><b>{row.nominal_code}</b><small>{row.nominal_name || ""}</small></td><td>{row.reference || row.details || row.transaction_number || "—"}{row.reference && row.details && <small>{row.details}</small>}</td><td>{row.type || "—"}</td><td><b>{GBP2.format(row.normalized_cost)}</b></td></tr>)}</tbody></table></div>{!filteredTransactions.length && <div className="fb-empty">No matching Sage cost entries for this month.</div>}
      </section>}
    </section>
  </main>;
}

function Kpi({ label, value, sub, bad = false }: { label: string; value: string; sub: string; bad?: boolean }) {
  return <article className="fb-kpi"><div>{label}</div><strong className={bad ? "negative" : ""}>{value}</strong><small>{sub}</small></article>;
}
