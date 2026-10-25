"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { AccountPanel, AppShell, WindowWidthToggle } from "@packages/app/app-shell";
import { AppNavigationProvider, type AppLinkProps } from "@packages/app/navigation";
import { WalletProvider } from "@packages/app/wallets";
import { LOCALE_PREFIXES } from "@packages/shared/i18n";
import type { Wallet } from "@packages/shared/wallets";
import { AppLanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth-client";
import { CURRENT_WALLET_COOKIE, WINDOW_WIDE_COOKIE } from "@/lib/cookies";
import { webWalletClient } from "@/lib/wallet-client";

function Link(props: AppLinkProps) {
  return <NextLink {...props} />;
}

/** Plugs Next.js routing and the session into the router-free screens of @packages/app. */
export function AppHost({
  children,
  initialWide,
  user,
  wallets,
  currentWalletId,
}: {
  children: React.ReactNode;
  initialWide: boolean;
  user: { name: string; email: string };
  wallets: Wallet[];
  currentWalletId: string | null;
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

  const rememberWallet = React.useCallback((walletId: string | null) => {
    document.cookie = walletId
      ? `${CURRENT_WALLET_COOKIE}=${walletId}; path=/; max-age=31536000; samesite=lax`
      : `${CURRENT_WALLET_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace(`${LOCALE_PREFIXES[locale]}/sign-in`);
    router.refresh();
  };

  return (
    <AppNavigationProvider Link={Link} pathname={pathname}>
      <WalletProvider
        client={webWalletClient}
        initialWallets={wallets}
        initialCurrentId={currentWalletId}
        onCurrentChange={rememberWallet}
      >
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
      </WalletProvider>
    </AppNavigationProvider>
  );
}
