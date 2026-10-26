"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
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
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import type { Account } from "@packages/shared/accounts";
import type { Card } from "@packages/shared/cards";
import { newId } from "@packages/shared/ids";
import { DESCRIPTION_MAX, NOTES_MAX, type Entry, type EntryKind } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi } from "./api";
import { InstallmentsSelect } from "./cards-ui";
import { saveEntryTags, TagPicker } from "./tags-ui";
import type { Tag } from "@packages/shared/tags";
import { CategoryPicker, type CategoryTree } from "./categories";
import { useTranslations } from "./i18n";
import { todayIso, useMoney } from "./money";
import { useWalletRequest, WalletErrorMessage } from "./wallet-ui";

export type EntryEditing = { mode: "create"; kind?: EntryKind } | { mode: "edit"; entry: Entry } | null;

/** Which kind the form shows for an existing entry. */
function kindOf(entry: Entry): EntryKind {
  if (entry.type === "INCOME") return "INCOME";
  if (entry.type === "TRANSFER_IN" || entry.type === "TRANSFER_OUT") return "TRANSFER";
  return "EXPENSE";
}

export function EntryDialog({
  wallet,
  accounts,
  cards = [],
  tree,
  tags,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  accounts: Account[];
  /** Cards an expense can be charged to (new entries only). */
  cards?: Card[];
  tree: CategoryTree | null;
  /** The wallet's tags, and how to remember one created from the form. */
  tags: { tags: Tag[]; add: (tag: Tag) => void };
  editing: EntryEditing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && (
          <EntryForm
            key={editing.mode === "edit" ? editing.entry.id : "new"}
            wallet={wallet}
            accounts={accounts}
            cards={cards}
            tree={tree}
            tags={tags}
            editing={editing}
            onCancel={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const CARD_PREFIX = "card:";

function AccountSelect({
  id,
  accounts,
  cards = [],
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  accounts: Account[];
  /** Offered after the accounts, as `card:<id>`. */
  cards?: Card[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("app.cards");
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
        {cards.map((card) => (
          <SelectItem key={card.id} value={`${CARD_PREFIX}${card.id}`}>
            {t("sourceCard", { name: card.name })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EntryForm({
  wallet,
  accounts,
  cards,
  tree,
  tags,
  editing,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  accounts: Account[];
  cards: Card[];
  tree: CategoryTree | null;
  tags: { tags: Tag[]; add: (tag: Tag) => void };
  editing: NonNullable<EntryEditing>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.entries");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const existing = editing.mode === "edit" ? editing.entry : null;
  const mainAccount = accounts.find((account) => account.isDefault) ?? accounts[0];

  // A transfer is edited from its outgoing side: "from" is this leg's account when it is TRANSFER_OUT.
  const isIncomingLeg = existing?.type === "TRANSFER_IN";
  const [kind, setKind] = React.useState<EntryKind>(existing ? kindOf(existing) : (editing.mode === "create" && editing.kind) || "EXPENSE");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [amount, setAmount] = React.useState(existing ? money.toInput(existing.amountMinor) : "");
  const [date, setDate] = React.useState(existing?.transactionDate ?? todayIso());
  const [accountId, setAccountId] = React.useState(
    (isIncomingLeg ? existing?.counterpartAccountId : existing?.accountId) ?? mainAccount?.id ?? "",
  );
  const [toAccountId, setToAccountId] = React.useState(
    (isIncomingLeg ? existing?.accountId : existing?.counterpartAccountId) ??
      accounts.find((account) => account.id !== mainAccount?.id)?.id ??
      "",
  );
  const [categoryId, setCategoryId] = React.useState<string | null>(existing?.categoryId ?? null);
  const [paid, setPaid] = React.useState(existing ? existing.status === "PAID" : true);
  const [notes, setNotes] = React.useState(existing?.notes ?? "");
  const [installments, setInstallments] = React.useState(1);
  const [tagIds, setTagIds] = React.useState<string[]>(existing?.tagIds ?? []);
  const [amountInvalid, setAmountInvalid] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const { pending, failure, setFailure, run } = useWalletRequest();
  const base = `/api/wallets/${wallet.id}/transactions`;

  const submit = async () => {
    const amountMinor = money.parse(amount);
    if (amountMinor === null || amountMinor <= 0) return setAmountInvalid(true);
    setAmountInvalid(false);
    if (kind === "TRANSFER" && accountId === toAccountId) return setFailure({ error: "invalidInput" });
    const status = paid ? "PAID" : "PENDING";
    const trimmedNotes = notes.trim() || null;

    // An expense charged to a card is a card purchase: it goes to the card's invoice.
    if (!existing && kind === "EXPENSE" && accountId.startsWith(CARD_PREFIX)) {
      const cardId = accountId.slice(CARD_PREFIX.length);
      const ok = await run(() =>
        request("POST", `/api/wallets/${wallet.id}/cards/${cardId}/purchases`, {
          id: newId(),
          mutationId: newId(),
          categoryId,
          description: description.trim(),
          amountMinor,
          transactionDate: date,
          installments,
          notes: trimmedNotes,
          tagIds,
        }),
      );
      if (ok) onSaved();
      return;
    }

    if (existing) {
      // Only what changed goes up; on a transfer the server mirrors shared fields to the other leg.
      const legAccount = kind === "TRANSFER" ? (isIncomingLeg ? toAccountId : accountId) : accountId;
      const patch = Object.fromEntries(
        Object.entries({
          description: description.trim() !== existing.description ? description.trim() : undefined,
          amountMinor: amountMinor !== existing.amountMinor ? amountMinor : undefined,
          transactionDate: date !== existing.transactionDate ? date : undefined,
          accountId: legAccount !== existing.accountId ? legAccount : undefined,
          categoryId: kind !== "TRANSFER" && categoryId && categoryId !== existing.categoryId ? categoryId : undefined,
          status: status !== existing.status ? status : undefined,
          notes: trimmedNotes !== existing.notes ? trimmedNotes : undefined,
        }).filter(([, value]) => value !== undefined),
      );
      // Fields and tags are two writes; tags go second so a refused edit keeps both as they were.
      const ok = await run(async () => {
        if (Object.keys(patch).length) {
          const response = await request("PATCH", `${base}/${existing.id}`, { mutationId: newId(), baseVersion: existing.version, ...patch });
          if (!response.ok) return response;
        }
        return saveEntryTags(request, wallet.id, existing.id, existing.tagIds, tagIds);
      });
      if (ok) onSaved();
      return;
    }
    const ok = await run(() =>
      kind === "TRANSFER"
        ? request("POST", `${base}/transfers`, {
            id: newId(),
            inId: newId(),
            mutationId: newId(),
            fromAccountId: accountId,
            toAccountId,
            description: description.trim(),
            amountMinor,
            transactionDate: date,
            status,
            notes: trimmedNotes,
          })
        : request("POST", base, {
            id: newId(),
            mutationId: newId(),
            type: kind,
            accountId,
            categoryId,
            description: description.trim(),
            amountMinor,
            transactionDate: date,
            status,
            notes: trimmedNotes,
            tagIds,
          }),
    );
    if (ok) onSaved();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await run(() => request("POST", `${base}/${existing.id}/archive`, { mutationId: newId(), baseVersion: existing.version }));
    if (ok) onSaved();
  };

  if (confirmingDelete && existing) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("delete.title")}</DialogTitle>
          <DialogDescription>{kind === "TRANSFER" ? t("delete.transferBody") : t("delete.body")}</DialogDescription>
        </DialogHeader>
        <WalletErrorMessage failure={failure} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
            {t("delete.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending ? <Spinner label={common("loading")} /> : t("delete.confirm")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const title = existing ? (kind === "TRANSFER" ? t("form.editTransferTitle") : t("form.editTitle")) : t("form.createTitle");
  const needsCategory = kind !== "TRANSFER" && !categoryId;
  // A card purchase has installments instead of a paid/pending switch.
  const onCard = !existing && kind === "EXPENSE" && accountId.startsWith(CARD_PREFIX);
  const parsed = money.parse(amount);
  const parsedAmount = parsed && parsed > 0 ? parsed : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
      </DialogHeader>
      {!existing && (
        <SegmentedControl
          aria-label={title}
          value={kind}
          onValueChange={(next) => {
            setKind(next);
            setCategoryId(null);
          }}
          options={(["EXPENSE", "INCOME", "TRANSFER"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }))}
          className="self-start"
        />
      )}
      <WalletErrorMessage failure={failure} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-amount">
            {t("form.amount")} ({wallet.currencyCode})
          </Label>
          <Input
            id="entry-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            autoFocus
            placeholder={money.toInput(0)}
            aria-invalid={amountInvalid || undefined}
            className="text-[15px] font-medium tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-date">{t("form.date")}</Label>
          <Input id="entry-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </div>
      </div>
      {amountInvalid && (
        <p className="-mt-2 text-[11px] text-destructive">{t("form.amountInvalid", { example: money.toInput(1990) })}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entry-description">{t("form.description")}</Label>
        <Input
          id="entry-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          maxLength={DESCRIPTION_MAX}
          placeholder={t("form.descriptionPlaceholder")}
        />
      </div>
      {kind === "TRANSFER" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-from">{t("form.fromAccount")}</Label>
            {/* Editing a transfer moves only the account of the leg being edited. */}
            <AccountSelect
              id="entry-from"
              accounts={accounts}
              value={accountId}
              onValueChange={setAccountId}
              disabled={existing !== null && isIncomingLeg}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-to">{t("form.toAccount")}</Label>
            <AccountSelect
              id="entry-to"
              accounts={accounts}
              value={toAccountId}
              onValueChange={setToAccountId}
              disabled={existing !== null && !isIncomingLeg}
            />
          </div>
          {accountId === toAccountId && <p className="text-[11px] text-destructive sm:col-span-2">{t("form.sameAccount")}</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-category">{t("form.category")}</Label>
            <CategoryPicker id="entry-category" tree={tree} kind={kind} value={categoryId} onValueChange={setCategoryId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-account">{t("form.account")}</Label>
            <AccountSelect
              id="entry-account"
              accounts={accounts}
              cards={!existing && kind === "EXPENSE" ? cards : []}
              value={accountId}
              onValueChange={setAccountId}
            />
          </div>
        </div>
      )}
      {onCard ? (
        <InstallmentsSelect value={installments} onChange={setInstallments} totalMinor={parsedAmount} format={money.format} />
      ) : (
        <div className="flex items-start gap-2">
          <Checkbox id="entry-paid" checked={paid} onCheckedChange={(checked) => setPaid(checked === true)} />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="entry-paid">{t("form.paid")}</Label>
            <p className="text-[11px] text-muted-foreground">{t("form.paidHint")}</p>
          </div>
        </div>
      )}
      {kind !== "TRANSFER" && (
        <TagPicker wallet={wallet} tags={tags.tags} value={tagIds} onChange={setTagIds} onCreated={tags.add} />
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entry-notes">{t("form.notes")}</Label>
        <textarea
          id="entry-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={NOTES_MAX}
          rows={2}
          className="min-h-14 rounded-md border border-input bg-card px-2.5 py-1.5 text-[13px] shadow-[0_1px_1px_rgb(0_0_0/0.05)] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 dark:bg-white/5"
        />
      </div>
      <DialogFooter className={cn(existing && "sm:justify-between")}>
        {existing && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
            <Trash2Icon />
            {t("form.delete")}
          </Button>
        )}
        <div className="flex gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={pending || !description.trim() || needsCategory || (kind === "TRANSFER" && accountId === toAccountId)}
          >
            {pending ? <Spinner label={common("loading")} /> : existing ? t("form.save") : t("form.create")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
