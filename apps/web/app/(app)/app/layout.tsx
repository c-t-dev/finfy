import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_PREFIXES } from "@packages/shared/i18n";
import { AppHost } from "@/components/app-host";
import { RootDocument } from "@/components/root-document";
import { getCurrentUser } from "@/lib/server/auth/session";
import { listWallets } from "@/lib/server/wallets";
import { CURRENT_WALLET_COOKIE, WINDOW_WIDE_COOKIE } from "@/lib/cookies";
import { PATH_HEADER, safeNextPath } from "@/lib/next-path";

export { viewport } from "@/components/root-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  // The signed-in app is never indexed.
  return { title: t("appName"), robots: { index: false, follow: false } };
}

/** Everything under /app needs a session; without one, go to the sign-in page in the visitor's language. */
export default async function SignedInLayout({ children }: LayoutProps<"/app">) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    const next = safeNextPath((await headers()).get(PATH_HEADER));
    redirect(`${LOCALE_PREFIXES[locale]}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  const jar = await cookies();
  const wide = jar.get(WINDOW_WIDE_COOKIE)?.value === "1";
  const wallets = await listWallets(user.id);
  const remembered = jar.get(CURRENT_WALLET_COOKIE)?.value;
  const currentWalletId = wallets.find((wallet) => wallet.id === remembered)?.id ?? wallets[0]?.id ?? null;
  return (
    <RootDocument locale={locale}>
      <AppHost
        initialWide={wide}
        user={{ name: user.name, email: user.email }}
        wallets={wallets}
        currentWalletId={currentWalletId}
      >
        {children}
      </AppHost>
    </RootDocument>
  );
}
