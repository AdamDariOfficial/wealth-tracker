import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationView } from "@/application/view-models";
import { Money } from "@/domain/core";
import { formatMoney, humanize } from "@/features/wealth-v2/format";
import { chartTooltipProps } from "@/lib/chart-style";

/**
 * Current composition by asset class.
 *
 * Slice geometry is derived from canonical valued amounts. No percentage is
 * asserted to the user — the readable figure is always the canonical Money
 * value, so the chart cannot imply a precision the ledger does not have.
 */

const SLICE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function compositionColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length]!;
}

export function CompositionChart({
  slices,
  locale,
}: {
  slices: readonly AllocationView[];
  locale?: string;
}) {
  const reduceMotion = useReducedMotion();
  const data = useMemo(
    () =>
      slices.map((slice, index) => ({
        kind: slice.kind,
        label: humanize(slice.kind),
        display: formatMoney(Money.of(slice.amount, slice.currency), locale),
        color: compositionColor(index),
        value: Math.abs(Number(slice.amount)),
      })),
    [slices, locale],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="58%"
          outerRadius="88%"
          paddingAngle={data.length > 1 ? 2 : 0}
          stroke="none"
          isAnimationActive={!reduceMotion}
          animationDuration={reduceMotion ? 0 : 420}
        >
          {data.map((slice) => (
            <Cell key={slice.kind} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          {...chartTooltipProps}
          cursor={false}
          animationDuration={reduceMotion ? 0 : chartTooltipProps.animationDuration}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const slice = payload[0]?.payload as (typeof data)[number] | undefined;
            if (!slice) return null;
            return (
              <div style={chartTooltipProps.contentStyle}>
                <div style={chartTooltipProps.labelStyle}>{slice.label}</div>
                <div className="font-mono text-sm">{slice.display}</div>
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
