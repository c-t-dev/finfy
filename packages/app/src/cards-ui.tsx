"use client";

import * as React from "react";
import { ArchiveIcon, ArchiveRestoreIcon, CreditCardIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@packages/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { ACCOUNT_COLORS, type Account, type AccountColor } from "@packages/shared/accounts";
import { CARD_NAME_MAX, INSTALLMENTS_MAX, splitInstallments, type Card, type InvoiceState } from "@packages/shared/cards";
import { CARD_BRANDS, type CardBrand } from "@packages/shared/finance";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import { DESCRIPTION_MAX, NOTES_MAX, type Entry } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "./api";
import { CategoryPicker, COLOR_BG, type CategoryTree } from "./categories";
import { useFormatter, useTranslations } from "./i18n";
import { todayIso, useMoney } from "./money";
import { APP_ROUTES, useAppNavigation } from "./navigation";
import { saveEntryTags, TagPicker } from "./tags-ui";
import type { Tag } from "@packages/shared/tags";
import { useWalletRequest, WalletErrorMessage } from "./wallet-ui";
import type { WalletFailure } from "./wallets";

export const CARDS_PATH = `${APP_ROUTES.find((route) => route.key === "accounts")!.path}/cards`;

const STATE_CLASS: Record<InvoiceState, string> = {
  OPEN: "bg-primary/12 text-primary",
  CLOSED: "bg-[#ff9500]/15 text-[#c93400] dark:text-[#ffb340]",
  OVERDUE: "bg-destructive/12 text-destructive",
  PAID: "bg-[#34c759]/15 text-[#248a3d] dark:text-[#30d158]",
};

export function InvoiceStateBadge({ state }: { state: InvoiceState }) {
  const t = useTranslations("app.cards.states");
  return <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", STATE_CLASS[state])}>{t(state)}</span>;
}

/** Short date in the user's language ("5 nov."). */
export function useShortDate() {
  const format = useFormatter();
  return React.useCallback((date: string) => format.dateTime(new Date(`${date}T12:00:00`), { day: "numeric", month: "short" }), [format]);
}

function ColorPicker({ value, onChange }: { value: AccountColor; onChange: (value: AccountColor) => void }) {
  const colors = useTranslations("app.accounts.colors");
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {ACCOUNT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={colors(color)}
          title={colors(color)}
          onClick={() => onChange(color)}
          className={cn(
            "size-6 rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-[3px] focus-visible:ring-ring/40",
            COLOR_BG[color],
            value === color && "ring-2 ring-foreground/70",
          )}
        />
      ))}
    </div>
  );
}

