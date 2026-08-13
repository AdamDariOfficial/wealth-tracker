import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityBucketView } from "@/application/view-models";
import { chartTooltipProps } from "@/lib/chart-style";

/**
 * How much was recorded, month by month. These are exact counts of canonical
 * transactions — never an estimate, a rate or a projection.
 */
export function ActivityRhythmChart({
  buckets,
  locale,
}: {
  buckets: readonly ActivityBucketView[];
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
      buckets.map((bucket) => ({
        key: bucket.key,
        label: monthLabel.format(bucket.start),
        full: monthYearLabel.format(bucket.start),
        entries: bucket.eventCount - bucket.correctionCount,
        corrections: bucket.correctionCount,
        total: bucket.eventCount,
      })),
    [buckets, monthLabel, monthYearLabel],
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
          width={32}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
        />
        <Tooltip
          {...chartTooltipProps}
          animationDuration={reduceMotion ? 0 : chartTooltipProps.animationDuration}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const bucket = payload[0]?.payload as (typeof data)[number] | undefined;
            if (!bucket) return null;
            return (
              <div style={chartTooltipProps.contentStyle}>
                <div style={chartTooltipProps.labelStyle}>{bucket.full}</div>
                <div className="font-mono text-sm">
                  {bucket.total} {bucket.total === 1 ? "entry" : "entries"}
                </div>
                {bucket.corrections > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    including {bucket.corrections}{" "}
                    {bucket.corrections === 1 ? "correction" : "corrections"}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Bar
          dataKey="entries"
          stackId="activity"
          fill="var(--color-cyan)"
          fillOpacity={0.75}
          radius={[0, 0, 0, 0]}
          isAnimationActive={!reduceMotion}
          animationDuration={reduceMotion ? 0 : 420}
        />
        <Bar
          dataKey="corrections"
          stackId="activity"
          fill="var(--color-chart-3)"
          fillOpacity={0.8}
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reduceMotion}
          animationDuration={reduceMotion ? 0 : 420}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
