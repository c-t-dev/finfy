"use client";

import * as React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "../i18n";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { AssetsSection, NetWorthCard } from "../patrimony-ui";
import { useWallets } from "../wallets";
import type { Wallet } from "@packages/shared/wallets";

export function PatrimonyScreen() {
  const t = useTranslations("app.patrimony");
  const orientation = useTranslations("app.orientation");
  const { current } = useWallets();
  const { Link } = useAppNavigation();
  return <div className="mx-auto flex max-w-3xl flex-col gap-5">
    <Link href={APP_ROUTES.find(route => route.key === "accounts")!.path} className="flex items-center gap-1 self-start text-[13px] text-primary hover:underline">
      <ChevronLeftIcon className="size-4" aria-hidden />{t("backToAccounts")}
    </Link>
    <div className="space-y-1"><h1 className="text-2xl font-semibold">{t("pageTitle")}</h1>
      <p className="text-[13px] text-muted-foreground">{orientation("patrimony")}</p></div>
    {current && <WalletPatrimony key={current.id} wallet={current} />}
  </div>;
}

function WalletPatrimony({ wallet }: { wallet: Wallet }) {
  const [revision, setRevision] = React.useState(0);
  return <>
    <NetWorthCard wallet={wallet} reloadKey={revision} />
    <AssetsSection wallet={wallet} onChanged={() => setRevision(value => value + 1)} />
  </>;
}
