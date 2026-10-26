import { z } from "zod";
import { addMonths } from "./transactions";

/**
 * Customizable Home (wiki/decisoes/0019). Each member arranges the Home of
 * each wallet for themselves: which blocks show, in which order, and how wide.
 * A personal preference, so it is not audited and other members never see it.
 */

/** Every block the Home can show. Never rename or reuse a key: layouts store them. */
export const HOME_WIDGETS = ["balance", "month", "balanceChart", "cashflowChart", "topExpenses", "recent"] as const;
export type HomeWidgetKey = (typeof HOME_WIDGETS)[number];

/** `half` takes one of two columns on wide screens; phones always stack. */
export const WIDGET_SIZES = ["half", "full"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

export const homeWidgetSchema = z.object({ key: z.enum(HOME_WIDGETS), size: z.enum(WIDGET_SIZES) });
export type HomeWidget = z.infer<typeof homeWidgetSchema>;

/** Width a block takes when it is added. */
export const DEFAULT_WIDGET_SIZE: Record<HomeWidgetKey, WidgetSize> = {
  balance: "half",
  month: "half",
  balanceChart: "full",
  cashflowChart: "full",
  topExpenses: "full",
  recent: "full",
};

/** The Home of someone who never customized it. */
export const DEFAULT_HOME_LAYOUT: HomeWidget[] = HOME_WIDGETS.map((key) => ({ key, size: DEFAULT_WIDGET_SIZE[key] }));

/** The visible blocks, in order; anything not listed is hidden. */
const widgetList = z
  .array(homeWidgetSchema)
  .max(HOME_WIDGETS.length)
  .refine((widgets) => new Set(widgets.map((widget) => widget.key)).size === widgets.length, { message: "duplicate block" });

export const homeLayoutSchema = z.object({
  widgets: widgetList,
  /** false while the default layout is in use. */
  customized: z.boolean(),
});
export type HomeLayout = z.infer<typeof homeLayoutSchema>;

/** `null` goes back to the default layout. */
export const saveHomeLayoutInput = z.object({ widgets: widgetList.nullable() });
export type SaveHomeLayoutInput = z.infer<typeof saveHomeLayoutInput>;

/**
 * A stored layout as the current app reads it: unknown keys (from a newer
 * version) and repeats are dropped, a bad size takes the default. Blocks added
 * to the app later stay hidden for people who already customized their Home.
 */
export function readHomeLayout(stored: unknown): HomeWidget[] {
  if (!Array.isArray(stored)) return DEFAULT_HOME_LAYOUT;
  const seen = new Set<string>();
  const widgets: HomeWidget[] = [];
  for (const item of stored) {
    const key = (item as { key?: unknown })?.key;
    if (typeof key !== "string" || !(HOME_WIDGETS as readonly string[]).includes(key) || seen.has(key)) continue;
    seen.add(key);
    const size = (item as { size?: unknown }).size;
    const known = key as HomeWidgetKey;
    widgets.push({ key: known, size: (WIDGET_SIZES as readonly unknown[]).includes(size) ? (size as WidgetSize) : DEFAULT_WIDGET_SIZE[known] });
  }
  return widgets;
}

/** Moves the block at `from` to `to`, keeping the others in order. */
export function moveWidget(widgets: HomeWidget[], from: number, to: number): HomeWidget[] {
  if (from === to || from < 0 || to < 0 || from >= widgets.length || to >= widgets.length) return widgets;
  const next = [...widgets];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Charts: months of history the person can pick, and months projected after the current one. */
export const INSIGHT_PERIODS = [6, 12] as const;
export const PROJECTION_MONTHS = 3;

export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const homeInsightsQuery = z.object({
  /** The person's current month, from their own clock. */
  month: yearMonth,
  months: z.coerce.number().pipe(z.literal([...INSIGHT_PERIODS])),
});
export type HomeInsightsQuery = z.infer<typeof homeInsightsQuery>;

export const monthInsightSchema = z.object({
  month: yearMonth,
  /** Same rules as the Statement totals of that month. */
  incomeMinor: z.number().int(),
  expenseMinor: z.number().int(),
  /** Opening balances plus paid movements through the month's last day, active accounts only. */
  balanceMinor: z.number().int(),
  /** `balanceMinor` plus pending movements and unpaid card purchases due through that day. */
  projectedMinor: z.number().int(),
});
export type MonthInsight = z.infer<typeof monthInsightSchema>;

export const homeInsightsSchema = z.object({
  month: yearMonth,
  /** `months` months up to the current one, then `PROJECTION_MONTHS` after it. */
  months: z.array(monthInsightSchema),
});
export type HomeInsights = z.infer<typeof homeInsightsSchema>;

/** The months a chart covers, oldest first. */
export function insightMonths(month: string, months: number): string[] {
  return Array.from({ length: months + PROJECTION_MONTHS }, (_, index) => addMonths(month, index - months + 1));
}
