"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RotateCcwIcon, WalletIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@packages/ui/components/dialog";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import type { Account } from "@packages/shared/accounts";
import { invoiceForDate, invoicePeriod, type Card, type Invoice, type InvoiceDetail } from "@packages/shared/cards";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import { addMonths } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { ConfirmDialog, InvoiceStateBadge, PurchaseDialog, useShortDate, type PurchaseEditing } from "../cards-ui";
import { useCategories } from "../categories";
import { useTags } from "../tags-ui";
import { useFormatter, useTranslations } from "../i18n";
import { todayIso, useMoney } from "../money";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";
import { EntryRow } from "./statement";

const ACCOUNTS_PATH = APP_ROUTES.find((route) => route.key === "accounts")!.path;

export function CardScreen({ cardId }: { cardId: string }) {
  const t = useTranslations("app.cards.detail");
  const { current } = useWallets();
  const { Link } = useAppNavigation();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href={ACCOUNTS_PATH} className="flex items-center gap-1 self-start text-[13px] text-primary hover:underline">
        <ChevronLeftIcon className="size-4" aria-hidden />
        {t("back")}
      </Link>
      {current && <WalletCard key={current.id} wallet={current} cardId={cardId} />}
    </div>
  );
}

function WalletCard({ wallet, cardId }: { wallet: Wallet; cardId: string }) {
  const t = useTranslations("app.cards");
  const cards = useResource<{ cards: Card[] }>(`/api/wallets/${wallet.id}/cards`);
  if (cards.state.status === "loading") return <Spinner label={t("title")} />;
  const card = cards.state.status === "ready" ? cards.state.value.cards.find((item) => item.id === cardId) : undefined;
  if (!card) return <p className="text-[13px] text-muted-foreground">{t("detail.notFound")}</p>;
  return <CardInvoices wallet={wallet} card={card} onChanged={cards.reload} />;
}

