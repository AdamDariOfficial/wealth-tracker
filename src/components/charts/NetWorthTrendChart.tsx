import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NetWorthPointView } from "@/application/view-models";
import { Money } from "@/domain/core";
import { formatMoney } from "@/features/wealth-v2/format";
import { chartTooltipProps } from "@/lib/chart-style";

/**
 * Known net worth at each month close.
 *
 * Every point is a canonical point-in-time valuation produced by the
 * application layer. The numbers passed to Recharts are used for pixel
 * geometry only — every value the user reads is formatted from the canonical
 * Money amount.
 */
export function NetWorthTrendChart({
  points,
  currency,
  locale,
}: {
  points: readonly NetWorthPointView[];
  currency: string;
  locale?: string;
}) {
  const reduceMotion = useReducedMotion();
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale ?? "en-US", { month: "short" }),
    [locale],
  );
  const monthYearLabel = useMemo(
    () => new Intl.DateTimeFormat(locale ?? "en-US", { month: "long", year: "numeric" }),
    [locale],
  );

  const data = useMemo(
    () =>
      points.map((point) => ({
        key: point.key,
        label: monthLabel.format(point.start),
        full: monthYearLabel.format(point.start),
        complete: point.valuationComplete,
        display: formatMoney(point.knownNetWorth, locale),
        value: point.knownNetWorth ? Number(point.knownNetWorth.amount.toString()) : null,
      })),
    [points, monthLabel, monthYearLabel, locale],
  );

  const compact = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale ?? "en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      });
    } catch {
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
    }
  }, [locale]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          cursor={{ stroke: "var(--color-cyan)", strokeOpacity: 0.35, strokeWidth: 1 }}
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
                    Some positions were unvalued
                  </div>
                )}
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={currency}
          stroke="var(--color-cyan)"
          strokeWidth={2}
          fill="url(#netWorthFill)"
          connectNulls
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-cyan)" }}
          isAnimationActive={!reduceMotion}
          animationDuration={reduceMotion ? 0 : 420}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function moneyFromSlice(amount: string, currency: string): Money {
  return Money.of(amount, currency);
}
