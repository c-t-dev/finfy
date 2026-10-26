"use client";

import * as React from "react";
import { ChevronLeftIcon, PlusIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
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
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import { RULE_NAME_MAX, type Rule, type RuleAction, type RuleCondition, type RulePreview } from "@packages/shared/rules";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { ConfirmDialog } from "../cards-ui";
import { CategoryPicker, useCategories, useCategoryLabel, type CategoryTree } from "../categories";
import { useTranslations } from "../i18n";
import { useMoney } from "../money";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { TagPicker, useTags } from "../tags-ui";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";
import { useWalletAccounts } from "./statement";

const SETTINGS_PATH = APP_ROUTES.find((route) => route.key === "settings")!.path;
export const RULES_PATH = `${SETTINGS_PATH}/rules`;
const ANY = "any";

export function RulesScreen() {
  const t = useTranslations("app.rules");
  const { current } = useWallets();
  const { Link } = useAppNavigation();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href={SETTINGS_PATH} className="flex items-center gap-1 text-[13px] text-primary hover:underline">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-[12px] text-muted-foreground">{t("settingsBody")}</p>
      </div>
      {current && <WalletRules key={current.id} wallet={current} />}
    </div>
  );
}

function WalletRules({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.rules");
  const request = useApi();
  const canEdit = can(wallet.role, "editEntries");
  const rules = useResource<{ rules: Rule[] }>(`/api/wallets/${wallet.id}/rules`);
  const { tree } = useCategories(wallet.id);
  const tags = useTags(wallet.id);
  const { accounts, cards, names } = useWalletAccounts(wallet.id);
  const [editing, setEditing] = React.useState<{ rule: Rule | null } | null>(null);
  const [message, setMessage] = React.useState<{ ruleId: string; text: string } | null>(null);
  const list = rules.state.status === "ready" ? rules.state.value.rules : [];

  return (
    <section className="flex flex-col gap-3">
      {canEdit && (
        <Button className="self-end" onClick={() => setEditing({ rule: null })}>
          <PlusIcon />
          {t("new")}
        </Button>
      )}
      {rules.state.status === "loading" && <Spinner label={t("title")} />}
      {rules.state.status === "ready" && list.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
          <WandSparklesIcon className="size-7 text-primary" aria-hidden />
          <p className="text-[13px] font-medium">{t("empty")}</p>
          <p className="text-[12px] text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}
      {list.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
          {list.map((rule) => (
            <li key={rule.id} className={cn("flex flex-col gap-1.5 px-4 py-3", !rule.isActive && "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 text-left text-[13px] font-medium outline-none hover:underline focus-visible:underline disabled:no-underline"
                  disabled={!canEdit}
                  onClick={() => setEditing({ rule })}
                >
                  {rule.name}
                  {!rule.isActive && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{t("inactive")}</span>}
                </button>
                {canEdit && rule.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const response = await request<{ changed: number }>("POST", `/api/wallets/${wallet.id}/rules/${rule.id}/apply`, { mutationId: newId() });
                      if (response.ok) setMessage({ ruleId: rule.id, text: t("applied", { count: response.value.changed }) });
                    }}
                  >
                    <WandSparklesIcon />
                    {t("applyNow")}
                  </Button>
                )}
              </div>
              <RuleSummary rule={rule} currencyCode={wallet.currencyCode} tree={tree} tagNames={new Map(tags.tags.map((tag) => [tag.id, tag.name]))} sourceNames={names} />
              {message?.ruleId === rule.id && (
                <p role="status" className="text-[12px] text-muted-foreground">
                  {message.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {accounts && (
        <RuleDialog
          wallet={wallet}
          tree={tree}
          tags={tags}
          sources={[
            ...accounts.map((account) => ({ value: `account:${account.id}`, label: account.name })),
            ...cards.map((card) => ({ value: `card:${card.id}`, label: card.name })),
          ]}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            rules.reload();
          }}
        />
      )}
    </section>
  );
}

function RuleSummary({
  rule,
  currencyCode,
  tree,
  tagNames,
  sourceNames,
}: {
  rule: Rule;
  currencyCode: Wallet["currencyCode"];
  tree: CategoryTree | null;
  tagNames: Map<string, string>;
  sourceNames: Map<string, string>;
}) {
  const t = useTranslations("app.rules");
  const label = useCategoryLabel();
  const money = useMoney(currencyCode);
  const describe = (condition: RuleCondition): string => {
    switch (condition.field) {
      case "description":
        return t("summary.description", { op: t(`ops.${condition.op}`), value: condition.value });
      case "amount":
        return t("summary.amount", {
          range: [condition.min !== undefined ? `≥ ${money.toInput(condition.min)}` : null, condition.max !== undefined ? `≤ ${money.toInput(condition.max)}` : null]
            .filter(Boolean)
            .join(" "),
        });
      case "account":
        return t("summary.account", { name: sourceNames.get(condition.accountId) ?? "" });
      case "card":
        return t("summary.card", { name: sourceNames.get(condition.creditCardId) ?? "" });
      case "type":
        return t("summary.type", { type: t(`types.${condition.type}`) });
    }
  };
  const act = (action: RuleAction): string => {
    if (action.set === "category") {
      const category = tree?.byId.get(action.categoryId);
      return t("summary.category", { name: category ? label(category) : "" });
    }
    return t("summary.tag", { name: tagNames.get(action.tagId) ?? "" });
  };
  return (
    <p className="text-[12px] text-muted-foreground">
      <span className="font-medium text-foreground/70">{t("when")}</span> {rule.conditions.map(describe).join(" · ")}{" "}
      <span className="font-medium text-foreground/70">→ {t("then")}</span> {rule.actions.map(act).join(" · ")}
    </p>
  );
}

function RuleDialog({
  wallet,
  tree,
  tags,
  sources,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  tree: CategoryTree | null;
  tags: ReturnType<typeof useTags>;
  sources: { value: string; label: string }[];
  editing: { rule: Rule | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-lg">
        {editing && <RuleForm key={editing.rule?.id ?? "new"} wallet={wallet} tree={tree} tags={tags} sources={sources} rule={editing.rule} onCancel={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function RuleForm({
  wallet,
  tree,
  tags,
  sources,
  rule,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  tree: CategoryTree | null;
  tags: ReturnType<typeof useTags>;
  sources: { value: string; label: string }[];
  rule: Rule | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.rules");
  const common = useTranslations("common");
  const request = useApi();
  const money = useMoney(wallet.currencyCode);
  const find = <F extends RuleCondition["field"]>(field: F) =>
    rule?.conditions.find((condition): condition is Extract<RuleCondition, { field: F }> => condition.field === field);
  const description = find("description");
  const amount = find("amount");
  const account = find("account");
  const card = find("card");

  const [name, setName] = React.useState(rule?.name ?? "");
  const [type, setType] = React.useState<"EXPENSE" | "INCOME">(find("type")?.type ?? "EXPENSE");
  const [op, setOp] = React.useState<"contains" | "equals" | "startsWith">(description?.op ?? "contains");
  const [text, setText] = React.useState(description?.value ?? "");
  const [min, setMin] = React.useState(amount?.min !== undefined ? money.toInput(amount.min) : "");
  const [max, setMax] = React.useState(amount?.max !== undefined ? money.toInput(amount.max) : "");
  const [source, setSource] = React.useState(account ? `account:${account.accountId}` : card ? `card:${card.creditCardId}` : ANY);
  const [categoryId, setCategoryId] = React.useState<string | null>(
    rule?.actions.find((action): action is Extract<RuleAction, { set: "category" }> => action.set === "category")?.categoryId ?? null,
  );
  const [tagIds, setTagIds] = React.useState<string[]>(
    rule?.actions.filter((action): action is Extract<RuleAction, { set: "tag" }> => action.set === "tag").map((action) => action.tagId) ?? [],
  );
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? true);
  const [applyToHistory, setApplyToHistory] = React.useState(rule?.applyToHistory ?? true);
  const [preview, setPreview] = React.useState<RulePreview | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();

  const minMinor = min.trim() ? money.parse(min) : undefined;
  const maxMinor = max.trim() ? money.parse(max) : undefined;
  const conditions: RuleCondition[] = [
    { field: "type", type },
    ...(text.trim() ? [{ field: "description" as const, op, value: text.trim() }] : []),
    ...(minMinor != null || maxMinor != null
      ? [{ field: "amount" as const, ...(minMinor != null ? { min: minMinor } : {}), ...(maxMinor != null ? { max: maxMinor } : {}) }]
      : []),
    ...(source.startsWith("account:") ? [{ field: "account" as const, accountId: source.slice(8) }] : []),
    ...(source.startsWith("card:") ? [{ field: "card" as const, creditCardId: source.slice(5) }] : []),
  ];
  const actions: RuleAction[] = [
    ...(categoryId ? [{ set: "category" as const, categoryId }] : []),
    ...tagIds.map((tagId) => ({ set: "tag" as const, tagId })),
  ];
  // A rule on type alone would match every entry: ask for something more specific.
  const specific = conditions.length > 1;
  const conditionsKey = JSON.stringify(conditions);

  React.useEffect(() => {
    if (!specific) return setPreview(null);
    const timer = setTimeout(() => {
      request<RulePreview>("POST", `/api/wallets/${wallet.id}/rules/preview`, { conditions: JSON.parse(conditionsKey) }).then(
        (response) => setPreview(response.ok ? response.value : null),
        () => setPreview(null),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [conditionsKey, specific, request, wallet.id]);

  if (confirmDelete && rule) {
    return (
      <ConfirmDialog
        open
        title={t("delete.title", { name: rule.name })}
        body={t("delete.body")}
        confirm={t("delete.confirm")}
        cancel={t("form.cancel")}
        onClose={() => setConfirmDelete(false)}
        action={() => request("POST", `/api/wallets/${wallet.id}/rules/${rule.id}/archive`, { mutationId: newId() })}
        onDone={onSaved}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const body = { name: name.trim(), isActive, applyToHistory, conditions, actions };
        const ok = await run(() =>
          rule
            ? request("PATCH", `/api/wallets/${wallet.id}/rules/${rule.id}`, { mutationId: newId(), ...body })
            : request("POST", `/api/wallets/${wallet.id}/rules`, { id: newId(), mutationId: newId(), ...body }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{rule ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("settingsBody")}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-name">{t("form.name")}</Label>
        <Input id="rule-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={RULE_NAME_MAX} />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-[12px] font-semibold">{t("when")}</legend>
        <SegmentedControl
          aria-label={t("form.type")}
          value={type}
          onValueChange={(value) => {
            setType(value);
            setCategoryId(null);
          }}
          options={[
            { value: "EXPENSE", label: t("types.EXPENSE") },
            { value: "INCOME", label: t("types.INCOME") },
          ]}
          className="self-start"
        />
        <div className="grid grid-cols-[9rem_1fr] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-op">{t("form.descriptionOp")}</Label>
            <Select value={op} onValueChange={(value) => setOp(value as typeof op)}>
              <SelectTrigger id="rule-op">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["contains", "startsWith", "equals"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`ops.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-text">{t("form.description")}</Label>
            <Input id="rule-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={120} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-min">{t("form.min")}</Label>
            <Input id="rule-min" inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} placeholder={money.toInput(0)} className="tabular-nums" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-max">{t("form.max")}</Label>
            <Input id="rule-max" inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} placeholder={money.toInput(0)} className="tabular-nums" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-source">{t("form.source")}</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="rule-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("form.anySource")}</SelectItem>
              {sources.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {specific ? (preview ? t("form.preview", { count: preview.count }) : "…") : t("form.needsCondition")}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-[12px] font-semibold">{t("then")}</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-category">{t("form.category")}</Label>
          <CategoryPicker id="rule-category" tree={tree} kind={type} value={categoryId} onValueChange={setCategoryId} />
        </div>
        <TagPicker wallet={wallet} tags={tags.tags} value={tagIds} onChange={setTagIds} onCreated={tags.add} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[13px]">
          <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
          {t("form.isActive")}
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <Checkbox checked={applyToHistory} onCheckedChange={(checked) => setApplyToHistory(checked === true)} />
          {t("form.applyToHistory")}
        </label>
      </div>

      <DialogFooter className={cn(rule && "sm:justify-between")}>
        {rule && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon />
            {t("form.delete")}
          </Button>
        )}
        <div className="flex gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={pending || !name.trim() || !specific || actions.length === 0}>
            {pending ? <Spinner label={common("loading")} /> : rule ? t("form.save") : t("form.create")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
