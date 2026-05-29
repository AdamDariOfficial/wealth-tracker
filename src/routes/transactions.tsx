import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Filter, ArrowUpDown, Trash2, Download, X, Pencil } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useAssets, useTransactions, type Transaction } from "@/hooks/use-ledger";
import { TransactionModal } from "@/components/TransactionModal";
import { Modal } from "@/components/Modal";
import { reverseTransaction } from "@/lib/ledger-actions";
import { toast } from "sonner";
import { RealtimeStatus } from "@/components/RealtimeStatus";
import { toCsv, downloadCsv, csvDateStamp } from "@/lib/csv-export";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { FilterPresets } from "@/components/FilterPresets";

export const Route = createFileRoute("/transactions")({ component: TransactionsPage });

const TYPES = ["all", "deposit", "withdrawal", "transfer", "buy", "sell", "convert", "fee", "dividend", "interest", "staking_reward", "profit_realization", "manual_adjustment"];

type TxFilters = {
  q: string; type: string; acct: string; assetSym: string; currency: string;
  amountMin: string; amountMax: string; dateFrom: string; dateTo: string; sortAsc: boolean;
};

function TransactionsPage() {
  const { rows: txs } = useTransactions();
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const [open, setOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [acct, setAcct] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);

  const [debouncedQ, setDebouncedQ] = useState("");
  const [assetSym, setAssetSym] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 100;
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 200); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("q")) setQ(p.get("q") ?? "");
    if (p.get("type")) setType(p.get("type") ?? "all");
    if (p.get("acct")) setAcct(p.get("acct") ?? "all");
    if (p.get("currency")) setCurrency(p.get("currency") ?? "all");
    if (p.get("asset")) setAssetSym(p.get("asset") ?? "all");
    if (p.get("min")) setAmountMin(p.get("min") ?? "");
    if (p.get("max")) setAmountMax(p.get("max") ?? "");
    if (p.get("from")) setDateFrom(p.get("from") ?? "");
    if (p.get("to")) setDateTo(p.get("to") ?? "");
    if (p.get("sort") === "asc") setSortAsc(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (type !== "all") p.set("type", type);
    if (acct !== "all") p.set("acct", acct);
    if (currency !== "all") p.set("currency", currency);
    if (assetSym !== "all") p.set("asset", assetSym);
    if (amountMin) p.set("min", amountMin);
    if (amountMax) p.set("max", amountMax);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    if (sortAsc) p.set("sort", "asc");
    const qs = p.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }, [debouncedQ, type, acct, currency, assetSym, amountMin, amountMax, dateFrom, dateTo, sortAsc]);

  const acctName = (id: string | null) => id ? accounts.find((a) => a.id === id)?.name ?? "—" : "—";
  const assetSymOf = (id: string | null) => id ? assets.find((a) => a.id === id)?.symbol ?? "—" : "—";
  const acctOf = (id: string | null) => id ? accounts.find((a) => a.id === id) ?? null : null;
  const currencies = useMemo(() => Array.from(new Set(accounts.map((a) => a.currency))).sort(), [accounts]);
  const assetSymbols = useMemo(() => Array.from(new Set(assets.map((a) => a.symbol))).sort(), [assets]);

  const filtered = useMemo(() => {
    const out = txs.filter((t) => {
      if (type !== "all" && t.transaction_type !== type) return false;
      if (acct !== "all" && t.source_account_id !== acct && t.destination_account_id !== acct) return false;
      if (assetSym !== "all" && assetSymOf(t.asset_id) !== assetSym) return false;
      if (currency !== "all") {
        const src = acctOf(t.source_account_id)?.currency;
        const dst = acctOf(t.destination_account_id)?.currency;
        if (src !== currency && dst !== currency) return false;
      }
      const fiat = Number(t.fiat_value);
      if (amountMin && fiat < Number(amountMin)) return false;
      if (amountMax && fiat > Number(amountMax)) return false;
      if (dateFrom && new Date(t.execution_timestamp) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.execution_timestamp) > new Date(dateTo + "T23:59:59")) return false;
      if (debouncedQ) {
        const s = debouncedQ.toLowerCase();
        const blob = `${t.note ?? ""} ${assetSymOf(t.asset_id)} ${acctName(t.source_account_id)} ${acctName(t.destination_account_id)} ${(t.tags ?? []).join(" ")}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
    return out.sort((a, b) => {
      const da = +new Date(a.execution_timestamp), db = +new Date(b.execution_timestamp);
      return sortAsc ? da - db : db - da;
    });
  }, [txs, type, acct, assetSym, currency, amountMin, amountMax, dateFrom, dateTo, debouncedQ, accounts, assets, sortAsc]);

  const pageRows = useMemo(() => filtered.slice(page * PAGE, (page + 1) * PAGE), [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  useEffect(() => { if (page >= totalPages) setPage(0); }, [page, totalPages]);

  const resetFilters = () => {
    setQ(""); setType("all"); setAcct("all"); setCurrency("all"); setAssetSym("all");
    setAmountMin(""); setAmountMax(""); setDateFrom(""); setDateTo(""); setSortAsc(false); setPage(0);
  };

  const { presets, save: savePreset, remove: removePreset } = useFilterPresets<TxFilters>("transactions");
  const currentFilters: TxFilters = { q, type, acct, assetSym, currency, amountMin, amountMax, dateFrom, dateTo, sortAsc };
  const applyPreset = (v: TxFilters) => {
    setQ(v.q ?? ""); setType(v.type ?? "all"); setAcct(v.acct ?? "all");
    setAssetSym(v.assetSym ?? "all"); setCurrency(v.currency ?? "all");
    setAmountMin(v.amountMin ?? ""); setAmountMax(v.amountMax ?? "");
    setDateFrom(v.dateFrom ?? ""); setDateTo(v.dateTo ?? "");
    setSortAsc(!!v.sortAsc); setPage(0);
    toast.success("Preset applied");
  };

  const exportCsv = () => {
    const csv = toCsv(pageRows, [
      { key: "execution_timestamp", header: "timestamp", format: (r) => new Date(r.execution_timestamp).toISOString() },
      { key: "id", header: "transaction_id" },
      { key: "source_account_id", header: "from_account", format: (r) => acctName(r.source_account_id) },
      { key: "destination_account_id", header: "to_account", format: (r) => acctName(r.destination_account_id) },
      { key: "asset_id", header: "asset_symbol", format: (r) => assetSymOf(r.asset_id) },
      { key: "transaction_type", header: "transaction_type" },
      { key: "quantity", header: "quantity", format: (r) => String(r.quantity) },
      { key: "fiat_value", header: "amount", format: (r) => Number(r.fiat_value).toFixed(2) },
      { key: "destination_account_id", header: "currency", format: (r) => acctOf(r.destination_account_id)?.currency ?? acctOf(r.source_account_id)?.currency ?? "" },
      { key: "destination_account_id", header: "broker", format: (r) => acctOf(r.destination_account_id)?.provider ?? acctOf(r.source_account_id)?.provider ?? "" },
      { key: "fiat_value", header: "balance_delta", format: (r) => {
          const v = Number(r.fiat_value);
          if (["deposit","dividend","interest","staking_reward","profit_realization","sell"].includes(r.transaction_type)) return `+${v.toFixed(2)}`;
          if (["withdrawal","fee","buy"].includes(r.transaction_type)) return `-${v.toFixed(2)}`;
          return v.toFixed(2);
        }
      },
      { key: "fee_amount", header: "fee", format: (r) => Number(r.fee_amount).toFixed(2) },
      { key: "note", header: "notes", format: (r) => r.note ?? "" },
    ]);
    downloadCsv(`ledger-export-${csvDateStamp()}.csv`, csv);
    toast.success(`Exported ${pageRows.length} rows`);
  };

  const totals = useMemo(() => {
    let inflow = 0, outflow = 0;
    for (const t of filtered) {
      const v = Number(t.fiat_value);
      if (["deposit","dividend","interest","staking_reward","profit_realization","sell"].includes(t.transaction_type)) inflow += v;
      else if (["withdrawal","fee","buy"].includes(t.transaction_type)) outflow += v;
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [filtered]);

  const handleDelete = async () => {
    if (!detail) return;
    try {
      await reverseTransaction(detail.id, "Voided from transactions detail");
      toast.success("Transaction voided · balances reconciled");
      setDetail(null);
    } catch (e: any) { toast.error(e.message); }
  };
  const handleEdit = () => {
    if (!detail) return;
    setEditTx(detail);
    setDetail(null);
  };


  const activeFilterCount =
    (type !== "all" ? 1 : 0) +
    (acct !== "all" ? 1 : 0) +
    (assetSym !== "all" ? 1 : 0) +
    (currency !== "all" ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Transactions" subtitle="The full ledger of every movement of capital."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <RealtimeStatus />
            <Button variant="outline" size="sm" onClick={exportCsv} className="touch-target">
              <Download className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button size="sm" className="bg-cyan text-background hover:bg-cyan/90 touch-target" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">New transaction</span>
            </Button>
          </div>
        } />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="glass rounded-2xl p-3 sm:p-5">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Inflow</div>
          <div className="font-display text-stat-value font-semibold mt-1 sm:mt-2 text-success tabular-nums truncate">+${totals.inflow.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
        <div className="glass rounded-2xl p-3 sm:p-5">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Outflow</div>
          <div className="font-display text-stat-value font-semibold mt-1 sm:mt-2 text-destructive tabular-nums truncate">-${totals.outflow.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
        <div className="glass rounded-2xl p-3 sm:p-5">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Net</div>
          <div className="font-display text-stat-value font-semibold mt-1 sm:mt-2 text-cyan tabular-nums truncate">${totals.net.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-3 sm:p-5">
        {/* Mobile-condensed filter bar */}
        <div className="flex items-center gap-2 mb-3 sm:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-10" />
          </div>
          <Button variant="outline" size="sm" className="h-10 touch-target relative" onClick={() => setFiltersOpen(true)}>
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-cyan text-background text-[10px] font-semibold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="h-10 touch-target" onClick={() => setSortAsc((s) => !s)} title="Sort">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop / tablet filter bar */}
        <div className="hidden sm:flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search note, asset, account…" className="pl-9" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={acct} onValueChange={setAcct}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assetSym} onValueChange={setAssetSym}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Asset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assets</SelectItem>
              {assetSymbols.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Currency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ccy</SelectItem>
              {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Min $" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="w-[100px]" />
          <Input type="number" placeholder="Max $" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="w-[100px]" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs"><X className="h-3 w-3 mr-1" /> Reset</Button>
          <FilterPresets
            presets={presets}
            onApply={applyPreset}
            onSave={(name) => { savePreset(name, currentFilters); toast.success("Preset saved"); }}
            onDelete={removePreset}
          />
        </div>

        {/* Desktop / tablet analytical table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2">
                  <button onClick={() => setSortAsc((s) => !s)} className="inline-flex items-center gap-1 hover:text-cyan">
                    Timestamp <ArrowUpDown className="h-3 w-3" />
                    <span className="text-[9px]">{sortAsc ? "↑" : "↓"}</span>
                  </button>
                </th>
                <th className="text-left">Type</th>
                <th className="text-left">From</th>
                <th className="text-left">To</th>
                <th className="text-left">Asset</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Fiat</th>
                <th className="text-right">Fee</th>
                <th className="text-left pl-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <tr key={t.id} onClick={() => setDetail(t)} className="border-t border-white/5 hover:bg-white/[0.04] cursor-pointer">
                  <td className="py-2 font-mono">{new Date(t.execution_timestamp).toLocaleString()}</td>
                  <td>{t.transaction_type}</td>
                  <td className="text-muted-foreground">{acctName(t.source_account_id)}</td>
                  <td className="text-muted-foreground">{acctName(t.destination_account_id)}</td>
                  <td>{assetSymOf(t.asset_id)}</td>
                  <td className="text-right font-mono">{Number(t.quantity).toLocaleString(undefined,{maximumFractionDigits:6})}</td>
                  <td className="text-right font-mono">${Number(t.fiat_value).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                  <td className="text-right font-mono text-muted-foreground">{Number(t.fee_amount) ? `$${Number(t.fee_amount).toFixed(2)}` : "—"}</td>
                  <td className="pl-3 text-muted-foreground truncate max-w-[200px]">{t.note}</td>
                </tr>
              ))}
              {pageRows.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No transactions match.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile / small-tablet card stack */}
        <div className="md:hidden space-y-2">
          {pageRows.map((t) => {
            const inflow = ["deposit","dividend","interest","staking_reward","profit_realization","sell"].includes(t.transaction_type);
            const outflow = ["withdrawal","fee","buy"].includes(t.transaction_type);
            return (
              <button
                key={t.id}
                onClick={() => setDetail(t)}
                className="w-full text-left rounded-xl border border-border/40 bg-white/[0.02] active:bg-white/[0.06] transition-colors p-3 touch-target"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                        {t.transaction_type}
                      </span>
                      {assetSymOf(t.asset_id) !== "—" && (
                        <span className="text-xs font-semibold">{assetSymOf(t.asset_id)}</span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground truncate">
                      {acctName(t.source_account_id)} {t.destination_account_id ? `→ ${acctName(t.destination_account_id)}` : ""}
                    </div>
                    {t.note && <div className="mt-1 text-xs text-muted-foreground/80 truncate">{t.note}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      inflow && "text-success",
                      outflow && "text-destructive",
                      !inflow && !outflow && "text-foreground"
                    )}>
                      {inflow ? "+" : outflow ? "-" : ""}${Number(t.fiat_value).toLocaleString(undefined,{maximumFractionDigits:2})}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {new Date(t.execution_timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {pageRows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No transactions match.</div>
          )}
        </div>

        {filtered.length > PAGE && (
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Page {page + 1} of {totalPages} · {filtered.length} entries</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="flex-1 sm:flex-none px-4 py-2 rounded glass disabled:opacity-30 touch-target">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex-1 sm:flex-none px-4 py-2 rounded glass disabled:opacity-30 touch-target">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile filter sheet */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { resetFilters(); }} className="touch-target">Reset</Button>
            <Button onClick={() => setFiltersOpen(false)} className="bg-cyan text-background hover:bg-cyan/90 touch-target">Apply</Button>
          </>
        }>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</label>
            <Select value={acct} onValueChange={setAcct}>
              <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Asset</label>
              <Select value={assetSym} onValueChange={setAssetSym}>
                <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {assetSymbols.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min $</label>
              <Input type="number" inputMode="decimal" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="mt-1 h-11" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max $</label>
              <Input type="number" inputMode="decimal" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="mt-1 h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 h-11" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 h-11" />
            </div>
          </div>
          <div className="pt-2">
            <FilterPresets
              presets={presets}
              onApply={(v) => { applyPreset(v); setFiltersOpen(false); }}
              onSave={(name) => { savePreset(name, currentFilters); toast.success("Preset saved"); }}
              onDelete={removePreset}
            />
          </div>
        </div>
      </Modal>


      <TransactionModal open={open} onClose={() => setOpen(false)} />
      <TransactionModal open={!!editTx} onClose={() => setEditTx(null)} edit={editTx} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Transaction detail"
        footer={detail && (
          <>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            <Button variant="outline" onClick={handleEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5 mr-1" /> Void & reconcile</Button>
          </>
        )}>

        {detail && (
          <div className="space-y-2 text-xs font-mono">
            {([
              ["ID", detail.id],
              ["Type", detail.transaction_type],
              ["Timestamp", new Date(detail.execution_timestamp).toLocaleString()],
              ["Created", new Date(detail.created_at).toLocaleString()],
              ["Source", acctName(detail.source_account_id)],
              ["Destination", acctName(detail.destination_account_id)],
              ["Asset", assetSymOf(detail.asset_id)],
              ["Quantity", String(detail.quantity)],
              ["Fiat value", `$${Number(detail.fiat_value).toFixed(2)}`],
              ["Fee", `$${Number(detail.fee_amount).toFixed(2)}`],
              ["Exchange rate", detail.exchange_rate?.toString() ?? "—"],
              ["Tags", detail.tags?.join(", ") || "—"],
              ["Note", detail.note ?? "—"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border/30 py-1.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{k}</span>
                <span className="text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
