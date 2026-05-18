import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { HoldingActionModal } from "@/components/HoldingActionModal";
import { useAssetPositions } from "@/hooks/use-positions";
import { cn } from "@/lib/utils";

function buildPage(assetClass: "crypto" | "etf" | "stock", title: string, subtitle: string) {
  return function Page() {
    const positions = useAssetPositions(assetClass);
    const [open, setOpen] = useState<null | { mode: "buy"|"sell"|"transfer"; assetId?: string }>(null);

    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
    const totalCost = positions.reduce((s, p) => s + p.costBasis, 0);
    const unrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const realized = positions.reduce((s, p) => s + p.realizedPnl, 0);

    const supportsTransfer = assetClass === "crypto";

    return (
      <div className="space-y-6">
        <PageHeader title={title} subtitle={subtitle}
          action={
            <div className="flex gap-2">
              {supportsTransfer && (
                <Button variant="outline" onClick={() => setOpen({ mode: "transfer" })}>
                  <ArrowLeftRight className="h-4 w-4 mr-1" /> Transfer
                </Button>
              )}
              <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen({ mode: "buy" })}>
                <Plus className="h-4 w-4 mr-1" /> Buy
              </Button>
            </div>
          } />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Market Value",     v: `$${totalValue.toLocaleString(undefined,{maximumFractionDigits:2})}`, c: "text-gradient-cyan" },
            { l: "Cost Basis",       v: `$${totalCost.toLocaleString(undefined,{maximumFractionDigits:2})}` },
            { l: "Unrealized P&L",   v: `${unrealized>=0?"+":""}$${unrealized.toLocaleString(undefined,{maximumFractionDigits:2})}`, c: unrealized>=0?"text-success":"text-destructive" },
            { l: "Realized P&L",     v: `${realized>=0?"+":""}$${realized.toLocaleString(undefined,{maximumFractionDigits:2})}`, c: realized>=0?"text-success":"text-destructive" },
          ].map((s) => (
            <div key={s.l} className="glass rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
              <div className={cn("font-display text-2xl font-semibold mt-2", s.c)}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <tr>{["Asset","Qty","Avg cost","Price","Value","Unrealized","Realized","Wallets",""].map((h) =>
                  <th key={h} className="text-left font-medium px-5 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">No positions yet — record your first buy.</td></tr>
                )}
                {positions.map((p) => (
                  <motion.tr key={p.assetId} initial={{opacity:0}} animate={{opacity:1}} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <div className="font-mono font-semibold text-cyan">{p.symbol}</div>
                      <div className="text-xs text-muted-foreground">{p.name}</div>
                    </td>
                    <td className="px-5 py-3 font-mono">{p.quantity.toLocaleString(undefined,{maximumFractionDigits:6})}</td>
                    <td className="px-5 py-3 font-mono">${p.avgCost.toFixed(2)}</td>
                    <td className="px-5 py-3 font-mono">${p.currentPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 font-mono font-semibold">${p.marketValue.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                    <td className={cn("px-5 py-3 font-mono", p.unrealizedPnl>=0?"text-success":"text-destructive")}>
                      <span className="inline-flex items-center gap-1">
                        {p.unrealizedPnl>=0 ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
                        {p.unrealizedPnl>=0?"+":""}${p.unrealizedPnl.toFixed(2)}
                      </span>
                    </td>
                    <td className={cn("px-5 py-3 font-mono", p.realizedPnl>=0?"text-success":"text-destructive")}>
                      {p.realizedPnl>=0?"+":""}${p.realizedPnl.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {p.perAccount.slice(0,2).map((a) => a.accountName).join(" · ")}
                      {p.perAccount.length > 2 && ` +${p.perAccount.length-2}`}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setOpen({ mode: "buy", assetId: p.assetId })}>Buy</Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen({ mode: "sell", assetId: p.assetId })}>Sell</Button>
                      {supportsTransfer && <Button size="sm" variant="ghost" onClick={() => setOpen({ mode: "transfer", assetId: p.assetId })}>Move</Button>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center text-[11px] text-muted-foreground">
          <Link to="/timeline" className="hover:underline">View full activity in Timeline →</Link>
        </div>

        {open && (
          <HoldingActionModal
            open
            onClose={() => setOpen(null)}
            mode={open.mode}
            assetClass={assetClass}
            presetAssetId={open.assetId}
          />
        )}
      </div>
    );
  };
}

export const Investments = buildPage("stock", "Investments", "Long-term equity positions, derived from your transaction ledger.");
export const ETF = buildPage("etf", "ETF Tracker", "Recurring DCA & long-term accumulation, account-aware.");
export const Crypto = buildPage("crypto", "Crypto", "Spot holdings across exchanges and self-custody wallets.");
