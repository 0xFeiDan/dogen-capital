import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "profit" | "loss";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-surface hover:bg-accent-dim active:scale-[0.98] font-medium",
  secondary:
    "bg-surface-3 text-text-primary border border-border hover:bg-surface-4 active:scale-[0.98]",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-surface-3 active:scale-[0.98]",
  danger:
    "bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 active:scale-[0.98]",
  profit:
    "bg-profit/10 text-profit border border-profit/20 hover:bg-profit/20 active:scale-[0.98]",
  loss: "bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 active:scale-[0.98]",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-xs gap-1 rounded",
  sm: "h-7 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-6 text-sm gap-2 rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      iconLeft,
      iconRight,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          iconLeft
        )}
        {children}
        {!loading && iconRight}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
