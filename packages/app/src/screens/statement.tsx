"use client";

import * as React from "react";
import { ArrowLeftRightIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CreditCardIcon, PlusIcon, RepeatIcon, SearchIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import type { Account } from "@packages/shared/accounts";
import type { Card } from "@packages/shared/cards";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import { addMonths, monthRange, type Entry, type EntryList } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { CategoryBadge, useCategories, useCategoryLabel, type CategoryTree } from "../categories";
import { EntryDialog, type EntryEditing } from "../entry-form";
import { TagChip, useTags } from "../tags-ui";
import { useRecurrenceRefresh } from "../recurrences-ui";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import type { Tag } from "@packages/shared/tags";
import { useFormatter, useTranslations } from "../i18n";
import { todayIso, useMoney } from "../money";
import { useWallets } from "../wallets";

const ALL = "all";
export const RECURRENCES_PATH = `${APP_ROUTES.find((route) => route.key === "statement")!.path}/recurrences`;

export function StatementScreen() {
  const t = useTranslations("app");
  const { current } = useWallets();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t("nav.statement")}</h1>
      {current ? (
        <WalletStatement key={current.id} wallet={current} />
      ) : (
        <p className="text-[13px] text-muted-foreground">{t("entries.noWallet")}</p>
      )}
    </div>
  );
}

/**
 * Accounts and cards of a wallet: the active ones for pickers, and the names
 * of archived ones too, since old entries still point at them.
 */
export function useWalletAccounts(walletId: string) {
  const active = useResource<{ accounts: Account[] }>(`/api/wallets/${walletId}/accounts`);
  const archived = useResource<{ accounts: Account[] }>(`/api/wallets/${walletId}/accounts?archived=1`);
  const cards = useResource<{ cards: Card[] }>(`/api/wallets/${walletId}/cards`);
  const archivedCards = useResource<{ cards: Card[] }>(`/api/wallets/${walletId}/cards?archived=1`);
  const activeList = active.state.status === "ready" ? active.state.value.accounts : null;
  const cardList = React.useMemo(() => (cards.state.status === "ready" ? cards.state.value.cards : []), [cards.state]);
  const names = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const state of [active.state, archived.state]) {
      if (state.status === "ready") for (const account of state.value.accounts) map.set(account.id, account.name);
    }
    for (const state of [cards.state, archivedCards.state]) {
      if (state.status === "ready") for (const card of state.value.cards) map.set(card.id, card.name);
    }
    return map;
  }, [active.state, archived.state, cards.state, archivedCards.state]);
  const { reload: reloadActive } = active;
  const { reload: reloadArchived } = archived;
  const { reload: reloadCards } = cards;
  const reload = React.useCallback(() => {
    reloadActive();
    reloadArchived();
    reloadCards();
  }, [reloadActive, reloadArchived, reloadCards]);
  return { accounts: activeList, cards: cardList, names, reload };
}

