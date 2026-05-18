import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ShoppingCart,
  TrendingUp, Coins, Sparkles, Filter, Search,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useAssets } from "@/hooks/use-ledger";
import { useTimeline } from "@/hooks/use-timeline";
import { cn } from "@/lib/utils";
import { RealtimeStatus } from "@/components/RealtimeStatus";
import { FilterPresets } from "@/components/FilterPresets";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { toast } from "sonner";

export const Route = createFileRoute("/timeline")({ component: TimelinePage });

const ICON: Record<string, any> = {
  deposit: ArrowDownToLine, withdrawal: ArrowUpFromLine, transfer: ArrowLeftRight,
  buy: ShoppingCart, sell: TrendingUp, dividend: Sparkles, interest: Sparkles,
  staking_reward: Coins, profit_realization: TrendingUp, fee: ArrowUpFromLine,
  manual_adjustment: Sparkles, convert: ArrowLeftRight,
};
const TONE: Record<string, string> = {
  deposit: "text-success", sell: "text-success", dividend: "text-success",
  interest: "text-success", staking_reward: "text-success", profit_realization: "text-success",
  withdrawal: "text-destructive", fee: "text-destructive", buy: "text-cyan",
  transfer: "text-muted-foreground", convert: "text-muted-foreground",
  manual_adjustment: "text-muted-foreground",
};

type TLFilters = { type: string; acct: string; q: string };

function TimelinePage() {
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const [type, setType] = useState("all");
  const [acct, setAcct] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(t); }, [q]);

  const { rows: txs, loading, hasMore, loadMore, reset } = useTimeline({ type, accountId: acct, search: debouncedQ });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) loadMore();
    }, { rootMargin: "200px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, loadMore]);

  useEffect(() => {
    if (autoScroll && topRef.current && typeof window !== "undefined") {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [txs.length, autoScroll]);

  const { presets, save: savePreset, remove: removePreset } = useFilterPresets<TLFilters>("timeline");
  const applyPreset = (v: TLFilters) => {
    setType(v.type ?? "all"); setAcct(v.acct ?? "all"); setQ(v.q ?? "");
    toast.success("Preset applied");
  };

  const acctName = (id: string | null) => id ? accounts.find((a) => a.id === id)?.name ?? "—" : "—";
  const assetSym = (id: string | null) => id ? assets.find((a) => a.id === id)?.symbol ?? "" : "";

  const grouped = useMemo(() => {
    const out = new Map<string, typeof txs>();
    for (const t of txs) {
      const day = t.execution_timestamp.slice(0, 10);
      const list = out.get(day) ?? [];
      list.push(t);
      out.set(day, list);
    }
    return Array.from(out.entries());
  }, [txs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline"
        subtitle="Every capital event, in order, with exact timestamps."
        action={
          <RealtimeStatus
            onRefresh={() => void reset()}
            autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll((s) => !s)}
          />
        }
      />
      <div ref={topRef} />

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search note…" className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all","deposit","withdrawal","transfer","buy","sell","dividend","interest","staking_reward","profit_realization","fee"].map((t) =>
              <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={acct} onValueChange={setAcct}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <FilterPresets
          presets={presets}
          onApply={applyPreset}
          onSave={(name) => { savePreset(name, { type, acct, q }); toast.success("Preset saved"); }}
          onDelete={removePreset}
        />
      </div>

      {loading && txs.length === 0 && <div className="text-center text-muted-foreground py-12">Loading ledger…</div>}
      {!loading && txs.length === 0 && <div className="text-center text-muted-foreground py-12">No matching events.</div>}

      <div className="space-y-6">
        {grouped.map(([day, list]) => {
          const totalIn = list.reduce((s, t) => {
            const v = Number(t.fiat_value);
            if (["deposit","dividend","interest","staking_reward","profit_realization","sell"].includes(t.transaction_type)) return s + v;
            return s;
          }, 0);
          const totalOut = list.reduce((s, t) => {
            const v = Number(t.fiat_value);
            if (["withdrawal","fee","buy"].includes(t.transaction_type)) return s + v;
            return s;
          }, 0);
          return (
            <div key={day}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{day}</div>
                <div className="text-xs font-mono">
                  <span className="text-success">+${totalIn.toFixed(0)}</span>
                  <span className="text-muted-foreground mx-2">·</span>
                  <span className="text-destructive">-${totalOut.toFixed(0)}</span>
                </div>
              </div>
              <div className="glass rounded-2xl divide-y divide-border/30 overflow-hidden">
                {list.map((t) => {
                  const Icon = ICON[t.transaction_type] ?? Sparkles;
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                      <div className={cn("h-9 w-9 rounded-lg glass-strong flex items-center justify-center", TONE[t.transaction_type])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium capitalize">{t.transaction_type.replace("_"," ")}</span>
                          {t.asset_id && <span className="font-mono text-xs text-cyan">{assetSym(t.asset_id)}</span>}
                          {t.tags?.length ? <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.tags.join(" · ")}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.source_account_id && <>From <span className="text-foreground/80">{acctName(t.source_account_id)}</span></>}
                          {t.source_account_id && t.destination_account_id && " → "}
                          {t.destination_account_id && <span className="text-foreground/80">{acctName(t.destination_account_id)}</span>}
                          {t.note && <span className="ml-2">· {t.note}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("font-mono font-semibold text-sm", TONE[t.transaction_type])}>
                          ${Number(t.fiat_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {new Date(t.execution_timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-12 flex items-center justify-center text-xs text-muted-foreground">
        {hasMore ? (loading ? "Loading…" : "Scroll for more") : txs.length > 0 ? "End of ledger" : ""}
      </div>

      <div className="text-center text-[11px] text-muted-foreground pt-4">
        <Link to="/transactions" className="hover:underline">Open ledger view →</Link>
      </div>
    </div>
  );
}
