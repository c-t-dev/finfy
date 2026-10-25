"use client";

import * as React from "react";
import { ExpandIcon, ShrinkIcon, WalletIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { MacTitlebar, MacWindow } from "@packages/ui/components/mac-window";
import { cn } from "@packages/ui/lib/utils";
import { useTranslations } from "./i18n";
import { APP_ROUTES, isActiveRoute, useAppNavigation } from "./navigation";

/** Squircle app icon, same family as the image-resizer one. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-5", className)} aria-hidden>
      <defs>
        <linearGradient id="finfy-icon-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ac8fa" />
          <stop offset="1" stopColor="#007aff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#finfy-icon-bg)" />
      <path d="M8 22.5 13.5 16l4 3.5L24 11" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="11" r="2" fill="#fff" />
    </svg>
  );
}

/**
 * Locks or unlocks the window width. The host decides where the choice is
 * saved; on phones the window is always full width, so it is hidden there.
 */
export function WindowWidthToggle({ wide, onWideChange }: { wide: boolean; onWideChange: (wide: boolean) => void }) {
  const t = useTranslations("app.window");
  const label = wide ? t("narrow") : t("widen");
  const Icon = wide ? ShrinkIcon : ExpandIcon;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={wide}
      title={label}
      onClick={() => onWideChange(!wide)}
      className="max-md:hidden"
    >
      <Icon />
    </Button>
  );
}

/**
 * The signed-in window (wiki/decisoes/0008): translucent sidebar with the
 * wallet switcher and navigation on wide screens, bottom bar on phones.
 * `wide` lifts the max-width so the window fills the screen.
 */
export function AppShell({
  children,
  trailing,
  wide = false,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations();

  return (
    <main className="flex min-h-dvh justify-center sm:items-center sm:p-6 lg:p-10">
      <MacWindow
        className={cn(
          "min-h-dvh w-full transition-[max-width] duration-300 ease-out motion-reduce:transition-none sm:h-[calc(100dvh-3rem)] sm:min-h-[560px] lg:h-[calc(100dvh-5rem)]",
          wide ? "max-w-[100vw]" : "max-w-6xl",
        )}
      >
        <MacTitlebar icon={<AppIcon />} title={t("common.appName")} trailing={trailing} />
        <div className="flex min-h-0 flex-1 pt-12 max-md:flex-col">
          <aside className="flex w-60 shrink-0 flex-col gap-4 border-r border-border/60 bg-sidebar p-3 max-md:hidden">
            <WalletSwitcher />
            <SidebarNav />
          </aside>
          <section className="min-h-0 flex-1 overflow-y-auto p-6 max-md:pb-24">{children}</section>
        </div>
        <BottomNav />
      </MacWindow>
    </main>
  );
}

function WalletSwitcher() {
  const t = useTranslations("app.wallet");
  // Wallets arrive with the wallet API; until then the switcher shows the empty state.
  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{t("label")}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[13px] text-foreground/70">
        <WalletIcon className="size-4" aria-hidden />
        {t("none")}
      </div>
    </div>
  );
}

function SidebarNav() {
  const t = useTranslations("app.nav");
  const { Link, pathname } = useAppNavigation();
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-0.5">
      {APP_ROUTES.map(({ key, path, icon: Icon }) => {
        const active = isActiveRoute(pathname, path);
        return (
          <Link
            key={key}
            href={path}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-foreground/80 outline-none transition-[background-color,color,scale] duration-100 hover:bg-foreground/5 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:hover:bg-white/10",
              active && "bg-primary/12 font-medium text-primary hover:bg-primary/15 dark:hover:bg-primary/20",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomNav() {
  const t = useTranslations("app.nav");
  const { Link, pathname } = useAppNavigation();
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/60 bg-titlebar pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
    >
      {APP_ROUTES.map(({ key, path, icon: Icon }) => {
        const active = isActiveRoute(pathname, path);
        return (
          <Link
            key={key}
            href={path}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] text-foreground/60 outline-none transition-[color,scale] duration-100 active:scale-[0.96] focus-visible:text-primary",
              active && "text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate px-1">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
