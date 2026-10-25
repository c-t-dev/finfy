"use client";

import { useTranslations } from "../i18n";
import type { AppRouteKey } from "../navigation";

/** Placeholder for sections that land in later milestones. */
export function ComingSoonScreen({ route }: { route: Exclude<AppRouteKey, "home"> }) {
  const t = useTranslations("app");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t(`nav.${route}`)}</h1>
      <p className="text-[13px] text-muted-foreground">{t("comingSoon")}</p>
    </div>
  );
}
