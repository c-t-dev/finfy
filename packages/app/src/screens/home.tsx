"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, EyeOffIcon, GripVerticalIcon, PlusIcon, SlidersHorizontalIcon, WalletIcon } from "lucide-react";
import { Button, buttonVariants } from "@packages/ui/components/button";
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import {
  DEFAULT_HOME_LAYOUT,
  DEFAULT_WIDGET_SIZE,
  HOME_WIDGETS,
  moveWidget,
  type HomeLayout,
  type HomeWidget,
  type HomeWidgetKey,
  type WidgetSize,
} from "@packages/shared/home";
import { can } from "@packages/shared/roles";
import { monthRange, type EntryList } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { CategoryBadge, useCategories, useCategoryLabel } from "../categories";
import { EntryDialog, type EntryEditing } from "../entry-form";
import { BalanceChart, CashflowChart } from "../home-charts";
import { useTags } from "../tags-ui";
import { useRecurrenceRefresh } from "../recurrences-ui";
import { useTranslations } from "../i18n";
import { todayIso, useMoney } from "../money";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { CreateWalletDialog } from "../wallet-ui";
import { useWallets } from "../wallets";
import { EntryRow, isEditable, useWalletAccounts } from "./statement";

const STATEMENT_PATH = APP_ROUTES.find((route) => route.key === "statement")!.path;
const ACCOUNTS_PATH = APP_ROUTES.find((route) => route.key === "accounts")!.path;

export function HomeScreen() {
  const t = useTranslations("app.home");
  const { current } = useWallets();
  const [creating, setCreating] = React.useState(false);

  if (current) return <WalletHome key={current.id} wallet={current} />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
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
    </div>
  );
}

/**
 * The member's own layout (wiki/decisoes/0019). Changes show at once and are
 * saved shortly after the last one, so quick reordering sends one request; a
 * pending save is sent when the screen closes. If the layout cannot be read,
 * the default one is shown.
 */
