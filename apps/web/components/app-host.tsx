"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@packages/app/app-shell";
import { AppNavigationProvider, type AppLinkProps } from "@packages/app/navigation";
import { AppLanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

function Link(props: AppLinkProps) {
  return <NextLink {...props} />;
}

/** Plugs Next.js routing into the router-free screens of @packages/app. */
export function AppHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AppNavigationProvider Link={Link} pathname={pathname}>
      <AppShell
        trailing={
          <div className="flex items-center gap-2">
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
