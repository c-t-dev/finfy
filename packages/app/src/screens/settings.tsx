"use client";

import * as React from "react";
import { ArchiveIcon, ChevronRightIcon, TagsIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@packages/ui/components/card";
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
import { Spinner } from "@packages/ui/components/spinner";
import type { CurrencyCode } from "@packages/shared/money";
import { can } from "@packages/shared/roles";
import type { Wallet } from "@packages/shared/wallets";
import { WALLET_NAME_MAX } from "@packages/shared/wallets";
import { useTranslations } from "../i18n";
import { MembersCard } from "../members-ui";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { CurrencySelect, useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";

export function SettingsScreen() {
  const t = useTranslations("app");
  const { current } = useWallets();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>
      {current ? (
        // Keyed by wallet, so switching wallets resets the forms.
        <React.Fragment key={current.id}>
          <WalletSettings wallet={current} />
          <MembersCard wallet={current} />
          <CategoriesLink />
          {can(current.role, "archiveWallet") && <ArchiveWallet wallet={current} />}
        </React.Fragment>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t("settings.wallet.none")}</p>
      )}
    </div>
  );
}

const CATEGORIES_PATH = `${APP_ROUTES.find((route) => route.key === "settings")!.path}/categories`;

function CategoriesLink() {
  const t = useTranslations("app.categories");
  const { Link } = useAppNavigation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settingsTitle")}</CardTitle>
        <CardDescription>{t("settingsBody")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href={CATEGORIES_PATH}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium shadow-[0_1px_1px_rgb(0_0_0/0.06)] outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-white/10"
        >
          <TagsIcon className="size-4" aria-hidden />
          {t("manage")}
          <ChevronRightIcon className="size-4 opacity-60" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

function WalletSettings({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.settings.wallet");
  const roles = useTranslations("app.wallet.roles");
  const common = useTranslations("common");
  const { update } = useWallets();
  const [name, setName] = React.useState(wallet.name);
  const [currency, setCurrency] = React.useState<CurrencyCode>(wallet.currencyCode);
  const [saved, setSaved] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();
  const editable = can(wallet.role, "editWallet");
  const dirty = name.trim() !== wallet.name || currency !== wallet.currencyCode;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("role", { role: roles(wallet.role) })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaved(false);
            const ok = await run(() =>
              update({
                name: name.trim() !== wallet.name ? name.trim() : undefined,
                currencyCode: currency !== wallet.currencyCode ? currency : undefined,
              }),
            );
            setSaved(ok);
          }}
        >
          <WalletErrorMessage failure={failure} />
          {!editable && <p className="text-[12px] text-muted-foreground">{t("readOnly")}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-wallet-name">{t("name")}</Label>
              <Input
                id="settings-wallet-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                required
                maxLength={WALLET_NAME_MAX}
                disabled={!editable}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-wallet-currency">{t("currency")}</Label>
              <CurrencySelect
                id="settings-wallet-currency"
                value={currency}
                onValueChange={(next) => {
                  setCurrency(next);
                  setSaved(false);
                }}
                disabled={!editable || wallet.currencyLocked}
              />
              {wallet.currencyLocked && <p className="text-[11px] text-muted-foreground">{t("currencyLocked")}</p>}
            </div>
          </div>
          {editable && (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending || !dirty || !name.trim()}>
                {pending ? <Spinner label={common("loading")} /> : t("save")}
              </Button>
              {saved && !dirty && (
                <span role="status" className="text-[12px] text-muted-foreground">
                  {t("saved")}
                </span>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/** Archiving asks for the password again (step-up, wiki/decisoes/0004). */
function ArchiveWallet({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.settings.archive");
  const common = useTranslations("common");
  const { archive } = useWallets();
  const [open, setOpen] = React.useState(false);
  const { pending, failure, setFailure, run } = useWalletRequest();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <ArchiveIcon />
          {t("open")}
        </Button>
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setFailure(null);
          setOpen(next);
        }}
      >
        <DialogContent closeLabel={common("close")} className="max-w-sm">
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const password = String(new FormData(event.currentTarget).get("archive-password"));
              // On success the wallet leaves the list and this card unmounts.
              await run(() => archive(password));
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("confirmTitle", { name: wallet.name })}</DialogTitle>
              <DialogDescription>{t("body")}</DialogDescription>
            </DialogHeader>
            <WalletErrorMessage failure={failure} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="archive-password">{t("password")}</Label>
              <Input
                id="archive-password"
                name="archive-password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">{t("passwordHint")}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? <Spinner label={common("loading")} /> : t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
