"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Pass the resolved theme from the app's theme provider. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
