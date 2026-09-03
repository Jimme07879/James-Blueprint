"use client";

import { useEffect } from "react";

const HIDE_LABELS = ["proof", "vault", "ceo", "me"];

function textOf(el: Element | null) {
  return (el?.textContent || "").trim().toLowerCase();
}

function hideRemovedNavigation() {
  document.querySelectorAll<HTMLElement>("nav button, nav a").forEach((item) => {
    if (HIDE_LABELS.includes(textOf(item))) item.style.display = "none";
  });
}

function wireDailyPriorityDone() {
  if (window.location.pathname !== "/") return;
  document.querySelectorAll<HTMLElement>(".todayItem").forEach((row) => {
    const detail = Array.from(row.querySelectorAll<HTMLElement>(".muted.small"))
      .find((el) => textOf(el).startsWith("daily") && textOf(el).includes("daily priority"));
    if (!detail || row.dataset.dailyDoneWired === "1") return;
    row.dataset.dailyDoneWired = "1";

    const actions = row.querySelector<HTMLElement>(".todayActions");
    const title = row.querySelector<HTMLElement>("strong")?.textContent?.trim();
    if (!actions || !title) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn primary";
    button.textContent = "Done";
    button.addEventListener("click", () => {
      const key = `blueprint-daily-priority-done:${new Date().toISOString().slice(0,10)}:${title}`;
      localStorage.setItem(key, "1");
      row.remove();
    });
    actions.prepend(button);

    const key = `blueprint-daily-priority-done:${new Date().toISOString().slice(0,10)}:${title}`;
    if (localStorage.getItem(key) === "1") row.remove();
  });
}

function wireBrokenPromisePaid() {
  if (window.location.pathname !== "/debtors") return;
  document.querySelectorAll<HTMLElement>("button").forEach((row) => {
    const alert = Array.from(row.querySelectorAll<HTMLElement>("small,p")).find((el) => textOf(el).includes("broken promise"));
    if (!alert || row.dataset.blueprintBrokenPaid === "1") return;
    row.dataset.blueprintBrokenPaid = "1";
    const paid = document.createElement("button");
    paid.type = "button";
    paid.textContent = "Paid";
    paid.style.marginLeft = "10px";
    paid.style.padding = "5px 10px";
    paid.style.borderRadius = "999px";
    paid.style.border = "1px solid rgba(212,175,55,.55)";
    paid.style.background = "rgba(212,175,55,.14)";
    paid.style.fontWeight = "700";
    paid.style.cursor = "pointer";
    paid.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation(); row.click();
      window.setTimeout(() => {
        const globalPaid = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => {
          const t = textOf(b); return b !== paid && (t === "paid" || t.includes("marked paid") || t.includes("mark paid"));
        });
        globalPaid?.click();
      }, 120);
    });
    alert.insertAdjacentElement("afterend", paid);
  });
}

export default function BlueprintTidyPatch() {
  useEffect(() => {
    let scheduled = false;
    const apply = () => { scheduled = false; hideRemovedNavigation(); wireDailyPriorityDone(); wireBrokenPromisePaid(); };
    const schedule = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(apply); };
    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("focus", schedule);
    return () => { observer.disconnect(); window.removeEventListener("focus", schedule); };
  }, []);
  return null;
}
