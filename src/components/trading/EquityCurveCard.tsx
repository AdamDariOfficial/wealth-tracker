import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Activity } from "lucide-react";
import type { EquityPoint } from "@/lib/trading-engine";
import { cn } from "@/lib/utils";
import { chartTooltipProps } from "@/lib/chart-style";

type Mode = "performance" | "total" | "split";

export function EquityCurveCard({
  data,
  defaultMode = "performance",
}: {
  data: EquityPoint[];
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  return (
    <div className="surface-section p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan" /> Equity Curve
        </h3>
        <div className="flex gap-1 text-[11px]">
          {(
            [
              ["performance", "Performance"],
              ["total", "Capital + Perf"],
              ["split", "Split"],
            ] as [Mode, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                mode === k ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-12">
          No trading history yet. Post a weekly P&L or capital deposit to start building the curve.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 240 / 0.3)" />
            <XAxis
              dataKey="date"
              stroke="oklch(0.6 0 0)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.6 0 0)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip {...chartTooltipProps} />
            {mode !== "total" && (
              <Line
                type="monotone"
                dataKey="performance"
                name="Performance"
                stroke="hsl(190 90% 60%)"
                strokeWidth={2}
                dot={false}
              />
            )}
            {mode === "total" && (
              <Line
                type="monotone"
                dataKey="total"
                name="Total equity"
                stroke="hsl(190 90% 60%)"
                strokeWidth={2}
                dot={false}
              />
            )}
            {mode === "split" && (
              <Line
                type="monotone"
                dataKey="capital"
                name="Net capital"
                stroke="hsl(45 90% 60%)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
            {mode === "split" && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="mt-2 text-[10px] text-muted-foreground">
        Performance excludes deposits/withdrawals. Capital is net broker-account flow. Both derive
        from the ledger.
      </div>
    </div>
  );
}
