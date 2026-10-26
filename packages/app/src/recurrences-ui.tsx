"use client";

import * as React from "react";
import { Label } from "@packages/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { RECURRENCE_FREQUENCIES, type RecurrenceFrequency } from "@packages/shared/finance";
import { newId } from "@packages/shared/ids";
import { useApi } from "./api";
import { useTranslations } from "./i18n";

export const NEVER = "NEVER";
export type RepeatChoice = RecurrenceFrequency | typeof NEVER;

/** "Doesn't repeat" plus every frequency. */
export function RepeatSelect({
  id,
  value,
  onValueChange,
  label,
  withNever = true,
}: {
  id: string;
  value: RepeatChoice;
  onValueChange: (value: RepeatChoice) => void;
  label?: string;
  withNever?: boolean;
}) {
  const t = useTranslations("app.recurrences");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label ?? t("repeat")}</Label>
      <Select value={value} onValueChange={(next) => onValueChange(next as RepeatChoice)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {withNever && <SelectItem value={NEVER}>{t("never")}</SelectItem>}
          {RECURRENCE_FREQUENCIES.map((frequency) => (
            <SelectItem key={frequency} value={frequency}>
              {t(`frequencies.${frequency}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Tops up the wallet's recurring entries once when a screen opens, and calls
 * `onCreated` when that added any (so the screen reloads its list).
 */
export function useRecurrenceRefresh(walletId: string, onCreated: () => void) {
  const request = useApi();
  const created = React.useRef(onCreated);
  created.current = onCreated;
  React.useEffect(() => {
    let active = true;
    request<{ created: number }>("POST", `/api/wallets/${walletId}/recurrences/refresh`, { mutationId: newId() }).then(
      (response) => {
        if (active && response.ok && response.value.created > 0) created.current();
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [request, walletId]);
}
