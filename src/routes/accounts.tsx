import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Wallet, Building2, Bitcoin, Briefcase, Landmark, HardDrive, PiggyBank,
  Eye, EyeOff, Archive, Star, StarOff, Rows, Grid3x3,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccounts, useHoldings, type Account } from "@/hooks/use-ledger";
import { useMoneyFormatter } from "@/lib/format-currency";
import { useUI } from "@/lib/ui-store";
import { AccountFormModal } from "@/components/AccountFormModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

const ICONS: Record<Account["type"], any> = {
  bank: Landmark, exchange: Building2, broker: Briefcase, crypto_wallet: Bitcoin,
  cold_wallet: HardDrive, cash: Wallet, savings: PiggyBank, investment: Building2, external: Wallet,
};

const TYPE_LABEL: Record<Account["type"], string> = {
  bank: "Bank", exchange: "Exchange", broker: "Broker", crypto_wallet: "Crypto Wallet",
  cold_wallet: "Cold Wallet", cash: "Cash", savings: "Savings", investment: "Investment", external: "External",
};

const PIN_KEY = "wt:pinned-accounts";

function loadPinned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]")); }
  catch { return new Set(); }
}

function AccountsPage() {
  const { rows: accounts, loading, update } = useAccounts();
  const { accountValue, totals } = useHoldings();
  const { openTxModal } = useUI();
  const fmt = useMoneyFormatter();
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());

  useEffect(() => { setPinned(loadPinned()); }, []);
  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(PIN_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => (showArchived ? true : !a.archived_at))
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.provider ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const ap = pinned.has(a.id) ? 0 : 1;
        const bp = pinned.has(b.id) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.name.localeCompare(b.name);
      });
  }, [accounts, query, pinned, showArchived]);

  const archiveToggle = async (a: Account) => {
    try {
      await update(a.id, { archived_at: a.archived_at ? null : new Date().toISOString() });
      toast.success(a.archived_at ? "Restored" : "Archived");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liquidity & Accounts"
        subtitle="Every container of capital — banks, brokers, wallets, vaults."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openTxModal({ type: "transfer" })}>
              <ArrowLeftRight className="h-4 w-4 mr-1.5" /> Transfer
            </Button>
            <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New account
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Net Worth</div>
            <div className="font-display text-4xl font-bold mt-3 text-gradient-cyan">{fmt(totals.netWorth)}</div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Liquid</div>
          <div className="font-display text-3xl font-semibold mt-3">{fmt(totals.liquid)}</div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Invested</div>
          <div className="font-display text-3xl font-semibold mt-3">{fmt(totals.invested)}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <Input
          placeholder="Search accounts, providers…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          className="md:w-72"
        />
        <div className="flex gap-2 text-xs">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCompact((c) => !c)}>
            {compact ? <Grid3x3 className="h-3.5 w-3.5 mr-1.5" /> : <Rows className="h-3.5 w-3.5 mr-1.5" />}
            {compact ? "Cards" : "Compact"}
          </Button>
        </div>
      </div>

      {loading && <div className="text-muted-foreground text-center py-8">Loading…</div>}
      {!loading && visible.length === 0 && (
        <div className="text-muted-foreground text-center py-12">
          No accounts — add your first bank, exchange or wallet.
        </div>
      )}

      {!loading && visible.length > 0 && (
        compact
          ? <CompactList accounts={visible} pinned={pinned} togglePin={togglePin}
              accountValue={accountValue} fmt={fmt} openTxModal={openTxModal}
              setEditAccount={setEditAccount} archiveToggle={archiveToggle} />
          : <CardGrid accounts={visible} pinned={pinned} togglePin={togglePin}
              accountValue={accountValue} fmt={fmt} openTxModal={openTxModal}
              setEditAccount={setEditAccount} archiveToggle={archiveToggle} />
      )}

      <AccountFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AccountFormModal open={!!editAccount} onClose={() => setEditAccount(null)} edit={editAccount} />
    </div>
  );
}

