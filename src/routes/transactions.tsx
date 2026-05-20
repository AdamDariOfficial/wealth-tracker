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
      await reverseTransaction(detail.id);
      toast.success("Transaction deleted; balances reconciled");
      setDetail(null);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" subtitle="The full ledger of every movement of capital."
        action={
          <div className="flex items-center gap-2">
            <RealtimeStatus />
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New transaction</Button>
          </div>
        } />

      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Inflow</div><div className="font-display text-2xl font-semibold mt-2 text-success">+${totals.inflow.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
        <div className="glass rounded-2xl p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Outflow</div><div className="font-display text-2xl font-semibold mt-2 text-destructive">-${totals.outflow.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
        <div className="glass rounded-2xl p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Net</div><div className="font-display text-2xl font-semibold mt-2 text-cyan">${totals.net.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap gap-2 mb-4">
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

        <div className="overflow-x-auto">
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
        {filtered.length > PAGE && (
          <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
            <span>Page {page + 1} of {totalPages} · {filtered.length} entries · exporting visible page</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded glass disabled:opacity-30">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded glass disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      <TransactionModal open={open} onClose={() => setOpen(false)} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Transaction detail"
        footer={detail && (
          <>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete & reconcile</Button>
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
