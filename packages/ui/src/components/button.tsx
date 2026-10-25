import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@packages/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity,scale] duration-100 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.18),inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-primary/90",
        secondary:
          "border border-border bg-card text-foreground shadow-[0_1px_1px_rgb(0_0_0/0.06)] hover:bg-accent dark:bg-white/10 dark:hover:bg-white/15",
        ghost: "text-foreground/80 hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/10",
        destructive: "bg-destructive text-white shadow-[0_1px_2px_rgb(0_0_0/0.18)] hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 rounded-[6px] px-2.5 text-xs",
        lg: "h-10 rounded-lg px-5 text-sm",
        xl: "h-12 rounded-xl px-6 text-[15px]",
        icon: "size-8",
        "icon-sm": "size-7 rounded-[6px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