type ListProps = {
  accounts: Account[];
  pinned: Set<string>;
  togglePin: (id: string) => void;
  accountValue: Map<string, number>;
  fmt: (n: number) => string;
  openTxModal: (d: any) => void;
  setEditAccount: (a: Account) => void;
  archiveToggle: (a: Account) => void;
};

function QuickActions({ id, openTxModal }: { id: string; openTxModal: (d: any) => void }) {
  return (
    <div className="flex gap-1">
      <button title="Deposit" onClick={(e) => { e.preventDefault(); openTxModal({ type: "deposit", accountId: id }); }}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-success/10 text-success/80 hover:text-success">
        <ArrowDownToLine className="h-3.5 w-3.5" />
      </button>
      <button title="Withdraw" onClick={(e) => { e.preventDefault(); openTxModal({ type: "withdrawal", accountId: id }); }}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive/80 hover:text-destructive">
        <ArrowUpFromLine className="h-3.5 w-3.5" />
      </button>
      <button title="Transfer" onClick={(e) => { e.preventDefault(); openTxModal({ type: "transfer", accountId: id }); }}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-cyan/10 text-cyan/80 hover:text-cyan">
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CardGrid({ accounts, pinned, togglePin, accountValue, fmt, openTxModal, setEditAccount, archiveToggle }: ListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((a) => {
        const Icon = ICONS[a.type] ?? Wallet;
        const value = accountValue.get(a.id) ?? Number(a.current_balance);
        const isPinned = pinned.has(a.id);
        return (
          <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn("glass rounded-2xl p-5 group relative", a.archived_at && "opacity-60")}>
            <button
              className="absolute top-3 right-3 opacity-60 hover:opacity-100"
              onClick={() => togglePin(a.id)}
              title={isPinned ? "Unpin" : "Pin to top"}
            >
              {isPinned ? <Star className="h-3.5 w-3.5 fill-cyan text-cyan" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            <Link to="/accounts/$id" params={{ id: a.id }} className="flex items-center gap-3 pr-6">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${a.color}22`, color: a.color ?? undefined }}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold truncate">{a.name}</h3>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">
                  {TYPE_LABEL[a.type]} · {a.currency}{a.provider ? ` · ${a.provider}` : ""}
                </div>
              </div>
            </Link>
            <div className="font-display text-2xl font-semibold mt-4 text-cyan">{fmt(value)}</div>
            <div className="mt-3 flex justify-between items-center">
              <QuickActions id={a.id} openTxModal={openTxModal} />
              <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditAccount(a)} title="Edit">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => archiveToggle(a)} title={a.archived_at ? "Restore" : "Archive"}>
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function CompactList({ accounts, pinned, togglePin, accountValue, fmt, openTxModal, setEditAccount, archiveToggle }: ListProps) {
  return (
    <div className="glass rounded-2xl overflow-hidden divide-y divide-border/30">
      {accounts.map((a) => {
        const Icon = ICONS[a.type] ?? Wallet;
        const value = accountValue.get(a.id) ?? Number(a.current_balance);
        const isPinned = pinned.has(a.id);
        return (
          <div key={a.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]", a.archived_at && "opacity-60")}>
            <button onClick={() => togglePin(a.id)} className="shrink-0">
              {isPinned ? <Star className="h-3.5 w-3.5 fill-cyan text-cyan" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground/60" />}
            </button>
            <Link to="/accounts/$id" params={{ id: a.id }} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}22`, color: a.color ?? undefined }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {TYPE_LABEL[a.type]} · {a.currency}{a.provider ? ` · ${a.provider}` : ""}
                </div>
              </div>
            </Link>
            <div className="font-mono font-semibold text-cyan text-sm shrink-0">{fmt(value)}</div>
            <QuickActions id={a.id} openTxModal={openTxModal} />
            <Button variant="ghost" size="icon" onClick={() => archiveToggle(a)}>
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
