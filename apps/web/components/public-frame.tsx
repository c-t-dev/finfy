"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { LOCALE_PREFIXES, type Locale } from "@packages/shared/i18n";

const AuthWindowContext = React.createContext<{
  minimized: boolean;
  setMinimized: (value: boolean) => void;
  setOverlay: (value: boolean) => void;
} | null>(null);

export function usePublicAuthWindow() {
  const context = React.useContext(AuthWindowContext);
  if (!context) throw new Error("AuthFlow requires PublicFrame");
  return context;
}

/** The router owns the background page; this state only minimizes its auth slot. */
export function PublicFrame({ children, auth }: { children: React.ReactNode; auth: React.ReactNode }) {
  const locale = useLocale() as Locale;
  const [overlay, setOverlayState] = React.useState(false);
  const [minimized, setMinimizedState] = React.useState(false);
  const minimizedRef = React.useRef(false);
  const authHref = React.useRef<string | null>(null);
  const setOverlay = React.useCallback((active: boolean) => {
    setOverlayState(active);
    if (!active) {
      minimizedRef.current = false;
      authHref.current = null;
      setMinimizedState(false);
    }
  }, []);
  const setMinimized = React.useCallback((value: boolean) => {
    if (value === minimizedRef.current) return;
    if (value) {
      authHref.current = window.location.pathname + window.location.search + window.location.hash;
      window.history.replaceState(null, "", LOCALE_PREFIXES[locale]);
    } else if (authHref.current) {
      window.history.replaceState(null, "", authHref.current);
    }
    minimizedRef.current = value;
    setMinimizedState(value);
  }, [locale]);
  return (
    <AuthWindowContext.Provider value={{ minimized, setMinimized, setOverlay }}>
      <div
        inert={!!overlay && !minimized}
        aria-hidden={!!overlay && !minimized}
        onClickCapture={(event) => {
          if (!overlay || !minimized || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const link = event.target instanceof Element ? event.target.closest("a") : null;
          if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
          if (!link.pathname.endsWith("/sign-in")) return;
          event.preventDefault();
          event.stopPropagation();
          setMinimized(false);
        }}
      >{children}</div>
      {auth}
    </AuthWindowContext.Provider>
  );
}
