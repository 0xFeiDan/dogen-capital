import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-text-secondary uppercase tracking-wide"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full min-h-[100px] rounded-lg bg-surface-2 border text-sm text-text-primary",
            "placeholder:text-text-muted px-3 py-2.5 resize-y",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            error
              ? "border-loss/40 focus:ring-loss/20"
              : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-loss">{error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
