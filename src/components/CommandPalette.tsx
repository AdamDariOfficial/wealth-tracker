import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  PieChart,
  Settings,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
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
  const navigate = useNavigate();
  const financial = useFinancialState();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        togglePalette(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === "Escape" && open) {
        togglePalette(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, togglePalette]);

  const run = (action: () => void) => {
    setQuery("");
    togglePalette(false);
    window.setTimeout(action, 0);
  };

  const visibleAccounts =
    financial.data?.accounts.filter((account) => account.ownership !== "system").slice(0, 20) ?? [];

  return (
    <Command className="w-full max-w-2xl overflow-visible rounded-xl bg-transparent [&_[cmdk-input-wrapper]]:h-10 [&_[cmdk-input-wrapper]]:rounded-xl [&_[cmdk-input-wrapper]]:border [&_[cmdk-input-wrapper]]:border-border/55 [&_[cmdk-input-wrapper]]:bg-card/45 [&_[cmdk-input-wrapper]]:px-3 [&_[cmdk-input-wrapper]]:transition-colors focus-within:[&_[cmdk-input-wrapper]]:border-cyan/35 focus-within:[&_[cmdk-input-wrapper]]:bg-card/65">
      <Popover open={open} onOpenChange={(next) => togglePalette(next)}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative w-full">
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                togglePalette(true);
              }}
              onFocus={() => togglePalette(true)}
              placeholder="Search or navigate…"
              className="h-10 pr-14 text-sm"
              aria-label="Search and navigate"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="center"
          side="bottom"
          sideOffset={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          className="w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/70 bg-popover/98 p-1 shadow-2xl backdrop-blur-xl"
        >
          <CommandList className="max-h-[min(65vh,520px)]">
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Navigate">
              {navigation.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`navigate ${item.label}`}
                  onSelect={() => run(() => navigate({ to: item.to }))}
                  className="min-h-11 rounded-xl px-3"
                >
                  <item.icon />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {visibleAccounts.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Accounts">
                  {visibleAccounts.map((account) => (
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
                      className="min-h-11 rounded-xl px-3"
                    >
                      <Wallet />
                      <span className="truncate">{account.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{account.kind}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  );
}
