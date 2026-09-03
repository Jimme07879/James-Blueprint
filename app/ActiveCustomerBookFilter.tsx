"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ActiveCustomerBookFilter() {
  const [activeRefs, setActiveRefs] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const from = cutoff.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("sage_transactions")
        .select("account_ref,type,transaction_date")
        .gte("transaction_date", from)
        .in("type", ["SI", "SC"])
        .limit(20000);

      if (cancelled) return;
      setActiveRefs(new Set((data || []).map((row: any) => String(row.account_ref || "").trim()).filter(Boolean)));
    };

    load();
    const timer = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!activeRefs) return;

    let scheduled = false;
    const apply = () => {
      scheduled = false;
      const table = document.querySelector<HTMLElement>(".sageCustomerTable");
      if (!table) return;

      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      rows.forEach((row) => {
        const ref = row.querySelector("td")?.textContent?.trim() || "";
        row.style.display = activeRefs.has(ref) ? "" : "none";
      });

      const card = table.closest<HTMLElement>(".card");
      const heading = card?.querySelector<HTMLElement>("h2");
      if (heading && !heading.textContent?.includes("active only")) heading.textContent = "Sage customer book · active only";

      let note = card?.querySelector<HTMLElement>("[data-active-customer-note='1']");
      if (!note && card) {
        note = document.createElement("div");
        note.dataset.activeCustomerNote = "1";
        note.className = "muted small";
        note.style.marginTop = "8px";
        note.textContent = `Showing ${activeRefs.size} customers with Sage sales activity in the last 90 days.`;
        const head = card.querySelector(".goalHeader");
        head?.insertAdjacentElement("afterend", note);
      } else if (note) {
        note.textContent = `Showing ${activeRefs.size} customers with Sage sales activity in the last 90 days.`;
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
  }, [activeRefs]);

  return null;
}
