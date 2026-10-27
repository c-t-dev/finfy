"use client";

import * as React from "react";
import { BellIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { cn } from "@packages/ui/lib/utils";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@packages/shared/money";
import type { AppNotification, NotificationList } from "@packages/shared/notifications";
import { ResourceFeedback } from "./loading";
import { useApi, useResource } from "./api";
import { useFormatter, useLocale, useTranslations } from "./i18n";
import { useAppNavigation } from "./navigation";

/** How often the bell looks again while the app is open. */
const REFRESH_MS = 5 * 60 * 1000;

/** Bell in the title bar: notifications across every wallet; opening it marks them read. */
export function NotificationBell() {
  const t = useTranslations("app.notifications");
  const request = useApi();
  const { state, reload } = useResource<NotificationList>("/api/notifications");
  const { Link } = useAppNavigation();
  const text = useNotificationText();

  React.useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const list = state.status === "ready" ? state.value : null;
  const unread = list?.unread ?? 0;

  return (
    <DropdownMenu
      onOpenChange={async (open) => {
        // Opening reads them; the list keeps showing which were new until it closes, then reloads.
        if (!open) return reload();
        if (!list || !unread) return;
        const keys = list.notifications.filter((item) => !item.read).map((item) => item.key);
        await request("POST", "/api/notifications/read", { keys }).catch(() => null);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread ? `${t("open")} · ${t("unread", { count: unread })}` : t("open")}
          title={t("open")}
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <ResourceFeedback state={state} reload={reload} />
        {state.status === "ready" && !list?.notifications.length && <p className="px-2 py-3 text-[12px] text-muted-foreground">{t("empty")}</p>}
        {list?.notifications.map((item) => (
          <DropdownMenuItem key={item.key} asChild className="items-start">
            <Link href={item.path} className="flex w-full items-start gap-2">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="whitespace-normal text-[12px] leading-snug">{text(item)}</span>
                <span className="text-[11px] opacity-70">{item.walletName}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The translated sentence of a notification, filled from its payload. */
function useNotificationText() {
  const t = useTranslations("app.notifications.types");
  const categories = useTranslations("categories");
  const locale = useLocale();
  const format = useFormatter();
  return (item: AppNotification): string => {
    const payload = item.payload;
    const code = (payload.currencyCode as CurrencyCode | null) ?? "EUR";
    const money = (minor: unknown) => formatMoney(Number(minor ?? 0), CURRENCIES[code] ?? CURRENCIES.EUR, locale);
    const date = (iso: unknown) => format.dateTime(new Date(`${String(iso)}T12:00:00`), { day: "numeric", month: "short" });
    switch (item.type) {
      case "BUDGET_NEAR":
      case "BUDGET_OVER": {
        const category = payload.categoryKey ? categories(String(payload.categoryKey) as Parameters<typeof categories>[0]) : String(payload.categoryName ?? "");
        return t(item.type, { category, spent: money(payload.spentMinor), limit: money(payload.limitMinor) });
      }
      case "INVOICE_DUE":
      case "INVOICE_OVERDUE":
        return t(item.type, { card: String(payload.cardName ?? ""), amount: money(payload.totalMinor), date: date(payload.dueDate) });
      case "PENDING_DUE":
        return t("PENDING_DUE", { count: Number(payload.count ?? 0) });
    }
  };
}
