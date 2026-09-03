"use client";

import { useEffect } from "react";

const HIDE_LABELS = ["proof", "vault", "ceo", "me"];

function normalise(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function clickFirstMatchingAction(card: HTMLElement, labels: string[]) {
  const buttons = Array.from(
    card.querySelectorAll<HTMLElement>("button, [role='button'], a")
  );
  const match = buttons.find((button) =>
    labels.some((label) => normalise(button.textContent).includes(label))
  );
  match?.click();
  return Boolean(match);
}

function addActionButton(
  row: HTMLElement,
  text: string,
  onClick: (button: HTMLButtonElement) => void
) {
  if (row.querySelector(`[data-blueprint-action='${text.toLowerCase()}']`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.dataset.blueprintAction = text.toLowerCase();
  button.style.marginLeft = "12px";
  button.style.padding = "7px 12px";
  button.style.borderRadius = "999px";
  button.style.border = "1px solid rgba(212,175,55,.5)";
  button.style.background = "rgba(212,175,55,.12)";
  button.style.color = "inherit";
  button.style.fontWeight = "700";
  button.style.cursor = "pointer";
  button.addEventListener("click", () => onClick(button));
  row.appendChild(button);
}

function findSectionHeading(label: string) {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,[data-section-title],.sectionTitle,.cardTitle"
    )
  );
  return headings.find((el) => normalise(el.textContent) === label);
}

function closestPanel(el: HTMLElement | null) {
  return (
    el?.closest<HTMLElement>(
      "section, article, .card, .panel, [data-section], [data-page-section]"
    ) || null
  );
}

function hideRemovedSections() {
  for (const label of HIDE_LABELS) {
    const heading = findSectionHeading(label);
    const panel = closestPanel(heading || null);
    if (panel) panel.style.display = "none";
  }

  const navItems = Array.from(
    document.querySelectorAll<HTMLElement>("nav a, nav button, [role='navigation'] a, [role='navigation'] button")
  );
  navItems.forEach((item) => {
    const text = normalise(item.textContent);
    if (HIDE_LABELS.includes(text)) item.style.display = "none";
  });
}

function addDoneButtonsToToday() {
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,.sectionTitle,.cardTitle")
  ).find((el) => {
    const text = normalise(el.textContent);
    return text === "today" || text.includes("what should i do next");
  });

  const panel = closestPanel(heading || null);
  if (!panel) return;

  const rows = Array.from(
    panel.querySelectorAll<HTMLElement>("li, tr, .task, .taskRow, .actionItem, .listItem")
  ).filter((row) => {
    const text = normalise(row.textContent);
    return Boolean(text) && !text.includes("done");
  });

  rows.forEach((row) => {
    addActionButton(row, "Done", (button) => {
      const handled = clickFirstMatchingAction(row, ["complete", "done", "finish"]);
      if (!handled) {
        row.dataset.blueprintCompleted = "true";
        row.style.opacity = "0.5";
        row.style.textDecoration = "line-through";
      }
      button.disabled = true;
      button.textContent = "Done ✓";
    });
  });
}

function addPaidButtonsToBrokenPromises() {
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,.sectionTitle,.cardTitle")
  ).find((el) => normalise(el.textContent).includes("broken promise"));

  const panel = closestPanel(heading || null);
  if (!panel) return;

  const rows = Array.from(
    panel.querySelectorAll<HTMLElement>("li, tr, .task, .taskRow, .actionItem, .listItem")
  );

  rows.forEach((row) => {
    addActionButton(row, "Paid", (button) => {
      const handled = clickFirstMatchingAction(row, ["paid", "settled", "clear"]);
      if (!handled) {
        row.dataset.blueprintPaid = "true";
        row.style.opacity = "0.55";
      }
      button.disabled = true;
      button.textContent = "Paid ✓";
    });
  });
}

function limitOverdueInvoicesTo50() {
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,.sectionTitle,.cardTitle")
  ).find((el) => normalise(el.textContent).includes("overdue invoice"));
  const panel = closestPanel(heading || null);
  if (!panel) return;

  const rows = Array.from(panel.querySelectorAll<HTMLElement>("tbody tr, li, .invoiceRow"));
  rows.forEach((row, index) => {
    if (index >= 50) row.style.display = "none";
  });
}

function hideInactiveCustomerRows() {
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,.sectionTitle,.cardTitle")
  ).find((el) => normalise(el.textContent).includes("customer book"));
  const panel = closestPanel(heading || null);
  if (!panel) return;

  const rows = Array.from(panel.querySelectorAll<HTMLElement>("tbody tr, li, .customerRow"));
  rows.forEach((row) => {
    const text = normalise(row.textContent);
    if (
      text.includes("inactive") ||
      text.includes("closed") ||
      text.includes("archived") ||
      text.includes("disabled")
    ) {
      row.style.display = "none";
    }
  });
}

export default function BlueprintTidyPatch() {
  useEffect(() => {
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      hideRemovedSections();
      addDoneButtonsToToday();
      addPaidButtonsToBrokenPromises();
      limitOverdueInvoicesTo50();
      hideInactiveCustomerRows();
    };

    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("focus", scheduleApply);

    return () => {
      observer.disconnect();
      window.removeEventListener("focus", scheduleApply);
    };
  }, []);

  return null;
}
