"use client";

import * as React from "react";
import { PlusIcon, WalletIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { useTranslations } from "../i18n";
import { CreateWalletDialog } from "../wallet-ui";
import { useWallets } from "../wallets";

export function HomeScreen() {
  const t = useTranslations("app.home");
  const { current } = useWallets();
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {current ? (
        <p className="text-[13px] text-muted-foreground">{t("ready", { name: current.name })}</p>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <WalletIcon className="size-8 text-primary" aria-hidden />
          <h2 className="text-[15px] font-semibold">{t("emptyTitle")}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">{t("emptyBody")}</p>
          <Button className="mt-2" onClick={() => setCreating(true)}>
            <PlusIcon />
            {t("createWallet")}
          </Button>
          <CreateWalletDialog open={creating} onOpenChange={setCreating} />
        </div>
      )}
    </div>
  );
}