function WalletStatement({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.entries");
  const tagsT = useTranslations("app.tags");
  const recurrencesT = useTranslations("app.recurrences");
  const format = useFormatter();
  const money = useMoney(wallet.currencyCode);
  const request = useApi();
  const canEdit = can(wallet.role, "editEntries");
  const [month, setMonth] = React.useState(() => todayIso().slice(0, 7));
  const [accountFilter, setAccountFilter] = React.useState(ALL);
  const [categoryFilter, setCategoryFilter] = React.useState(ALL);
  const [tagFilter, setTagFilter] = React.useState(ALL);
  const tags = useTags(wallet.id);
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<EntryEditing>(null);
  const { accounts, cards, names, reload: reloadAccounts } = useWalletAccounts(wallet.id);
  const { tree } = useCategories(wallet.id);

  // Typing settles before the list reloads.
  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { from, to } = monthRange(month);
  const params = new URLSearchParams({ from, to });
  if (accountFilter !== ALL) params.set("accountId", accountFilter);
  if (categoryFilter !== ALL) params.set("categoryId", categoryFilter);
  if (tagFilter !== ALL) params.set("tagId", tagFilter);
  if (query) params.set("q", query);
  const list = useResource<EntryList>(`/api/wallets/${wallet.id}/transactions?${params}`);
  useRecurrenceRefresh(wallet.id, list.reload);
  const { Link } = useAppNavigation();

  const refresh = () => {
    list.reload();
    reloadAccounts();
  };
  const markPaid = async (entry: Entry) => {
    await request("PATCH", `/api/wallets/${wallet.id}/transactions/${entry.id}`, {
      mutationId: newId(),
      baseVersion: entry.version,
      status: "PAID",
    }).catch(() => null);
    refresh();
  };

  const monthLabel = format.dateTime(new Date(`${month}-15T12:00:00`), { month: "long", year: "numeric" });
  const groups = React.useMemo(() => {
    if (list.state.status !== "ready") return [];
    const byDate = new Map<string, Entry[]>();
    for (const entry of list.state.value.entries) {
      const date = entry.statementDate ?? entry.transactionDate;
      byDate.set(date, [...(byDate.get(date) ?? []), entry]);
    }
    return [...byDate];
  }, [list.state]);
  const summary = list.state.status === "ready" ? list.state.value.summary : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={t("previousMonth")} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeftIcon />
          </Button>
          <span className="inline-block min-w-36 text-center text-[15px] font-semibold first-letter:uppercase">{monthLabel}</span>
          <Button variant="ghost" size="icon-sm" aria-label={t("nextMonth")} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRightIcon />
          </Button>
          {month !== todayIso().slice(0, 7) && (
            <Button variant="link" size="sm" onClick={() => setMonth(todayIso().slice(0, 7))}>
              {t("today")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={RECURRENCES_PATH}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-foreground/80 outline-none hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <RepeatIcon className="size-4" aria-hidden />
            {recurrencesT("open")}
          </Link>
          {canEdit && accounts && accounts.length > 0 && (
            <Button onClick={() => setEditing({ mode: "create" })}>
              <PlusIcon />
              {t("new")}
            </Button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard label={t("income")} value={money.format(summary.incomeMinor)} tone="positive"
            hint={summary.pendingIncomeMinor ? t("pending", { amount: money.format(summary.pendingIncomeMinor) }) : undefined} />
          <SummaryCard label={t("expense")} value={money.format(summary.expenseMinor)} tone="negative"
            hint={summary.pendingExpenseMinor ? t("pending", { amount: money.format(summary.pendingExpenseMinor) }) : undefined} />
          <SummaryCard label={t("accumulatedResult")} value={money.format(summary.accumulatedBalanceMinor)}
            hint={t("accumulatedResultHint")}
            tone={summary.accumulatedBalanceMinor < 0 ? "negative" : "neutral"} />
        </div>
      )}

      <div className={cn("grid gap-2", tags.tags.length ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-8" />
        </div>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger aria-label={t("allAccounts")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allAccounts")}</SelectItem>
            {accounts?.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CategoryFilter tree={tree} value={categoryFilter} onValueChange={setCategoryFilter} />
        {tags.tags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger aria-label={tagsT("allTags")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tagsT("allTags")}</SelectItem>
              {tags.tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!canEdit && <p className="text-[12px] text-muted-foreground">{t("readOnly")}</p>}
      {canEdit && accounts && accounts.length === 0 && <p className="text-[13px] text-muted-foreground">{t("noAccounts")}</p>}

      {list.state.status === "loading" && <Spinner label={t("new")} />}
      {list.state.status === "error" && (
        <div className="flex items-center gap-3 text-[13px] text-destructive">
          {t("loadError")}
          <Button variant="secondary" size="sm" onClick={list.reload}>
            {t("retry")}
          </Button>
        </div>
      )}
      {list.state.status === "ready" && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
          <p className="text-[13px] font-medium">{t("empty")}</p>
          {canEdit && <p className="mt-1 text-[12px] text-muted-foreground">{t("emptyHint")}</p>}
        </div>
      )}
      {groups.map(([date, entries]) => (
        <div key={date} className="flex flex-col gap-1.5">
          <h3 className="px-1 text-[12px] font-medium text-muted-foreground first-letter:uppercase">
            {format.dateTime(new Date(`${date}T12:00:00`), { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                wallet={wallet}
                tree={tree}
                accountNames={names}
                tagMap={tags.byId}
                onOpen={canEdit && isEditable(entry) ? () => setEditing({ mode: "edit", entry }) : undefined}
                onMarkPaid={canEdit && entry.status === "PENDING" && isEditable(entry) ? () => void markPaid(entry) : undefined}
              />
            ))}
          </ul>
        </div>
      ))}

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
            refresh();
          }}
        />
      )}
    </section>
  );
}

/** Entries the generic form edits; card purchases and invoice payments live in the card screens. */
export function isEditable(entry: Entry): boolean {
  return ["INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT"].includes(entry.type);
}

function SummaryCard({ label, value, tone, hint }: { label: string; value: string; tone: "positive" | "negative" | "neutral"; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          "truncate text-[15px] font-semibold tabular-nums",
          tone === "positive" && "text-[#248a3d] dark:text-[#30d158]",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CategoryFilter({ tree, value, onValueChange }: { tree: CategoryTree | null; value: string; onValueChange: (value: string) => void }) {
  const t = useTranslations("app.entries");
  const label = useCategoryLabel();
  const groups = tree ? [...tree.groups("EXPENSE"), ...tree.groups("INCOME")] : [];
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={t("allCategories")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
        {groups.map(({ parent, children }) => (
          <React.Fragment key={parent.id}>
            <SelectItem value={parent.id}>{label(parent)}</SelectItem>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.id} className="pl-6">
                {label(child)}
              </SelectItem>
            ))}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EntryRow({
  entry,
  wallet,
  tree,
  accountNames,
  tagMap,
  onOpen,
  onMarkPaid,
}: {
  entry: Entry;
  wallet: Wallet;
  tree: CategoryTree | null;
  accountNames: Map<string, string>;
  tagMap?: Map<string, Tag>;
  onOpen?: () => void;
  onMarkPaid?: () => void;
}) {
  const t = useTranslations("app.entries");
  const format = useFormatter();
  const recurrenceLabel = useTranslations("app.recurrences")("recurringBadge");
  const label = useCategoryLabel();
  const money = useMoney(wallet.currencyCode);
  const category = entry.categoryId ? tree?.byId.get(entry.categoryId) : undefined;
  const parent = category?.parentId ? tree?.byId.get(category.parentId) : undefined;
  const isTransfer = entry.type === "TRANSFER_IN" || entry.type === "TRANSFER_OUT";
  // Card purchases wait for their invoice; the invoice state says that, not each row.
  const pending = entry.status === "PENDING" && entry.type !== "CREDIT_CARD_PURCHASE";
  const incoming = entry.type === "INCOME" || entry.type === "TRANSFER_IN" || entry.type === "REFUND";
  const source = entry.accountId ?? entry.creditCardId;
  const accountName = source ? (accountNames.get(source) ?? "") : "";
  const counterpart = entry.counterpartAccountId ? (accountNames.get(entry.counterpartAccountId) ?? "") : "";
  const subtitle = isTransfer
    ? entry.type === "TRANSFER_OUT"
      ? t("transferFromTo", { from: accountName, to: counterpart })
      : t("transferFromTo", { from: counterpart, to: accountName })
    : [category ? label(category) : null, accountName].filter(Boolean).join(" · ");

  const content = (
    <>
      {isTransfer || entry.type === "CREDIT_CARD_PAYMENT" ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/70" aria-hidden>
          {isTransfer ? <ArrowLeftRightIcon className="size-3.5" /> : <CreditCardIcon className="size-3.5" />}
        </span>
      ) : (
        <CategoryBadge category={category ?? null} parent={parent ?? null} />
      )}
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{entry.description}</span>
          {entry.recurrenceId && <RepeatIcon className="size-3 shrink-0 text-muted-foreground" aria-label={recurrenceLabel} />}
          {entry.installmentNumber && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t("installment", { number: entry.installmentNumber, total: entry.installmentTotal ?? 0 })}
            </span>
          )}
          {pending && (
            <span className="shrink-0 rounded-full bg-[#ff9500]/15 px-1.5 py-px text-[10px] font-medium text-[#c93400] dark:text-[#ffb340]">
              {t("pendingBadge")}
            </span>
          )}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">{subtitle}{entry.type === "CREDIT_CARD_PURCHASE" && <> · {t("purchaseDate", { date: format.dateTime(new Date(`${entry.transactionDate}T12:00:00`), { day: "numeric", month: "short", year: "numeric" }) })}</>}</div>
        {tagMap && entry.tagIds.some((id) => tagMap.has(id)) && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {entry.tagIds.map((id) => tagMap.get(id)).filter((tag): tag is Tag => Boolean(tag)).map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 text-[13px] font-medium tabular-nums",
          incoming && !isTransfer && "text-[#248a3d] dark:text-[#30d158]",
          pending && "opacity-60",
        )}
      >
        {incoming ? "+" : "−"}
        {money.format(entry.amountMinor)}
      </span>
    </>
  );

  return (
    <li className="flex items-center">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 outline-none hover:bg-foreground/[0.03] focus-visible:bg-foreground/5">
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">{content}</div>
      )}
      {onMarkPaid && (
        <Button variant="ghost" size="icon-sm" className="mr-2" aria-label={t("markPaid")} title={t("markPaid")} onClick={onMarkPaid}>
          <CheckIcon />
        </Button>
      )}
    </li>
  );
}
