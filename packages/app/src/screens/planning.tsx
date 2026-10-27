"use client";

import * as React from "react";
import {
  ArchiveRestoreIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react";
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
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { LoadingList, ResourceFeedback } from "../loading";
import { cn } from "@packages/ui/lib/utils";
import { GOAL_TEMPLATES, type GoalTemplate } from "@packages/shared/finance";
import { newId } from "@packages/shared/ids";
import {
  GOAL_NAME_MAX,
  monthlyNeeded,
  type BudgetItem,
  type BudgetMonth,
  type Goal,
  type GoalDetail,
} from "@packages/shared/planning";
import { can } from "@packages/shared/roles";
import { addMonths, NOTES_MAX } from "@packages/shared/transactions";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { ConfirmDialog, useShortDate } from "../cards-ui";
import { CategoryBadge, useCategories, useCategoryLabel, type CategoryTree } from "../categories";
import { useFormatter, useTranslations } from "../i18n";
import { todayIso, useMoney } from "../money";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";

type Tab = "budget" | "goals";

export function PlanningScreen() {
  const t = useTranslations("app");
  const orientation = useTranslations("app.orientation");
  const { current } = useWallets();
  const [tab, setTab] = React.useState<Tab>("budget");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1"><h1 className="text-2xl font-semibold">{t("nav.goals")}</h1>
        <p className="max-w-xl text-[13px] text-muted-foreground">{orientation("planning")}</p></div>
        <SegmentedControl
          aria-label={t("nav.goals")}
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "budget", label: t("planning.tabs.budget") },
            { value: "goals", label: t("planning.tabs.goals") },
          ]}
        />
      </div>
      <p className="text-[13px] text-muted-foreground">{orientation(tab)}</p>
      {!current ? (
        <p className="text-[13px] text-muted-foreground">{t("planning.noWallet")}</p>
      ) : tab === "budget" ? (
        <BudgetTab key={current.id} wallet={current} />
      ) : (
        <GoalsTab key={current.id} wallet={current} />
      )}
    </div>
  );
}

function Progress({ share, tone }: { share: number; tone: "ok" | "near" | "over" | "done" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "ok" && "bg-primary",
          tone === "near" && "bg-[#ff9500]",
          tone === "over" && "bg-destructive",
          tone === "done" && "bg-[#34c759]",
        )}
        style={{ width: `${Math.min(100, Math.max(share > 0 ? 3 : 0, share))}%` }}
      />
    </div>
  );
}

function amountField(
  id: string,
  label: string,
  value: string,
  onChange: (value: string) => void,
  invalid: boolean,
  placeholder: string,
  autoFocus = false,
) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        className="tabular-nums"
      />
    </div>
  );
}

// ---------- Budget ----------

