"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, WindowWidthToggle } from "@packages/app/app-shell";
import { AppNavigationProvider, type AppLinkProps } from "@packages/app/navigation";
import { AppLanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { WINDOW_WIDE_COOKIE } from "@/lib/cookies";

function Link(props: AppLinkProps) {
  return <NextLink {...props} />;
}

/** Plugs Next.js routing into the router-free screens of @packages/app. */
export function AppHost({ children, initialWide }: { children: React.ReactNode; initialWide: boolean }) {
  const pathname = usePathname();
  const [wide, setWide] = React.useState(initialWide);

  const changeWide = (next: boolean) => {
    setWide(next);
    document.cookie = `${WINDOW_WIDE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <AppNavigationProvider Link={Link} pathname={pathname}>
      <AppShell
        wide={wide}
        trailing={
          <div className="flex items-center gap-2">
            <WindowWidthToggle wide={wide} onWideChange={changeWide} />
            <AppLanguageSwitcher />
            <ThemeToggle />
          </div>
        }
      >
        {children}
      </AppShell>
    </AppNavigationProvider>
  );
}