function CardInvoices({ wallet, card, onChanged }: { wallet: Wallet; card: Card; onChanged: () => void }) {
  const t = useTranslations("app.cards");
  const format = useFormatter();
  const money = useMoney(wallet.currencyCode);
  const shortDate = useShortDate();
  const request = useApi();
  const canEdit = can(wallet.role, "editEntries");
  const current = invoiceForDate(todayIso(), card.closingDay, card.dueDay);
  const [month, setMonth] = React.useState(`${current.referenceYear}-${String(current.referenceMonth).padStart(2, "0")}`);
  const detail = useResource<InvoiceDetail>(`/api/wallets/${wallet.id}/cards/${card.id}/invoices/${month}`);
  const accounts = useResource<{ accounts: Account[] }>(`/api/wallets/${wallet.id}/accounts`);
  const { tree } = useCategories(wallet.id);
  const tags = useTags(wallet.id);
  const [editing, setEditing] = React.useState<PurchaseEditing>(null);
  const [paying, setPaying] = React.useState(false);
  const [reopening, setReopening] = React.useState(false);
  const names = React.useMemo(() => new Map([[card.id, card.name]]), [card]);

  const refresh = () => {
    detail.reload();
    onChanged();
  };
  const invoice = detail.state.status === "ready" ? detail.state.value.invoice : null;
  const purchases = detail.state.status === "ready" ? detail.state.value.purchases : [];
  const [year, monthNumber] = month.split("-").map(Number);
  const dueDate = invoice?.dueDate ?? invoicePeriod(year, monthNumber, card.closingDay, card.dueDay).dueDate;
  const monthLabel = format.dateTime(new Date(`${dueDate}T12:00:00`), { month: "long", year: "numeric" });
  const paid = invoice?.state === "PAID";

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{card.name}</h1>
        <p className="text-[13px] text-muted-foreground">
          {t(`brands.${card.brand}`)} ·{" "}
          {card.limitMinor > 0
            ? t("used", { used: money.format(card.usedMinor), limit: money.format(card.limitMinor) })
            : t("noLimit", { used: money.format(card.usedMinor) })}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={t("detail.previous")} onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeftIcon />
        </Button>
        <span className="inline-block min-w-44 text-center text-[15px] font-semibold first-letter:uppercase">
          {t("detail.invoice", { month: monthLabel })}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label={t("detail.next")} onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRightIcon />
        </Button>
      </div>

      {invoice && (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
              {t("detail.total")}
              <InvoiceStateBadge state={invoice.state} />
            </div>
            <div className="text-2xl font-semibold tabular-nums">{money.format(invoice.totalMinor)}</div>
            <div className="text-[12px] text-muted-foreground">
              {t("detail.period", { from: shortDate(invoice.openingDate), to: shortDate(invoice.closingDate) })} ·{" "}
              {t("due", { date: shortDate(invoice.dueDate) })}
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {!paid && (
                <Button variant="secondary" onClick={() => setEditing({ mode: "create" })}>
                  <PlusIcon />
                  {t("detail.newPurchase")}
                </Button>
              )}
              {!paid && invoice.totalMinor > 0 && (
                <Button onClick={() => setPaying(true)}>
                  <WalletIcon />
                  {t("detail.pay")}
                </Button>
              )}
              {paid && (
                <Button variant="secondary" onClick={() => setReopening(true)}>
                  <RotateCcwIcon />
                  {t("detail.reopen")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {detail.state.status === "loading" && <Spinner label={t("title")} />}
      {detail.state.status === "ready" &&
        (purchases.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("detail.emptyInvoice")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {purchases.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                wallet={wallet}
                tree={tree}
                accountNames={names}
                tagMap={tags.byId}
                onOpen={canEdit && !paid ? () => setEditing({ mode: "edit", entry }) : undefined}
              />
            ))}
          </ul>
        ))}

      <PurchaseDialog
        wallet={wallet}
        card={card}
        tree={tree}
        tags={tags}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      {invoice && accounts.state.status === "ready" && (
        <PayInvoiceDialog
          open={paying}
          wallet={wallet}
          card={card}
          month={month}
          monthLabel={monthLabel}
          invoice={invoice}
          accounts={accounts.state.value.accounts}
          onClose={() => setPaying(false)}
          onPaid={() => {
            setPaying(false);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={reopening}
        title={t("detail.reopenTitle")}
        body={t("detail.reopenBody")}
        confirm={t("detail.reopenConfirm")}
        cancel={t("form.cancel")}
        onClose={() => setReopening(false)}
        action={() => request("POST", `/api/wallets/${wallet.id}/cards/${card.id}/invoices/${month}/reopen`, { mutationId: newId() })}
        onDone={() => {
          setReopening(false);
          refresh();
        }}
      />
    </>
  );
}

function PayInvoiceDialog({
  open,
  wallet,
  card,
  month,
  monthLabel,
  invoice,
  accounts,
  onClose,
  onPaid,
}: {
  open: boolean;
  wallet: Wallet;
  card: Card;
  month: string;
  monthLabel: string;
  invoice: Invoice;
  accounts: Account[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const t = useTranslations("app.cards");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [accountId, setAccountId] = React.useState(
    accounts.some((account) => account.id === card.paymentAccountId) ? card.paymentAccountId : (accounts[0]?.id ?? ""),
  );
  const [date, setDate] = React.useState(todayIso());
  const { pending, failure, setFailure, run } = useWalletRequest();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFailure(null);
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await run(() =>
              request("POST", `/api/wallets/${wallet.id}/cards/${card.id}/invoices/${month}/pay`, {
                mutationId: newId(),
                paymentId: newId(),
                accountId,
                paymentDate: date,
                amountMinor: invoice.totalMinor,
              }),
            );
            if (ok) onPaid();
          }}
        >
          <DialogHeader>
            <DialogTitle className="first-letter:uppercase">{t("payDialog.title", { month: monthLabel })}</DialogTitle>
            <DialogDescription>
              {t("payDialog.amount")}: <span className="font-medium tabular-nums text-foreground">{money.format(invoice.totalMinor)}</span>
            </DialogDescription>
          </DialogHeader>
          <WalletErrorMessage failure={failure} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-account">{t("payDialog.account")}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="pay-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} · {money.format(account.balanceMinor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-date">{t("payDialog.date")}</Label>
            <Input id="pay-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !accountId}>
              {pending ? <Spinner label={common("loading")} /> : t("payDialog.confirm", { amount: money.format(invoice.totalMinor) })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
