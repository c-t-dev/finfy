"use client";

import * as React from "react";
import { ChevronLeftIcon, RepeatIcon } from "lucide-react";
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
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { newId } from "@packages/shared/ids";
import type { RecurrenceFrequency } from "@packages/shared/finance";
import type { Recurrence } from "@packages/shared/recurrences";
import { can } from "@packages/shared/roles";
import { DESCRIPTION_MAX } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { ConfirmDialog, useShortDate } from "../cards-ui";
import { CategoryBadge, CategoryPicker, useCategories, useCategoryLabel, type CategoryTree } from "../categories";
import { useTranslations } from "../i18n";
import { useMoney } from "../money";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { RepeatSelect } from "../recurrences-ui";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";
import { useWalletAccounts } from "./statement";

const STATEMENT_PATH = APP_ROUTES.find((route) => route.key === "statement")!.path;

export function RecurrencesScreen() {
  const t = useTranslations("app.recurrences");
  const { current } = useWallets();
  const { Link } = useAppNavigation();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href={STATEMENT_PATH} className="flex items-center gap-1 text-[13px] text-primary hover:underline">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-[12px] text-muted-foreground">{t("horizonNote")}</p>
      </div>
      {current && <WalletRecurrences key={current.id} wallet={current} />}
    </div>
  );
}

function WalletRecurrences({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.recurrences");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const shortDate = useShortDate();
  const label = useCategoryLabel();
  const canEdit = can(wallet.role, "editEntries");
  const { names } = useWalletAccounts(wallet.id);
  const { tree } = useCategories(wallet.id);
  const list = useResource<{ recurrences: Recurrence[] }>(`/api/wallets/${wallet.id}/recurrences`);
  const [showEnded, setShowEnded] = React.useState(false);
  const ended = useResource<{ recurrences: Recurrence[] }>(showEnded ? `/api/wallets/${wallet.id}/recurrences?archived=1` : null);
  const [editing, setEditing] = React.useState<Recurrence | null>(null);
  const [ending, setEnding] = React.useState<Recurrence | null>(null);
  const items = list.state.status === "ready" ? list.state.value.recurrences : [];

  const row = (item: Recurrence, open?: () => void) => {
    const category = item.categoryId ? tree?.byId.get(item.categoryId) : undefined;
    const parent = category?.parentId ? tree?.byId.get(category.parentId) : undefined;
    const source = names.get(item.accountId ?? item.creditCardId ?? "") ?? "";
    const content = (
      <>
        <CategoryBadge category={category ?? null} parent={parent ?? null} />
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[13px] font-medium">{item.description}</div>
          <div className="truncate text-[12px] text-muted-foreground">
            {t(`frequencies.${item.frequency}`)} · {category ? label(category) : ""} · {source}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn("text-[13px] font-medium tabular-nums", item.type === "INCOME" && "text-[#248a3d] dark:text-[#30d158]")}>
            {item.type === "INCOME" ? "+" : "−"}
            {money.format(item.amountMinor)}
          </div>
          <div className="text-[11px] text-muted-foreground">{item.nextDate ? t("next", { date: shortDate(item.nextDate) }) : t("ended")}</div>
        </div>
      </>
    );
    return (
      <li key={item.id}>
        {open ? (
          <button type="button" onClick={open} className="flex w-full items-center gap-3 px-4 py-2.5 outline-none hover:bg-foreground/[0.03] focus-visible:bg-foreground/5">
            {content}
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 py-2.5">{content}</div>
        )}
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-3">
      {list.state.status === "loading" && <Spinner label={t("title")} />}
      {list.state.status === "ready" && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
          <RepeatIcon className="size-7 text-primary" aria-hidden />
          <p className="text-[13px] font-medium">{t("empty")}</p>
          <p className="text-[12px] text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item) => row(item, canEdit ? () => setEditing(item) : undefined))}
        </ul>
      )}
      <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowEnded((show) => !show)}>
        {showEnded ? t("archived.hide") : t("archived.show")}
      </Button>
      {showEnded &&
        ended.state.status === "ready" &&
        (ended.state.value.recurrences.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("archived.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60 opacity-80">
            {ended.state.value.recurrences.map((item) => row(item))}
          </ul>
        ))}

      <RecurrenceDialog
        wallet={wallet}
        tree={tree}
        recurrence={editing}
        onClose={() => setEditing(null)}
        onEnd={(item) => {
          setEditing(null);
          setEnding(item);
        }}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
      />
      <ConfirmDialog
        open={ending !== null}
        title={t("end.title", { name: ending?.description ?? "" })}
        body={t("end.body")}
        confirm={t("end.confirm")}
        cancel={t("form.cancel")}
        onClose={() => setEnding(null)}
        action={() => request("POST", `/api/wallets/${wallet.id}/recurrences/${ending!.id}/archive`, { mutationId: newId(), baseVersion: ending!.version })}
        onDone={() => {
          setEnding(null);
          list.reload();
          if (showEnded) ended.reload();
        }}
      />
    </section>
  );
}

