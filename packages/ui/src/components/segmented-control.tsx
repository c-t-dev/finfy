"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@packages/ui/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  size?: "sm" | "default";
  "aria-label"?: string;
}

/** Shared with link-based segmented navigation (e.g. tool switchers). Active items use data-state="on". */
function segmentedRootClass(size: "sm" | "default" = "default") {
  return cn("inline-flex items-center rounded-lg bg-foreground/[0.07] p-0.5 dark:bg-white/10", size === "sm" ? "h-7" : "h-8");
}

function segmentedItemClass(size: "sm" | "default" = "default") {
  return cn(
    "inline-flex h-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[12px] font-medium text-foreground/65 outline-none transition-[background-color,color,box-shadow,scale] duration-150 ease-out hover:text-foreground active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_3px_rgb(0_0_0/0.14),0_0_0_0.5px_rgb(0_0_0/0.06)] dark:data-[state=on]:bg-white/20 [&_svg]:size-3.5",
    size === "sm" ? "px-2" : "px-3",
  );
}

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = "default",
  ...props
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Radix allows deselecting the active item; a segmented control never does.
      onValueChange={(next) => next && onValueChange(next as T)}
      data-slot="segmented-control"
      className={cn(
        segmentedRootClass(size),
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          title={option.title}
          aria-label={option.title}
          className={cn(
            segmentedItemClass(size),
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

export { SegmentedControl, segmentedItemClass, segmentedRootClass };
