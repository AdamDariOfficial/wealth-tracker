import { useMemo } from "react";
import { useHoldings } from "@/hooks/use-ledger";

/** Aggregated per-asset position for a given asset_class. */
export function useAssetPositions(assetClass: "crypto" | "etf" | "stock") {
  const { holdings, assets, accounts } = useHoldings();
  return useMemo(() => {
    const map = new Map<string, {
      assetId: string; symbol: string; name: string;
      quantity: number; costBasis: number; marketValue: number;
      avgCost: number; unrealizedPnl: number; realizedPnl: number;
      perAccount: { accountId: string; accountName: string; quantity: number; marketValue: number }[];
      currentPrice: number;
    }>();
    for (const h of holdings) {
      const a = assets.find((x) => x.id === h.assetId);
      if (!a || a.asset_class !== assetClass) continue;
      const acc = accounts.find((x) => x.id === h.accountId);
      const cur = map.get(h.assetId) ?? {
        assetId: h.assetId, symbol: a.symbol, name: a.name,
        quantity: 0, costBasis: 0, marketValue: 0,
        avgCost: 0, unrealizedPnl: 0, realizedPnl: 0,
        perAccount: [], currentPrice: Number(a.current_price ?? 0),
      };
      cur.quantity += h.quantity;
      cur.costBasis += h.costBasis;
      cur.marketValue += h.marketValue;
      cur.unrealizedPnl += h.unrealizedPnl;
      cur.realizedPnl += h.realizedPnl;
      if (acc) cur.perAccount.push({ accountId: acc.id, accountName: acc.name, quantity: h.quantity, marketValue: h.marketValue });
      map.set(h.assetId, cur);
    }
    return Array.from(map.values()).map((p) => ({
      ...p, avgCost: p.quantity > 0 ? p.costBasis / p.quantity : 0,
    })).sort((a, b) => b.marketValue - a.marketValue);
  }, [holdings, assets, accounts, assetClass]);
}
