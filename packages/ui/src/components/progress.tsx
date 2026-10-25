"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@packages/ui/lib/utils";

/** Pass `value={null}` for an indeterminate bar. */
function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const indeterminate = value == null;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-primary",
          indeterminate ? "w-1/3 animate-indeterminate" : "w-full transition-transform duration-300 ease-out",
        )}
        style={
          indeterminate ? undefined : { transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }
        }
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
