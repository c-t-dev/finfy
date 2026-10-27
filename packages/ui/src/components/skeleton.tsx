import * as React from "react";
import { cn } from "../lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} aria-hidden="true" className={cn("rounded-md bg-foreground/10 motion-safe:animate-pulse", className)} />;
}
