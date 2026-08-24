import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "surface-section flex flex-col items-center justify-center px-5 text-center",
        compact ? "py-8" : "py-12 sm:py-16",
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-foreground">{t(title)}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{t(description)}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
