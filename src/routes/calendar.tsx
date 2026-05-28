/**
 * Temporal Intelligence Workspace.
 *
 * Year → Quarter → Month → Week → Day drilldown over the ledger. Every
 * aggregate derives from the centralized temporal-engine + reconstruction
 * engine. No duplicated business logic.
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, X, ArrowUpRight, ArrowDownRight, Activity as ActivityIcon,
  Flame, Sparkles, Repeat,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUserTable } from "@/hooks/use-user-table";
import { useAccounts, useAssets, type Transaction } from "@/hooks/use-ledger";
import { useMoneyFormatter } from "@/lib/format-currency";
import { chartTooltipProps } from "@/lib/chart-style";
import { cn } from "@/lib/utils";
import {
  type PeriodKey, type PeriodBucket,
  buildYearBuckets, buildQuarterMonths, buildMonthDays, buildWeekDays,
  reconstruct, netWorthAt, activeYears, deriveInsights,
  addDays, addMonths, startOfMonth, startOfQuarter, startOfWeek, startOfYear,
  dayKey, periodBounds, POS_TYPES, NEG_TYPES,
} from "@/lib/temporal-engine";

type View = PeriodKey;
type CalSearch = { view?: View; anchor?: string };

export const Route = createFileRoute("/calendar")({
  validateSearch: (s: Record<string, unknown>): CalSearch => {
    const v = typeof s.view === "string" ? s.view : "";
    const view: View =
      v === "week" || v === "month" || v === "quarter" || v === "day" || v === "year"
        ? (v as View) : "year";
    const anchor = typeof s.anchor === "string" ? s.anchor : "";
    return { view, anchor };
  },
  component: TemporalWorkspace,
});

// ───────────────────────────────────────────────────────────────────────────
// Root
// ───────────────────────────────────────────────────────────────────────────
function TemporalWorkspace() {
  const navigate = useNavigate({ from: "/calendar" });
  const { view, anchor } = useSearch({ from: "/calendar" }) as { view: View; anchor: string };
  const anchorDate = useMemo(() => (anchor ? new Date(anchor + (anchor.length === 10 ? "T00:00:00" : "")) : new Date()), [anchor]);

  const setAnchor = (d: Date) =>
    navigate({ search: (p: CalSearch) => ({ ...p, anchor: dayKey(d) }) });
  const setView = (v: View) =>
    navigate({ search: (p: CalSearch) => ({ ...p, view: v }) });
  const setBoth = (v: View, d: Date) =>
    navigate({ search: () => ({ view: v, anchor: dayKey(d) }) });

  const { rows: txs } = useUserTable<Transaction>("transactions", { col: "execution_timestamp", asc: true });
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const fmt = useMoneyFormatter();

  // Keyboard shortcuts: ⌘1..5 switch scope; ⌘← / ⌘→ shifts period
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "1") { e.preventDefault(); setView("week"); }
      else if (e.key === "2") { e.preventDefault(); setView("month"); }
      else if (e.key === "3") { e.preventDefault(); setView("quarter"); }
      else if (e.key === "4") { e.preventDefault(); setView("year"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); shift(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); shift(1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor]);

  const shift = (dir: -1 | 1) => {
    if (view === "day") setAnchor(addDays(anchorDate, dir));
    else if (view === "week") setAnchor(addDays(anchorDate, dir * 7));
    else if (view === "month") setAnchor(addMonths(startOfMonth(anchorDate), dir));
    else if (view === "quarter") setAnchor(addMonths(startOfQuarter(anchorDate), dir * 3));
    else setAnchor(new Date(anchorDate.getFullYear() + dir, 0, 1));
  };

  const title = useMemo(() => {
    if (view === "year") return String(anchorDate.getFullYear());
    if (view === "quarter") {
      const q = Math.floor(anchorDate.getMonth() / 3) + 1;
      return `Q${q} ${anchorDate.getFullYear()}`;
    }
    if (view === "month") return anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(anchorDate); const e = addDays(s, 6);
      return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return anchorDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [view, anchorDate]);

  // Reconstruction series (decimal-safe, deterministic).
  const recon = useMemo(() => reconstruct(accounts, txs), [accounts, txs]);
  const years = useMemo(() => activeYears(txs), [txs]);

  // Period buckets for the current scope.
  const buckets: PeriodBucket[] = useMemo(() => {
    if (view === "year") return buildYearBuckets(anchorDate.getFullYear(), txs, assets);
    if (view === "quarter") return buildQuarterMonths(anchorDate, txs, assets);
    if (view === "month") return buildMonthDays(anchorDate, txs, assets);
    if (view === "week") return buildWeekDays(anchorDate, txs, assets);
    // day handled inline
    return [];
  }, [view, anchorDate, txs, assets]);

  // Window totals + reconstructed net-worth delta across the window.
  const windowStats = useMemo(() => {
    const { start, end } = periodBounds(view === "day" ? "day" : view, anchorDate);
    let inflow = 0, outflow = 0, count = 0, contrib = 0, trades = 0;
    for (const b of buckets) { inflow += b.inflow; outflow += b.outflow; count += b.count; contrib += b.contributions; trades += b.trades; }
    if (view === "day") {
      for (const t of txs) {
        const d = new Date(t.execution_timestamp);
        if (d < start || d >= end || t.voided_at) continue;
        const v = Number(t.base_value ?? t.fiat_value ?? 0);
        count += 1;
        if (POS_TYPES.has(t.transaction_type)) inflow += v;
        else if (NEG_TYPES.has(t.transaction_type)) outflow += v;
      }
    }
    const nwStart = netWorthAt(recon, addDays(start, -1))?.netWorth ?? 0;
    const nwEnd = netWorthAt(recon, addDays(end, -1))?.netWorth ?? nwStart;
    return { inflow, outflow, net: inflow - outflow, count, contrib, trades, nwStart, nwEnd, nwDelta: nwEnd - nwStart };
  }, [buckets, view, anchorDate, recon, txs]);

  const [selected, setSelected] = useState<string | null>(null);
  const selectedTxs = useMemo(() => {
    if (!selected) return null;
    return txs.filter((t) => !t.voided_at && dayKey(new Date(t.execution_timestamp)) === selected);
  }, [selected, txs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temporal Intelligence"
        subtitle="Replay your financial evolution — capital, behavior, and rhythm across time."
      />

      {/* ── Primary temporal switcher + smart jumps */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedScope view={view} onChange={setView} />
        <div className="flex flex-wrap items-center gap-2">
          <QuickJump label="Today" onClick={() => setBoth("day", new Date())} />
          <QuickJump label="This week" onClick={() => setBoth("week", new Date())} />
          <QuickJump label="MTD" onClick={() => setBoth("month", new Date())} />
          <QuickJump label="QTD" onClick={() => setBoth("quarter", new Date())} />
          <QuickJump label="YTD" onClick={() => setBoth("year", new Date())} />
        </div>
      </div>

      {/* ── Window header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-2 font-display text-2xl font-semibold">{title}</div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <kbd className="px-1.5 py-0.5 rounded bg-muted/40 border border-border/40">⌘1-4</kbd> scope
          <kbd className="px-1.5 py-0.5 rounded bg-muted/40 border border-border/40">⌘←/→</kbd> shift
        </div>
      </div>

      {/* ── Year scrubber */}
      <YearScrubber years={years} active={anchorDate.getFullYear()} onPick={(y) => {
        const d = new Date(y, view === "year" ? 0 : anchorDate.getMonth(), 1);
        setAnchor(d);
      }} />

      {/* ── Headline intelligence row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IntelTile label="Net-worth Δ" value={fmt(windowStats.nwDelta)} tone={windowStats.nwDelta >= 0 ? "text-success" : "text-destructive"} icon={windowStats.nwDelta >= 0 ? ArrowUpRight : ArrowDownRight} hint="Reconstructed from ledger" />
        <IntelTile label="Capital inflow" value={fmt(windowStats.inflow)} tone="text-success" icon={ArrowUpRight} />
        <IntelTile label="Capital outflow" value={fmt(windowStats.outflow)} tone="text-destructive" icon={ArrowDownRight} />
        <IntelTile label="Events · trades" value={`${windowStats.count} · ${windowStats.trades}`} tone="text-cyan" icon={ActivityIcon} />
      </div>

      {/* ── Workspace body */}
      <AnimatePresence mode="wait">
        <motion.div key={view + dayKey(anchorDate)}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }} className="space-y-4">
          {view === "year" && (
            <YearView buckets={buckets} fmt={fmt} onOpenMonth={(d) => setBoth("month", d)} />
          )}
          {view === "quarter" && (
            <QuarterView buckets={buckets} fmt={fmt} onOpenMonth={(d) => setBoth("month", d)} recon={recon} />
          )}
          {view === "month" && (
            <MonthIntelligence anchor={anchorDate} days={buckets} fmt={fmt} recon={recon} onPickDay={(k) => setSelected(k)} />
          )}
          {view === "week" && (
            <WeekTactical days={buckets} fmt={fmt} onPickDay={(k) => setSelected(k)} />
          )}
          {view === "day" && (
            <DayDetail anchor={anchorDate} txs={txs.filter((t) => !t.voided_at && dayKey(new Date(t.execution_timestamp)) === dayKey(anchorDate))}
              accounts={accounts} assets={assets} fmt={fmt} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Insights strip (derived, never AI gimmick) */}
      <InsightsStrip insights={deriveInsights(buckets)} />

      {/* ── Day drawer */}
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
            {selectedTxs && selectedTxs.length > 0 ? (
              <EventList txs={selectedTxs} accounts={accounts} assets={assets} fmt={fmt} />
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10">No activity on this day.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Controls
// ───────────────────────────────────────────────────────────────────────────
function SegmentedScope({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const items: { v: View; l: string }[] = [
    { v: "week", l: "W" }, { v: "month", l: "M" }, { v: "quarter", l: "Q" }, { v: "year", l: "Y" },
  ];
  return (
    <div className="inline-flex rounded-2xl bg-muted/30 border border-border/40 p-1 backdrop-blur">
      {items.map((it) => (
        <button key={it.v} onClick={() => onChange(it.v)}
          className={cn(
            "relative h-9 min-w-[44px] px-4 text-sm font-display font-semibold rounded-xl transition-colors",
            view === it.v ? "text-cyan" : "text-muted-foreground hover:text-foreground",
          )}>
          {view === it.v && (
            <motion.span layoutId="scope-pill"
              className="absolute inset-0 rounded-xl bg-cyan/15 ring-1 ring-cyan/40"
              transition={{ type: "spring", stiffness: 380, damping: 30 }} />
          )}
          <span className="relative">{it.l}</span>
        </button>
      ))}
    </div>
  );
}

function QuickJump({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="h-8 px-3 rounded-full text-[11px] font-medium tracking-wide
                 bg-muted/30 border border-border/40 text-muted-foreground
                 hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors">
      {label}
    </button>
  );
}

function YearScrubber({ years, active, onPick }: { years: number[]; active: number; onPick: (y: number) => void }) {
  if (years.length === 0) return null;
  const min = years[0]; const max = years[years.length - 1];
  // ensure all years between min..max present
  const span: number[] = [];
  for (let y = min; y <= max; y++) span.push(y);
  return (
    <div className="glass rounded-2xl p-3 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {span.map((y) => {
          const has = years.includes(y);
          const isActive = y === active;
          return (
            <button key={y} onClick={() => onPick(y)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums transition-all",
                isActive ? "bg-cyan/15 text-cyan ring-1 ring-cyan/40"
                  : has ? "text-foreground hover:bg-muted/40" : "text-muted-foreground/40 hover:text-muted-foreground",
              )}>
              <span>{y}</span>
              <span className={cn("h-0.5 w-6 rounded-full", isActive ? "bg-cyan" : has ? "bg-muted-foreground/30" : "bg-transparent")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IntelTile({ label, value, tone, icon: Icon, hint }: {
  label: string; value: string; tone: string; icon: typeof ArrowUpRight; hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <Icon className={cn("h-3.5 w-3.5", tone)} />
      </div>
      <div className={cn("mt-2 font-display text-2xl font-semibold tabular-nums", tone)}>{value}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

function InsightsStrip({ insights }: { insights: string[] }) {
  if (!insights.length) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-cyan" />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Behavioral signals</div>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {insights.map((s, i) => (
          <li key={i} className="text-sm text-foreground/85 flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan/70 shrink-0" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Year View — 12 month intelligence cards
// ───────────────────────────────────────────────────────────────────────────
function YearView({ buckets, fmt, onOpenMonth }: {
  buckets: PeriodBucket[]; fmt: (n: number) => string; onOpenMonth: (d: Date) => void;
}) {
  const maxAbsNet = Math.max(1, ...buckets.map((b) => Math.abs(b.net)));
  const maxActive = Math.max(1, ...buckets.map((b) => b.activeDays));
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {buckets.map((b) => {
        const intensity = Math.min(1, Math.abs(b.net) / maxAbsNet);
        const tone = b.net >= 0 ? "success" : "destructive";
        return (
          <button key={b.key} onClick={() => onOpenMonth(b.start)}
            className={cn(
              "glass rounded-2xl p-4 text-left transition-all group relative overflow-hidden",
              "hover:border-cyan/40 hover:-translate-y-0.5",
            )}
            style={{
              background:
                intensity > 0.05
                  ? `linear-gradient(135deg, var(--card) 0%, color-mix(in oklab, var(--${tone}) ${Math.round(intensity * 18)}%, transparent) 100%)`
                  : undefined,
            }}>
            <div className="flex items-center justify-between">
              <div className="font-display text-lg font-semibold">{b.label}</div>
              <ActivityDots level={b.activeDays / maxActive} />
            </div>
            <div className={cn("mt-3 text-[11px] uppercase tracking-wider text-muted-foreground")}>Net flow</div>
            <div className={cn("font-mono text-xl font-semibold tabular-nums",
              b.net > 0 ? "text-success" : b.net < 0 ? "text-destructive" : "text-muted-foreground")}>
              {b.net >= 0 ? "+" : ""}{fmt(b.net)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <MiniStat label="In" value={fmt(b.inflow)} tone="text-success" />
              <MiniStat label="Out" value={fmt(b.outflow)} tone="text-destructive" />
              <MiniStat label="Trades" value={String(b.trades)} tone="text-foreground" />
              <MiniStat label="Active" value={`${b.activeDays}d`} tone="text-cyan" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActivityDots({ level }: { level: number }) {
  const filled = Math.round(level * 4);
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full transition-colors",
          i < filled ? "bg-cyan" : "bg-muted-foreground/20")} />
      ))}
    </div>
  );
}
function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className={cn("font-mono tabular-nums truncate", tone)}>{value}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Quarter View — 3 month comparative blocks
// ───────────────────────────────────────────────────────────────────────────
function QuarterView({ buckets, fmt, onOpenMonth, recon }: {
  buckets: PeriodBucket[]; fmt: (n: number) => string; onOpenMonth: (d: Date) => void;
  recon: ReturnType<typeof reconstruct>;
}) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {buckets.map((b) => {
        const nwStart = netWorthAt(recon, addDays(b.start, -1))?.netWorth ?? 0;
        const nwEnd = netWorthAt(recon, addDays(b.end, -1))?.netWorth ?? nwStart;
        const delta = nwEnd - nwStart;
        return (
          <button key={b.key} onClick={() => onOpenMonth(b.start)}
            className="glass rounded-2xl p-5 text-left transition-all hover:border-cyan/40 hover:-translate-y-0.5">
            <div className="flex items-baseline justify-between">
              <div className="font-display text-xl font-semibold">{b.label}</div>
              <div className={cn("font-mono text-sm tabular-nums",
                delta >= 0 ? "text-success" : "text-destructive")}>
                {delta >= 0 ? "+" : ""}{fmt(delta)}
              </div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Net-worth delta</div>
            <div className="mt-4 space-y-2">
              <Bar label="Inflow" value={b.inflow} max={Math.max(b.inflow, b.outflow, 1)} tone="success" fmt={fmt} />
              <Bar label="Outflow" value={b.outflow} max={Math.max(b.inflow, b.outflow, 1)} tone="destructive" fmt={fmt} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <MiniStat label="Events" value={String(b.count)} tone="text-foreground" />
              <MiniStat label="Trades" value={String(b.trades)} tone="text-foreground" />
              <MiniStat label="Active" value={`${b.activeDays}d`} tone="text-cyan" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
function Bar({ label, value, max, tone, fmt }: { label: string; value: number; max: number; tone: "success" | "destructive"; fmt: (n: number) => string }) {
  const pct = Math.min(100, (value / max) * 100);
  const textCls = tone === "success" ? "text-success" : "text-destructive";
  const barCls = tone === "success" ? "bg-success/60" : "bg-destructive/60";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono tabular-nums", textCls)}>{fmt(value)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className={cn("h-full rounded-full", barCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Month Intelligence — heatmap grid + reconstructed equity curve
// ───────────────────────────────────────────────────────────────────────────
function MonthIntelligence({ anchor, days, fmt, recon, onPickDay }: {
  anchor: Date; days: PeriodBucket[]; fmt: (n: number) => string;
  recon: ReturnType<typeof reconstruct>; onPickDay: (k: string) => void;
}) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = dayKey(new Date());
  const dayByKey = new Map(days.map((d) => [d.key, d]));
  const maxAbsNet = Math.max(1, ...days.map((d) => Math.abs(d.net)));

  // Reconstructed net-worth series within the month
  const series = useMemo(() => {
    const s = monthStart, e = addMonths(s, 1);
    const out: { date: string; nw: number }[] = [];
    let lastNw = netWorthAt(recon, addDays(s, -1))?.netWorth ?? 0;
    for (let d = new Date(s); d < e; d = addDays(d, 1)) {
      const p = netWorthAt(recon, d);
      if (p) lastNw = p.netWorth;
      out.push({ date: dayKey(d), nw: lastNw });
    }
    return out;
  }, [monthStart, recon]);

  // top asset by abs flow
  const topAsset = useMemo(() => {
    const map = new Map<string, { sym: string; net: number }>();
    for (const d of days) for (const [id, v] of d.byAsset) {
      const cur = map.get(id) ?? { sym: v.symbol, net: 0 };
      cur.net += v.pnl; map.set(id, cur);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 4);
  }, [days]);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Heatmap */}
      <div className="lg:col-span-2 glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Daily flow heatmap</div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="h-2 w-3 rounded-sm" style={{ background: `color-mix(in oklab, var(--success) ${i * 18}%, transparent)` }} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-1">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="text-center md:text-left">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const b = dayByKey.get(k);
            const isToday = k === todayKey;
            const intensity = b ? Math.min(1, Math.abs(b.net) / maxAbsNet) : 0;
            const tone = b && b.net >= 0 ? "success" : "destructive";
            return (
              <button key={k} onClick={() => onPickDay(k)} disabled={!inMonth}
                className={cn(
                  "relative aspect-square md:aspect-[1.3/1] rounded-lg p-1.5 md:p-2 text-left border border-transparent transition-all",
                  "hover:border-cyan/40 focus:outline-none focus:ring-1 focus:ring-cyan/40",
                  !inMonth && "opacity-25 pointer-events-none",
                  isToday && "ring-1 ring-cyan/60",
                )}
                style={{
                  background: intensity > 0.03
                    ? `color-mix(in oklab, var(--${tone}) ${Math.round(intensity * 30)}%, transparent)`
                    : undefined,
                }}>
                <div className="flex items-start justify-between">
                  <span className={cn("text-xs font-mono", isToday && "text-cyan font-semibold")}>{d.getDate()}</span>
                  {b && b.count > 0 && (
                    <span className="text-[9px] font-mono text-muted-foreground hidden md:inline">{b.count}</span>
                  )}
                </div>
                {b && b.net !== 0 && (
                  <div className={cn("mt-auto text-[10px] font-mono tabular-nums truncate",
                    b.net >= 0 ? "text-success" : "text-destructive")}>
                    {b.net >= 0 ? "+" : ""}{fmt(b.net)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel: equity curve + top assets */}
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Net-worth evolution</div>
          <div className="h-32 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip {...chartTooltipProps} formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="nw" stroke="var(--cyan)" strokeWidth={1.5} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Top assets · realized flow</div>
          {topAsset.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No asset activity this month.</div>
          ) : (
            <ul className="space-y-1.5">
              {topAsset.map((a) => (
                <li key={a.sym} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{a.sym || "—"}</span>
                  <span className={cn("font-mono tabular-nums text-xs",
                    a.net >= 0 ? "text-success" : "text-destructive")}>
                    {a.net >= 0 ? "+" : ""}{fmt(a.net)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Week Tactical View
// ───────────────────────────────────────────────────────────────────────────
function WeekTactical({ days, fmt, onPickDay }: {
  days: PeriodBucket[]; fmt: (n: number) => string; onPickDay: (k: string) => void;
}) {
  const todayKey = dayKey(new Date());
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((b) => {
        const isToday = b.key === todayKey;
        return (
          <button key={b.key} onClick={() => onPickDay(b.key)}
            className={cn(
              "glass rounded-2xl p-4 text-left min-h-[170px] transition-all hover:border-cyan/40",
              isToday && "ring-1 ring-cyan/60",
            )}>
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.label}</div>
              <div className={cn("font-display text-lg font-semibold", isToday && "text-cyan")}>{b.start.getDate()}</div>
            </div>
            {b.count > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className={cn("text-sm font-mono tabular-nums", b.net >= 0 ? "text-success" : "text-destructive")}>
                  {b.net >= 0 ? "+" : ""}{fmt(b.net)}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>{b.count} event{b.count === 1 ? "" : "s"}</span>
                  {b.trades > 0 && <span className="flex items-center gap-0.5"><Repeat className="h-3 w-3" />{b.trades}</span>}
                </div>
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

// ───────────────────────────────────────────────────────────────────────────
// Day Detail
// ───────────────────────────────────────────────────────────────────────────
function DayDetail({ anchor, txs, accounts, assets, fmt }: {
  anchor: Date; txs: Transaction[]; accounts: any[]; assets: any[]; fmt: (n: number) => string;
}) {
  if (txs.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
        No financial activity recorded on {anchor.toLocaleDateString()}.
      </div>
    );
  }
  return (
    <div className="glass rounded-2xl p-5">
      <EventList txs={txs} accounts={accounts} assets={assets} fmt={fmt} />
    </div>
  );
}

function EventList({ txs, accounts, assets, fmt }: {
  txs: Transaction[]; accounts: any[]; assets: any[]; fmt: (n: number) => string;
}) {
  const acctName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const assetSym = (id: string | null) => assets.find((a) => a.id === id)?.symbol ?? "";
  const sorted = [...txs].sort((a, b) =>
    new Date(b.execution_timestamp).getTime() - new Date(a.execution_timestamp).getTime());
  return (
    <ul className="divide-y divide-border/40">
      {sorted.map((t) => {
        const positive = POS_TYPES.has(t.transaction_type);
        const negative = NEG_TYPES.has(t.transaction_type);
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
            <div className={cn("font-mono tabular-nums text-sm shrink-0", tone)}>
              {sign}{fmt(v)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
