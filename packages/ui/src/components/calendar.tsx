"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import { DayPicker } from "@daypicker/react";
import { cn } from "@packages/ui/lib/utils";

/** Token-based calendar. DayPicker owns keyboard navigation and localized ARIA labels. */
export function Calendar({ className, classNames, components, ...props }: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker showOutsideDays fixedWeeks className={cn("w-fit p-2.5 text-[12px] text-popover-foreground", className)}
    classNames={{
      root: "relative", months: "relative flex flex-col gap-4", month: "flex flex-col gap-2",
      month_caption: "flex h-8 items-center px-1 font-semibold capitalize",
      caption_label: "text-[14px]", nav: "absolute right-0 top-0 flex gap-1",
      button_previous: "flex size-8 items-center justify-center rounded-full text-primary outline-none hover:bg-primary/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30",
      button_next: "flex size-8 items-center justify-center rounded-full text-primary outline-none hover:bg-primary/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30",
      month_grid: "w-full border-collapse", weekdays: "flex", weekday: "w-8 pointer-coarse:w-10 py-1 text-center text-[11px] font-medium uppercase text-muted-foreground",
      week: "mt-1 flex", day: "group relative size-8 pointer-coarse:size-10 p-0 text-center",
      day_button: "flex size-8 pointer-coarse:size-10 items-center justify-center rounded-full text-[12px] tabular-nums outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring group-data-[selected=true]:bg-primary group-data-[selected=true]:font-semibold group-data-[selected=true]:text-primary-foreground",
      selected: "[&_button]:bg-primary [&_button]:font-semibold [&_button]:text-primary-foreground",
      today: "font-semibold text-primary", outside: "text-muted-foreground/50", disabled: "pointer-events-none opacity-30", hidden: "invisible",
      ...classNames,
    }} components={{ Chevron: ({ orientation, className }) => {
      const Icon = orientation === "left" ? ChevronLeftIcon : orientation === "right" ? ChevronRightIcon : ChevronDownIcon;
      return <Icon aria-hidden className={cn("size-4", className)} />;
    }, ...components }} {...props} />;
}
