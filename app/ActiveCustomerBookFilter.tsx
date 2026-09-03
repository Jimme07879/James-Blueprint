"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SageCustomerRow = {
  account_ref: string;
  name?: string | null;
  balance?: number | null;
  credit_limit?: number | null;
  telephone?: string | null;
  email?: string | null;
};

export default function ActiveCustomerBookFilter() {
  const [activeCustomers, setActiveCustomers] = useState<SageCustomerRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const from = cutoff.toISOString().slice(0, 10);

      // Pull the full 90-day sales activity in pages so PostgREST row caps cannot
      // silently truncate the active-customer set.
      const activeRefs = new Set<string>();
      const pageSize = 1000;
      for (let start = 0; ; start += pageSize) {
        const { data, error } = await supabase
          .from("sage_transactions")
          .select("account_ref")
          .gte("transaction_date", from)
          .in("type", ["SI", "SC"])
          .range(start, start + pageSize - 1);

        if (error) break;
        const rows = data || [];
        rows.forEach((row: any) => {
          const ref = String(row.account_ref || "").trim();
          if (ref) activeRefs.add(ref);
        });
        if (rows.length < pageSize) break;
      }

      // The original Sage Live screen only renders customers.slice(0,250), which
      // cuts the alphabet off. Load the complete synced customer book here and
      // rebuild the visible table from the active references instead.
      const { data: customers } = await supabase
        .from("sage_customers")
        .select("account_ref,name,balance,credit_limit,telephone,email")
        .order("name", { ascending: true })
        .limit(2000);

      if (cancelled) return;
      const active = ((customers || []) as SageCustomerRow[]).filter((row) =>
        activeRefs.has(String(row.account_ref || "").trim())
      );
      setActiveCustomers(active);
    };

    load();
    const timer = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!activeCustomers) return;

    let scheduled = false;
    const money = (value: any) =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(Number(value) || 0);

    const apply = () => {
      scheduled = false;
      const tableWrap = document.querySelector<HTMLElement>(".sageCustomerTable");
      const tbody = tableWrap?.querySelector<HTMLTableSectionElement>("tbody");
      if (!tableWrap || !tbody) return;

      const signature = activeCustomers
        .map((c) => String(c.account_ref || "").trim())
        .join("|");
      if (tbody.dataset.activeCustomerSignature !== signature) {
        tbody.innerHTML = "";
        activeCustomers.forEach((customer) => {
          const tr = document.createElement("tr");
          const values = [
            String(customer.account_ref || "").trim(),
            customer.name || "—",
            money(customer.balance),
            money(customer.credit_limit),
            customer.telephone || "—",
            customer.email || "—",
          ];

          values.forEach((value, index) => {
            const td = document.createElement("td");
            if (index === 1) {
              const strong = document.createElement("strong");
              strong.textContent = String(value);
              td.appendChild(strong);
            } else {
              td.textContent = String(value);
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        tbody.dataset.activeCustomerSignature = signature;
      }

      const card = tableWrap.closest<HTMLElement>(".card");
      const heading = card?.querySelector<HTMLElement>("h2");
      if (heading) heading.textContent = "Sage customer book · active only";

      let note = card?.querySelector<HTMLElement>("[data-active-customer-note='1']");
      if (!note && card) {
        note = document.createElement("div");
        note.dataset.activeCustomerNote = "1";
        note.className = "muted small";
        note.style.marginTop = "8px";
        const head = card.querySelector(".goalHeader");
        head?.insertAdjacentElement("afterend", note);
      }
      if (note) {
        note.textContent = `Showing ${activeCustomers.length} customers with Sage sales activity in the last 90 days · full A–Z list.`;
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeCustomers]);

  return null;
}
