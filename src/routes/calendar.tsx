import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUserTable } from "@/hooks/use-user-table";
import { useAccounts, useAssets, type Transaction } from "@/hooks/use-ledger";
import { useMoneyFormatter } from "@/lib/format-currency";
import { formatPct } from "@/lib/format-percent";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day";
type CalSearch = { view?: View; anchor?: string };

export const Route = createFileRoute("/calendar")({
  validateSearch: (s: Record<string, unknown>): CalSearch => {
    const v = typeof s.view === "string" ? s.view : "";
    const view: View = v === "week" || v === "day" ? v : "month";
    const anchor = typeof s.anchor === "string" ? s.anchor : "";
    return { view, anchor };
  },
  component: CalendarPage,
});

// ---------- date helpers (timezone-safe, local) ----------
const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const w = x.getDay(); // 0 Sun
  return addDays(x, -((w + 6) % 7)); // Monday-start
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// ---------- event taxonomy ----------
const POSITIVE_TYPES = new Set(["deposit", "sell", "dividend", "interest", "staking_reward", "profit_realization"]);
const NEGATIVE_TYPES = new Set(["withdrawal", "fee", "buy"]);

type DayBucket = {
  date: string;
  txs: Transaction[];
  inflow: number;
  outflow: number;
  net: number;
  count: number;
};

