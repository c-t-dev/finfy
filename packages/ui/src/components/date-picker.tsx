"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { CalendarDaysIcon } from "lucide-react";
import { enUS, ptBR } from "@daypicker/react/locale";
import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { cn } from "@packages/ui/lib/utils";

type DatePickerProps = {
  id: string; name: string; defaultValue: string; locale: string; label: string; todayLabel: string;
  disabled?: boolean; "aria-invalid"?: boolean; "aria-describedby"?: string;
};
const dateFromValue = (value: string) => new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)), 12);
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Local-calendar dates: selecting a day never converts through UTC. */
export function DatePicker({ id, name, defaultValue, locale, label, todayLabel, disabled, ...aria }: DatePickerProps) {
  const [value, setValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const selected = dateFromValue(value);
  const pick = (date: Date | undefined) => { if (date) { setValue(dateValue(date)); setOpen(false); } };
  return <>
    <input type="hidden" name={name} value={value} />
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button id={id} type="button" variant="secondary" disabled={disabled} aria-label={label} {...aria}
          className="h-9 min-w-40 justify-between gap-4 rounded-lg font-normal tabular-nums aria-invalid:border-destructive">
          {new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(selected)}
          <CalendarDaysIcon className="size-4 text-primary" aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={7} collisionPadding={12} aria-label={label}
          className={cn("z-50 max-h-(--radix-popover-content-available-height) overflow-y-auto w-fit max-w-[calc(100vw-24px)] origin-(--radix-popover-content-transform-origin) rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-2xl backdrop-saturate-150 outline-none data-[state=open]:animate-materialize-in data-[state=closed]:animate-materialize-out")}>
          <Calendar mode="single" required selected={selected} defaultMonth={selected} onSelect={pick} autoFocus locale={locale.startsWith("pt") ? ptBR : enUS} />
          <div className="border-t border-border/60 px-2.5 py-1.5"><Button type="button" variant="ghost" size="sm" className="w-full text-primary" onClick={() => pick(new Date())}>{todayLabel}</Button></div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </>;
}
