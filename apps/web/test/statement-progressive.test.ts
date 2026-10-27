import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { act, createElement as h } from "react";
import { NextIntlClientProvider as IntlProvider } from "next-intl";
import { DEFAULT_HOME_LAYOUT } from "@packages/shared/home";
import messages from "@packages/shared/i18n/messages/en";
import type { ApiRequest } from "../../../packages/app/src/api";
import type { Wallet, WalletError } from "@packages/shared/wallets";

test("data pages render independent responses and isolate loading and failures", async (t) => {
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
    HTMLFormElement: window.HTMLFormElement, HTMLInputElement: window.HTMLInputElement,
    HTMLButtonElement: window.HTMLButtonElement, HTMLSelectElement: window.HTMLSelectElement,
    Event: window.Event, CustomEvent: window.CustomEvent, DocumentFragment: window.DocumentFragment, ResizeObserver: window.ResizeObserver,
    Element: window.Element, Node: window.Node, NodeList: window.NodeList, SVGElement: window.SVGElement,
    requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window), MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true });
  // Happy DOM cancels WAAPI promises differently from browsers; use Motion's JS fallback.
  Object.defineProperty(window.Element.prototype, "animate", { value: undefined, configurable: true });
  const { createRoot } = await import("react-dom/client");
  const { ApiProvider } = await import("../../../packages/app/src/api");
  const { WalletProvider } = await import("../../../packages/app/src/wallets");
  const { AppNavigationProvider } = await import("../../../packages/app/src/navigation");
  const { StatementScreen } = await import("../../../packages/app/src/screens/statement");
  const { HomeScreen } = await import("../../../packages/app/src/screens/home");
  const { AccountsScreen } = await import("../../../packages/app/src/screens/accounts");
  const { PlanningScreen } = await import("../../../packages/app/src/screens/planning");
  const { RulesScreen } = await import("../../../packages/app/src/screens/rules");
  const { CardScreen } = await import("../../../packages/app/src/screens/card");
  const { AccountClientProvider } = await import("../../../packages/app/src/accounts");
  const wallet: Wallet = { id: "00000000-0000-4000-8000-000000000001", name: "Synthetic wallet",
    currencyCode: "EUR", currencyLocked: true, role: "VIEWER", version: 1 };
  const entry = { id: "00000000-0000-4000-8000-000000000002", type: "INCOME", status: "PAID",
    description: "Synthetic progressive entry", amountMinor: 12345, transactionDate: "2026-10-27",
    accountId: null, creditCardId: null, invoiceId: null, categoryId: null, notes: null,
    linkedTransactionId: null, counterpartAccountId: null, installmentNumber: null,
    installmentTotal: null, tagIds: [], recurrenceId: null, version: 1 };
  const rows = { entries: [entry] };
  const summary = { summary: { incomeMinor: 12345, expenseMinor: 0, pendingIncomeMinor: 500,
    pendingExpenseMinor: 0, accumulatedBalanceMinor: 12845, confirmedBalanceMinor: 12345, accumulatedPendingMinor: 500 } };
  async function mount(Screen: typeof HomeScreen, request: ApiRequest) {
    const unused = async () => ({ ok: false as const, error: "unavailable" as WalletError });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(h(IntlProvider, { locale: "en", timeZone: "UTC", messages, children:
      h(WalletProvider, { client: { create: unused, update: unused, archive: unused }, initialWallets: [wallet],
        initialCurrentId: wallet.id, onCurrentChange: () => {}, children:
        h(AppNavigationProvider, { pathname: "/app", Link: ({ href, children }) => h("a", { href }, children), children:
          h(AccountClientProvider, { client: { list: () => new Promise<never>(() => {}), create: unused, update: unused, archive: unused, restore: unused }, children:
            h(ApiProvider, { request, children: h(Screen) }) }) }) }) })));
    return { container, close: async () => { await act(async () => root.unmount()); container.remove(); } };
  }
  await t.test("Statement applies cross-month and single-day ranges, rejects reversed dates, and returns to months", async () => {
    const urls: string[] = [];
    const request = ((_method, url) => {
      if (url.includes("/transactions/")) { urls.push(url); return Promise.resolve({ ok: true, value: url.includes("/summary?") ? summary : rows }); }
      return new Promise(() => {});
    }) as ApiRequest;
    const screen = await mount(StatementScreen, request);
    const button = (label: string) => [...screen.container.querySelectorAll("button")].find(item => item.textContent === label)!;
    const apply = async (from: string, to: string) => {
      await act(async () => button(messages.app.entries.period.custom).click());
      screen.container.querySelector<HTMLInputElement>('[name="from"]')!.value = from;
      screen.container.querySelector<HTMLInputElement>('[name="to"]')!.value = to;
      await act(async () => screen.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    };
    try {
      await apply("2026-11-15", "2026-12-15");
      assert.equal(urls.filter(url => url.includes("from=2026-11-15&to=2026-12-15")).length, 2);
      assert.match(screen.container.textContent ?? "", /Dec 15, 2026/);
      await apply("2026-12-15", "2026-11-15");
      assert.ok(screen.container.textContent?.includes(messages.app.entries.period.invalid));
      assert.equal(urls.length, 4); // Invalid drafts never fetch or replace the applied interval.
      screen.container.querySelector<HTMLInputElement>('[name="from"]')!.value = "2026-11-15";
      screen.container.querySelector<HTMLInputElement>('[name="to"]')!.value = "2026-11-15";
      await act(async () => screen.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      assert.equal(urls.filter(url => url.includes("from=2026-11-15&to=2026-11-15")).length, 2);
      await act(async () => button(messages.app.entries.period.custom).click());
      await act(async () => button(messages.app.entries.period.month).click());
      assert.equal(urls.filter(url => url.includes("from=2026-11-01&to=2026-11-30")).length, 2);
    } finally { await screen.close(); }
  });
  await t.test("Date picker selects a leap day and returns focus to its trigger", async () => {
    const { DatePicker } = await import("../../../packages/ui/src/components/date-picker");
    const Picker = () => h(DatePicker, { id: "synthetic-date", name: "synthetic-date", defaultValue: "2028-02-28", locale: "en", label: "Synthetic date", todayLabel: "Today" });
    const screen = await mount(Picker, (() => new Promise(() => {})) as ApiRequest);
    try {
      const trigger = screen.container.querySelector<HTMLButtonElement>("#synthetic-date")!;
      await act(async () => trigger.click());
      const leapDay = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "29");
      assert.ok(leapDay);
      await act(async () => leapDay.click());
      assert.equal(screen.container.querySelector<HTMLInputElement>('[name="synthetic-date"]')!.value, "2028-02-29");
      assert.equal(trigger.getAttribute("aria-expanded"), "false");
      assert.equal(document.activeElement, trigger);
    } finally { await screen.close(); }
  });
  await t.test("App window minimizes and restores without remounting its content", async () => {
    const { AppShell } = await import("../../../packages/app/src/app-shell");
    const Shell = () => h(AppShell, { allowMinimize: true, minimizedBackground: h("div", { "data-testid": "public-home" }, h("a", { href: "/app" }, "Open app")), children: h("input", { "aria-label": "Synthetic draft", defaultValue: "Preserved draft" }) });
    const screen = await mount(Shell, (() => new Promise(() => {})) as ApiRequest);
    try {
      const input = screen.container.querySelector<HTMLInputElement>('input[aria-label="Synthetic draft"]')!;
      const minimize = screen.container.querySelector<HTMLButtonElement>('button[aria-label="Minimize"]')!;
      const zoom = screen.container.querySelector<HTMLButtonElement>('button[aria-label="Maximize window"]')!;
      zoom.focus();
      await act(async () => zoom.click());
      assert.ok(!screen.container.querySelector('[data-slot="app-background"]'));
      assert.equal(zoom.getAttribute("aria-label"), "Restore window size");
      assert.equal(document.activeElement, zoom);
      assert.equal(screen.container.querySelector('input[aria-label="Synthetic draft"]'), input);
      await act(async () => zoom.click());
      assert.ok(screen.container.querySelector('[data-slot="app-background"]'));
      assert.equal(zoom.getAttribute("aria-label"), "Maximize window");
      minimize.focus();
      await act(async () => minimize.click());
      assert.ok(screen.container.querySelector('[inert][aria-hidden="true"]'));
      const restore = screen.container.querySelector<HTMLButtonElement>('button[aria-label="Restore window"]')!;
      assert.ok(restore);
      assert.ok(screen.container.querySelector('[data-testid="public-home"]'));
      assert.equal(document.activeElement, restore);
      await act(async () => restore.click());
      assert.equal(screen.container.querySelector('input[aria-label="Synthetic draft"]'), input);
      assert.equal(input.value, "Preserved draft");
      assert.equal(document.activeElement, minimize);
      assert.ok(!screen.container.querySelector('[aria-hidden="true"][style*="pointer-events: none"]'));
      assert.equal(screen.container.querySelector('[data-slot="app-background"]')?.getAttribute("aria-hidden"), "true");
      await act(async () => minimize.click());
      await act(async () => screen.container.querySelector<HTMLAnchorElement>('[data-testid="public-home"] a')!.click());
      assert.ok(!screen.container.querySelector('[aria-hidden="true"][style*="pointer-events: none"]'));
      assert.equal(screen.container.querySelector('input[aria-label="Synthetic draft"]'), input);
    } finally { await screen.close(); }
  });
  await t.test("Shared shell does not enable web minimization by default", async () => {
    const { AppShell } = await import("../../../packages/app/src/app-shell");
    const Shell = () => h(AppShell, { minimizedBackground: h("div", { "data-testid": "web-only-background" }), children: h("p", null, "Native content") });
    const screen = await mount(Shell, (() => new Promise(() => {})) as ApiRequest);
    try {
      const light = screen.container.querySelector<HTMLButtonElement>('button[aria-label="Minimize"]')!;
      assert.equal(light.getAttribute("aria-hidden"), "true");
      await act(async () => light.click());
      assert.ok(!screen.container.querySelector('[data-slot="app-background"]'));
      assert.ok(!screen.container.querySelector('button[aria-label="Restore window"]'));
      assert.ok(screen.container.textContent?.includes("Native content"));
    } finally { await screen.close(); }
  });
  for (const first of ["summary", "entries"] as const) {
    for (const failFirst of [false, true]) {
      await t.test(`${first} ${failFirst ? "fails" : "finishes"} while the other request is pending`, async () => {
        const pending = { summary: Promise.withResolvers<unknown>(), entries: Promise.withResolvers<unknown>() };
        const calls = { summary: 0, entries: 0 };
        const request = ((_method, url) => {
          if (url.includes("/transactions/summary?")) {
            calls.summary++;
            return calls.summary === 1 ? pending.summary.promise : Promise.resolve({ ok: true, value: summary });
          }
          if (url.includes("/transactions/entries?")) {
            calls.entries++;
            return calls.entries === 1 ? pending.entries.promise : Promise.resolve({ ok: true, value: rows });
          }
          return new Promise(() => {});
        }) as ApiRequest;
        const unused = async () => ({ ok: false as const, error: "unavailable" as WalletError });
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);
        try {
          await act(async () => root.render(h(IntlProvider, { locale: "en", timeZone: "UTC", messages, children:
            h(WalletProvider, { client: { create: unused, update: unused, archive: unused },
              initialWallets: [wallet], initialCurrentId: wallet.id, onCurrentChange: () => {}, children:
              h(AppNavigationProvider, { pathname: "/app/statement", Link: ({ href, children }) => h("a", { href }, children), children:
                h(ApiProvider, { request, children: h(StatementScreen) }) }) }) })));
          assert.equal(container.querySelectorAll('[role="status"][aria-busy="true"]').length, 2);
          await act(async () => pending[first].resolve(failFirst ? { ok: false, error: "unavailable" }
            : { ok: true, value: first === "summary" ? summary : rows }));
          assert.equal(container.querySelectorAll('[role="status"][aria-busy="true"]').length, 1);
          const text = container.textContent ?? "";
          assert.equal(text.includes(first === "summary" ? "Accumulated result" : entry.description), !failFirst);
          if (first === "summary" && !failFirst) assert.match(text, /128.45/); // Includes pending income in the headline.
          const second = first === "summary" ? "entries" : "summary";
          await act(async () => pending[second].resolve({ ok: true, value: second === "summary" ? summary : rows }));
          assert.equal(container.querySelectorAll('[role="status"][aria-busy="true"]').length, 0);
          assert.ok(container.textContent?.includes(second === "summary" ? "Accumulated result" : entry.description));
          if (failFirst) {
            assert.ok(container.textContent?.includes(first === "summary" ? messages.app.entries.summaryLoadError : messages.app.entries.loadError));
            const retry = [...container.querySelectorAll("button")].find(button => button.textContent === messages.app.entries.retry);
            assert.ok(retry);
            await act(async () => retry.click());
            assert.equal(calls[first], 2);
            assert.equal(calls[second], 1); // Retry never reloads the successful block.
            assert.ok(container.textContent?.includes(entry.description));
            assert.ok(container.textContent?.includes("Accumulated result"));
          } else {
            const previous = container.querySelector<HTMLButtonElement>(`button[aria-label="${messages.app.entries.previousMonth}"]`);
            assert.ok(previous);
            await act(async () => previous.click());
            assert.deepEqual(calls, { summary: 2, entries: 2 });
          }
        } finally {
          await act(async () => root.unmount());
          container.remove();
        }
      });
    }
  }
  for (const first of ["summary", "entries"] as const) {
    await t.test(`Home displays ${first} without waiting for the other blocks`, async () => {
      const pending = Promise.withResolvers<unknown>();
      const request = ((_method, url) => url.endsWith("/home/layout") ? Promise.resolve({ ok: true, value: { widgets: DEFAULT_HOME_LAYOUT, customized: false } }) : url.includes(`/transactions/${first}?`) ? pending.promise : new Promise(() => {})) as ApiRequest;
      const screen = await mount(HomeScreen, request);
      try {
        assert.ok(screen.container.querySelector('[aria-busy="true"]'));
        assert.ok(!screen.container.textContent?.includes(messages.app.entries.empty));
        await act(async () => pending.resolve({ ok: true, value: first === "summary" ? summary : rows }));
        assert.ok(screen.container.textContent?.includes(first === "summary" ? "128.45" : entry.description));
        assert.ok(screen.container.querySelector('[aria-busy="true"]')); // Other blocks remain pending.
        assert.ok(screen.container.textContent?.includes(messages.app.home.charts.balance.title));
        assert.ok(screen.container.textContent?.includes(messages.app.home.charts.cashflow.title));
      } finally { await screen.close(); }
    });
  }
  await t.test("Accounts starts cards before the account list is ready", async () => {
    const pending = Promise.withResolvers<unknown>();
    let cardsRequested = false;
    const request = ((_method, url) => {
      if (url.endsWith("/cards")) { cardsRequested = true; return pending.promise; }
      return new Promise(() => {});
    }) as ApiRequest;
    const screen = await mount(AccountsScreen, request);
    try {
      assert.ok(cardsRequested);
      await act(async () => pending.resolve({ ok: true, value: { cards: [{ id: "synthetic-card", name: "Synthetic independent card",
        paymentAccountId: "synthetic-account", brand: "VISA", limitMinor: 10000, usedMinor: 1000,
        closingDay: 15, dueDay: 5, color: "blue", currentInvoice: null, archived: false, version: 1,
        nextInvoice: { id: "next", referenceYear: 2026, referenceMonth: 10, dueDate: "2026-11-05", totalMinor: 1000 },
        overdueMinor: 0, overdueCount: 0, overdueInvoice: null,
        nextForecast: { dueDate: "2026-12-05", amountMinor: 2000 },
      }] } }));
      assert.ok(screen.container.textContent?.includes("Synthetic independent card"));
      assert.ok(screen.container.textContent?.includes(messages.app.cards.nextInvoice));
      assert.ok(screen.container.querySelector('a[href$="?month=2026-10"]'));
      assert.ok(!screen.container.textContent?.includes(messages.app.patrimony.netWorth));
      assert.ok(screen.container.querySelector('a[href="/app/accounts/patrimony"]'));
      assert.ok(screen.container.querySelector('[aria-busy="true"]'));
    } finally { await screen.close(); }
  });
  await t.test("Planning renders amounts before category metadata arrives", async () => {
    const pending = Promise.withResolvers<unknown>();
    const request = ((_method, url) => url.includes("/budget/") ? pending.promise : new Promise(() => {})) as ApiRequest;
    const screen = await mount(PlanningScreen, request);
    try {
      assert.ok(screen.container.querySelector('[aria-busy="true"]'));
      await act(async () => pending.resolve({ ok: true, value: { month: "2026-10", items: [{ id: "synthetic-budget",
        categoryId: "synthetic-category", amountMinor: 12345, spentMinor: 1000, alertPercentage: 80, version: 1 }], unbudgetedSpentMinor: 0 } }));
      assert.ok(screen.container.textContent?.includes("123.45"));
    } finally { await screen.close(); }
  });
  await t.test("Rules exposes a recoverable error instead of an empty or endless loading state", async () => {
    const pending = Promise.withResolvers<unknown>();
    const request = ((_method, url) => url.endsWith("/rules") ? pending.promise : new Promise(() => {})) as ApiRequest;
    const screen = await mount(RulesScreen, request);
    try {
      assert.ok(screen.container.querySelector('[aria-busy="true"]'));
      await act(async () => pending.resolve({ ok: false, error: "unavailable" }));
      assert.ok(screen.container.querySelector('[role="alert"]'));
      assert.ok(!screen.container.querySelector('[aria-busy="true"]'));
    } finally { await screen.close(); }
  });
  for (const first of ["summary", "purchases"] as const) {
    await t.test(`Invoice displays ${first} while the other part is pending`, async () => {
      const pending = Promise.withResolvers<unknown>();
      const request = ((_method, url) => {
        if (url.endsWith("/cards")) return Promise.resolve({ ok: true, value: { cards: [{ id: "synthetic-card",
          name: "Synthetic invoice card", paymentAccountId: "synthetic-account", brand: "VISA", limitMinor: 10000,
          usedMinor: 12345, closingDay: 15, dueDay: 5, color: "blue", currentInvoice: null, archived: false, version: 1 }] } });
        if (url.endsWith(`?part=${first}`)) return pending.promise;
        return new Promise(() => {});
      }) as ApiRequest;
      const screen = await mount(() => h(CardScreen, { cardId: "synthetic-card" }), request);
      try {
        assert.equal(screen.container.querySelectorAll('[aria-busy="true"]').length, 2);
        const invoice = { id: "synthetic-invoice", creditCardId: "synthetic-card", referenceYear: 2026, referenceMonth: 10,
          openingDate: "2026-09-16", closingDate: "2026-10-15", dueDate: "2026-11-05", state: "OPEN",
          totalMinor: 98765, paymentTransactionId: null, version: 1 };
        await act(async () => pending.resolve({ ok: true, value: first === "summary" ? { invoice } : { purchases: [entry] } }));
        assert.ok(screen.container.textContent?.includes(first === "summary" ? "987.65" : entry.description));
        assert.equal(screen.container.querySelectorAll('[aria-busy="true"]').length, 1);
      } finally { await screen.close(); }
    });
  }
  await window.happyDOM.close();
});
