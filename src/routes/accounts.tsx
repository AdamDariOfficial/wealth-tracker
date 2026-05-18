import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Plus, Wallet, Building2, Bitcoin, Briefcase, Landmark, HardDrive, PiggyBank, Eye, EyeOff, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, useHoldings, type Account } from "@/hooks/use-ledger";
import { TransactionModal } from "@/components/TransactionModal";
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

function AccountsPage() {
  const { rows: accounts, loading, insert, update, remove } = useAccounts();
  const { accountValue, totals } = useHoldings();
  const [open, setOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; type: Account["type"]; provider: string; currency: string; description: string }>({
    name: "", type: "bank", provider: "", currency: "USD", description: "",
  });

  const visible = useMemo(() => accounts.filter((a) => !a.archived_at), [accounts]);

  const submit = async () => {
    try {
      await insert({ ...form });
      toast.success("Account created");
      setOpen(false);
      setForm({ name: "", type: "bank", provider: "", currency: "USD", description: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Liquidity & Accounts" subtitle="Every container of capital — banks, brokers, wallets, vaults."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTxOpen(true)}><Plus className="h-4 w-4 mr-1" /> Transaction</Button>
            <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New account</Button>
          </div>
        } />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Net Worth</div>
            <div className="font-display text-4xl font-bold mt-3 text-gradient-cyan">${totals.netWorth.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Liquid</div>
          <div className="font-display text-3xl font-semibold mt-3">${totals.liquid.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Invested</div>
          <div className="font-display text-3xl font-semibold mt-3">${totals.invested.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div className="text-muted-foreground col-span-full text-center py-8">Loading…</div>}
        {!loading && visible.length === 0 && (
          <div className="text-muted-foreground col-span-full text-center py-12">
            No accounts yet — add your first bank, exchange or wallet.
          </div>
        )}
        {visible.map((a) => {
          const Icon = ICONS[a.type] ?? Wallet;
          const value = accountValue.get(a.id) ?? Number(a.current_balance);
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 group">
              <div className="flex justify-between items-start">
                <Link to="/accounts/$id" params={{ id: a.id }} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${a.color}22`, color: a.color ?? undefined }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">{a.name}</h3>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{TYPE_LABEL[a.type]} · {a.currency}</div>
                  </div>
                </Link>
                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => update(a.id, { include_in_net_worth: !a.include_in_net_worth })} title="Toggle in net worth">
                    {a.include_in_net_worth ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
              <div className="font-display text-2xl font-semibold mt-4 text-cyan">
                ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
            </motion.div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New account"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>Create</Button></>}>
        <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Main Bank, Binance, Ledger…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Account["type"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="mt-1" /></div>
        </div>
        <div><Label className="text-xs">Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="mt-1" placeholder="Revolut, Kraken, Phantom…" /></div>
        <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
      </Modal>

      <TransactionModal open={txOpen} onClose={() => setTxOpen(false)} />
    </div>
  );
}
