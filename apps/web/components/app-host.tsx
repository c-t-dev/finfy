"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { AccountPanel, AppShell, WindowWidthToggle } from "@packages/app/app-shell";
import { AppNavigationProvider, type AppLinkProps } from "@packages/app/navigation";
import { LOCALE_PREFIXES } from "@packages/shared/i18n";
import { AppLanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth-client";
import { WINDOW_WIDE_COOKIE } from "@/lib/cookies";

function Link(props: AppLinkProps) {
  return <NextLink {...props} />;
}

/** Plugs Next.js routing and the session into the router-free screens of @packages/app. */
export function AppHost({
  children,
  initialWide,
  user,
}: {
  children: React.ReactNode;
  initialWide: boolean;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [wide, setWide] = React.useState(initialWide);
  const [signingOut, setSigningOut] = React.useState(false);

  const changeWide = (next: boolean) => {
    setWide(next);
    document.cookie = `${WINDOW_WIDE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace(`${LOCALE_PREFIXES[locale]}/sign-in`);
    router.refresh();
  };

  return (
    <AppNavigationProvider Link={Link} pathname={pathname}>
      <AppShell
        wide={wide}
        account={
          <AccountPanel name={user.name} email={user.email} pending={signingOut} onSignOut={() => void handleSignOut()} />
        }
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
