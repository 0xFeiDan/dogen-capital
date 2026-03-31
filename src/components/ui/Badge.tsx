import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "profit"
  | "loss"
  | "neutral"
  | "accent"
  | "outline";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-3 text-text-secondary border border-border",
  profit: "bg-profit/10 text-profit border border-profit/20",
  loss: "bg-loss/10 text-loss border border-loss/20",
  neutral: "bg-surface-3 text-text-primary border border-border",
  accent: "bg-accent/10 text-accent border border-accent/20",
  outline: "bg-transparent text-text-secondary border border-border",
};

export function Badge({
  variant = "default",
  className,
  children,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "profit" && "bg-profit",
            variant === "loss" && "bg-loss",
            variant === "accent" && "bg-accent",
            !["profit", "loss", "accent"].includes(variant) && "bg-text-muted"
          )}
        />
      )}
      {children}
    </span>
  );
}
