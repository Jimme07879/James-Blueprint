"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

type Row = {
  tran_number: string;
  account_ref?: string | null;
  inv_ref?: string | null;
  due_date?: string | null;
  outstanding?: number | null;
  details?: string | null;
};

const gbp = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

export default function LiveOverdueInvoices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<HTMLElement | null>(null);

  const load = async () => {
    if (window.location.pathname !== "/debtors") return;
    setLoading(true);
    setError("");
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("sage_transactions")
      .select("tran_number,account_ref,inv_ref,due_date,outstanding,details")
      .lt("due_date", today)
      .gt("outstanding", 0)
      .order("due_date", { ascending: true })
      .limit(50);

    if (error) setError(error.message);
    else setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    if (window.location.pathname !== "/debtors") return;
    const findTarget = () => {
      const kpis = document.querySelector<HTMLElement>("main section");
      if (kpis) setTarget(kpis.parentElement);
    };
    findTarget();
    load();
    const timer = window.setInterval(load, 15 * 60 * 1000);
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.outstanding) || 0), 0), [rows]);

  if (!target || window.location.pathname !== "/debtors") return null;

  return createPortal(
    <section style={{ background: "#fff", border: "1px solid rgba(20,36,68,.12)", borderRadius: 18, padding: 18, marginTop: 16, boxShadow: "0 8px 28px rgba(20,36,68,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".12em", fontWeight: 800, color: "#7b6b2c" }}>LIVE FROM SAGE</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>50 oldest overdue invoices</h2>
          <div style={{ fontSize: 13, color: "#667085", marginTop: 4 }}>{rows.length} open invoices · {gbp(total)} outstanding in this list</div>
        </div>
        <button onClick={load} disabled={loading} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(20,36,68,.16)", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(20,36,68,.12)" }}>
              <th style={{ padding: "9px 8px" }}>Due</th>
              <th style={{ padding: "9px 8px" }}>A/C</th>
              <th style={{ padding: "9px 8px" }}>Invoice</th>
              <th style={{ padding: "9px 8px" }}>Details</th>
              <th style={{ padding: "9px 8px", textAlign: "right" }}>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.tran_number}-${row.account_ref || ""}`} style={{ borderBottom: "1px solid rgba(20,36,68,.07)" }}>
                <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>{row.due_date ? new Date(`${row.due_date}T12:00:00`).toLocaleDateString("en-GB") : "—"}</td>
                <td style={{ padding: "9px 8px", fontWeight: 700 }}>{row.account_ref || "—"}</td>
                <td style={{ padding: "9px 8px" }}>{row.inv_ref || row.tran_number}</td>
                <td style={{ padding: "9px 8px", color: "#667085" }}>{row.details || "—"}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 800 }}>{gbp(row.outstanding)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 18, color: "#667085" }}>No overdue open invoices found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>,
    target
  );
}