function RecurrenceDialog({
  wallet,
  tree,
  recurrence,
  onClose,
  onEnd,
  onSaved,
}: {
  wallet: Wallet;
  tree: CategoryTree | null;
  recurrence: Recurrence | null;
  onClose: () => void;
  onEnd: (recurrence: Recurrence) => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={recurrence !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {recurrence && <RecurrenceForm key={recurrence.id} wallet={wallet} tree={tree} recurrence={recurrence} onCancel={onClose} onEnd={onEnd} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function RecurrenceForm({
  wallet,
  tree,
  recurrence,
  onCancel,
  onEnd,
  onSaved,
}: {
  wallet: Wallet;
  tree: CategoryTree | null;
  recurrence: Recurrence;
  onCancel: () => void;
  onEnd: (recurrence: Recurrence) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.recurrences");
  const entries = useTranslations("app.entries");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [description, setDescription] = React.useState(recurrence.description);
  const [amount, setAmount] = React.useState(money.toInput(recurrence.amountMinor));
  const [categoryId, setCategoryId] = React.useState<string | null>(recurrence.categoryId);
  const [frequency, setFrequency] = React.useState<RecurrenceFrequency>(recurrence.frequency);
  const [endDate, setEndDate] = React.useState(recurrence.endDate ?? "");
  const [invalid, setInvalid] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const amountMinor = money.parse(amount);
        if (amountMinor === null || amountMinor <= 0) return setInvalid(true);
        setInvalid(false);
        const patch = Object.fromEntries(
          Object.entries({
            description: description.trim() !== recurrence.description ? description.trim() : undefined,
            amountMinor: amountMinor !== recurrence.amountMinor ? amountMinor : undefined,
            categoryId: categoryId && categoryId !== recurrence.categoryId ? categoryId : undefined,
            frequency: frequency !== recurrence.frequency ? frequency : undefined,
            endDate: (endDate || null) !== recurrence.endDate ? endDate || null : undefined,
          }).filter(([, value]) => value !== undefined),
        );
        if (!Object.keys(patch).length) return onCancel();
        const ok = await run(() =>
          request("PATCH", `/api/wallets/${wallet.id}/recurrences/${recurrence.id}`, { mutationId: newId(), baseVersion: recurrence.version, ...patch }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("form.editTitle")}</DialogTitle>
        <DialogDescription>{t("form.editHint")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recurrence-description">{t("form.description")}</Label>
        <Input id="recurrence-description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={DESCRIPTION_MAX} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurrence-amount">
            {t("form.amount")} ({wallet.currencyCode})
          </Label>
          <Input id="recurrence-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={invalid || undefined} className="tabular-nums" />
        </div>
        <RepeatSelect id="recurrence-frequency" value={frequency} onValueChange={(value) => setFrequency(value as RecurrenceFrequency)} label={t("form.frequency")} withNever={false} />
      </div>
      {invalid && <p className="-mt-2 text-[11px] text-destructive">{entries("form.amountInvalid", { example: money.toInput(1990) })}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurrence-category">{t("form.category")}</Label>
          <CategoryPicker id="recurrence-category" tree={tree} kind={recurrence.type} value={categoryId} onValueChange={setCategoryId} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurrence-end">{t("until")}</Label>
          <Input id="recurrence-end" type="date" value={endDate} min={recurrence.startDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="ghost" className="text-destructive" onClick={() => onEnd(recurrence)}>
          {t("end.action")}
        </Button>
        <div className="flex gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={pending || !description.trim()}>
            {pending ? <Spinner label={common("loading")} /> : t("form.save")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
