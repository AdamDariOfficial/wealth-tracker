import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

/**
 * One silhouette for every chart in the product.
 *
 * Charts sit in a recessed well with a fixed, breakpoint-aware height so the
 * plot area never collapses on mobile and never floats in an oversized card
 * on desktop. Callers pass a `<ResponsiveContainer>` child.
 */
export function ChartFrame({
  children,
  className,
  caption,
  height = "default",
}: {
  children: ReactNode;
  className?: string;
  /** Short, plain-language note under the plot. */
  caption?: ReactNode;
  height?: "compact" | "default" | "tall";
}) {
  const { t } = useI18n();
  const heightClass =
    height === "compact" ? "h-40 sm:h-44" : height === "tall" ? "h-64 sm:h-72" : "h-52 sm:h-60";

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className={cn("chart-well w-full overflow-hidden p-2 sm:p-3", heightClass)}>
        {children}
      </div>
      {caption && (
        <p className="text-xs leading-5 text-muted-foreground">
          {typeof caption === "string" ? t(caption) : caption}
        </p>
      )}
    </div>
  );
}
