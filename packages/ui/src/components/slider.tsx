"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@packages/ui/lib/utils";

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbs = (value ?? defaultValue ?? [min]).length;
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      className={cn("relative flex w-full touch-none select-none items-center py-1.5 data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-foreground/15">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbs }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          // The thumb is what gets focus (role="slider"), so it carries the label.
          aria-label={ariaLabel}
          className="block size-[18px] rounded-full border border-black/10 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
