import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp, TrendingDown, Wallet, Coins, Target } from "lucide-react";
import { formatMoney } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { ImpactReport } from "@/lib/import-analytics";
import { pct } from "@/lib/import-analytics";

const fmt = (v: number, ccy: string) => formatMoney(v, { currency: ccy });

export function ImpactPreview({ impact, ccy }: { impact: ImpactReport; ccy: string }) {
  const [showDetail, setShowDetail] = useState(false);
  const nwUp = impact.netWorthDelta >= 0;

  return (
    <Card className="glass p-4 border-cyan/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Impact preview
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Net worth</span>
            <span className="font-mono tabular-nums text-sm">
              {fmt(impact.netWorthBefore, ccy)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono tabular-nums text-sm font-semibold">
              {fmt(impact.netWorthAfter, ccy)}
            </span>
            <Badge
              className={cn(
                "text-[10px] gap-1",
                nwUp
                  ? "bg-success/15 text-success border-success/30"
                  : "bg-destructive/15 text-destructive border-destructive/30",
              )}
            >
              {nwUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {impact.netWorthDelta >= 0 ? "+" : ""}
              {fmt(impact.netWorthDelta, ccy)}
            </Badge>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowDetail((v) => !v)}>
          <ChevronDown
            className={cn("h-3.5 w-3.5 mr-1 transition-transform", showDetail && "rotate-180")}
          />
          {showDetail ? "Hide" : "Details"}
        </Button>
      </div>

      {/* Allocation deltas */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {impact.allocationByClass.map((slice) => {
          const total = impact.netWorthAfter || 1;
          const totalBefore = impact.netWorthBefore || 1;
          const before = pct(slice.before, totalBefore);
          const after = pct(slice.after, total);
          const arrow = after > before ? "↑" : after < before ? "↓" : "=";
          const color =
            slice.name === "Cash"
              ? "text-cyan"
              : slice.name === "Trading"
                ? "text-warning"
                : "text-success";
          return (
            <div
              key={slice.name}
              className="rounded-md border border-border/40 px-2 py-1.5 bg-card/40"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {slice.name}
              </div>
              <div className="font-mono text-xs tabular-nums flex items-center gap-1">
                <span className="text-muted-foreground">{before}%</span>
                <span className="text-muted-foreground">→</span>
                <span className={cn("font-semibold", color)}>{after}%</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{arrow}</span>
              </div>
            </div>
          );
        })}
      </div>

      {showDetail && (
        <div className="mt-4 space-y-4 text-xs">
          {(impact.newAccounts || impact.newAssets || impact.newGoals) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {impact.newAccounts > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Wallet className="h-2.5 w-2.5" /> +{impact.newAccounts} account
                  {impact.newAccounts === 1 ? "" : "s"}
                </Badge>
              )}
              {impact.newAssets > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Coins className="h-2.5 w-2.5" /> +{impact.newAssets} asset
                  {impact.newAssets === 1 ? "" : "s"}
                </Badge>
              )}
              {impact.newGoals > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Target className="h-2.5 w-2.5" /> +{impact.newGoals} goal
                  {impact.newGoals === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          )}

          {impact.accountDeltas.length > 0 && (
            <Section title="Account balances">
              {impact.accountDeltas.slice(0, 8).map((d) => (
                <DeltaRow
                  key={d.id}
                  label={d.name}
                  before={d.before}
                  after={d.after}
                  delta={d.delta}
                  ccy={ccy}
                />
              ))}
              {impact.accountDeltas.length > 8 && (
                <div className="text-[10px] text-muted-foreground px-1">
                  +{impact.accountDeltas.length - 8} more
                </div>
              )}
            </Section>
          )}

          {impact.assetDeltas.length > 0 && (
            <Section title="Asset exposure">
              {impact.assetDeltas.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-1 py-0.5">
                  <span className="text-muted-foreground truncate">{d.symbol}</span>
                  <span className="font-mono tabular-nums text-[11px]">
                    {d.beforeQty.toFixed(4).replace(/\.?0+$/, "")} →{" "}
                    <span className="font-semibold">
                      {d.afterQty.toFixed(4).replace(/\.?0+$/, "")}
                    </span>
                  </span>
                </div>
              ))}
            </Section>
          )}

          {impact.goalDeltas.length > 0 && (
            <Section title="Goal progress">
              {impact.goalDeltas.map((g) => (
                <div key={g.id} className="px-1 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground truncate">{g.name}</span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {Math.round(g.beforePct)}% →{" "}
                      <span className="font-semibold text-cyan">{Math.round(g.afterPct)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 bg-muted/40 rounded-full overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                      style={{ width: `${g.beforePct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan/80"
                      style={{ width: `${g.afterPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <div className="rounded-md border border-border/30 bg-card/30 divide-y divide-border/20">
        {children}
      </div>
    </div>
  );
}

function DeltaRow({
  label,
  before,
  after,
  delta,
  ccy,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
  ccy: string;
}) {
  const up = delta >= 0;
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <span className="text-muted-foreground truncate">{label}</span>
      <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px] shrink-0">
        <span className="text-muted-foreground">{fmt(before, ccy)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-semibold">{fmt(after, ccy)}</span>
        <span className={cn("text-[10px]", up ? "text-success" : "text-destructive")}>
          {up ? "+" : ""}
          {fmt(delta, ccy)}
        </span>
      </div>
    </div>
  );
}
