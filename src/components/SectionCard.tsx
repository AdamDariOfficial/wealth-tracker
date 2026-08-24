import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  elevated = false,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  elevated?: boolean;
}) {
  const hasHeader = Boolean(title || description || action);
  const { t } = useI18n();
  return (
    <section
      className={cn(elevated ? "surface-elevated" : "surface-section", "p-4 sm:p-5", className)}
    >
      {hasHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />}
            <div className="min-w-0">
              {title && (
                <h2 className="font-display text-base font-semibold tracking-tight">{t(title)}</h2>
              )}
              {description && (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(description)}</p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
        </div>
      )}
      <div className={cn(hasHeader && "mt-4", bodyClassName)}>{children}</div>
    </section>
  );
}