function useHomeLayout(walletId: string) {
  const request = useApi();
  const path = `/api/wallets/${walletId}/home/layout`;
  const resource = useResource<HomeLayout>(path);
  const [draft, setDraft] = React.useState<HomeLayout | null>(null);
  const [failed, setFailed] = React.useState(false);
  const pending = React.useRef<{ widgets: HomeWidget[] | null } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = React.useCallback(() => {
    clearTimeout(timer.current);
    const body = pending.current;
    pending.current = null;
    if (!body) return;
    request<HomeLayout>("POST", path, body).then(
      (response) => setFailed(!response.ok),
      () => setFailed(true),
    );
  }, [request, path]);

  React.useEffect(() => flush, [flush]);

  const save = React.useCallback(
    (widgets: HomeWidget[] | null) => {
      setDraft({ widgets: widgets ?? DEFAULT_HOME_LAYOUT, customized: widgets !== null });
      setFailed(false);
      pending.current = { widgets };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  const loaded = resource.state.status === "ready" ? resource.state.value : resource.state.status === "error" ? { widgets: DEFAULT_HOME_LAYOUT, customized: false } : null;
  return { layout: draft ?? loaded, save, failed };
}

function WalletHome({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.home");
  const entriesT = useTranslations("app.entries");
  const money = useMoney(wallet.currencyCode);
  const label = useCategoryLabel();
  const { Link } = useAppNavigation();
  const canEdit = can(wallet.role, "editEntries");
  const { accounts, cards, names, reload: reloadAccounts } = useWalletAccounts(wallet.id);
  const { tree } = useCategories(wallet.id);
  const tags = useTags(wallet.id);
  const { from, to } = monthRange(todayIso().slice(0, 7));
  const month = useResource<EntryList>(`/api/wallets/${wallet.id}/transactions?from=${from}&to=${to}`);
  useRecurrenceRefresh(wallet.id, month.reload);
  const [editing, setEditing] = React.useState<EntryEditing>(null);
  const { layout, save, failed } = useHomeLayout(wallet.id);
  const [customizing, setCustomizing] = React.useState(false);

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

  // A new wallet starts with its first account: every entry needs one.
  if (accounts && accounts.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border border-border bg-card px-5 py-4">
          <WalletIcon className="size-6 text-primary" aria-hidden />
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-semibold">{t("firstAccount.title", { name: wallet.name })}</h2>
            <p className="text-[13px] text-muted-foreground">{canEdit ? t("firstAccount.body") : t("firstAccount.readOnly")}</p>
          </div>
          {canEdit && (
            <Link href={ACCOUNTS_PATH} className={buttonVariants({ size: "sm" })}>
              <PlusIcon />
              {t("firstAccount.create")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const widget = (key: HomeWidgetKey): React.ReactNode => {
    switch (key) {
      case "balance":
        return (
          <div className="h-full rounded-xl border border-border bg-card px-4 py-3">
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
        );
      case "month":
        return (
          <div className="h-full rounded-xl border border-border bg-card px-4 py-3">
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
        );
      case "balanceChart":
        return <BalanceChart wallet={wallet} />;
      case "cashflowChart":
        return <CashflowChart wallet={wallet} />;
      case "topExpenses":
        return (
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
        );
      case "recent":
        return (
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
                    tagMap={tags.byId}
                    onOpen={canEdit && isEditable(entry) ? () => setEditing({ mode: "edit", entry }) : undefined}
                  />
                ))}
              </ul>
            )}
          </section>
        );
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {layout &&
          (customizing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => save(null)} disabled={!layout.customized}>
                {t("customize.reset")}
              </Button>
              <Button size="sm" onClick={() => setCustomizing(false)}>
                {t("customize.done")}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setCustomizing(true)}>
              <SlidersHorizontalIcon />
              {t("customize.open")}
            </Button>
          ))}
      </div>

      {failed && (
        <p role="alert" className="-mt-3 text-[12px] text-destructive">
          {t("customize.saveError")}
        </p>
      )}

      {!layout ? (
        <div className="flex justify-center py-10">
          <Spinner label={t("title")} />
        </div>
      ) : customizing ? (
        <HomeEditor widgets={layout.widgets} onChange={save} render={widget} />
      ) : layout.widgets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-[13px] text-muted-foreground">{t("customize.emptyHome")}</p>
          <Button size="sm" onClick={() => setCustomizing(true)}>
            <SlidersHorizontalIcon />
            {t("customize.open")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
          {layout.widgets.map(({ key, size }) => (
            <div key={key} className={cn("min-w-0", size === "full" && "sm:col-span-2")}>
              {widget(key)}
            </div>
          ))}
        </div>
      )}

      {accounts && (
        <EntryDialog
          wallet={wallet}
          accounts={accounts}
          cards={cards}
          tree={tree}
          tags={tags}
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

/**
 * Edit mode: each visible block gets a bar to move it (drag on desktop, arrows
 * everywhere), change its width or hide it; hidden blocks are listed below to
 * add back. The blocks themselves are shown inert so a click never opens them.
 */
function HomeEditor({
  widgets,
  onChange,
  render,
}: {
  widgets: HomeWidget[];
  onChange: (widgets: HomeWidget[]) => void;
  render: (key: HomeWidgetKey) => React.ReactNode;
}) {
  const t = useTranslations("app.home.customize");
  const names = useTranslations("app.home.widgets");
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  const hidden = HOME_WIDGETS.filter((key) => !widgets.some((widget) => widget.key === key));

  const resize = (index: number, size: WidgetSize) => onChange(widgets.map((widget, i) => (i === index ? { ...widget, size } : widget)));
  const drop = (index: number) => {
    if (dragging !== null) onChange(moveWidget(widgets, dragging, index));
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3 text-[12px] text-muted-foreground">{t("hint")}</p>
      {widgets.length > 0 && (
        <ol className="grid gap-x-3 gap-y-5 sm:grid-cols-2" aria-label={t("visible")}>
          {widgets.map(({ key, size }, index) => (
            <li
              key={key}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                setDragging(index);
              }}
              onDragOver={(event) => {
                if (dragging === null) return;
                event.preventDefault();
                setOver(index);
              }}
              onDragLeave={() => setOver((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                drop(index);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-xl outline-2 outline-offset-4 outline-dashed outline-primary/35 transition-opacity",
                size === "full" && "sm:col-span-2",
                dragging === index && "opacity-40",
                over === index && dragging !== index && "outline-primary",
              )}
            >
              <div className="flex items-center gap-1 rounded-lg bg-foreground/[0.04] px-1.5 py-1 dark:bg-white/5">
                <GripVerticalIcon className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{names(`${key}.title`)}</span>
                <SegmentedControl
                  size="sm"
                  className="hidden sm:inline-flex"
                  aria-label={t("size")}
                  value={size}
                  onValueChange={(next) => resize(index, next)}
                  options={[
                    { value: "half", label: t("half") },
                    { value: "full", label: t("full") },
                  ]}
                />
                <Button variant="ghost" size="icon-sm" aria-label={t("moveUp", { name: names(`${key}.title`) })} title={t("moveUp", { name: names(`${key}.title`) })} disabled={index === 0} onClick={() => onChange(moveWidget(widgets, index, index - 1))}>
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveDown", { name: names(`${key}.title`) })}
                  title={t("moveDown", { name: names(`${key}.title`) })}
                  disabled={index === widgets.length - 1}
                  onClick={() => onChange(moveWidget(widgets, index, index + 1))}
                >
                  <ArrowDownIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t("hide", { name: names(`${key}.title`) })} title={t("hide", { name: names(`${key}.title`) })} onClick={() => onChange(widgets.filter((_, i) => i !== index))}>
                  <EyeOffIcon />
                </Button>
              </div>
              <div inert className="pointer-events-none select-none">
                {render(key)}
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">{t("hidden")}</h2>
        {hidden.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("allVisible")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {hidden.map((key) => (
              <li key={key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{names(`${key}.title`)}</div>
                  <div className="text-[12px] text-muted-foreground">{names(`${key}.description`)}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onChange([...widgets, { key, size: DEFAULT_WIDGET_SIZE[key] }])}>
                  <PlusIcon />
                  {t("add")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
