import * as React from "react";
import { cn } from "@packages/ui/lib/utils";

/** A translucent macOS-style window frame. */
function MacWindow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mac-window"
      className={cn(
        "relative flex flex-col overflow-hidden bg-window backdrop-blur-2xl backdrop-saturate-150 sm:rounded-xl sm:border sm:border-border sm:shadow-[0_30px_80px_rgb(0_0_0/0.28),0_0_0_0.5px_rgb(0_0_0/0.15)] dark:sm:shadow-[0_30px_80px_rgb(0_0_0/0.6),0_0_0_0.5px_rgb(255_255_255/0.12),inset_0_0.5px_0_rgb(255_255_255/0.14)]",
        className,
      )}
      {...props}
    />
  );
}

/** Filled diagonal triangles used by the macOS green window control. */
function ZoomGlyph({ zoomed }: { zoomed: boolean }) {
  return <svg viewBox="0 0 12 12" className="size-2" aria-hidden fill="currentColor">
    {zoomed ? <path d="M1.5 5.5H5.5V1.5Z M6.5 10.5V6.5H10.5Z" /> : <path d="M1.5 1.5H5.5L1.5 5.5Z M10.5 10.5H6.5L10.5 6.5Z" />}
  </svg>;
}

/** Close / minimise / zoom buttons. Purely decorative unless handlers are passed. */
function TrafficLights({
  className,
  onClose,
  onMinimize,
  onZoom,
  zoomed = false,
  labels,
}: {
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onZoom?: () => void;
  /** Whether the green control restores an already maximized window. */
  zoomed?: boolean;
  /** Translated labels; only announced when a handler is passed. */
  labels?: { close?: string; minimize?: string; zoom?: string };
}) {
  const lights = [
    { color: "bg-[#ff5f57]", glyph: "×", label: labels?.close ?? "Close", onClick: onClose },
    { color: "bg-[#febc2e]", glyph: "−", label: labels?.minimize ?? "Minimize", onClick: onMinimize },
    { color: "bg-[#28c840]", glyph: onZoom ? <ZoomGlyph zoomed={zoomed} /> : "+", label: labels?.zoom ?? "Zoom", onClick: onZoom },
  ];
  return (
    <div className={cn("group/lights flex items-center gap-2", className)}>
      {lights.map((light) => (
        <button
          key={light.color}
          type="button"
          tabIndex={light.onClick ? 0 : -1}
          aria-label={light.label}
          aria-hidden={!light.onClick}
          onClick={light.onClick}
          className={cn(
            "flex size-3 items-center justify-center rounded-full text-[9px] font-bold leading-none text-black/0 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.2)] transition-colors group-hover/lights:text-black/55",
            light.color,
            light.onClick === onZoom && onZoom && "text-black/65",
            !light.onClick && "cursor-default",
          )}
        >
          {light.glyph}
        </button>
      ))}
    </div>
  );
}

function MacTitlebar({
  className,
  title,
  icon,
  center,
  trailing,
  trafficLights,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** Toolbar content in the middle (e.g. a tool switcher). The title then moves next to the traffic lights. */
  center?: React.ReactNode;
  trailing?: React.ReactNode;
  trafficLights?: Omit<React.ComponentProps<typeof TrafficLights>, "className">;
}) {
  const heading = (
    <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground/85">
      {icon}
      <span className="truncate">{title}</span>
    </div>
  );
  return (
    <div
      data-slot="mac-titlebar"
      className={cn(
        // Floats over the content, which scrolls underneath the translucent material.
        "absolute inset-x-0 top-0 z-30 grid h-12 select-none grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 bg-titlebar px-4 backdrop-blur-2xl backdrop-saturate-150",
        className,
      )}
      {...props}
    >
      {center ? (
        <>
          <div className="flex min-w-0 items-center gap-4">
            <TrafficLights className="max-sm:hidden" {...trafficLights} />
            <div className="max-md:hidden">{heading}</div>
          </div>
          <div className="flex items-center justify-center">{center}</div>
        </>
      ) : (
        <>
          <TrafficLights className="max-sm:hidden" {...trafficLights} />
          <div className="col-start-1 sm:col-start-2">{heading}</div>
        </>
      )}
      <div className="col-start-3 flex items-center justify-end">{trailing}</div>
    </div>
  );
}

export { MacTitlebar, MacWindow, TrafficLights };
