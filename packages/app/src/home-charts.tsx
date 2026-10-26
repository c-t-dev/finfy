"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@packages/ui/components/chart";
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { FORECAST_PERIODS, INSIGHT_PERIODS, type HomeInsights } from "@packages/shared/home";
import type { Wallet } from "@packages/shared/wallets";
import { useResource } from "./api";
import { useLocale, useTranslations } from "./i18n";
import { todayIso, useMoney } from "./money";

/**
 * The Home charts (wiki/decisoes/0019): balance over time with its projection,
 * and income x expense per month. Both read `/home/insights`, which uses the
 * Statement totals, so every figure matches the Statement of that month.
 */

type Period = `${(typeof INSIGHT_PERIODS)[number]}`;
type Ahead = `${(typeof FORECAST_PERIODS)[number]}`;
/** Months of history and months ahead a chart shows; each chart keeps its own, not saved. */
type Range = { period: Period; ahead: Ahead };
const DEFAULT_RANGE: Range = { period: "6", ahead: "3" };

/** `refreshKey` changes when the Home saves or deletes an entry, so the chart reloads in place. */
function useInsights(walletId: string, range: Range, refreshKey: number) {
  const month = todayIso().slice(0, 7);
  const resource = useResource<HomeInsights>(`/api/wallets/${walletId}/home/insights?month=${month}&months=${range.period}&ahead=${range.ahead}`);
  const { reload } = resource;
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) first.current = false;
    else reload();
  }, [refreshKey, reload]);
  return { ...resource, month };
}

function useMonthLabel() {
  const locale = useLocale();
  return React.useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    const long = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    const date = (month: string) => Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
    return { short: (month: string) => short.format(date(month)), long: (month: string) => long.format(date(month)) };
  }, [locale]);
}

