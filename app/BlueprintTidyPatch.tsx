"use client";

import { useEffect } from "react";

const HIDE_LABELS = ["proof", "vault", "ceo", "me"];

function textOf(el: Element | null) {
  return (el?.textContent || "").trim().toLowerCase();
}

function addPillButton(container: HTMLElement, key: string, label: string, onClick: (button: HTMLButtonElement) => void) {
  if (container.querySelector(`[data-blueprint-action='${key}']`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.blueprintAction = key;
  button.className = "btn primary";
  button.style.marginLeft = "8px";
  button.addEventListener("click", () => onClick(button));
  container.appendChild(button);
}

function hideRemovedNavigation() {
  document.querySelectorAll<HTMLElement>("nav button, nav a").forEach((item) => {
    if (HIDE_LABELS.includes(textOf(item))) item.style.display = "none";
  });
}

function wireNextActionDone() {
  const card = document.querySelector<HTMLElement>(".nextActionCard");
  if (!card) return;
  const actions = card.querySelector<HTMLElement>(".actions");
  const title = card.querySelector<HTMLElement>("h2")?.textContent?.trim();
  if (!actions || !title) return;

  addPillButton(actions, "next-done", "Done", (button) => {
    const queueItems = Array.from(document.querySelectorAll<HTMLElement>(".todayItem"));
    const matching = queueItems.find((item) => item.querySelector("strong")?.textContent?.trim() === title);
    const done = matching
      ? Array.from(matching.querySelectorAll<HTMLButtonElement>("button")).find((b) => textOf(b) === "done")
      : undefined;

    if (done) {
      done.click();
      button.disabled = true;
      button.textContent = "Done ✓";
      return;
    }

    const storageKey = `blueprint-done:${new Date().toISOString().slice(0, 10)}:${title}`;
    localStorage.setItem(storageKey, "1");
    card.style.opacity = "0.55";
    button.disabled = true;
    button.textContent = "Done ✓";
  });

  const storageKey = `blueprint-done:${new Date().toISOString().slice(0, 10)}:${title}`;
  if (localStorage.getItem(storageKey) === "1") {
    card.style.opacity = "0.55";
    const doneButton = card.querySelector<HTMLButtonElement>("[data-blueprint-action='next-done']");
    if (doneButton) {
      doneButton.disabled = true;
      doneButton.textContent = "Done ✓";
    }
  }
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
      event.preventDefault();
      event.stopPropagation();
      row.click();
      window.setTimeout(() => {
        const actionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
        const globalPaid = actionButtons.find((b) => {
          const t = textOf(b);
          return t === "paid" || t.includes("marked paid") || t.includes("mark paid");
        });
        if (globalPaid && globalPaid !== paid) globalPaid.click();
      }, 80);
    });
    alert.insertAdjacentElement("afterend", paid);
  });
}

export default function BlueprintTidyPatch() {
  useEffect(() => {
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      hideRemovedNavigation();
      wireNextActionDone();
      wireBrokenPromisePaid();
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("focus", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("focus", schedule);
    };
  }, []);

  return null;
}