function BudgetTab({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.planning");
  const format = useFormatter();
  const money = useMoney(wallet.currencyCode);
  const label = useCategoryLabel();
  const request = useApi();
  const canEdit = can(wallet.role, "editEntries");
  const [month, setMonth] = React.useState(() => todayIso().slice(0, 7));
  const budget = useResource<BudgetMonth>(`/api/wallets/${wallet.id}/budget/${month}`);
  const { tree } = useCategories(wallet.id);
  const [editing, setEditing] = React.useState<{ item: BudgetItem | null } | null>(null);

  const items = budget.state.status === "ready" ? budget.state.value.items : [];
  const totalLimit = items.reduce((sum, item) => sum + item.amountMinor, 0);
  const totalSpent = items.reduce((sum, item) => sum + item.spentMinor, 0);
  const monthLabel = format.dateTime(new Date(`${month}-15T12:00:00`), { month: "long", year: "numeric" });
  const sorted = [...items].sort((a, b) => b.spentMinor / (b.amountMinor || 1) - a.spentMinor / (a.amountMinor || 1));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={t("tabs.budget")} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeftIcon />
          </Button>
          <span className="inline-block min-w-36 text-center text-[15px] font-semibold first-letter:uppercase">{monthLabel}</span>
          <Button variant="ghost" size="icon-sm" aria-label={t("tabs.budget")} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRightIcon />
          </Button>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await request("POST", `/api/wallets/${wallet.id}/budget/${month}/copy-previous`, { mutationId: newId() }).catch(() => null);
                budget.reload();
              }}
            >
              <CopyIcon />
              {t("budget.copyPrevious")}
            </Button>
            <Button onClick={() => setEditing({ item: null })}>
              <PlusIcon />
              {t("budget.setLimit")}
            </Button>
          </div>
        )}
      </div>
      {!canEdit && <p className="text-[12px] text-muted-foreground">{t("readOnly")}</p>}
      {budget.state.status === "loading" && <LoadingList />}
      {budget.state.status === "error" && (
        <div className="flex items-center gap-3 text-[13px] text-destructive">
          {t("loadError")}
          <Button variant="secondary" size="sm" onClick={budget.reload}>
            {t("retry")}
          </Button>
        </div>
      )}
      {budget.state.status === "ready" && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
          <p className="text-[13px] font-medium">{t("budget.empty")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("budget.emptyHint")}</p>
        </div>
      )}
      {items.length > 0 && (
        <>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">{t("budget.total")}</span>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {t("budget.spentOf", { spent: money.format(totalSpent), limit: money.format(totalLimit) })}
              </span>
            </div>
            <div className="mt-2">
              <Progress share={totalLimit ? (totalSpent / totalLimit) * 100 : 0} tone={totalSpent > totalLimit ? "over" : "ok"} />
            </div>
          </div>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {sorted.map((item) => {
              const category = tree?.byId.get(item.categoryId);
              const share = item.amountMinor ? (item.spentMinor / item.amountMinor) * 100 : item.spentMinor > 0 ? 101 : 0;
              const tone = share > 100 ? "over" : item.alertPercentage && share >= item.alertPercentage ? "near" : "ok";
              const rest = item.amountMinor - item.spentMinor;
              const content = (
                <>
                  <CategoryBadge category={category ?? null} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{category ? label(category) : ""}</span>
                        {tone !== "ok" && (
                          <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium", tone === "over" ? "bg-destructive/12 text-destructive" : "bg-[#ff9500]/15 text-[#c93400] dark:text-[#ffb340]")}>
                            {tone === "over" ? t("budget.exceeded") : t("budget.near")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {t("budget.spentOf", { spent: money.format(item.spentMinor), limit: money.format(item.amountMinor) })}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Progress share={share} tone={tone} />
                    </div>
                    <div className={cn("mt-1 text-[11px]", rest < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {rest >= 0 ? t("budget.left", { amount: money.format(rest) }) : t("budget.over", { amount: money.format(-rest) })}
                    </div>
                  </div>
                </>
              );
              return (
                <li key={item.id}>
                  {canEdit ? (
                    <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-foreground/[0.03] focus-visible:bg-foreground/5" onClick={() => setEditing({ item })}>
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {budget.state.status === "ready" && budget.state.value.unbudgetedSpentMinor > 0 && (
        <p className="text-[12px] text-muted-foreground">{t("budget.unbudgeted", { amount: money.format(budget.state.value.unbudgetedSpentMinor) })}</p>
      )}

      <BudgetItemDialog
        wallet={wallet}
        month={month}
        tree={tree}
        taken={new Set(items.map((item) => item.categoryId))}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          budget.reload();
        }}
      />
    </section>
  );
}

function BudgetItemDialog({
  wallet,
  month,
  tree,
  taken,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  month: string;
  tree: CategoryTree | null;
  taken: Set<string>;
  editing: { item: BudgetItem | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        {editing && (
          <BudgetItemForm key={editing.item?.id ?? "new"} wallet={wallet} month={month} tree={tree} taken={taken} item={editing.item} onCancel={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BudgetItemForm({
  wallet,
  month,
  tree,
  taken,
  item,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  month: string;
  tree: CategoryTree | null;
  taken: Set<string>;
  item: BudgetItem | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.planning.budget");
  const common = useTranslations("common");
  const label = useCategoryLabel();
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [categoryId, setCategoryId] = React.useState(item?.categoryId ?? "");
  const [amount, setAmount] = React.useState(item ? money.toInput(item.amountMinor) : "");
  const [alert, setAlert] = React.useState(item?.alertPercentage ? String(item.alertPercentage) : "80");
  const [invalid, setInvalid] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();
  const base = `/api/wallets/${wallet.id}/budget/${month}`;
  const options = tree?.groups("EXPENSE").filter(({ parent }) => parent.id === item?.categoryId || !taken.has(parent.id)) ?? [];
  const category = item ? tree?.byId.get(item.categoryId) : undefined;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const amountMinor = money.parse(amount);
        if (amountMinor === null || amountMinor < 0) return setInvalid(true);
        setInvalid(false);
        const alertValue = Number(alert);
        const ok = await run(() =>
          request("POST", `${base}/set`, {
            mutationId: newId(),
            categoryId,
            amountMinor,
            alertPercentage: alert.trim() && alertValue >= 1 && alertValue <= 100 ? Math.round(alertValue) : null,
          }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{category ? t("form.editTitle", { category: label(category) }) : t("form.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("form.alertHint")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      {!item && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-category">{t("form.category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="budget-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {options.map(({ parent }) => (
                <SelectItem key={parent.id} value={parent.id}>
                  <span className="flex items-center gap-2">
                    <CategoryBadge category={parent} className="size-5" />
                    {label(parent)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        {amountField("budget-amount", `${t("form.amount")} (${wallet.currencyCode})`, amount, setAmount, invalid, money.toInput(0), true)}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-alert">{t("form.alert")}</Label>
          <Input id="budget-alert" type="number" min={1} max={100} value={alert} onChange={(event) => setAlert(event.target.value)} />
        </div>
      </div>
      <p className={cn("-mt-2 text-[11px]", invalid ? "text-destructive" : "text-muted-foreground")}>
        {invalid ? t("form.amountInvalid", { example: money.toInput(50000) }) : t("form.alertHint")}
      </p>
      <DialogFooter className={cn(item && "sm:justify-between")}>
        {item && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={async () => {
              if (await run(() => request("POST", `${base}/remove`, { mutationId: newId(), categoryId: item.categoryId }))) onSaved();
            }}
          >
            <Trash2Icon />
            {t("form.remove")}
          </Button>
        )}
        <div className="flex gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={pending || !categoryId || !amount.trim()}>
            {pending ? <Spinner label={common("loading")} /> : t("form.save")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

// ---------- Goals ----------

function GoalsTab({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.planning");
  const request = useApi();
  const canEdit = can(wallet.role, "editEntries");
  const goals = useResource<{ goals: Goal[] }>(`/api/wallets/${wallet.id}/goals`);
  const [showArchived, setShowArchived] = React.useState(false);
  const archived = useResource<{ goals: Goal[] }>(showArchived ? `/api/wallets/${wallet.id}/goals?archived=1` : null);
  const [editing, setEditing] = React.useState<{ goal: Goal | null } | null>(null);
  const [openGoalId, setOpenGoalId] = React.useState<string | null>(null);
  const list = goals.state.status === "ready" ? goals.state.value.goals : [];
  const reload = () => {
    goals.reload();
    if (showArchived) archived.reload();
  };

  return (
    <section className="flex flex-col gap-4">
      {canEdit && (
        <Button className="self-end" onClick={() => setEditing({ goal: null })}>
          <PlusIcon />
          {t("goals.new")}
        </Button>
      )}
      {!canEdit && <p className="text-[12px] text-muted-foreground">{t("readOnly")}</p>}
      <ResourceFeedback state={goals.state} reload={goals.reload} />
      {goals.state.status === "ready" && list.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
          <p className="text-[13px] font-medium">{t("goals.empty")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("goals.emptyHint")}</p>
        </div>
      )}
      {list.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((goal) => (
            <li key={goal.id}>
              <GoalCard wallet={wallet} goal={goal} onOpen={() => setOpenGoalId(goal.id)} />
            </li>
          ))}
        </ul>
      )}
      <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowArchived((show) => !show)}>
        {showArchived ? t("goals.archived.hide") : t("goals.archived.show")}
      </Button>
      {showArchived && <ResourceFeedback state={archived.state} reload={archived.reload} />}
      {showArchived &&
        archived.state.status === "ready" &&
        (archived.state.value.goals.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("goals.archived.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60">
            {archived.state.value.goals.map((goal) => (
              <li key={goal.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">{goal.name}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await request("POST", `/api/wallets/${wallet.id}/goals/${goal.id}/restore`, { mutationId: newId(), baseVersion: goal.version }).catch(() => null);
                      reload();
                    }}
                  >
                    <ArchiveRestoreIcon />
                    {t("goals.archived.restore")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}

      <GoalFormDialog
        wallet={wallet}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <GoalDetailDialog
        wallet={wallet}
        goalId={openGoalId}
        initialGoal={list.find(goal => goal.id === openGoalId)}
        canEdit={canEdit}
        onClose={() => setOpenGoalId(null)}
        onChanged={reload}
        onEdit={(goal) => {
          setOpenGoalId(null);
          setEditing({ goal });
        }}
      />
    </section>
  );
}

function GoalCard({ wallet, goal, onOpen }: { wallet: Wallet; goal: Goal; onOpen: () => void }) {
  const t = useTranslations("app.planning.goals");
  const money = useMoney(wallet.currencyCode);
  const format = useFormatter();
  const share = goal.targetMinor ? (goal.savedMinor / goal.targetMinor) * 100 : 0;
  const monthly = monthlyNeeded(goal, todayIso());
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left outline-none hover:bg-foreground/[0.02] focus-visible:ring-[3px] focus-visible:ring-ring/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{goal.name}</div>
          <div className="text-[12px] text-muted-foreground">{t(`templates.${goal.template}`)}</div>
        </div>
        {goal.achieved && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#34c759]/15 px-1.5 py-px text-[10px] font-medium text-[#248a3d] dark:text-[#30d158]">
            <TrophyIcon className="size-3" aria-hidden />
            {t("achieved")}
          </span>
        )}
      </div>
      <div className="text-[15px] font-semibold tabular-nums">
        {t("savedOf", { saved: money.format(goal.savedMinor), target: money.format(goal.targetMinor) })}
      </div>
      <Progress share={share} tone={goal.achieved ? "done" : "ok"} />
      <div className="flex flex-wrap justify-between gap-x-3 text-[11px] text-muted-foreground">
        {!goal.achieved && <span>{t("missing", { amount: money.format(Math.max(0, goal.targetMinor - goal.savedMinor)) })}</span>}
        {goal.deadline && <span>{t("until", { date: format.dateTime(new Date(`${goal.deadline}T12:00:00`), { month: "short", year: "numeric" }) })}</span>}
        {monthly !== null && monthly > 0 && <span className="w-full font-medium text-foreground/80">{t("monthly", { amount: money.format(monthly) })}</span>}
      </div>
    </button>
  );
}

function GoalFormDialog({
  wallet,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  editing: { goal: Goal | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && <GoalForm key={editing.goal?.id ?? "new"} wallet={wallet} goal={editing.goal} onCancel={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ wallet, goal, onCancel, onSaved }: { wallet: Wallet; goal: Goal | null; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations("app.planning.goals");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [name, setName] = React.useState(goal?.name ?? "");
  const [template, setTemplate] = React.useState<GoalTemplate>(goal?.template ?? "EMERGENCY_FUND");
  const [target, setTarget] = React.useState(goal ? money.toInput(goal.targetMinor) : "");
  const [initial, setInitial] = React.useState(goal && goal.initialMinor ? money.toInput(goal.initialMinor) : "");
  const [deadline, setDeadline] = React.useState(goal?.deadline ?? "");
  const [invalid, setInvalid] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const targetMinor = money.parse(target);
        const initialMinor = initial.trim() ? money.parse(initial) : 0;
        if (targetMinor === null || targetMinor <= 0 || initialMinor === null || initialMinor < 0) return setInvalid(true);
        setInvalid(false);
        const values = { name: name.trim(), template, targetMinor, initialMinor, deadline: deadline || null };
        const ok = await run(() =>
          goal
            ? request("PATCH", `/api/wallets/${wallet.id}/goals/${goal.id}`, {
                mutationId: newId(),
                baseVersion: goal.version,
                ...Object.fromEntries(Object.entries(values).filter(([key, value]) => goal[key as keyof Goal] !== value)),
              })
            : request("POST", `/api/wallets/${wallet.id}/goals`, { id: newId(), mutationId: newId(), ...values }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{goal ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("form.deadlineHint")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-name">{t("form.name")}</Label>
          <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={GOAL_NAME_MAX} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-template">{t("form.template")}</Label>
          <Select value={template} onValueChange={(value) => setTemplate(value as GoalTemplate)}>
            <SelectTrigger id="goal-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_TEMPLATES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`templates.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {amountField("goal-target", `${t("form.target")} (${wallet.currencyCode})`, target, setTarget, invalid, money.toInput(0))}
        {amountField("goal-initial", t("form.initial"), initial, setInitial, invalid, money.toInput(0))}
      </div>
      {invalid && <p className="-mt-2 text-[11px] text-destructive">{t("form.amountInvalid", { example: money.toInput(1000000) })}</p>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-deadline">{t("form.deadline")}</Label>
        <Input id="goal-deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
        <p className="text-[11px] text-muted-foreground">{t("form.deadlineHint")}</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" disabled={pending || !name.trim() || !target.trim()}>
          {pending ? <Spinner label={common("loading")} /> : goal ? t("form.save") : t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GoalDetailDialog({
  wallet,
  goalId,
  initialGoal,
  canEdit,
  onClose,
  onChanged,
  onEdit,
}: {
  wallet: Wallet;
  goalId: string | null;
  initialGoal?: Goal;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (goal: Goal) => void;
}) {
  const t = useTranslations("app.planning.goals");
  const common = useTranslations("common");
  const money = useMoney(wallet.currencyCode);
  const shortDate = useShortDate();
  const request = useApi();
  const detail = useResource<GoalDetail>(goalId ? `/api/wallets/${wallet.id}/goals/${goalId}` : null);
  const [moving, setMoving] = React.useState<"deposit" | "withdraw" | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const goal = detail.state.status === "ready" ? detail.state.value.goal : initialGoal ?? null;
  const deposits = detail.state.status === "ready" ? detail.state.value.deposits : [];
  const refresh = () => {
    detail.reload();
    onChanged();
  };

  return (
    <>
      <Dialog open={goalId !== null && moving === null && !archiving && deleting === null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent closeLabel={common("close")} className="max-w-md">
          {!goal ? (
            <div className="flex flex-col gap-3">
              <DialogHeader><DialogTitle>{t("detail.history")}</DialogTitle></DialogHeader>
              <ResourceFeedback state={detail.state} reload={detail.reload} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{goal.name}</DialogTitle>
                <DialogDescription>{t("savedOf", { saved: money.format(goal.savedMinor), target: money.format(goal.targetMinor) })}</DialogDescription>
              </DialogHeader>
              <Progress share={goal.targetMinor ? (goal.savedMinor / goal.targetMinor) * 100 : 0} tone={goal.achieved ? "done" : "ok"} />
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setMoving("deposit")}>
                    <PlusIcon />
                    {t("detail.deposit")}
                  </Button>
                  <Button variant="secondary" onClick={() => setMoving("withdraw")}>
                    <MinusIcon />
                    {t("detail.withdraw")}
                  </Button>
                  <Button variant="ghost" onClick={() => onEdit(goal)}>
                    <PencilIcon />
                    {t("detail.edit")}
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[12px] font-medium text-muted-foreground">{t("detail.history")}</h3>
                <ResourceFeedback state={detail.state} reload={detail.reload} />
                <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
                  {goal.initialMinor > 0 && (
                    <li className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span>{t("detail.initial")}</span>
                      <span className="tabular-nums">{money.format(goal.initialMinor)}</span>
                    </li>
                  )}
                  {deposits.map((deposit) => (
                    <li key={deposit.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                      <span className="text-muted-foreground">{shortDate(deposit.depositDate)}</span>
                      <span className="min-w-0 flex-1 truncate">{deposit.notes}</span>
                      <span className={cn("tabular-nums", deposit.amountMinor < 0 && "text-destructive")}>
                        {deposit.amountMinor > 0 ? "+" : "−"}
                        {money.format(Math.abs(deposit.amountMinor))}
                      </span>
                      {canEdit && (
                        <Button variant="ghost" size="icon-sm" aria-label={t("detail.deleteDeposit")} onClick={() => setDeleting(deposit.id)}>
                          <Trash2Icon />
                        </Button>
                      )}
                    </li>
                  ))}
                  {detail.state.status === "ready" && deposits.length === 0 && goal.initialMinor === 0 && <li className="px-3 py-2 text-[13px] text-muted-foreground">{t("detail.noDeposits")}</li>}
                </ul>
              </div>
              {canEdit && (
                <Button variant="ghost" className="self-start text-destructive" onClick={() => setArchiving(true)}>
                  {t("detail.archive")}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {goal && (
        <DepositDialog
          wallet={wallet}
          goal={goal}
          mode={moving}
          onClose={() => setMoving(null)}
          onSaved={() => {
            setMoving(null);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={archiving}
        title={t("detail.archiveTitle", { name: goal?.name ?? "" })}
        body={t("detail.archiveBody")}
        confirm={t("detail.archive")}
        cancel={t("form.cancel")}
        onClose={() => setArchiving(false)}
        action={() => request("POST", `/api/wallets/${wallet.id}/goals/${goal!.id}/archive`, { mutationId: newId(), baseVersion: goal!.version })}
        onDone={() => {
          setArchiving(false);
          onClose();
          onChanged();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("detail.deleteDepositTitle")}
        body={t("detail.deleteDepositBody")}
        confirm={t("detail.deleteDeposit")}
        cancel={t("form.cancel")}
        onClose={() => setDeleting(null)}
        action={() => request("POST", `/api/wallets/${wallet.id}/goals/${goal!.id}/deposits/${deleting}/archive`, { mutationId: newId() })}
        onDone={() => {
          setDeleting(null);
          refresh();
        }}
      />
    </>
  );
}

function DepositDialog({
  wallet,
  goal,
  mode,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  goal: Goal;
  mode: "deposit" | "withdraw" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.planning.goals.depositForm");
  const goalsT = useTranslations("app.planning.goals");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayIso());
  const [notes, setNotes] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);
  const { pending, failure, setFailure, run } = useWalletRequest();

  React.useEffect(() => {
    if (mode) {
      setAmount("");
      setNotes("");
      setInvalid(false);
      setFailure(null);
    }
  }, [mode, setFailure]);

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const value = money.parse(amount);
            if (value === null || value <= 0) return setInvalid(true);
            setInvalid(false);
            const ok = await run(() =>
              request("POST", `/api/wallets/${wallet.id}/goals/${goal.id}/deposits`, {
                id: newId(),
                mutationId: newId(),
                amountMinor: mode === "withdraw" ? -value : value,
                depositDate: date,
                notes: notes.trim() || null,
              }),
            );
            if (ok) onSaved();
          }}
        >
          <DialogHeader>
            <DialogTitle>{mode === "withdraw" ? t("withdrawTitle", { name: goal.name }) : t("depositTitle", { name: goal.name })}</DialogTitle>
            <DialogDescription className="sr-only">{goal.name}</DialogDescription>
          </DialogHeader>
          <WalletErrorMessage failure={failure} />
          <div className="grid grid-cols-2 gap-4">
            {amountField("deposit-amount", `${t("amount")} (${wallet.currencyCode})`, amount, setAmount, invalid, money.toInput(0), true)}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deposit-date">{t("date")}</Label>
              <Input id="deposit-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </div>
          </div>
          {invalid && <p className="-mt-2 text-[11px] text-destructive">{goalsT("form.amountInvalid", { example: money.toInput(10000) })}</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deposit-notes">{t("notes")}</Label>
            <Input id="deposit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={NOTES_MAX} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !amount.trim()}>
              {pending ? <Spinner label={common("loading")} /> : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
