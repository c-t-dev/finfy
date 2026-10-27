"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ExpandIcon, LogOutIcon, ShrinkIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { MacTitlebar, MacWindow } from "@packages/ui/components/mac-window";
import { cn } from "@packages/ui/lib/utils";
import { useTranslations } from "./i18n";
import { APP_ROUTES, isActiveRoute, useAppNavigation } from "./navigation";
import { WalletSwitcher } from "./wallet-ui";
import { ScreenTransition } from "./screen-transition";

const SETTINGS_PATH = APP_ROUTES.find((route) => route.key === "settings")!.path;

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
  account,
  wide = false,
  minimizedBackground,
  allowMinimize = false,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  /** Signed-in user shown at the bottom of the sidebar. */
  account?: React.ReactNode;
  wide?: boolean;
  /** Host-rendered public Home, revealed without unmounting the signed-in app. */
  minimizedBackground?: React.ReactNode;
  /** Web host opt-in; native shells use their operating system window controls. */
  allowMinimize?: boolean;
}) {
  const t = useTranslations();
  const { pathname } = useAppNavigation();
  const [minimizedState, setMinimized] = React.useState(false);
  const minimized = allowMinimize && minimizedState;
  const [maximizedState, setMaximized] = React.useState(false);
  const maximized = allowMinimize && maximizedState;
  const showBackground = allowMinimize && minimizedBackground && (!maximized || minimized);
  const reduceMotion = useReducedMotion();
  const restoreRef = React.useRef<HTMLButtonElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const wasMinimized = React.useRef(false);
  React.useEffect(() => {
    if (minimized) restoreRef.current?.focus();
    else if (wasMinimized.current) previousFocus.current?.focus();
    wasMinimized.current = minimized;
  }, [minimized]);

  return (
    <>
      {showBackground && <div data-slot="app-background" inert={!minimized} aria-hidden={!minimized} className="fixed inset-0 overflow-y-auto pb-24" onClickCapture={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target instanceof Element ? event.target.closest("a") : null;
        if (!link || link.hash || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
        if (new URL(link.href, window.location.href).pathname !== APP_ROUTES[0].path) return;
        event.preventDefault(); event.stopPropagation(); setMinimized(false);
      }}>{minimizedBackground}</div>}
      {showBackground && <motion.div aria-hidden initial={false} className="pointer-events-none fixed inset-0 z-[5] bg-black/20 backdrop-blur-sm" animate={{ opacity: minimized ? 0 : 1 }} transition={{ duration: reduceMotion === false ? 0.25 : 0.12 }} />}
    <main className={cn("relative z-10 flex min-h-dvh overflow-clip justify-center sm:items-center", !maximized && "sm:p-6 lg:p-10", minimized && "pointer-events-none")}>
      <motion.div
        layout={reduceMotion === false && !minimized}
        inert={minimized} aria-hidden={minimized} initial={false}
        className={cn("w-full", maximized ? "max-w-none" : wide ? "max-w-[100vw]" : "max-w-6xl")}
        style={{ pointerEvents: minimized ? "none" : "auto", transformOrigin: "bottom center" }}
        animate={{ opacity: minimized ? 0 : 1, y: minimized && reduceMotion === false ? "40vh" : 0, scale: minimized && reduceMotion === false ? 0.15 : 1 }}
        transition={{ duration: reduceMotion === false ? 0.35 : 0.12, ease: "easeInOut", layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
      >
      <MacWindow
        className={cn(
          "min-h-dvh w-full",
          maximized ? "h-dvh rounded-none border-0 shadow-none sm:rounded-none sm:border-0 sm:shadow-none dark:sm:shadow-none" : "sm:h-[calc(100dvh-3rem)] sm:min-h-[560px] lg:h-[calc(100dvh-5rem)]",
          maximized ? "max-w-none" : wide ? "max-w-[100vw]" : "max-w-6xl",
        )}
      >
        <MacTitlebar icon={<AppIcon />} title={t("common.appName")} trailing={trailing} trafficLights={allowMinimize ? { zoomed: maximized, onMinimize: () => { previousFocus.current = document.activeElement as HTMLElement; setMinimized(true); }, onZoom: () => setMaximized(value => !value), labels: { minimize: t("common.window.minimize"), zoom: maximized ? t("common.window.restoreSize") : t("common.window.maximize") } } : undefined} />
        <div className="flex min-h-0 flex-1 pt-12 max-md:flex-col">
          <aside className="flex w-60 shrink-0 flex-col gap-4 border-r border-border/60 bg-sidebar p-3 max-md:hidden">
            <WalletSwitcher />
            <SidebarNav />
            {account && <div className="mt-auto">{account}</div>}
          </aside>
          <section className="min-h-0 flex-1 overflow-y-auto p-6 max-md:pb-24">
            {/* Phones have no sidebar: the wallet switcher goes on top, the account (and sign-out) on Settings. */}
            <div className="mb-4 md:hidden">
              <WalletSwitcher />
            </div>
            {account && isActiveRoute(pathname, SETTINGS_PATH) && <div className="mb-6 md:hidden">{account}</div>}
            <ScreenTransition transitionKey={pathname}>{children}</ScreenTransition>
          </section>
        </div>
        <BottomNav />
      </MacWindow>
      </motion.div>
      {minimized && <div className="pointer-events-auto fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-window px-4 py-3 shadow-lg backdrop-blur-2xl">
          <AppIcon /><span className="text-[13px] font-medium">{t("common.appName")}</span>
          <button ref={restoreRef} type="button" onClick={() => setMinimized(false)} aria-label={t("common.window.restore")} title={t("common.window.restore")} className="flex size-6 items-center justify-center rounded-full bg-[#28c840] text-black focus-visible:outline-2 focus-visible:outline-ring">+</button>
        </div>
      </div>}
    </main>
    </>
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
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border/60 bg-titlebar pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
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

/** Name, e-mail and sign-out at the bottom of the sidebar. */
export function AccountPanel({
  name,
  email,
  onSignOut,
  pending = false,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
  pending?: boolean;
}) {
  const t = useTranslations("auth");
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{email}</div>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={t("signOut")} title={t("signOut")} disabled={pending} onClick={onSignOut}>
        <LogOutIcon />
      </Button>
    </div>
  );
}