function CalendarPage() {
  const navigate = useNavigate({ from: "/calendar" });
  const { view, anchor } = useSearch({ from: "/calendar" }) as { view: View; anchor: string };
  const anchorDate = useMemo(() => (anchor ? new Date(anchor) : new Date()), [anchor]);
  const setAnchor = (d: Date) => navigate({ search: (p: CalSearch) => ({ ...p, anchor: dayKey(d) }) });
  const setView = (v: View) => navigate({ search: (p: CalSearch) => ({ ...p, view: v }) });

  const { rows: txs } = useUserTable<Transaction>("transactions", { col: "execution_timestamp", asc: true });
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const fmt = useMoneyFormatter();

  // group by day
  const buckets = useMemo(() => {
    const m = new Map<string, DayBucket>();
    for (const t of txs) {
      if (t.voided_at) continue;
      const key = dayKey(new Date(t.execution_timestamp));
      const b = m.get(key) ?? { date: key, txs: [], inflow: 0, outflow: 0, net: 0, count: 0 };
      b.txs.push(t);
      const v = Number(t.base_value ?? t.fiat_value ?? 0);
      if (POSITIVE_TYPES.has(t.transaction_type)) { b.inflow += v; b.net += v; }
      else if (NEGATIVE_TYPES.has(t.transaction_type)) { b.outflow += v; b.net -= v; }
      b.count += 1;
      m.set(key, b);
    }
    return m;
  }, [txs]);

  // intensity scale for heatmap (max |net| in the visible window)
  const maxAbsNet = useMemo(() => {
    let max = 0;
    for (const b of buckets.values()) max = Math.max(max, Math.abs(b.net));
    return max || 1;
  }, [buckets]);

  const [selected, setSelected] = useState<string | null>(null);
  const selectedBucket = selected ? buckets.get(selected) ?? null : null;

  // window bounds
  const title = useMemo(() => {
    if (view === "day") return anchorDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(anchorDate); const e = addDays(s, 6);
      return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [anchorDate, view]);

  const shift = (dir: -1 | 1) => {
    if (view === "day") setAnchor(addDays(anchorDate, dir));
    else if (view === "week") setAnchor(addDays(anchorDate, dir * 7));
    else setAnchor(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1));
  };

  // window net flow summary
  const windowStats = useMemo(() => {
    let inflow = 0, outflow = 0, count = 0;
    let s: Date, e: Date;
    if (view === "day") { s = startOfDay(anchorDate); e = addDays(s, 1); }
    else if (view === "week") { s = startOfWeek(anchorDate); e = addDays(s, 7); }
    else { s = startOfMonth(anchorDate); e = addDays(endOfMonth(anchorDate), 1); }
    for (let d = new Date(s); d < e; d = addDays(d, 1)) {
      const b = buckets.get(dayKey(d));
      if (!b) continue;
      inflow += b.inflow; outflow += b.outflow; count += b.count;
    }
    return { inflow, outflow, net: inflow - outflow, count };
  }, [view, anchorDate, buckets]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Calendar"
        subtitle="Temporal intelligence across the ledger — every flow, every event, every day."
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())} className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" /> Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-3 font-display text-lg font-semibold">{title}</div>
        </div>
        <div className="inline-flex rounded-xl bg-muted/40 border border-border/40 p-1">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",
                view === v ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:text-foreground")}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Window summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Inflow"  value={fmt(windowStats.inflow)}  tone="text-success" />
        <SummaryTile label="Outflow" value={fmt(windowStats.outflow)} tone="text-destructive" />
        <SummaryTile label="Net flow" value={fmt(windowStats.net)} tone={windowStats.net >= 0 ? "text-success" : "text-destructive"} />
        <SummaryTile label="Events" value={String(windowStats.count)} tone="text-cyan" />
      </div>

      {/* View body */}
      <AnimatePresence mode="wait">
        <motion.div key={view + dayKey(anchorDate)}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}>
          {view === "month" && (
            <MonthView anchor={anchorDate} buckets={buckets} maxAbsNet={maxAbsNet} onSelect={setSelected} fmt={fmt} />
          )}
          {view === "week" && (
            <WeekView anchor={anchorDate} buckets={buckets} maxAbsNet={maxAbsNet} onSelect={setSelected} fmt={fmt} />
          )}
          {view === "day" && (
            <DayView anchor={anchorDate} bucket={buckets.get(dayKey(anchorDate)) ?? null}
              accounts={accounts} assets={assets} fmt={fmt} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Day drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background/95 backdrop-blur border-l border-border/50">
          <SheetHeader className="px-5 py-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display text-base">
                {selected ? new Date(selected + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}
              </SheetTitle>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {selectedBucket ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Mini label="Inflow"  value={fmt(selectedBucket.inflow)}  tone="text-success" />
                  <Mini label="Outflow" value={fmt(selectedBucket.outflow)} tone="text-destructive" />
                  <Mini label="Net"     value={fmt(selectedBucket.net)}     tone={selectedBucket.net >= 0 ? "text-success" : "text-destructive"} />
                </div>
                <EventList txs={selectedBucket.txs} accounts={accounts} assets={assets} fmt={fmt} />
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10">No activity on this day.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============= Sub-views =============

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 font-display text-xl font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}
function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-mono font-medium tabular-nums", tone)}>{value}</div>
    </div>
  );
}

function intensityClass(net: number, maxAbs: number) {
  if (!net || !maxAbs) return "bg-transparent";
  const ratio = Math.min(1, Math.abs(net) / maxAbs);
  const step = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
  if (net >= 0) return ["bg-success/10", "bg-success/20", "bg-success/30"][step - 1];
  return ["bg-destructive/10", "bg-destructive/20", "bg-destructive/30"][step - 1];
}

function MonthView({
  anchor, buckets, maxAbsNet, onSelect, fmt,
}: {
  anchor: Date; buckets: Map<string, DayBucket>; maxAbsNet: number;
  onSelect: (key: string) => void; fmt: (v: number) => string;
}) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = dayKey(new Date());

  return (
    <div className="glass rounded-2xl p-3 md:p-4">
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center md:text-left">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const b = buckets.get(key);
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "relative aspect-square md:aspect-[1.2/1] rounded-lg p-1.5 md:p-2 text-left transition-all border border-transparent",
                "hover:border-cyan/40 hover:bg-cyan/5 focus:outline-none focus:ring-1 focus:ring-cyan/40",
                !inMonth && "opacity-30",
                b && intensityClass(b.net, maxAbsNet),
                isToday && "ring-1 ring-cyan/60",
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn("text-xs font-mono", isToday && "text-cyan font-semibold")}>{d.getDate()}</span>
                {b && b.count > 0 && (
                  <span className="text-[9px] font-mono text-muted-foreground hidden md:inline">{b.count}</span>
                )}
              </div>
              {b && (
                <div className={cn(
                  "mt-auto text-[10px] md:text-[11px] font-mono tabular-nums truncate",
                  b.net >= 0 ? "text-success" : "text-destructive",
                )}>
                  {b.net >= 0 ? "+" : ""}{fmt(b.net)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  anchor, buckets, maxAbsNet, onSelect, fmt,
}: {
  anchor: Date; buckets: Map<string, DayBucket>; maxAbsNet: number;
  onSelect: (key: string) => void; fmt: (v: number) => string;
}) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayKey = dayKey(new Date());
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d) => {
        const key = dayKey(d);
        const b = buckets.get(key);
        const isToday = key === todayKey;
        return (
          <button key={key} onClick={() => onSelect(key)}
            className={cn(
              "glass rounded-2xl p-4 text-left min-h-[160px] transition-all hover:border-cyan/40",
              b && intensityClass(b.net, maxAbsNet),
              isToday && "ring-1 ring-cyan/60",
            )}>
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className={cn("font-display text-lg font-semibold", isToday && "text-cyan")}>{d.getDate()}</div>
            </div>
            {b ? (
              <div className="mt-3 space-y-1">
                <div className={cn("text-sm font-mono tabular-nums", b.net >= 0 ? "text-success" : "text-destructive")}>
                  {b.net >= 0 ? "+" : ""}{fmt(b.net)}
                </div>
                <div className="text-[11px] text-muted-foreground">{b.count} event{b.count === 1 ? "" : "s"}</div>
              </div>
            ) : (
              <div className="mt-3 text-[11px] text-muted-foreground">No activity</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DayView({
  anchor, bucket, accounts, assets, fmt,
}: {
  anchor: Date; bucket: DayBucket | null;
  accounts: any[]; assets: any[]; fmt: (v: number) => string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      {!bucket ? (
        <div className="text-sm text-muted-foreground text-center py-16">
          No financial activity recorded on {anchor.toLocaleDateString()}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Mini label="Inflow"  value={fmt(bucket.inflow)}  tone="text-success" />
            <Mini label="Outflow" value={fmt(bucket.outflow)} tone="text-destructive" />
            <Mini label="Net"     value={fmt(bucket.net)}     tone={bucket.net >= 0 ? "text-success" : "text-destructive"} />
          </div>
          <EventList txs={bucket.txs} accounts={accounts} assets={assets} fmt={fmt} />
        </>
      )}
    </div>
  );
}

function EventList({
  txs, accounts, assets, fmt,
}: {
  txs: Transaction[]; accounts: any[]; assets: any[]; fmt: (v: number) => string;
}) {
  const acctName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const assetSym = (id: string | null) => assets.find((a) => a.id === id)?.symbol ?? "";
  const sorted = [...txs].sort((a, b) =>
    new Date(b.execution_timestamp).getTime() - new Date(a.execution_timestamp).getTime());

  return (
    <ul className="divide-y divide-border/40">
      {sorted.map((t) => {
        const positive = POSITIVE_TYPES.has(t.transaction_type);
        const negative = NEGATIVE_TYPES.has(t.transaction_type);
        const tone = positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground";
        const sign = positive ? "+" : negative ? "-" : "";
        const v = Number(t.base_value ?? t.fiat_value ?? 0);
        return (
          <li key={t.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium capitalize">
                {t.transaction_type.replace(/_/g, " ")}
                {t.asset_id && <span className="text-muted-foreground"> · {assetSym(t.asset_id)}</span>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {acctName(t.source_account_id ?? t.destination_account_id)}
                {" · "}
                {new Date(t.execution_timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                {t.note ? ` · ${t.note}` : ""}
              </div>
            </div>
            <div className={cn("text-sm font-mono tabular-nums shrink-0", tone)}>
              {sign}{fmt(v)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

void formatPct;
