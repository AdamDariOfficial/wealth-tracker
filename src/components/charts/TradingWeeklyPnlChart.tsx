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
import type { WeeklyReview } from "@/application/advanced";
import { Decimal, Money } from "@/domain/core";
import { formatMoney } from "@/features/wealth-v2/format";
import { chartTooltipProps } from "@/lib/chart-style";

export function TradingWeeklyPnlChart({
  reviews,
  currency,
  locale,
}: {
  reviews: readonly WeeklyReview[];
  currency: string | null;
  locale?: string;
}) {
  const reduceMotion = useReducedMotion();
  const weekLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale ?? "en-US", {
        day: "numeric",
        month: "short",
      }),
    [locale],
  );
  const fullLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale ?? "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [locale],
  );
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

  const data = useMemo(
    () =>
      [...reviews]
        .sort((left, right) => left.weekStart.localeCompare(right.weekStart))
        .map((review) => {
          const amount = Decimal.parse(review.reportedPnl);
          const start = new Date(`${review.weekStart}T00:00:00`);
          return {
            id: review.id,
            label: weekLabel.format(start),
            full: fullLabel.format(start),
            value: Number(amount.toString()),
            display: currency ? formatMoney(Money.of(amount, currency), locale) : amount.toString(),
            tone: amount.isZero() ? "neutral" : amount.isNegative() ? "negative" : "positive",
          };
        }),
    [reviews, currency, locale, weekLabel, fullLabel],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
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
                <div style={chartTooltipProps.labelStyle}>Week of {point.full}</div>
                <div className="font-mono text-sm">{point.display}</div>
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
              key={point.id}
              fill={
                point.tone === "positive"
                  ? "var(--color-success)"
                  : point.tone === "negative"
                    ? "var(--color-destructive)"
                    : "var(--color-muted-foreground)"
              }
              fillOpacity={point.tone === "neutral" ? 0.35 : 0.78}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
