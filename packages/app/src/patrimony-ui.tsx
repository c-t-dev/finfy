"use client";

import * as React from "react";
import { ArchiveRestoreIcon, PlusIcon } from "lucide-react";
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
import { cn } from "@packages/ui/lib/utils";
import type { AssetType } from "@packages/shared/finance";
import { FULL_BPS } from "@packages/shared/finance";
import { newId } from "@packages/shared/ids";
import { ASSET_NAME_MAX, ownedPart, TYPES_BY_KIND, type Asset, type NetWorth } from "@packages/shared/patrimony";
import { can } from "@packages/shared/roles";
import { NOTES_MAX } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "./api";
import { ConfirmDialog } from "./cards-ui";
import { useTranslations } from "./i18n";
import { useMoney } from "./money";
import { useWalletRequest, WalletErrorMessage } from "./wallet-ui";

/** Net worth summary for the top of the accounts screen. */
export function NetWorthCard({ wallet, reloadKey }: { wallet: Wallet; reloadKey: number }) {
  const t = useTranslations("app.patrimony");
  const money = useMoney(wallet.currencyCode);
  const data = useResource<NetWorth>(`/api/wallets/${wallet.id}/net-worth`);
  const { reload } = data;
  // Accounts, cards or assets changed elsewhere on the screen.
  React.useEffect(() => {
    if (reloadKey > 0) reload();
  }, [reloadKey, reload]);
  if (data.state.status !== "ready") return null;
  const value = data.state.value;
  const parts: [string, number, boolean][] = [
    [t("accounts"), value.accountsMinor, false],
    [t("assets"), value.assetsMinor, false],
    [t("liabilities"), value.liabilitiesMinor, true],
    [t("cardDebt"), value.cardDebtMinor, true],
  ];
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{t("netWorth")}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", value.netWorthMinor < 0 && "text-destructive")}>{money.format(value.netWorthMinor)}</div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px] sm:grid-cols-4">
        {parts.map(([label, amount, minus]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">
              {minus && amount > 0 ? "−" : ""}
              {money.format(amount)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Assets and debts list, for the accounts screen. `onChanged` refreshes the net worth. */
export function AssetsSection({ wallet, onChanged }: { wallet: Wallet; onChanged: () => void }) {
  const t = useTranslations("app.patrimony");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const canEdit = can(wallet.role, "editEntries");
  const list = useResource<{ assets: Asset[] }>(`/api/wallets/${wallet.id}/assets`);
  const [showArchived, setShowArchived] = React.useState(false);
  const archived = useResource<{ assets: Asset[] }>(showArchived ? `/api/wallets/${wallet.id}/assets?archived=1` : null);
  const [editing, setEditing] = React.useState<{ kind: "ASSET" | "LIABILITY"; asset: Asset | null } | null>(null);
  const items = list.state.status === "ready" ? list.state.value.assets : [];
  const refresh = () => {
    list.reload();
    if (showArchived) archived.reload();
    onChanged();
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{t("title")}</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing({ kind: "LIABILITY", asset: null })}>
              <PlusIcon />
              {t("newLiability")}
            </Button>
            <Button onClick={() => setEditing({ kind: "ASSET", asset: null })}>
              <PlusIcon />
              {t("newAsset")}
            </Button>
          </div>
        )}
      </div>
      {list.state.status === "ready" && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
          <p className="text-[13px] font-medium">{t("empty")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
          {items.map((asset) => {
            const content = (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-medium">{asset.name}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {t(`kinds.${asset.kind}`)} · {t(`types.${asset.type}`)}
                    {asset.ownershipBps < FULL_BPS && ` · ${t("share", { percent: asset.ownershipBps / 100 })}`}
                  </div>
                </div>
                <span className={cn("shrink-0 text-[13px] font-medium tabular-nums", asset.kind === "LIABILITY" && "text-destructive")}>
                  {asset.kind === "LIABILITY" ? "−" : ""}
                  {money.format(ownedPart(asset.currentValueMinor, asset.ownershipBps))}
                </span>
              </>
            );
            return (
              <li key={asset.id}>
                {canEdit ? (
                  <button type="button" onClick={() => setEditing({ kind: asset.kind, asset })} className="flex w-full items-center gap-3 px-4 py-2.5 outline-none hover:bg-foreground/[0.03] focus-visible:bg-foreground/5">
                    {content}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">{content}</div>
                )}
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
        (archived.state.value.assets.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("archived.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60">
            {archived.state.value.assets.map((asset) => (
              <li key={asset.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">{asset.name}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await request("POST", `/api/wallets/${wallet.id}/assets/${asset.id}/restore`, { mutationId: newId(), baseVersion: asset.version }).catch(() => null);
                      refresh();
                    }}
                  >
                    <ArchiveRestoreIcon />
                    {t("archived.restore")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}
      <AssetDialog
        wallet={wallet}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </section>
  );
}

function AssetDialog({
  wallet,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  editing: { kind: "ASSET" | "LIABILITY"; asset: Asset | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && <AssetForm key={editing.asset?.id ?? editing.kind} wallet={wallet} kind={editing.kind} asset={editing.asset} onCancel={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function AssetForm({
  wallet,
  kind,
  asset,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  kind: "ASSET" | "LIABILITY";
  asset: Asset | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.patrimony");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [name, setName] = React.useState(asset?.name ?? "");
  const [type, setType] = React.useState<AssetType>(asset?.type ?? TYPES_BY_KIND[kind][0]);
  const [current, setCurrent] = React.useState(asset ? money.toInput(asset.currentValueMinor) : "");
  const [purchase, setPurchase] = React.useState(asset?.purchaseValueMinor != null ? money.toInput(asset.purchaseValueMinor) : "");
  const [purchaseDate, setPurchaseDate] = React.useState(asset?.purchaseDate ?? "");
  const [share, setShare] = React.useState(String((asset?.ownershipBps ?? FULL_BPS) / 100));
  const [notes, setNotes] = React.useState(asset?.notes ?? "");
  const [invalid, setInvalid] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();
  const debt = kind === "LIABILITY";

  if (archiving && asset) {
    return (
      <ConfirmDialog
        open
        title={t("archive.title", { name: asset.name })}
        body={t("archive.body")}
        confirm={t("archive.confirm")}
        cancel={t("form.cancel")}
        onClose={() => setArchiving(false)}
        action={() => request("POST", `/api/wallets/${wallet.id}/assets/${asset.id}/archive`, { mutationId: newId(), baseVersion: asset.version })}
        onDone={onSaved}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const currentValueMinor = money.parse(current);
        const purchaseValueMinor = purchase.trim() ? money.parse(purchase) : null;
        const ownershipBps = Math.round(Number(share.replace(",", ".")) * 100);
        if (currentValueMinor === null || currentValueMinor < 0 || (purchase.trim() && (purchaseValueMinor === null || purchaseValueMinor < 0)) || !(ownershipBps >= 1 && ownershipBps <= FULL_BPS)) {
          return setInvalid(true);
        }
        setInvalid(false);
        const values = { name: name.trim(), type, currentValueMinor, purchaseValueMinor, purchaseDate: purchaseDate || null, ownershipBps, notes: notes.trim() || null };
        const ok = await run(() =>
          asset
            ? request("PATCH", `/api/wallets/${wallet.id}/assets/${asset.id}`, {
                mutationId: newId(),
                baseVersion: asset.version,
                ...Object.fromEntries(Object.entries(values).filter(([key, value]) => asset[key as keyof Asset] !== value)),
              })
            : request("POST", `/api/wallets/${wallet.id}/assets`, { id: newId(), mutationId: newId(), kind, ...values }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{asset ? t("form.editTitle") : debt ? t("form.createLiabilityTitle") : t("form.createAssetTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("title")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-name">{t("form.name")}</Label>
          <Input id="asset-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={ASSET_NAME_MAX} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-type">{t("form.type")}</Label>
          <Select value={type} onValueChange={(value) => setType(value as AssetType)}>
            <SelectTrigger id="asset-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES_BY_KIND[kind].map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`types.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-current">
            {debt ? t("form.currentDebt") : t("form.current")} ({wallet.currencyCode})
          </Label>
          <Input id="asset-current" inputMode="decimal" value={current} onChange={(event) => setCurrent(event.target.value)} required placeholder={money.toInput(0)} className="tabular-nums" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-share">{t("form.ownership")}</Label>
          <Input id="asset-share" inputMode="decimal" value={share} onChange={(event) => setShare(event.target.value)} className="tabular-nums" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-purchase">{debt ? t("form.purchaseDebt") : t("form.purchase")}</Label>
          <Input id="asset-purchase" inputMode="decimal" value={purchase} onChange={(event) => setPurchase(event.target.value)} placeholder={money.toInput(0)} className="tabular-nums" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-date">{t("form.purchaseDate")}</Label>
          <Input id="asset-date" type="date" value={purchaseDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setPurchaseDate(event.target.value)} />
        </div>
      </div>
      {invalid && <p className="-mt-2 text-[11px] text-destructive">{t("form.invalid")}</p>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-notes">{t("form.notes")}</Label>
        <Input id="asset-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={NOTES_MAX} />
      </div>
      <DialogFooter className={cn(asset && "sm:justify-between")}>
        {asset && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setArchiving(true)}>
            {t("form.archive")}
          </Button>
        )}
        <div className="flex gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={pending || !name.trim() || !current.trim()}>
            {pending ? <Spinner label={common("loading")} /> : asset ? t("form.save") : t("form.create")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
