import { Card } from "@/components/ui/card";
import { Plus, Wallet, Coins, Target, ArrowDownToLine, Repeat, TrendingUp, TrendingDown } from "lucide-react";

export type QuickAction =
  | { kind: "open-account" } | { kind: "open-asset" } | { kind: "open-goal" }
  | { kind: "deposit" } | { kind: "transfer" } | { kind: "buy" } | { kind: "sell" };

const CARDS: { id: QuickAction["kind"]; label: string; hint: string; icon: React.ReactNode; tone: string }[] = [
  { id: "open-account", label: "Opening Account", hint: "Set starting balance", icon: <Wallet className="h-4 w-4" />, tone: "text-muted-foreground" },
  { id: "open-asset",   label: "Opening Position", hint: "Pre-existing holding", icon: <Coins className="h-4 w-4" />, tone: "text-muted-foreground" },
  { id: "open-goal",    label: "Create Goal", hint: "Define a target", icon: <Target className="h-4 w-4" />, tone: "text-cyan" },
  { id: "deposit",      label: "Deposit", hint: "+amount to account", icon: <ArrowDownToLine className="h-4 w-4" />, tone: "text-success" },
  { id: "transfer",     label: "Transfer", hint: "Account → account", icon: <Repeat className="h-4 w-4" />, tone: "text-cyan" },
  { id: "buy",          label: "Buy Asset", hint: "BUY qty asset @ price", icon: <TrendingUp className="h-4 w-4" />, tone: "text-success" },
  { id: "sell",         label: "Sell Asset", hint: "SELL qty asset @ price", icon: <TrendingDown className="h-4 w-4" />, tone: "text-warning" },
];

export function QuickActions({ onPick }: { onPick: (a: QuickAction["kind"]) => void }) {
  return (
    <Card className="glass p-4">
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Plus className="h-4 w-4 text-cyan" /> Quick Add
        <span className="text-[11px] text-muted-foreground font-normal ml-2">Generates valid syntax and inserts it into the editor</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {CARDS.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className="text-left rounded-md border border-border/40 bg-card/40 hover:bg-card/70 hover:border-cyan/40 transition p-3 group"
          >
            <div className={`mb-1 ${c.tone}`}>{c.icon}</div>
            <div className="text-xs font-semibold leading-tight">{c.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{c.hint}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}
