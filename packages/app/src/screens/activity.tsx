"use client";

import * as React from "react";
import { ChevronLeftIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import type { ActivityEntry, ActivityPage, ChainCheck } from "@packages/shared/activity";
import { can } from "@packages/shared/roles";
import type { Wallet } from "@packages/shared/wallets";
import { useApi } from "../api";
import { useFormatter, useTranslations } from "../i18n";
import { useMoney } from "../money";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { useWallets } from "../wallets";

const SETTINGS_PATH = APP_ROUTES.find((route) => route.key === "settings")!.path;
export const ACTIVITY_PATH = `${SETTINGS_PATH}/activity`;

export function ActivityScreen() {
  const t = useTranslations("app.activity");
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
      </div>
      {current && <WalletActivity key={current.id} wallet={current} />}
    </div>
  );
}

function WalletActivity({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.activity");
  const request = useApi();
  const format = useFormatter();
  const [entries, setEntries] = React.useState<ActivityEntry[]>([]);
  const [nextBefore, setNextBefore] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [check, setCheck] = React.useState<ChainCheck | null>(null);
  const [checking, setChecking] = React.useState(false);

  const load = React.useCallback(
    async (before: string | null) => {
      setState("loading");
      const query = before ? `?before=${encodeURIComponent(before)}` : "";
      const response = await request<ActivityPage>("GET", `/api/wallets/${wallet.id}/activity${query}`).catch(() => null);
      if (!response?.ok) return setState("error");
      setEntries((list) => (before ? [...list, ...response.value.entries] : response.value.entries));
      setNextBefore(response.value.nextBefore);
      setState("ready");
    },
    [request, wallet.id],
  );

  React.useEffect(() => {
    void load(null);
  }, [load]);

  // Entries grouped by day, in the order they came (newest first).
  const days = React.useMemo(() => {
    const groups = new Map<string, ActivityEntry[]>();
    for (const entry of entries) {
      const day = entry.recordedAt.slice(0, 10);
      groups.set(day, [...(groups.get(day) ?? []), entry]);
    }
    return [...groups];
  }, [entries]);

  return (
    <section className="flex flex-col gap-4">
      {can(wallet.role, "editWallet") && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              const response = await request<ChainCheck>("GET", `/api/wallets/${wallet.id}/activity/verify`).catch(() => null);
              setCheck(response?.ok ? response.value : null);
              setChecking(false);
            }}
          >
            {checking ? <Spinner label={t("verify")} /> : <ShieldCheckIcon />}
            {t("verify")}
          </Button>
          {check && (
            <span role="status" className={cn("text-[12px]", check.valid ? "text-[#248a3d] dark:text-[#30d158]" : "text-destructive")}>
              {check.valid ? t("valid", { count: check.entries }) : t("broken")}
            </span>
          )}
        </div>
      )}
      {state === "ready" && entries.length === 0 && <p className="text-[13px] text-muted-foreground">{t("empty")}</p>}
      {days.map(([day, list]) => (
        <div key={day} className="flex flex-col gap-1.5">
          <h3 className="px-1 text-[12px] font-medium text-muted-foreground first-letter:uppercase">
            {format.dateTime(new Date(`${day}T12:00:00`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {list.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} wallet={wallet} />
            ))}
          </ul>
        </div>
      ))}
      {state === "loading" && <Spinner label={t("title")} />}
      {state === "error" && (
        <div className="flex items-center gap-3 text-[13px] text-destructive">
          {t("loadError")}
          <Button variant="secondary" size="sm" onClick={() => void load(null)}>
            {t("retry")}
          </Button>
        </div>
      )}
      {state === "ready" && nextBefore && (
        <Button variant="secondary" className="self-center" onClick={() => void load(nextBefore)}>
          {t("loadMore")}
        </Button>
      )}
    </section>
  );
}

function ActivityRow({ entry, wallet }: { entry: ActivityEntry; wallet: Wallet }) {
  const t = useTranslations("app.activity");
  const roles = useTranslations("app.wallet.roles");
  const format = useFormatter();
  const money = useMoney(wallet.currencyCode);
  const label = (group: "actions" | "entities" | "fields", key: string) =>
    t.has(`${group}.${key}` as never) ? t(`${group}.${key}` as never) : key;

  const value = (field: string, raw: unknown): string => {
    if (raw === null || raw === undefined || raw === "") return t("empty_value");
    if (typeof raw === "boolean") return raw ? t("yes") : t("no");
    if (field.endsWith("_minor") && typeof raw === "number") return money.format(raw);
    if (field === "role" && roles.has(raw as never)) return roles(raw as never);
    return String(raw);
  };
  // IDs say nothing to a person; the entity line already names what changed.
  const fields = Object.entries(entry.changes ?? {}).filter(([field]) => !field.endsWith("_id"));

  return (
    <li className="flex flex-col gap-1 px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px]">
          <span className="font-medium">{label("actions", entry.action)}</span>
          <span className="text-muted-foreground"> · {label("entities", entry.entity)}</span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {entry.actorName ?? t("system")} · {format.dateTime(new Date(entry.recordedAt), { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          {fields.map(([field, change]) => (
            <React.Fragment key={field}>
              <dt className="text-muted-foreground">{label("fields", field)}</dt>
              <dd className="min-w-0 truncate">
                {change.from !== null && change.from !== undefined && (
                  <>
                    <span className="text-muted-foreground line-through">{value(field, change.from)}</span>
                    {" → "}
                  </>
                )}
                {value(field, change.to)}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </li>
  );
}
