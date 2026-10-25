"use client";

import * as React from "react";
import { PlusIcon, WalletIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { can } from "@packages/shared/roles";
import { monthRange, type EntryList } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useResource } from "../api";
import { CategoryBadge, useCategories, useCategoryLabel } from "../categories";
import { EntryDialog, type EntryEditing } from "../entry-form";
import { useTranslations } from "../i18n";
import { todayIso, useMoney } from "../money";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { CreateWalletDialog } from "../wallet-ui";
import { useWallets } from "../wallets";
import { EntryRow, isEditable, useWalletAccounts } from "./statement";

const STATEMENT_PATH = APP_ROUTES.find((route) => route.key === "statement")!.path;

export function HomeScreen() {
  const t = useTranslations("app.home");
  const { current } = useWallets();
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {current ? (
        <WalletHome key={current.id} wallet={current} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <WalletIcon className="size-8 text-primary" aria-hidden />
          <h2 className="text-[15px] font-semibold">{t("emptyTitle")}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">{t("emptyBody")}</p>
          <Button className="mt-2" onClick={() => setCreating(true)}>
            <PlusIcon />
            {t("createWallet")}
          </Button>
          <CreateWalletDialog open={creating} onOpenChange={setCreating} />
        </div>
      )}
    </div>
  );
}

function WalletHome({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.home");
  const entriesT = useTranslations("app.entries");
  const money = useMoney(wallet.currencyCode);
  const label = useCategoryLabel();
  const { Link } = useAppNavigation();
  const canEdit = can(wallet.role, "editEntries");
  const { accounts, names, reload: reloadAccounts } = useWalletAccounts(wallet.id);
  const { tree } = useCategories(wallet.id);
  const { from, to } = monthRange(todayIso().slice(0, 7));
  const month = useResource<EntryList>(`/api/wallets/${wallet.id}/transactions?from=${from}&to=${to}`);
  const [editing, setEditing] = React.useState<EntryEditing>(null);

  const balance = accounts?.reduce((sum, account) => sum + account.balanceMinor, 0) ?? null;
  const summary = month.state.status === "ready" ? month.state.value.summary : null;
  const entries = month.state.status === "ready" ? month.state.value.entries : [];

  // Expenses of the month by top-level category, largest first.
  const topExpenses = React.useMemo(() => {
    if (!tree) return [];
    const totals = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.categoryId || entry.status === "CANCELED") continue;
      if (entry.type !== "EXPENSE" && entry.type !== "CREDIT_CARD_PURCHASE") continue;
      if (entry.type === "EXPENSE" && entry.status !== "PAID") continue;
      const category = tree.byId.get(entry.categoryId);
      const topId = category?.parentId ?? entry.categoryId;
      totals.set(topId, (totals.get(topId) ?? 0) + entry.amountMinor);
    }
    return [...totals]
      .map(([id, amount]) => ({ category: tree.byId.get(id), amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [entries, tree]);
  const topMax = topExpenses[0]?.amount ?? 0;

  if (accounts && accounts.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{t("ready", { name: wallet.name })}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{t("balance")}</div>
          <div className={cn("text-2xl font-semibold tabular-nums", balance !== null && balance < 0 && "text-destructive")}>
            {balance === null ? "—" : money.format(balance)}
          </div>
          {canEdit && (
            <Button className="mt-3" size="sm" onClick={() => setEditing({ mode: "create" })} disabled={!accounts}>
              <PlusIcon />
              {entriesT("new")}
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{t("month")}</div>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
            <dt className="text-muted-foreground">{entriesT("income")}</dt>
            <dd className="text-right font-medium tabular-nums text-[#248a3d] dark:text-[#30d158]">
              {summary ? money.format(summary.incomeMinor) : "—"}
            </dd>
            <dt className="text-muted-foreground">{entriesT("expense")}</dt>
            <dd className="text-right font-medium tabular-nums text-destructive">{summary ? money.format(summary.expenseMinor) : "—"}</dd>
            <dt className="text-muted-foreground">{entriesT("result")}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {summary ? money.format(summary.incomeMinor - summary.expenseMinor) : "—"}
            </dd>
          </dl>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">{t("topExpenses")}</h2>
        {topExpenses.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("noExpenses")}</p>
        ) : (
          <ul className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
            {topExpenses.map(({ category, amount }) => (
              <li key={category?.id ?? "none"} className="flex items-center gap-3">
                <CategoryBadge category={category ?? null} className="size-6" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate">{category ? label(category) : ""}</span>
                    <span className="font-medium tabular-nums">{money.format(amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (amount / topMax) * 100)}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("recent")}</h2>
          <Link href={STATEMENT_PATH} className="text-[13px] text-primary hover:underline">
            {t("seeAll")}
          </Link>
        </div>
        {entries.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{entriesT("empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {entries.slice(0, 6).map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                wallet={wallet}
                tree={tree}
                accountNames={names}
                onOpen={canEdit && isEditable(entry) ? () => setEditing({ mode: "edit", entry }) : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {accounts && (
        <EntryDialog
          wallet={wallet}
          accounts={accounts}
          tree={tree}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            month.reload();
            reloadAccounts();
          }}
        />
      )}
    </div>
  );
}
