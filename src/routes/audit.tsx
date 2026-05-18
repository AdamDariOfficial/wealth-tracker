import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserTable } from "@/hooks/use-user-table";
import { useAccounts } from "@/hooks/use-ledger";
import { RealtimeStatus } from "@/components/RealtimeStatus";
import { ShieldCheck, AlertTriangle, RotateCcw, Sliders } from "lucide-react";

export const Route = createFileRoute("/audit")({ component: AuditPage });

type AuditRow = {
  id: string; user_id: string; event_type: string;
  account_id: string | null; transaction_id: string | null;
  before_balance: number | null; after_balance: number | null; delta: number | null;
  source: string; message: string | null; metadata: Record<string, unknown>;
  created_at: string;
};

const EVENT_TYPES = ["all", "reconciliation", "reverse_transaction", "manual_adjustment", "failed_reconciliation"] as const;
const ICON: Record<string, typeof ShieldCheck> = {
  reconciliation: ShieldCheck, reverse_transaction: RotateCcw,
  manual_adjustment: Sliders, failed_reconciliation: AlertTriangle,
};
const TONE: Record<string, string> = {
  reconciliation: "text-cyan", reverse_transaction: "text-amber-400",
  manual_adjustment: "text-muted-foreground", failed_reconciliation: "text-destructive",
};

const PAGE_SIZE = 50;

function AuditPage() {
  const { rows, loading } = useUserTable<AuditRow>("audit_log", { col: "created_at", asc: false });
  const { rows: accounts } = useAccounts();
  const [event, setEvent] = useState<string>("all");
  const [acct, setAcct] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const acctName = (id: string | null) => id ? accounts.find((a) => a.id === id)?.name ?? "—" : "—";

  const filtered = useMemo(() => rows.filter((r) => {
    if (event !== "all" && r.event_type !== event) return false;
    if (acct !== "all" && r.account_id !== acct) return false;
    if (from && new Date(r.created_at) < new Date(from)) return false;
    if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
    return true;
  }), [rows, event, acct, from, to]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader title="Audit & Reconciliation" subtitle="Every balance change, reversal, and adjustment — with before/after values."
        action={<RealtimeStatus />} />

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        <Select value={event} onValueChange={(v) => { setEvent(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={acct} onValueChange={(v) => { setAcct(v); setPage(0); }}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="w-[160px]" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="w-[160px]" />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {loading && rows.length === 0 && <div className="text-center py-12 text-muted-foreground">Loading audit log…</div>}
        {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No audit events match your filters.</div>}
        {paged.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-4">Time</th>
                <th className="text-left">Event</th>
                <th className="text-left">Account</th>
                <th className="text-right">Before</th>
                <th className="text-right">After</th>
                <th className="text-right">Delta</th>
                <th className="text-left pl-3">Source</th>
                <th className="text-left pl-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const Icon = ICON[r.event_type] ?? ShieldCheck;
                const delta = Number(r.delta ?? 0);
                return (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="py-2 px-4 font-mono">{new Date(r.created_at).toLocaleString()}</td>
                    <td><span className={`inline-flex items-center gap-1.5 ${TONE[r.event_type] ?? ""}`}><Icon className="h-3 w-3" />{r.event_type.replace(/_/g, " ")}</span></td>
                    <td className="text-muted-foreground">{acctName(r.account_id)}</td>
                    <td className="text-right font-mono">{r.before_balance != null ? `$${Number(r.before_balance).toFixed(2)}` : "—"}</td>
                    <td className="text-right font-mono">{r.after_balance != null ? `$${Number(r.after_balance).toFixed(2)}` : "—"}</td>
                    <td className={`text-right font-mono ${delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(2)}
                    </td>
                    <td className="pl-3 text-muted-foreground uppercase text-[10px] tracking-wider">{r.source}</td>
                    <td className="pl-3 text-muted-foreground truncate max-w-[260px]">{r.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Page {page + 1} of {totalPages} · {filtered.length} events</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded glass disabled:opacity-30">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded glass disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}