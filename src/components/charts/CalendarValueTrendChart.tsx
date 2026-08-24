import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CalendarBucketView,
  CalendarScope,
  CalendarValuationView,
} from "@/application/view-models";
import { formatMoney } from "@/features/wealth-v2/format";
import { useI18n } from "@/lib/use-i18n";
import { chartTooltipProps } from "@/lib/chart-style";

function bucketLabel(scope: CalendarScope, date: Date, locale: string): string {
  if (scope === "week" || scope === "month") {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

export function CalendarValueTrendChart({
  scope,
  start,
  buckets,
  locale,
}: {
  scope: CalendarScope;
  start: CalendarValuationView;
  buckets: readonly CalendarBucketView[];
  locale: string;
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useI18n();
  const compact = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [locale],
  );

  const data = useMemo(() => {
    const points = [
      {
        key: "period-start",
        label: t("Start"),
        display: formatMoney(start.knownNetWorth, locale),
        value: Number(start.knownNetWorth.amount.toString()),
        complete: start.complete,
      },
    ];

    for (const bucket of buckets) {
      if (bucket.future || !bucket.knownNetWorth) continue;
      points.push({
        key: bucket.key,
        label: bucketLabel(scope, bucket.start, locale),
        display: formatMoney(bucket.knownNetWorth, locale),
        value: Number(bucket.knownNetWorth.amount.toString()),
        complete: bucket.valuationComplete,
      });
    }
    return points;
  }, [buckets, locale, scope, start, t]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          minTickGap={18}
        />
        <YAxis
          width={46}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          tickFormatter={(value: number) => compact.format(value)}
          domain={["auto", "auto"]}
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
                <div style={chartTooltipProps.labelStyle}>{point.label}</div>
                <div className="font-mono text-sm">{point.display}</div>
                {!point.complete ? (
                  <div className="mt-1 text-[11px] text-warning">{t("Partial valuation")}</div>
                ) : null}
              </div>
            );
          }}
        />
        <Line
          type="stepAfter"
          dataKey="value"
          stroke="var(--color-cyan)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--color-background)", strokeWidth: 2 }}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={!reduceMotion}
          animationDuration={reduceMotion ? 0 : 360}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
