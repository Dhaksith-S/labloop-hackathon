import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-primary/80 hover:bg-primary/90 shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
  secondary:
    "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/70",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted/70",
  ghost: "border border-transparent bg-transparent text-foreground hover:bg-muted/70",
  danger:
    "bg-destructive text-destructive-foreground border border-destructive/80 hover:bg-destructive/90",
  accent:
    "bg-accent text-accent-foreground border border-accent/80 hover:bg-accent/90",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.78rem] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[0.95rem] gap-2.5 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={buttonStyles({ variant, size, className })} {...props} />;
}
