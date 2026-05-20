import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-surface transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pesatrix-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 press-scale",
  {
    variants: {
      variant: {
        default: "bg-pesatrix-blue text-white shadow-[0_12px_26px_rgba(20,99,255,0.18)] hover:bg-primary",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_12px_26px_rgba(186,26,26,0.14)] hover:bg-destructive/90",
        outline:
          "border border-outline-variant/70 bg-white/70 text-on-surface shadow-sm hover:border-pesatrix-blue/40 hover:bg-white",
        secondary:
          "bg-surface-container-high text-on-surface shadow-sm hover:bg-surface-container",
        ghost: "text-on-surface hover:bg-surface-container-low/90",
        link: "text-pesatrix-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-14 rounded-2xl px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
