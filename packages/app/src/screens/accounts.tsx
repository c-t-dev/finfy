"use client";

import * as React from "react";
import { ArchiveIcon, ArchiveRestoreIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, StarIcon, WalletCardsIcon } from "lucide-react";
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
import { ACCOUNT_COLORS, ACCOUNT_NAME_MAX, type Account, type AccountColor } from "@packages/shared/accounts";
import { ACCOUNT_TYPES, type AccountType } from "@packages/shared/finance";
import { newId } from "@packages/shared/ids";
import { CURRENCIES, formatMoney, parseMoney, type Currency } from "@packages/shared/money";
import { can } from "@packages/shared/roles";
import type { Wallet } from "@packages/shared/wallets";
import { useAccountClient, useAccountList } from "../accounts";
import { CardsSection } from "../cards-ui";
import { useLocale, useTranslations } from "../i18n";
import { decimalSeparator, minorToInput } from "../money";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";

/** Apple system colors, so the dots match the macOS look (wiki/decisoes/0008). */
const COLOR_CLASS: Record<AccountColor, string> = {
  blue: "bg-[#007aff]",
  green: "bg-[#34c759]",
  orange: "bg-[#ff9500]",
  red: "bg-[#ff3b30]",
  purple: "bg-[#af52de]",
  pink: "bg-[#ff2d55]",
  teal: "bg-[#30b0c7]",
  gray: "bg-[#8e8e93]",
};

export function AccountsScreen() {
  const t = useTranslations("app");
  const { current } = useWallets();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("nav.accounts")}</h1>
      {current ? (
        <WalletAccounts key={current.id} wallet={current} />
      ) : (
        <p className="text-[13px] text-muted-foreground">{t("accounts.noWallet")}</p>
      )}
    </div>
  );
}

type Editing = { mode: "create" } | { mode: "edit"; account: Account } | null;

function WalletAccounts({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.accounts");
  const locale = useLocale();
  const currency = CURRENCIES[wallet.currencyCode];
  const canEdit = can(wallet.role, "editEntries");
  const [showArchived, setShowArchived] = React.useState(false);
  const active = useAccountList(wallet.id, false);
  const archived = useAccountList(wallet.id, true, showArchived);
  const [editing, setEditing] = React.useState<Editing>(null);
  const [archiving, setArchiving] = React.useState<Account | null>(null);
  const client = useAccountClient();

  // A write can move the "main" mark between accounts, so both lists reload.
  const reload = () => {
    active.reload();
    if (showArchived) archived.reload();
  };
  // Menu actions reload either way: on a failure (e.g. a newer version), the list shows the current state.
  const run = async (action: () => Promise<{ ok: boolean }>) => {
    await action().catch(() => null);
    reload();
  };
  const makeMain = (account: Account) =>
    run(() => client.update(wallet.id, account.id, { mutationId: newId(), baseVersion: account.version, isDefault: true }));
  const restore = (account: Account) =>
    run(() => client.restore(wallet.id, account.id, { mutationId: newId(), baseVersion: account.version }));

  const accounts = active.state.status === "ready" ? active.state.accounts : [];
  const total = accounts.reduce((sum, account) => sum + account.balanceMinor, 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{t("section")}</h2>
          {active.state.status === "ready" && accounts.length > 0 && (
            <p className="text-[13px] text-muted-foreground">
              {t("total")}: <span className="font-medium tabular-nums text-foreground">{formatMoney(total, currency, locale)}</span>
            </p>
          )}
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({ mode: "create" })}>
            <PlusIcon />
            {t("new")}
          </Button>
        )}
      </div>
      {!canEdit && <p className="text-[12px] text-muted-foreground">{t("readOnly")}</p>}

      {active.state.status === "loading" && <Spinner label={t("section")} />}
      {active.state.status === "error" && (
        <div className="flex items-center gap-3 text-[13px] text-destructive">
          {t("loadError")}
          <Button variant="secondary" size="sm" onClick={active.reload}>
            {t("retry")}
          </Button>
        </div>
      )}
      {active.state.status === "ready" &&
        (accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <WalletCardsIcon className="size-7 text-primary" aria-hidden />
            <h3 className="text-[14px] font-semibold">{t("emptyTitle")}</h3>
            <p className="max-w-sm text-[13px] text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                currency={currency}
                canEdit={canEdit}
                onEdit={() => setEditing({ mode: "edit", account })}
                onMakeMain={() => void makeMain(account)}
                onArchive={() => setArchiving(account)}
              />
            ))}
          </ul>
        ))}

      <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowArchived((show) => !show)}>
        {showArchived ? t("archived.hide") : t("archived.show")}
      </Button>
      {showArchived &&
        archived.state.status === "ready" &&
        (archived.state.accounts.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("archived.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60 opacity-80">
            {archived.state.accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                currency={currency}
                canEdit={canEdit}
                onRestore={() => void restore(account)}
              />
            ))}
          </ul>
        ))}

      <AccountFormDialog
        wallet={wallet}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ArchiveAccountDialog
        wallet={wallet}
        account={archiving}
        onClose={() => setArchiving(null)}
        onArchived={() => {
          setArchiving(null);
          reload();
        }}
      />
      {active.state.status === "ready" && (
        <div className="mt-4">
          <CardsSection wallet={wallet} accounts={accounts} />
        </div>
      )}
    </section>
  );
}