function ChartFrame({
  title,
  description,
  range,
  onRange,
  aside,
  children,
}: {
  title: string;
  description: string;
  range: Range;
  onRange: (range: Range) => void;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("app.home.charts");
  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-[12px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span aria-hidden>{t("history")}</span>
          <SegmentedControl
            size="sm"
            aria-label={t("history")}
            value={range.period}
            onValueChange={(period) => onRange({ ...range, period })}
            options={INSIGHT_PERIODS.map((months) => ({ value: `${months}` as Period, label: t("months", { count: months }) }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden>{t("ahead")}</span>
          <SegmentedControl
            size="sm"
            aria-label={t("ahead")}
            value={range.ahead}
            onValueChange={(ahead) => onRange({ ...range, ahead })}
            options={FORECAST_PERIODS.map((months) => ({ value: `${months}` as Ahead, label: t("months", { count: months }) }))}
          />
        </div>
      </div>
      {aside}
      {children}
    </section>
  );
}

function ChartState({ state, reload, label }: { state: "loading" | "error"; reload: () => void; label: string }) {
  const t = useTranslations("app.home.charts");
  return (
    <div className="flex h-56 items-center justify-center gap-3 text-[13px] text-muted-foreground">
      {state === "loading" ? (
        <Spinner label={label} />
      ) : (
        <>
          <span className="text-destructive">{t("loadError")}</span>
          <Button variant="secondary" size="sm" onClick={reload}>
            {t("retry")}
          </Button>
        </>
      )}
    </div>
  );
}

const balanceConfig = {
  balance: { label: "", color: "var(--primary)" },
  projected: { label: "", color: "var(--primary)" },
} satisfies ChartConfig;

/** Month-end balance of the accounts: solid up to this month, dashed for the projection. */
export function BalanceChart({ wallet, refreshKey }: { wallet: Wallet; refreshKey: number }) {
  const t = useTranslations("app.home.charts");
  const money = useMoney(wallet.currencyCode);
  const animate = !useReducedMotion();
  const label = useMonthLabel();
  const [range, setRange] = React.useState<Range>(DEFAULT_RANGE);
  const { state, reload, month } = useInsights(wallet.id, range, refreshKey);
  const config = React.useMemo(
    () => ({ balance: { ...balanceConfig.balance, label: t("balance.actual") }, projected: { ...balanceConfig.projected, label: t("balance.projected") } }),
    [t],
  );

  const rows = React.useMemo(() => {
    if (state.status !== "ready") return [];
    return state.value.months.map((item) => ({
      month: item.month,
      balance: item.month <= month ? item.balanceMinor : undefined,
      // The projection starts at this month, so the dashed line continues the solid one.
      projected: item.month >= month ? item.projectedMinor : undefined,
    }));
  }, [state, month]);
  const negative = rows.some((row) => (row.balance ?? 0) < 0 || (row.projected ?? 0) < 0);
  const last = state.status === "ready" ? state.value.months.at(-1) : undefined;

  return (
    <ChartFrame
      title={t("balance.title")}
      description={t("balance.description")}
      range={range}
      onRange={setRange}
      aside={
        last && (
          <p className="text-[12px] text-muted-foreground">
            {t("balance.projection", { month: label.long(last.month) })}{" "}
            <span className={cn("font-medium tabular-nums text-foreground", last.projectedMinor < 0 && "text-destructive")}>
              {money.format(last.projectedMinor)}
            </span>
          </p>
        )
      }
    >
      {state.status !== "ready" ? (
        <ChartState state={state.status} reload={reload} label={t("balance.title")} />
      ) : (
        <ChartContainer config={config} className="aspect-auto h-56 w-full" role="img" aria-label={t("balance.description")}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={label.short} minTickGap={8} />
            <YAxis tickLine={false} axisLine={false} width={76} tickFormatter={money.compact} />
            {negative && <ReferenceLine y={0} stroke="var(--border)" />}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => label.long(String(payload?.[0]?.payload?.month ?? ""))}
                  formatter={(value, name) => (
                    <TooltipRow name={config[name as keyof typeof config]?.label} value={money.format(Number(value))} />
                  )}
                />
              }
            />
            <Area dataKey="balance" type="monotone" stroke="var(--color-balance)" strokeWidth={2} fill="url(#balance-fill)" isAnimationActive={animate} />
            <Line dataKey="projected" type="monotone" stroke="var(--color-projected)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={animate} />
            <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
          </ComposedChart>
        </ChartContainer>
      )}
    </ChartFrame>
  );
}

/** Income and expense of each month side by side; the projected months after this one are lighter. */
export function CashflowChart({ wallet, refreshKey }: { wallet: Wallet; refreshKey: number }) {
  const t = useTranslations("app.home.charts");
  const money = useMoney(wallet.currencyCode);
  const animate = !useReducedMotion();
  const label = useMonthLabel();
  const [range, setRange] = React.useState<Range>(DEFAULT_RANGE);
  const { state, reload, month } = useInsights(wallet.id, range, refreshKey);
  const config = React.useMemo(
    () =>
      ({
        income: { label: t("cashflow.income"), color: "var(--success)" },
        expense: { label: t("cashflow.expense"), color: "var(--destructive)" },
      }) satisfies ChartConfig,
    [t],
  );

  // Months after this one are projected: what is paid, what is pending and the simulated recurrences.
  const rows = React.useMemo(
    () =>
      state.status === "ready"
        ? state.value.months.map((item) =>
            item.month <= month
              ? { month: item.month, projected: false, income: item.incomeMinor, expense: item.expenseMinor }
              : {
                  month: item.month,
                  projected: true,
                  income: item.incomeMinor + item.pendingIncomeMinor + item.forecastIncomeMinor,
                  expense: item.expenseMinor + item.pendingExpenseMinor + item.forecastExpenseMinor,
                },
          )
        : [],
    [state, month],
  );
  const result = rows.filter((row) => !row.projected).reduce((sum, row) => sum + row.income - row.expense, 0);
  const empty = rows.every((row) => row.income === 0 && row.expense === 0);
  const cells = (key: "income" | "expense") =>
    rows.map((row) => <Cell key={row.month} fill={`var(--color-${key})`} fillOpacity={row.projected ? 0.4 : 1} />);

  return (
    <ChartFrame
      title={t("cashflow.title")}
      description={t("cashflow.description")}
      range={range}
      onRange={setRange}
      aside={
        state.status === "ready" &&
        !empty && (
          <p className="text-[12px] text-muted-foreground">
            {t("cashflow.result")}{" "}
            <span className={cn("font-medium tabular-nums", result < 0 ? "text-destructive" : "text-[#248a3d] dark:text-[#30d158]")}>
              {money.format(result)}
            </span>
          </p>
        )
      }
    >
      {state.status !== "ready" ? (
        <ChartState state={state.status} reload={reload} label={t("cashflow.title")} />
      ) : empty ? (
        <p className="flex h-56 items-center justify-center text-[13px] text-muted-foreground">{t("cashflow.empty")}</p>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-56 w-full" role="img" aria-label={t("cashflow.description")}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={label.short} minTickGap={4} />
            <YAxis tickLine={false} axisLine={false} width={76} tickFormatter={money.compact} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                    return row ? (row.projected ? t("cashflow.projectedMonth", { month: label.long(row.month) }) : label.long(row.month)) : "";
                  }}
                  formatter={(value, name) => (
                    <TooltipRow name={config[name as keyof typeof config]?.label} value={money.format(Number(value))} color={`var(--color-${name})`} />
                  )}
                />
              }
            />
            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={animate}>
              {cells("income")}
            </Bar>
            <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={animate}>
              {cells("expense")}
            </Bar>
            <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
          </BarChart>
        </ChartContainer>
      )}
    </ChartFrame>
  );
}

function TooltipRow({ name, value, color = "var(--color-balance)" }: { name: React.ReactNode; value: string; color?: string }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
      <span className="flex-1 text-muted-foreground">{name}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
