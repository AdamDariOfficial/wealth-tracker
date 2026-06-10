import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useUI } from "@/lib/ui-store";
import { useAccounts, useAssets } from "@/hooks/use-ledger";
import { useUserTable } from "@/hooks/use-user-table";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, Activity, ShieldCheck,
  TrendingUp, PieChart, Bitcoin, Briefcase, Target, BarChart3, Settings,
  Plus, ArrowDownToLine, ArrowUpFromLine, Repeat, FlaskConical, Upload,
} from "lucide-react";

type Goal = { id: string; name: string };

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const toggle = useUI((s) => s.togglePalette);
  const openTxModal = useUI((s) => s.openTxModal);
  const navigate = useNavigate();
  const nav = (to: string) => navigate({ to } as never);
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const { rows: goals } = useUserTable<Goal>("goals", { col: "name", asc: true });

  // Global Cmd/Ctrl + K binding
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const run = (fn: () => void) => { toggle(false); setTimeout(fn, 0); };

  const navItems = useMemo(() => ([
    { label: "Dashboard", to: "/", icon: LayoutDashboard },
    { label: "Liquidity & Accounts", to: "/accounts", icon: Wallet },
    { label: "Transactions", to: "/transactions", icon: ArrowLeftRight },
    { label: "Import Data", to: "/import", icon: Upload },
    { label: "Activity", to: "/activity", icon: Activity },
    { label: "Timeline", to: "/timeline", icon: Activity },
    { label: "Audit Log", to: "/audit", icon: ShieldCheck },
    { label: "Investments", to: "/investments", icon: TrendingUp },
    { label: "ETF Tracker", to: "/etf", icon: PieChart },
    { label: "Crypto", to: "/crypto", icon: Bitcoin },
    { label: "Trading Workspace", to: "/trading", icon: Briefcase },
    { label: "Goals", to: "/goals", icon: Target },
    { label: "Analytics", to: "/analytics", icon: BarChart3 },
    { label: "Settings", to: "/settings", icon: Settings },
    { label: "Dev Tools", to: "/dev-tools", icon: FlaskConical },
  ]), []);

  return (
    <CommandDialog open={open} onOpenChange={(o) => toggle(o)}>
      <CommandInput placeholder="Search or type a command…  ⌘K" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => run(() => openTxModal({ type: "deposit" }))}>
            <ArrowDownToLine /> Record deposit
          </CommandItem>
          <CommandItem onSelect={() => run(() => openTxModal({ type: "withdrawal" }))}>
            <ArrowUpFromLine /> Record withdrawal
          </CommandItem>
          <CommandItem onSelect={() => run(() => openTxModal({ type: "transfer" }))}>
            <Repeat /> Transfer funds
          </CommandItem>
          <CommandItem onSelect={() => run(() => openTxModal({ type: "buy" }))}>
            <Plus /> Buy asset
          </CommandItem>
          <CommandItem onSelect={() => run(() => openTxModal({ type: "sell" }))}>
            <Plus /> Sell asset
          </CommandItem>
          <CommandItem onSelect={() => run(() => nav("/import"))}>
            <Upload /> Import transactions
          </CommandItem>
          <CommandItem onSelect={() => run(() => nav("/trading"))}>
            <Briefcase /> Open trading workspace
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {navItems.map((n) => (
            <CommandItem key={n.to} onSelect={() => run(() => nav(n.to))}>
              <n.icon /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Accounts">
              {accounts.slice(0, 20).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`account ${a.name} ${a.type} ${a.provider ?? ""}`}
                  onSelect={() => run(() => navigate({ to: "/accounts/$id", params: { id: a.id } } as never))}
                >
                  <Wallet /> {a.name}
                  <span className="ml-auto text-xs text-muted-foreground">{a.currency}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {assets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Assets">
              {assets.slice(0, 20).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`asset ${a.symbol} ${a.name}`}
                  onSelect={() => run(() => navigate({ to: "/transactions", search: { asset: a.symbol } } as never))}
                >
                  <TrendingUp /> {a.symbol}
                  <span className="ml-auto text-xs text-muted-foreground">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {goals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Goals">
              {goals.slice(0, 10).map((g) => (
                <CommandItem
                  key={g.id}
                  value={`goal ${g.name}`}
                  onSelect={() => run(() => nav("/goals"))}
                >
                  <Target /> {g.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
