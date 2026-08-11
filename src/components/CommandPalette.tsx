import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  LineChart,
  PackagePlus,
  PieChart,
  Plus,
  Settings,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useCoreUI } from "@/lib/core-ui-store";

const navigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Portfolio", to: "/investments", icon: PieChart },
  { label: "Accounts", to: "/accounts", icon: Wallet },
  { label: "Transactions", to: "/transactions", icon: ArrowLeftRight },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Import", to: "/import", icon: Upload },
  { label: "Trading", to: "/trading", icon: Briefcase },
  { label: "Goals", to: "/goals", icon: Target },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function CommandPalette() {
  const open = useCoreUI((state) => state.paletteOpen);
  const togglePalette = useCoreUI((state) => state.togglePalette);
  const openComposer = useCoreUI((state) => state.openComposer);
  const navigate = useNavigate();
  const financial = useFinancialState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePalette]);

  const run = (action: () => void) => {
    togglePalette(false);
    window.setTimeout(action, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={(nextOpen) => togglePalette(nextOpen)}>
      <DialogTitle className="sr-only">Nebula command palette</DialogTitle>
      <DialogDescription className="sr-only">
        Jump to a section or create something new.
      </DialogDescription>
      <CommandInput placeholder="Search or run a command…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => run(() => openComposer("transaction"))}>
            <Plus /> Post transaction
          </CommandItem>
          <CommandItem onSelect={() => run(() => openComposer("account"))}>
            <Wallet /> Create account
          </CommandItem>
          <CommandItem onSelect={() => run(() => openComposer("asset"))}>
            <PackagePlus /> Create asset
          </CommandItem>
          <CommandItem onSelect={() => run(() => openComposer("market-data"))}>
            <LineChart /> Add market data
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {navigation.map((item) => (
            <CommandItem key={item.to} onSelect={() => run(() => navigate({ to: item.to }))}>
              <item.icon /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {financial.data && financial.data.accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Accounts">
              {financial.data.accounts.slice(0, 20).map((account) => (
                <CommandItem
                  key={account.id}
                  value={`account ${account.name} ${account.kind}`}
                  onSelect={() =>
                    run(() =>
                      navigate({
                        to: "/accounts/$id",
                        params: { id: account.id },
                        search: { q: "", archived: false, edit: false },
                      }),
                    )
                  }
                >
                  <Wallet />
                  {account.name}
                  <span className="ml-auto text-xs text-muted-foreground">{account.kind}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
