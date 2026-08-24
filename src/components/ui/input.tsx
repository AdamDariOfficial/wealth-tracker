import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, placeholder, ...props }, ref) => {
    const { t } = useI18n();
    return (
      <input
        type={type}
        placeholder={typeof placeholder === "string" ? t(placeholder) : placeholder}
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:h-9 md:text-sm",
          (type === "date" || type === "datetime-local" || type === "time") &&
            "[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
export { Input };
