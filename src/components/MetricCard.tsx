import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

export type MetricTone = "neutral" | "positive" | "negative" | "warning" | "accent";

const toneClass: Record<MetricTone, string> = {
  neutral: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
  accent: "text-cyan",
};

const toneSurfaceClass: Record<MetricTone, string> = {
  neutral: "",
  positive: "semantic-surface-positive-1",
  negative: "semantic-surface-negative-1",
  warning: "semantic-surface-warning",
  accent: "",
};

/**
 * Bridges legacy `tone` props that were plain Tailwind class strings onto the
 * semantic tone scale, so existing call sites keep working unchanged.
 */
export function metricToneFromClass(value?: string): MetricTone {
  if (!value) return "neutral";
  if (value.includes("destructive")) return "negative";
  if (value.includes("success")) return "positive";
  if (value.includes("warning")) return "warning";
  if (value.includes("cyan")) return "accent";
  return "neutral";
}

/**
 * The single metric surface used across every route.
 *
 * Hierarchy rules:
 *  - `emphasis="hero"`   → focal surface, fluid money type. One per page.
 *  - `emphasis="normal"` → calm section surface. Supporting figures.
 *
 * Financial values wrap rather than truncate: a clipped balance is worse
 * than a two-line balance.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  emphasis = "normal",
  sign,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
  emphasis?: "normal" | "hero";
  /** Rendered next to the value so meaning never depends on color alone. */
  sign?: ReactNode;
  className?: string;
}) {
  const hero = emphasis === "hero";
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "min-w-0 p-4 sm:p-5",
        hero ? "surface-focal" : "surface-section",
        !hero && toneSurfaceClass[tone],
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            className={cn("h-4 w-4 shrink-0", hero ? "text-cyan" : "text-muted-foreground")}
            aria-hidden="true"
          />
        )}
        <span className="label-muted min-w-0 truncate">{t(label)}</span>
      </div>

      <div
        className={cn(
          "mt-2 flex items-baseline gap-1.5 font-display font-semibold text-money",
          hero ? "text-money-hero" : "text-money-lg",
          toneClass[tone],
        )}
      >
        {sign}
        <span className="min-w-0">{value}</span>
      </div>

      {hint && <div className="mt-1.5 text-xs leading-5 text-muted-foreground">{t(hint)}</div>}
    </div>
  );
}
