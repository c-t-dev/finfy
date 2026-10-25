import * as React from "react";
import { cn } from "@packages/ui/lib/utils";

const BARS = 12;

/** The classic macOS activity indicator: twelve fading spokes. */
function Spinner({
  className,
  size = 16,
  label = "Loading",
  ...props
}: React.ComponentProps<"span"> & { size?: number; /** Pass the translated text. */ label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      data-slot="spinner"
      className={cn("relative inline-block shrink-0 text-current", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          className="absolute left-[45%] top-0 h-[28%] w-[10%] animate-spinner-fade rounded-full bg-current"
          style={{
            transform: `rotate(${(360 / BARS) * i}deg)`,
            transformOrigin: "50% 178.5%",
            animationDelay: `${i / BARS - 1}s`,
          }}
        />
      ))}
    </span>
  );
}

export { Spinner };