function AccountRow({
  account,
  currency,
  canEdit,
  onEdit,
  onMakeMain,
  onArchive,
  onRestore,
}: {
  account: Account;
  currency: Currency;
  canEdit: boolean;
  onEdit?: () => void;
  onMakeMain?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const t = useTranslations("app.accounts");
  const locale = useLocale();
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={cn("size-2.5 shrink-0 rounded-full", COLOR_CLASS[account.color])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{account.name}</span>
          {account.isDefault && (
            <span className="rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-medium text-primary">{t("main")}</span>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground">{t(`types.${account.type}`)}</div>
      </div>
      <span className={cn("text-[13px] font-medium tabular-nums", account.balanceMinor < 0 && "text-destructive")}>
        {formatMoney(account.balanceMinor, currency, locale)}
      </span>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("actions.menu", { name: account.name })}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {account.archived ? (
              <DropdownMenuItem onSelect={onRestore}>
                <ArchiveRestoreIcon aria-hidden />
                {t("actions.restore")}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon aria-hidden />
                  {t("actions.edit")}
                </DropdownMenuItem>
                {!account.isDefault && (
                  <DropdownMenuItem onSelect={onMakeMain}>
                    <StarIcon aria-hidden />
                    {t("actions.makeMain")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={onArchive}>
                  <ArchiveIcon aria-hidden />
                  {t("actions.archive")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function AccountFormDialog({
  wallet,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && (
          <AccountForm
            key={editing.mode === "edit" ? editing.account.id : "new"}
            wallet={wallet}
            account={editing.mode === "edit" ? editing.account : null}
            onCancel={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({
  wallet,
  account,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  account: Account | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.accounts");
  const common = useTranslations("common");
  const locale = useLocale();
  const client = useAccountClient();
  const currency = CURRENCIES[wallet.currencyCode];
  const separator = decimalSeparator(locale);
  const [name, setName] = React.useState(account?.name ?? "");
  const [type, setType] = React.useState<AccountType>(account?.type ?? "CHECKING");
  const [color, setColor] = React.useState<AccountColor>(account?.color ?? "blue");
  const [balance, setBalance] = React.useState(account ? minorToInput(account.initialBalanceMinor, currency, separator) : "");
  const [isDefault, setIsDefault] = React.useState(account?.isDefault ?? false);
  const [balanceInvalid, setBalanceInvalid] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const initialBalanceMinor = balance.trim() === "" ? 0 : parseMoney(balance, currency, separator);
        if (initialBalanceMinor === null) return setBalanceInvalid(true);
        setBalanceInvalid(false);
        const ok = await run(() =>
          account
            ? client.update(wallet.id, account.id, {
                mutationId: newId(),
                baseVersion: account.version,
                name: name.trim() !== account.name ? name.trim() : undefined,
                type: type !== account.type ? type : undefined,
                initialBalanceMinor: initialBalanceMinor !== account.initialBalanceMinor ? initialBalanceMinor : undefined,
                color: color !== account.color ? color : undefined,
                isDefault: isDefault && !account.isDefault ? true : undefined,
              })
            : client.create(wallet.id, {
                id: newId(),
                mutationId: newId(),
                name: name.trim(),
                type,
                initialBalanceMinor,
                color,
                isDefault: isDefault || undefined,
              }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{account ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("form.initialBalanceHint")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">{t("form.name")}</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
          maxLength={ACCOUNT_NAME_MAX}
          placeholder={t("form.namePlaceholder")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-type">{t("form.type")}</Label>
          <Select value={type} onValueChange={(next) => setType(next as AccountType)}>
            <SelectTrigger id="account-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`types.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-balance">
            {t("form.initialBalance")} ({wallet.currencyCode})
          </Label>
          <Input
            id="account-balance"
            inputMode="decimal"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            placeholder={minorToInput(0, currency, separator)}
            aria-invalid={balanceInvalid || undefined}
            aria-describedby="account-balance-hint"
            className="tabular-nums"
          />
        </div>
      </div>
      <p id="account-balance-hint" className={cn("-mt-2 text-[11px]", balanceInvalid ? "text-destructive" : "text-muted-foreground")}>
        {balanceInvalid
          ? t("form.initialBalanceInvalid", { example: minorToInput(-123456, currency, separator) })
          : t("form.initialBalanceHint")}
      </p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium">{t("form.color")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {ACCOUNT_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={color === value}
              aria-label={t(`colors.${value}`)}
              title={t(`colors.${value}`)}
              onClick={() => setColor(value)}
              className={cn(
                "size-6 rounded-full outline-none ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40",
                COLOR_CLASS[value],
                color === value && "ring-2 ring-foreground/70",
              )}
            />
          ))}
        </div>
      </fieldset>
      {!account?.isDefault && (
        <div className="flex items-start gap-2">
          <Checkbox id="account-default" checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="account-default">{t("form.isDefault")}</Label>
            <p className="text-[11px] text-muted-foreground">{t("form.isDefaultHint")}</p>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Spinner label={common("loading")} /> : account ? t("form.save") : t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ArchiveAccountDialog({
  wallet,
  account,
  onClose,
  onArchived,
}: {
  wallet: Wallet;
  account: Account | null;
  onClose: () => void;
  onArchived: () => void;
}) {
  const t = useTranslations("app.accounts.archive");
  const common = useTranslations("common");
  const client = useAccountClient();
  const { pending, failure, setFailure, run } = useWalletRequest();
  return (
    <Dialog
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) {
          setFailure(null);
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title", { name: account?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <WalletErrorMessage failure={failure} />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (!account) return;
              const ok = await run(() =>
                client.archive(wallet.id, account.id, { mutationId: newId(), baseVersion: account.version }),
              );
              if (ok) onArchived();
            }}
          >
            {pending ? <Spinner label={common("loading")} /> : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