/** Cards of the wallet, for the accounts screen. */
export function CardsSection({ wallet, accounts }: { wallet: Wallet; accounts: Account[] }) {
  const t = useTranslations("app.cards");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const shortDate = useShortDate();
  const { Link } = useAppNavigation();
  const canEdit = can(wallet.role, "editEntries");
  const [showArchived, setShowArchived] = React.useState(false);
  const active = useResource<{ cards: Card[] }>(`/api/wallets/${wallet.id}/cards`);
  const archived = useResource<{ cards: Card[] }>(showArchived ? `/api/wallets/${wallet.id}/cards?archived=1` : null);
  const [editing, setEditing] = React.useState<{ card: Card | null } | null>(null);
  const [archiving, setArchiving] = React.useState<Card | null>(null);
  const reload = () => {
    active.reload();
    if (showArchived) archived.reload();
  };
  const cards = active.state.status === "ready" ? active.state.value.cards : [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{t("title")}</h2>
        {canEdit && accounts.length > 0 && (
          <Button onClick={() => setEditing({ card: null })}>
            <PlusIcon />
            {t("new")}
          </Button>
        )}
      </div>
      {canEdit && accounts.length === 0 && <p className="text-[13px] text-muted-foreground">{t("needsAccount")}</p>}
      {active.state.status === "loading" && <Spinner label={t("title")} />}
      {active.state.status === "ready" && cards.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
          <CreditCardIcon className="size-7 text-primary" aria-hidden />
          <p className="text-[13px] font-medium">{t("empty")}</p>
          <p className="text-[12px] text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}
      {cards.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const invoice = card.currentInvoice;
            const usedShare = card.limitMinor > 0 ? Math.min(100, (card.usedMinor / card.limitMinor) * 100) : 0;
            return (
              <li key={card.id} className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center rounded-md text-white", COLOR_BG[card.color])} aria-hidden>
                    <CreditCardIcon className="size-3.5" />
                  </span>
                  <Link href={`${CARDS_PATH}/${card.id}`} className="min-w-0 flex-1 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/40">
                    <div className="truncate text-[13px] font-medium">{card.name}</div>
                    <div className="text-[12px] text-muted-foreground">{t(`brands.${card.brand}`)}</div>
                  </Link>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="relative z-10" aria-label={t("actions.menu", { name: card.name })}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing({ card })}>
                          <PencilIcon aria-hidden />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setArchiving(card)}>
                          <ArchiveIcon aria-hidden />
                          {t("actions.archive")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {invoice && (
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {t("currentInvoice")}
                        <InvoiceStateBadge state={invoice.state} />
                      </div>
                      <div className="text-[15px] font-semibold tabular-nums">{money.format(invoice.totalMinor)}</div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      <div>{t("closes", { date: shortDate(invoice.closingDate) })}</div>
                      <div>{t("due", { date: shortDate(invoice.dueDate) })}</div>
                    </div>
                  </div>
                )}
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
                    <div className={cn("h-full rounded-full", usedShare >= 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${usedShare}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {card.limitMinor > 0
                      ? t("used", { used: money.format(card.usedMinor), limit: money.format(card.limitMinor) })
                      : t("noLimit", { used: money.format(card.usedMinor) })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowArchived((show) => !show)}>
        {showArchived ? t("archived.hide") : t("archived.show")}
      </Button>
      {showArchived &&
        archived.state.status === "ready" &&
        (archived.state.value.cards.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("archived.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60">
            {archived.state.value.cards.map((card) => (
              <li key={card.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">{card.name}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await request("POST", `/api/wallets/${wallet.id}/cards/${card.id}/restore`, {
                        mutationId: newId(),
                        baseVersion: card.version,
                      }).catch(() => null);
                      reload();
                    }}
                  >
                    <ArchiveRestoreIcon />
                    {t("actions.restore")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}

      <CardFormDialog
        wallet={wallet}
        accounts={accounts}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={archiving !== null}
        title={t("archive.title", { name: archiving?.name ?? "" })}
        body={t("archive.body")}
        confirm={t("archive.confirm")}
        cancel={t("archive.cancel")}
        onClose={() => setArchiving(null)}
        action={() =>
          request("POST", `/api/wallets/${wallet.id}/cards/${archiving!.id}/archive`, {
            mutationId: newId(),
            baseVersion: archiving!.version,
          })
        }
        onDone={() => {
          setArchiving(null);
          reload();
        }}
      />
    </section>
  );
}

/** A yes/no dialog that runs one API request and shows its error. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirm,
  cancel,
  destructive = true,
  onClose,
  action,
  onDone,
}: {
  open: boolean;
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  destructive?: boolean;
  onClose: () => void;
  action: () => Promise<{ ok: true; value: unknown } | ({ ok: false } & WalletFailure)>;
  onDone: () => void;
}) {
  const common = useTranslations("common");
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
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <WalletErrorMessage failure={failure} />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {cancel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              if (await run(action)) onDone();
            }}
          >
            {pending ? <Spinner label={common("loading")} /> : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardFormDialog({
  wallet,
  accounts,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  accounts: Account[];
  editing: { card: Card | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && (
          <CardForm key={editing.card?.id ?? "new"} wallet={wallet} accounts={accounts} card={editing.card} onCancel={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardForm({
  wallet,
  accounts,
  card,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  accounts: Account[];
  card: Card | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.cards");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const mainAccount = accounts.find((account) => account.isDefault) ?? accounts[0];
  const [name, setName] = React.useState(card?.name ?? "");
  const [paymentAccountId, setPaymentAccountId] = React.useState(card?.paymentAccountId ?? mainAccount?.id ?? "");
  const [brand, setBrand] = React.useState<CardBrand>(card?.brand ?? "VISA");
  const [limit, setLimit] = React.useState(card && card.limitMinor > 0 ? money.toInput(card.limitMinor) : "");
  const [closingDay, setClosingDay] = React.useState(String(card?.closingDay ?? ""));
  const [dueDay, setDueDay] = React.useState(String(card?.dueDay ?? ""));
  const [color, setColor] = React.useState<AccountColor>(card?.color ?? "purple");
  const [invalid, setInvalid] = React.useState<"limit" | "days" | null>(null);
  const { pending, failure, run } = useWalletRequest();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const limitMinor = limit.trim() === "" ? 0 : money.parse(limit);
        if (limitMinor === null || limitMinor < 0) return setInvalid("limit");
        const closing = Number(closingDay);
        const due = Number(dueDay);
        if (![closing, due].every((day) => Number.isInteger(day) && day >= 1 && day <= 31)) return setInvalid("days");
        setInvalid(null);
        const values = { name: name.trim(), paymentAccountId, brand, limitMinor, closingDay: closing, dueDay: due, color };
        const ok = await run(() =>
          card
            ? request("PATCH", `/api/wallets/${wallet.id}/cards/${card.id}`, {
                mutationId: newId(),
                baseVersion: card.version,
                ...Object.fromEntries(Object.entries(values).filter(([key, value]) => card[key as keyof Card] !== value)),
              })
            : request("POST", `/api/wallets/${wallet.id}/cards`, { id: newId(), mutationId: newId(), ...values }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{card ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("form.daysHint")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="card-name">{t("form.name")}</Label>
        <Input id="card-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={CARD_NAME_MAX} placeholder={t("form.namePlaceholder")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-brand">{t("form.brand")}</Label>
          <Select value={brand} onValueChange={(value) => setBrand(value as CardBrand)}>
            <SelectTrigger id="card-brand">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_BRANDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`brands.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-limit">
            {t("form.limit")} ({wallet.currencyCode})
          </Label>
          <Input id="card-limit" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder={money.toInput(0)} aria-invalid={invalid === "limit" || undefined} className="tabular-nums" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="card-account">{t("form.paymentAccount")}</Label>
        <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
          <SelectTrigger id="card-account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-closing">{t("form.closingDay")}</Label>
          <Input id="card-closing" type="number" min={1} max={31} value={closingDay} onChange={(event) => setClosingDay(event.target.value)} required aria-invalid={invalid === "days" || undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-due">{t("form.dueDay")}</Label>
          <Input id="card-due" type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(event.target.value)} required aria-invalid={invalid === "days" || undefined} />
        </div>
      </div>
      <p className={cn("-mt-2 text-[11px]", invalid ? "text-destructive" : "text-muted-foreground")}>
        {invalid === "days" ? t("form.dayInvalid") : invalid === "limit" ? t("form.limitHint") : t("form.daysHint")}
      </p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium">{t("form.color")}</legend>
        <ColorPicker value={color} onChange={setColor} />
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" disabled={pending || !name.trim() || !paymentAccountId}>
          {pending ? <Spinner label={common("loading")} /> : card ? t("form.save") : t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export type PurchaseEditing = { mode: "create" } | { mode: "edit"; entry: Entry } | null;

/** New purchase (with installments) or edit of an existing one (text fields of every installment). */
export function PurchaseDialog({
  wallet,
  card,
  tree,
  tags,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  card: Pick<Card, "id" | "name">;
  tree: CategoryTree | null;
  tags: { tags: Tag[]; add: (tag: Tag) => void };
  editing: PurchaseEditing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && (
          <PurchaseForm
            key={editing.mode === "edit" ? editing.entry.id : "new"}
            wallet={wallet}
            card={card}
            tree={tree}
            tags={tags}
            entry={editing.mode === "edit" ? editing.entry : null}
            onCancel={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PurchaseForm({
  wallet,
  card,
  tree,
  tags,
  entry,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  card: Pick<Card, "id" | "name">;
  tree: CategoryTree | null;
  tags: { tags: Tag[]; add: (tag: Tag) => void };
  entry: Entry | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.cards.purchase");
  const entries = useTranslations("app.entries");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [description, setDescription] = React.useState(entry?.description ?? "");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayIso());
  const [installments, setInstallments] = React.useState(1);
  const [categoryId, setCategoryId] = React.useState<string | null>(entry?.categoryId ?? null);
  const [notes, setNotes] = React.useState(entry?.notes ?? "");
  const [tagIds, setTagIds] = React.useState<string[]>(entry?.tagIds ?? []);
  const [amountInvalid, setAmountInvalid] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();
  const base = `/api/wallets/${wallet.id}/cards/${card.id}/purchases`;
  const parsed = money.parse(amount);

  if (confirmingDelete && entry) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteBody")}</DialogDescription>
        </DialogHeader>
        <WalletErrorMessage failure={failure} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
            {entries("delete.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (await run(() => request("POST", `${base}/${entry.id}/archive`, { mutationId: newId() }))) onSaved();
            }}
          >
            {pending ? <Spinner label={common("loading")} /> : entries("delete.confirm")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmedNotes = notes.trim() || null;
        if (entry) {
          const patch = Object.fromEntries(
            Object.entries({
              description: description.trim() !== entry.description ? description.trim() : undefined,
              categoryId: categoryId && categoryId !== entry.categoryId ? categoryId : undefined,
              notes: trimmedNotes !== entry.notes ? trimmedNotes : undefined,
            }).filter(([, value]) => value !== undefined),
          );
          const ok = await run(async () => {
            if (Object.keys(patch).length) {
              const response = await request("PATCH", `${base}/${entry.id}`, { mutationId: newId(), ...patch });
              if (!response.ok) return response;
            }
            return saveEntryTags(request, wallet.id, entry.id, entry.tagIds, tagIds);
          });
          if (ok) onSaved();
          return;
        }
        if (parsed === null || parsed <= 0) return setAmountInvalid(true);
        setAmountInvalid(false);
        const ok = await run(() =>
          request("POST", base, {
            id: newId(),
            mutationId: newId(),
            categoryId,
            description: description.trim(),
            amountMinor: parsed,
            transactionDate: date,
            installments,
            notes: trimmedNotes,
            tagIds,
          }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{entry ? t("editTitle") : t("createTitle", { card: card.name })}</DialogTitle>
        <DialogDescription className={entry ? "" : "sr-only"}>{t("editHint")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      {!entry && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-amount">
                {entries("form.amount")} ({wallet.currencyCode})
              </Label>
              <Input id="purchase-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required autoFocus placeholder={money.toInput(0)} aria-invalid={amountInvalid || undefined} className="text-[15px] font-medium tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-date">{entries("form.date")}</Label>
              <Input id="purchase-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </div>
          </div>
          {amountInvalid && <p className="-mt-2 text-[11px] text-destructive">{entries("form.amountInvalid", { example: money.toInput(1990) })}</p>}
          <InstallmentsSelect value={installments} onChange={setInstallments} totalMinor={parsed && parsed > 0 ? parsed : null} format={money.format} />
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purchase-description">{entries("form.description")}</Label>
        <Input id="purchase-description" value={description} onChange={(event) => setDescription(event.target.value)} required autoFocus={entry !== null} maxLength={DESCRIPTION_MAX} placeholder={entries("form.descriptionPlaceholder")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purchase-category">{entries("form.category")}</Label>
        <CategoryPicker id="purchase-category" tree={tree} kind="EXPENSE" value={categoryId} onValueChange={setCategoryId} />
      </div>
      <TagPicker wallet={wallet} tags={tags.tags} value={tagIds} onChange={setTagIds} onCreated={tags.add} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purchase-notes">{entries("form.notes")}</Label>
        <textarea
          id="purchase-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={NOTES_MAX}
          rows={2}
          className="min-h-14 rounded-md border border-input bg-card px-2.5 py-1.5 text-[13px] shadow-[0_1px_1px_rgb(0_0_0/0.05)] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 dark:bg-white/5"
        />
      </div>
      <DialogFooter className={cn(entry && "sm:justify-between")}>
        {entry && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
            <Trash2Icon />
            {t("delete")}
          </Button>
        )}
        <div className="flex gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {entries("form.cancel")}
          </Button>
          <Button type="submit" disabled={pending || !description.trim() || !categoryId}>
            {pending ? <Spinner label={common("loading")} /> : entry ? entries("form.save") : entries("form.create")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

/** 1× to 48×, showing each installment's value when the total is known. */
export function InstallmentsSelect({
  value,
  onChange,
  totalMinor,
  format,
}: {
  value: number;
  onChange: (value: number) => void;
  totalMinor: number | null;
  format: (minor: number) => string;
}) {
  const t = useTranslations("app.cards.purchase");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="purchase-installments">{t("installments")}</Label>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger id="purchase-installments">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {Array.from({ length: INSTALLMENTS_MAX }, (_, index) => index + 1).map((count) => (
            <SelectItem key={count} value={String(count)}>
              {count === 1
                ? t("single")
                : totalMinor
                  ? t("installmentsHint", { count, amount: format(splitInstallments(totalMinor, count)[0]) })
                  : `${count}×`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
