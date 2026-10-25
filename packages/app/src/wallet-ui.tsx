"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, WalletIcon } from "lucide-react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import type { CurrencyCode } from "@packages/shared/money";
import { CURRENCY_CODES, WALLET_NAME_MAX } from "@packages/shared/wallets";
import { useTranslations } from "./i18n";
import { useWallets, type WalletFailure } from "./wallets";

/** Translated text of a wallet API failure. */
export function WalletErrorMessage({ failure }: { failure: WalletFailure | null }) {
  const t = useTranslations("errors.wallet");
  if (!failure) return null;
  const text =
    failure.error === "rateLimited"
      ? t("rateLimited", { minutes: Math.max(1, Math.ceil((failure.retryAfterSeconds ?? 60) / 60)) })
      : t(failure.error);
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
      {text}
    </p>
  );
}

/** Runs one wallet request, keeping the pending flag and the last failure. */
export function useWalletRequest() {
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<WalletFailure | null>(null);
  const run = async <T,>(request: () => Promise<{ ok: true; value: T } | ({ ok: false } & WalletFailure)>) => {
    setPending(true);
    setFailure(null);
    try {
      const response = await request();
      if (!response.ok) setFailure(response);
      return response.ok;
    } catch {
      setFailure({ error: "unavailable" });
      return false;
    } finally {
      setPending(false);
    }
  };
  return { pending, failure, setFailure, run };
}

export function CurrencySelect({
  id,
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  value: CurrencyCode;
  onValueChange: (value: CurrencyCode) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("app.wallet.currencies");
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as CurrencyCode)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCY_CODES.map((code) => (
          <SelectItem key={code} value={code}>
            {t(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Name and currency of a new wallet; the creator becomes its owner. */
export function CreateWalletDialog({
  open,
  onOpenChange,
  defaultCurrency = "EUR",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency?: CurrencyCode;
}) {
  const t = useTranslations("app.wallet.create");
  const common = useTranslations("common");
  const { create } = useWallets();
  const [currency, setCurrency] = React.useState<CurrencyCode>(defaultCurrency);
  const { pending, failure, setFailure, run } = useWalletRequest();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFailure(null);
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const name = String(new FormData(event.currentTarget).get("wallet-name")).trim();
            if (await run(() => create(name, currency))) onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>
          <WalletErrorMessage failure={failure} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wallet-name">{t("name")}</Label>
            <Input
              id="wallet-name"
              name="wallet-name"
              required
              autoFocus
              maxLength={WALLET_NAME_MAX}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wallet-currency">{t("currency")}</Label>
            <CurrencySelect id="wallet-currency" value={currency} onValueChange={setCurrency} />
            <p className="text-[11px] text-muted-foreground">{t("currencyHint")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner label={common("loading")} /> : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Current wallet, the list to switch to, and "New wallet". */
export function WalletSwitcher() {
  const t = useTranslations("app.wallet");
  const { wallets, current, select } = useWallets();
  const [creating, setCreating] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("switch")}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-left outline-none transition-colors hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">{t("label")}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[13px]">
                <WalletIcon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className={current ? "truncate font-medium" : "truncate text-foreground/70"}>
                  {current ? current.name : t("none")}
                </span>
              </div>
            </div>
            <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          {wallets.length > 0 && (
            <>
              <DropdownMenuLabel>{t("switch")}</DropdownMenuLabel>
              {wallets.map((wallet) => (
                <DropdownMenuItem key={wallet.id} onSelect={() => select(wallet.id)}>
                  <span className="min-w-0 flex-1 truncate">{wallet.name}</span>
                  <span className="text-[11px] opacity-70">{wallet.currencyCode}</span>
                  <CheckIcon className={wallet.id === current?.id ? "" : "invisible"} aria-hidden />
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <PlusIcon aria-hidden />
            {t("new")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWalletDialog open={creating} onOpenChange={setCreating} defaultCurrency={current?.currencyCode} />
    </>
  );
}
