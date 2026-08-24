import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NetWorthPointView } from "@/application/view-models";
import { Decimal } from "@/domain/core";
import { formatMoney } from "@/features/wealth-v2/format";
import { chartTooltipProps } from "@/lib/chart-style";
import { normalizeAppLocale, tr } from "@/lib/i18n";

/**
 * Month-over-month change in canonical known net worth.
 *
 * This deliberately is not labelled as investment performance: the delta can
 * include recorded cash flows as well as valuation changes. JavaScript numbers
 * are used only for chart geometry; displayed values come from canonical Money.
 */
export function NetWorthDeltaChart({
  points,
  locale,
}: {
  points: readonly NetWorthPointView[];
  locale?: string;
}) {
  const reduceMotion = useReducedMotion();
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale ?? "en-US", { month: "short" }),
    [locale],
  );
  const monthYearLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale ?? "en-US", {
        month: "long",
        year: "numeric",
      }),
    [locale],
  );

  const data = useMemo(() => {
    const rows: Array<{
      key: string;
      label: string;
      full: string;
      display: string;
      value: number;
      positive: boolean;
      complete: boolean;
    }> = [];

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (!previous.knownNetWorth || !current.knownNetWorth) continue;
      const delta = current.knownNetWorth.minus(previous.knownNetWorth);
      rows.push({
        key: current.key,
        label: monthLabel.format(current.start),
        full: monthYearLabel.format(current.start),
        display: formatMoney(delta, locale),
        value: Number(delta.amount.toString()),
        positive: delta.amount.compare(Decimal.zero()) >= 0,
        complete: previous.valuationComplete && current.valuationComplete,
      });
    }

    return rows;
  }, [points, monthLabel, monthYearLabel, locale]);

  const compact = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale ?? "en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      });
    } catch {
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      });
    }
  }, [locale]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          minTickGap={12}
          interval="preserveStartEnd"
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => compact.format(value)}
        />
        <Tooltip
          {...chartTooltipProps}
          animationDuration={reduceMotion ? 0 : chartTooltipProps.animationDuration}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0]?.payload as (typeof data)[number] | undefined;
            if (!point) return null;
            return (
              <div style={chartTooltipProps.contentStyle}>
                <div style={chartTooltipProps.labelStyle}>{point.full}</div>
                <div className="font-mono text-sm">{point.display}</div>
                {!point.complete && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {tr(normalizeAppLocale(locale), "Based on partially valued month closes")}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reduceMotion}
          animationDuration={reduceMotion ? 0 : 420}
        >
          {data.map((point) => (
            <Cell
              key={point.key}
              fill={point.positive ? "var(--color-success)" : "var(--color-destructive)"}
              fillOpacity={0.78}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
