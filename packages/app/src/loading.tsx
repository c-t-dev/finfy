"use client";

import * as React from "react";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Button } from "@packages/ui/components/button";
import { useTranslations } from "./i18n";

/** One accessible loading announcement; decorative shapes never read as data. */
export function LoadingList({ rows = 4 }: { rows?: number }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-label={t("loading")} aria-busy="true" className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function LoadingSummary() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-label={t("loading")} aria-busy="true" className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map(index => (
        <div key={index} className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function LoadingPanel() {
  const t = useTranslations("common");
  return <div role="status" aria-label={t("loading")} aria-busy="true" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
    <Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-36" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
  </div>;
}

export function ResourceFeedback({ state, reload, layout = "list" }: {
  state: { status: "loading" | "ready" | "error" }; reload: () => void; layout?: "list" | "panel";
}) {
  const t = useTranslations("common");
  if (state.status === "loading") return layout === "panel" ? <LoadingPanel /> : <LoadingList />;
  if (state.status !== "error") return null;
  return <div role="alert" className="flex items-center gap-3 text-[13px] text-destructive">
    {t("loadError")}<Button variant="secondary" size="sm" onClick={reload}>{t("retry")}</Button>
  </div>;
}
