"use client";

import * as React from "react";
import { APP_BASE } from "./app-base";
import { HomeIcon, ListIcon, SettingsIcon, TargetIcon, WalletCardsIcon, type LucideIcon } from "lucide-react";

/**
 * The app never imports a router. The host (Next.js on the web, a Vite build
 * for Tauri and Capacitor later) passes its own Link and current path, so the
 * same screens run everywhere (wiki/decisoes/0010).
 */
export interface AppLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-current"?: "page";
}

interface AppNavigation {
  Link: React.ComponentType<AppLinkProps>;
  pathname: string;
}

const NavigationContext = React.createContext<AppNavigation | null>(null);

export function AppNavigationProvider({ children, ...value }: AppNavigation & { children: React.ReactNode }) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useAppNavigation(): AppNavigation {
  const value = React.useContext(NavigationContext);
  if (!value) throw new Error("useAppNavigation must be used inside AppNavigationProvider");
  return value;
}

export { APP_BASE };

export const APP_ROUTES = [
  { key: "home", path: APP_BASE, icon: HomeIcon },
  { key: "statement", path: `${APP_BASE}/statement`, icon: ListIcon },
  { key: "accounts", path: `${APP_BASE}/accounts`, icon: WalletCardsIcon },
  { key: "goals", path: `${APP_BASE}/goals`, icon: TargetIcon },
  { key: "settings", path: `${APP_BASE}/settings`, icon: SettingsIcon },
] as const satisfies readonly { key: string; path: string; icon: LucideIcon }[];

export type AppRouteKey = (typeof APP_ROUTES)[number]["key"];

export function isActiveRoute(pathname: string, path: string): boolean {
  return path === APP_BASE ? pathname === APP_BASE : pathname === path || pathname.startsWith(`${path}/`);
}
